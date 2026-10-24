// The admin review queue at /admin, laid out for desktop: pending garments,
// each with its photos on the left and a grid of its properties on the
// right, problem cells tinted (red blocks publishing, amber needs a look),
// each showing how the ingest pipeline read it and how sure it was,
// with Edit, Publish and Reject; then open correction suggestions (what
// they're about, the field's value now and as suggested, who sent it, and
// Apply, Mark accepted and Dismiss). Admins only; everyone else gets the 404
// page.
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { AdminNav } from "@/components/admin-nav";
import { Container } from "@/components/container";
import { GarmentReview, SuggestionReview } from "@/components/review-actions";
import { requireAdmin } from "@/lib/auth";
import {
  getOpenSuggestions,
  getPendingGarments,
  type ReviewCell,
} from "@/lib/review";
import { cn } from "@/lib/utils";

export default function AdminPage() {
  return (
    <Container className="pt-10">
      {/* Everything sits inside the boundary, so nothing renders for a
          non-admin before the check fails. */}
      <Suspense fallback={null}>
        <Queue />
      </Suspense>
    </Container>
  );
}

async function Queue() {
  await requireAdmin();
  const [pending, open] = await Promise.all([
    getPendingGarments(),
    getOpenSuggestions(),
  ]);

  return (
    <>
      <AdminNav current="review" />
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">
        Review queue
      </h1>
      <Heading
        title="Pending garments"
        count={pending.length}
      />
      {pending.length === 0 && <Empty>Nothing waiting.</Empty>}
      <ul className="divide-y divide-muted">
        {pending.map((g) => (
          <li
            key={g.id}
            className="grid gap-6 py-8 lg:grid-cols-[22rem_1fr]"
          >
            <Photos images={g.images} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-lg font-semibold tracking-tight">
                  {g.title}
                </h3>
                <GarmentReview
                  id={g.id}
                  hasModel={g.hasModel}
                />
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-md border bg-border xl:grid-cols-3">
                {g.cells.map((cell) => (
                  <Cell
                    key={cell.label}
                    {...cell}
                  />
                ))}
              </dl>
              {g.notes.length > 0 && (
                <ul className="mt-3 space-y-1 text-[13px] text-muted-foreground">
                  {g.notes.map((note) => (
                    <li key={note}>Pipeline: {note}</li>
                  ))}
                </ul>
              )}
              {g.source?.url && (
                <a
                  href={g.source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-block text-[13px] underline underline-offset-4"
                >
                  View on {g.source.label ?? "the listing"} ↗
                </a>
              )}
              {g.runId && (
                <Link
                  href={`/admin/runs?run=${g.runId}#${g.runId}`}
                  className="mt-3 ml-4 inline-block text-[13px] text-muted-foreground hover:text-foreground"
                >
                  From run {g.runId.slice(0, 8)}
                </Link>
              )}
            </div>
          </li>
        ))}
      </ul>

      <Heading
        title="Suggestions"
        count={open.length}
      />
      {open.length === 0 && <Empty>No open suggestions.</Empty>}
      <ul className="divide-y divide-muted">
        {open.map((s) => (
          <li
            key={s.id}
            className="space-y-2 py-5 text-[13px]"
          >
            <p>
              <span className="eyebrow mr-2">{s.kind}</span>
              <Link
                href={s.href}
                className="font-medium hover:underline"
              >
                {s.about}
              </Link>
              <span className="text-muted-foreground"> · {s.field}</span>
            </p>
            <dl className="grid grid-cols-[5rem_1fr] gap-x-3 gap-y-1">
              <dt className="text-muted-foreground">Now</dt>
              <dd>{s.current || "—"}</dd>
              <dt className="text-muted-foreground">Suggested</dt>
              <dd className="font-medium">{s.proposed}</dd>
              {s.note && (
                <>
                  <dt className="text-muted-foreground">Note</dt>
                  <dd>{s.note}</dd>
                </>
              )}
            </dl>
            <p className="font-mono text-[11px] text-muted-foreground">
              {s.by ?? "Unknown user"} ·{" "}
              {s.at.toLocaleDateString("en", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </p>
            <SuggestionReview
              id={s.id}
              editHref={s.editHref}
            />
          </li>
        ))}
      </ul>
    </>
  );
}

// A pending garment's photos: the first large, the rest in a strip beneath.
// Fitted whole rather than cropped, so nothing in the photo is missed.
function Photos({ images }: { images: string[] }) {
  return (
    <div>
      <div className="relative aspect-square bg-muted">
        {images[0] && (
          <Image
            src={images[0]}
            alt=""
            fill
            sizes="352px"
            className="object-contain"
          />
        )}
      </div>
      {images.length > 1 && (
        <div className="mt-2 grid grid-cols-5 gap-2">
          {images.slice(1, 11).map((src) => (
            <div
              key={src}
              className="relative aspect-square bg-muted"
            >
              <Image
                src={src}
                alt=""
                fill
                sizes="64px"
                className="object-cover"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// One property of a pending garment. Problems are tinted so they stand out:
// red for what blocks publishing, amber for anything else that needs a look.
function Cell({ label, value, problem, hint, read }: ReviewCell) {
  return (
    <div
      className={cn(
        "bg-background p-3 text-[13px]",
        problem?.blocking && "bg-red-50",
        problem && !problem.blocking && "bg-amber-50",
      )}
    >
      <dt className="flex items-baseline justify-between gap-2">
        <span className="eyebrow">{label}</span>
        {problem && (
          <span
            className={cn(
              "text-[11px] font-medium",
              problem.blocking ? "text-red-700" : "text-amber-800",
            )}
          >
            {problem.text}
          </span>
        )}
      </dt>
      <dd className="mt-1">
        {value || <span className="text-muted-foreground">—</span>}
      </dd>
      {hint && (
        <dd className="mt-1 font-mono text-[11px] text-muted-foreground">
          {hint}
        </dd>
      )}
      {read && (
        <dd className="mt-1 font-mono text-[11px] text-muted-foreground">
          {read.from} · {Math.round(read.confidence * 100)}%
        </dd>
      )}
    </div>
  );
}

function Heading({ title, count }: { title: string; count: number }) {
  return (
    <div className="mt-10 flex items-baseline justify-between gap-4 border-b border-muted pb-2">
      <h2 className="font-medium">{title}</h2>
      <span className="font-mono text-xs text-muted-foreground">{count}</span>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="mt-4 text-[13px] text-muted-foreground">{children}</p>;
}
