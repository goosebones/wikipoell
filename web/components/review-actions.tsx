// The buttons on the admin review queue. GarmentReview: Edit, Publish (only
// once the garment has a model) and Reject for a pending garment.
// SuggestionReview: Apply (opens the garment editor with the suggestion
// beside it, for garment suggestions), Mark accepted and Dismiss. Each action
// refreshes the queue.
// GarmentReview props: id, hasModel. SuggestionReview props: id, editHref
// (the editor link, or null when there's no editor for the target yet).
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { reviewGarment, settleSuggestion } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";

export function GarmentReview({
  id,
  hasModel,
}: {
  id: string;
  hasModel: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const review = (publish: boolean) =>
    startTransition(async () => {
      const failed = await reviewGarment(id, publish);
      setError(failed);
      if (!failed) router.refresh();
    });

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        asChild
        variant="outline"
        size="sm"
      >
        <Link href={`/garment/${id}/edit`}>Edit</Link>
      </Button>
      <Button
        size="sm"
        disabled={pending || !hasModel}
        title={hasModel ? undefined : "Add a model before publishing"}
        onClick={() => review(true)}
      >
        Publish
      </Button>
      <Button
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={() => review(false)}
      >
        Reject
      </Button>
      {error && <span className="text-[13px] text-destructive">{error}</span>}
    </div>
  );
}

export function SuggestionReview({
  id,
  editHref,
}: {
  id: string;
  editHref: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const settle = (accept: boolean) =>
    startTransition(async () => {
      await settleSuggestion(id, accept);
      router.refresh();
    });

  return (
    <div className="flex flex-wrap items-center gap-2">
      {editHref && (
        <Button
          asChild
          size="sm"
        >
          <Link href={editHref}>Apply</Link>
        </Button>
      )}
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => settle(true)}
      >
        Mark accepted
      </Button>
      <Button
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={() => settle(false)}
      >
        Dismiss
      </Button>
    </div>
  );
}
