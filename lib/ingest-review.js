/**
 * Presentation helpers for `Garment.ingest.review`.
 *
 * The pipeline records *why* it could not publish a garment as a list of
 * machine-readable reason strings (`unknown_vocab:material=XHORSASIS`). These
 * turn them into something an admin can act on, and — more usefully — group
 * the queue by reason, so 29 garments blocked on the same missing property
 * can be fixed once rather than 29 times.
 */

/** reason kind → how to show it. Order is roughly "cheapest to resolve first". */
export const REVIEW_REASON_META = {
  unknown_vocab: {
    label: "Unknown value",
    color: "violet",
    hint: "Not in the Property vocabulary. Add it, or correct the field.",
  },
  unknown_category: {
    label: "Category",
    color: "orange",
    hint: "The pipeline could not resolve a category.",
  },
  code_unparseable: {
    label: "Bad article code",
    color: "red",
    hint: "The listing showed a code that does not match the expected format.",
  },
  title_unformatted: {
    label: "Title",
    color: "yellow",
    hint: "Title still looks raw — check it before publishing.",
  },
  missing: {
    label: "Missing field",
    color: "gray",
    hint: "Required for auto-publish and could not be determined.",
  },
  llm_low_confidence: {
    label: "Low confidence",
    color: "blue",
    hint: "The model was unsure. Verify against the images.",
  },
  llm_skipped: {
    label: "LLM skipped",
    color: "gray",
    hint: "Ran without the LLM, so gaps were never filled in.",
  },
  disagreement: {
    label: "Disagreement",
    color: "red",
    hint: "Deterministic rules and the model disagreed.",
  },
};

/** `"unknown_vocab:material=XHORSASIS"` → `{ kind, detail, field, value }`. */
export function parseReviewReason(reason) {
  const [kind, ...rest] = String(reason).split(":");
  const detail = rest.join(":");
  let field = null;
  let value = null;
  if (detail.includes("=")) {
    const eq = detail.indexOf("=");
    field = detail.slice(0, eq);
    value = detail.slice(eq + 1);
  } else if (detail) {
    field = detail;
  }
  const meta = REVIEW_REASON_META[kind] ?? {
    label: kind,
    color: "gray",
    hint: "",
  };
  return { kind, detail, field, value, ...meta };
}

/** Short human phrase for one reason, e.g. `material = "XHORSASIS"`. */
export function describeReviewReason(reason) {
  const { kind, label, field, value } = parseReviewReason(reason);
  if (kind === "unknown_vocab") return `${field} = "${value}"`;
  if (kind === "missing") return `${field} missing`;
  if (kind === "llm_low_confidence") return `confidence ${value ?? field}`;
  if (kind === "code_unparseable") return field ? `"${field}"` : label;
  return field ? `${label}: ${field}` : label;
}

/**
 * Collapse a queue's reasons into a ranked list for the filter bar.
 * Keyed on `kind:detail` so "add material XHORSASIS" is one row, not 29.
 */
export function summarizeReviewReasons(garments) {
  const counts = new Map();
  for (const garment of garments) {
    for (const reason of garment?.ingest?.review?.reasons ?? []) {
      const entry = counts.get(reason) ?? { reason, count: 0 };
      entry.count += 1;
      counts.set(reason, entry);
    }
  }
  return [...counts.values()]
    .map((entry) => ({ ...entry, ...parseReviewReason(entry.reason) }))
    .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason));
}

/** Badge colour for a field's confidence. */
export function confidenceColor(confidence) {
  if (confidence == null) return "gray";
  if (confidence >= 0.9) return "green";
  if (confidence >= 0.7) return "yellow";
  return "red";
}

/** Where a field's value came from, as a short label. */
export const ORIGIN_LABEL = {
  code: "article code",
  sku: "SKU",
  title: "title",
  hint: "site",
  llm: "LLM",
};
