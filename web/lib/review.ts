// The admin review queue: pending garments, which an admin publishes (once
// they have a model, per SCHEMA.md's publishing rules) or rejects, and open
// correction suggestions, which an admin accepts or dismisses. Everything is
// read fresh per request; changes call updateTag, so they run from server
// actions.
import { ObjectId } from "mongodb";
import { updateTag } from "next/cache";
import { garments, suggestions, users } from "@/lib/db";
import {
  articleCode,
  garmentFields,
  garmentTitle,
} from "@/lib/garment-display";
import { getSuggestionFields } from "@/lib/suggestions";
import { nodeHref } from "@/lib/tree";
import { getVocabulary } from "@/lib/vocabulary";
import type { Suggestion } from "@/types";

// Fields a garment needs before it's complete; procedure, process and
// extras can rightly be empty.
const REQUIRED = new Set([
  "type",
  "gender",
  "model",
  "material",
  "color",
  "category",
]);

export type ReviewCell = {
  label: string;
  value: string;
  // Why the cell needs attention ("blocking" stops publishing), or null.
  problem: { text: string; blocking: boolean } | null;
  // What the retailer wrote, when the pipeline couldn't match it.
  hint: string | null;
};

// Pending garments, oldest first, laid out for the queue: all their photos,
// and a cell per field (plus the article code and source) marking what's
// missing or couldn't be matched. Reasons the pipeline recorded that aren't
// about one field, and its own notes, come separately.
export async function getPendingGarments() {
  const [vocab, pending] = await Promise.all([
    getVocabulary(),
    garments.find({ status: "pending" }).sort({ createdAt: 1 }).toArray(),
  ]);
  return pending.map((g) => {
    const review = g.ingest?.review;
    // The pipeline's reasons, by field where they're about one.
    const hints = new Map<string, string>();
    const notes: string[] = [];
    for (const reason of review?.reasons ?? []) {
      const colon = reason.indexOf(":");
      const kind = colon < 0 ? reason : reason.slice(0, colon);
      const detail = colon < 0 ? "" : reason.slice(colon + 1);
      if (kind === "unknown_vocab") {
        const [field, value] = detail.split("=");
        hints.set(field, `Retailer wrote: ${value}`);
      } else if (kind === "code_unparseable") {
        hints.set("code", `Couldn’t read: ${detail}`);
      } else if (kind === "unknown_category") {
        hints.set("category", "Retailer’s category didn’t match");
      } else if (kind === "llm_low_confidence") {
        notes.push(`Low confidence (${detail})`);
      } else if (kind !== "missing" && kind !== "title_unformatted") {
        notes.push(reason);
      }
    }
    if (review?.llm?.notes) notes.push(review.llm.notes);

    const cells: ReviewCell[] = garmentFields(g, vocab).map(
      ({ field, label, value }) => ({
        label,
        value,
        problem:
          field === "model" && !value
            ? { text: "Needed to publish", blocking: true }
            : REQUIRED.has(field) && !value
              ? { text: "Empty", blocking: false }
              : null,
        hint: hints.get(field) ?? null,
      }),
    );
    const [line1, line2] = articleCode(g, vocab);
    const codeHint = hints.get("code") ?? null;
    cells.push(
      {
        label: "Article code",
        value: [line1, line2].filter(Boolean).join(" "),
        problem: codeHint ? { text: "Not read", blocking: false } : null,
        hint: codeHint,
      },
      {
        label: "Listed as",
        value: review?.fields?.title?.value ?? "",
        problem: null,
        hint: null,
      },
    );

    return {
      id: g._id.toString(),
      // Without a model or override there's no title yet, so the listing's
      // stands in.
      title:
        g.model || g.overrideTitle
          ? garmentTitle(g, vocab)
          : (review?.fields?.title?.value ?? "Untitled"),
      images: g.images.map((i) => i.url),
      cells,
      notes,
      source: g.source,
      hasModel: !!g.model,
    };
  });
}

// Publishes or rejects a pending garment. Publishing needs a model; the
// result is null on success, or why it didn't happen.
export async function setGarmentStatus(
  id: string,
  status: "published" | "rejected",
) {
  const _id = new ObjectId(id);
  const garment = await garments.findOne({ _id, status: "pending" });
  if (!garment) return "It’s no longer pending.";
  if (status === "published" && !garment.model) {
    return "Add a model before publishing.";
  }
  const now = new Date();
  await garments.updateOne(
    { _id },
    { $set: { status, updatedAt: now, "ingest.humanReviewedAt": now } },
  );
  updateTag("garments");
  return null;
}

// Where each kind of suggestion target lives on the site.
const PAGES: Record<Suggestion["target"]["collection"], string> = {
  garments: "/garment",
  models: "/model",
  categories: "/category",
  materials: "/material",
  colors: "/color",
};

// Open suggestions, oldest first, each with what it's about (the target's
// title or name, linking to its page), the field's name, and who sent it.
// Garment suggestions can be applied in the garment editor.
export async function getOpenSuggestions() {
  const open = await suggestions
    .find({ status: "open" })
    .sort({ createdAt: 1 })
    .toArray();
  const [fields, people] = await Promise.all([
    Promise.all(open.map((s) => getSuggestionFields(s.target))),
    users.find({ userId: { $in: open.map((s) => s.userId) } }).toArray(),
  ]);
  const username = new Map(people.map((u) => [u.userId, u.username]));
  return open.map((s, i) => {
    const { collection, id } = s.target;
    const base = PAGES[collection];
    return {
      id: s._id.toString(),
      kind: collection === "garments" ? "Garment" : collection.slice(0, -1),
      // The first field is always the title or name.
      about: fields[i]?.[0].current ?? "(no longer exists)",
      href:
        collection === "garments" || collection === "models"
          ? `${base}/${id}`
          : nodeHref(base, id),
      editHref:
        collection === "garments"
          ? `/garment/${id}/edit?suggestion=${s._id}`
          : null,
      field: fields[i]?.find((f) => f.field === s.field)?.label ?? s.field,
      current: s.current,
      proposed: s.proposed,
      note: s.note,
      by: username.get(s.userId) ?? null,
      at: s.createdAt,
    };
  });
}

// Marks a suggestion accepted or dismissed. Applying the change itself is
// done by the admin, in the editor.
export async function resolveSuggestion(
  id: string,
  status: "accepted" | "dismissed",
) {
  await suggestions.updateOne(
    { _id: new ObjectId(id), status: "open" },
    { $set: { status } },
  );
}

// An open suggestion about this garment, for the editor to show beside the
// fields; null if there isn't one with this id.
export async function getGarmentSuggestion(id: string, garmentId: string) {
  if (!ObjectId.isValid(id)) return null;
  const s = await suggestions.findOne({
    _id: new ObjectId(id),
    status: "open",
    target: { collection: "garments", id: garmentId },
  });
  if (!s) return null;
  const fields = await getSuggestionFields(s.target);
  return {
    id: s._id.toString(),
    field: fields?.find((f) => f.field === s.field)?.label ?? s.field,
    current: s.current,
    proposed: s.proposed,
    note: s.note,
  };
}
