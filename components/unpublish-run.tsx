// The "Unpublish" button on an ingest run: after asking, it moves every
// still-published garment the run created back to the review queue, then
// says how many moved.
// Props: runId, count (how many of its garments are still published).
"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { unpublishIngestRun } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";

export function UnpublishRun({
  runId,
  count,
}: {
  runId: string;
  count: number;
}) {
  const router = useRouter();
  const [moved, setMoved] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  if (moved !== null) {
    return (
      <span className="text-muted-foreground">{moved} moved to the queue</span>
    );
  }
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending || count === 0}
      onClick={() => {
        const ok = confirm(
          `Move this run's ${count} published garments back to the review queue? Nothing is deleted.`,
        );
        if (!ok) return;
        startTransition(async () => {
          setMoved(await unpublishIngestRun(runId));
          router.refresh();
        });
      }}
    >
      Unpublish
    </Button>
  );
}
