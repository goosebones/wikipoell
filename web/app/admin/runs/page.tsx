// Ingest runs at /admin/runs, laid out for desktop: the latest runs, newest
// first, each with when and how it was started, its sources, what it found
// and did, how long it took, and how many of the garments it created are
// still published, with Unpublish to send those back to the review queue.
// A run linked from a review card (?run=<id>) is highlighted. Admins only;
// everyone else gets the 404 page.
import { Suspense } from "react";
import { AdminNav } from "@/components/admin-nav";
import { Container } from "@/components/container";
import { UnpublishRun } from "@/components/unpublish-run";
import { requireAdmin } from "@/lib/auth";
import { getRuns } from "@/lib/ingest";
import { cn } from "@/lib/utils";

export default function RunsPage({ searchParams }: PageProps<"/admin/runs">) {
  return (
    <Container className="pt-10">
      {/* Everything sits inside the boundary, so nothing renders for a
          non-admin before the check fails. */}
      <Suspense fallback={null}>
        {searchParams.then(({ run }) => (
          <Runs highlight={typeof run === "string" ? run : null} />
        ))}
      </Suspense>
    </Container>
  );
}

async function Runs({ highlight }: { highlight: string | null }) {
  await requireAdmin();
  const runs = await getRuns();
  const seconds = (ms: number | null) =>
    ms === null ? "—" : ms < 1000 ? "<1s" : `${Math.round(ms / 1000)}s`;

  return (
    <>
      <AdminNav current="runs" />
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">
        Ingest runs
      </h1>
      <p className="mt-2 text-[13px] text-muted-foreground">
        The latest {runs.length}. Unpublish sends a run’s garments that are
        still published back to the review queue; nothing is deleted.
      </p>
      <table className="mt-6 w-full text-left text-[13px]">
        <thead className="eyebrow border-b border-muted">
          <tr>
            <th className="py-2 font-normal">Started</th>
            <th className="font-normal">Sources</th>
            <th className="text-right font-normal">Found</th>
            <th className="text-right font-normal">Published</th>
            <th className="text-right font-normal">For review</th>
            <th className="text-right font-normal">Failed</th>
            <th className="text-right font-normal">Took</th>
            <th className="text-right font-normal">Still live</th>
            <th />
          </tr>
        </thead>
        <tbody className="divide-y divide-muted">
          {runs.map((run) => (
            <tr
              key={run.id}
              id={run.id}
              className={cn(run.id === highlight && "bg-amber-50")}
            >
              <td className="py-2">
                {run.startedAt.toLocaleString("en", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                <p className="font-mono text-[11px] text-muted-foreground">
                  {run.id.slice(0, 8)} · {run.trigger ?? "?"} · {run.status}
                </p>
              </td>
              <td>{run.sources.join(", ") || "—"}</td>
              <td className="text-right font-mono">{run.found}</td>
              <td className="text-right font-mono">{run.published}</td>
              <td className="text-right font-mono">{run.needsReview}</td>
              <td className="text-right font-mono">
                {run.failed > 0 ? (
                  <span className="text-destructive">{run.failed}</span>
                ) : (
                  0
                )}
              </td>
              <td className="text-right font-mono">
                {seconds(run.durationMs)}
              </td>
              <td className="text-right font-mono">
                {run.stillPublished} / {run.garments}
              </td>
              <td className="pl-4 text-right">
                <UnpublishRun
                  runId={run.id}
                  count={run.stillPublished}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
