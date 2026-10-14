// A "Suggest a correction" link that opens a short form in a dialog: which
// field is wrong (each showing its current value), what it should be, and an
// optional note. Sent suggestions go to the admin queue, and the dialog says
// thanks. Visitors who aren't signed in get Clerk's sign-in instead.
// Props: target ({ collection, id }), fields (from getSuggestionFields()).
"use client";

import { SignInButton, useAuth } from "@clerk/nextjs";
import { useState, useTransition } from "react";
import { suggestCorrection } from "@/app/suggestions/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { SuggestionField, SuggestionTarget } from "@/lib/suggestions";

const input = "w-full rounded-md bg-muted px-3 py-2 text-[14px] outline-none";

export function SuggestCorrection({
  target,
  fields,
}: {
  target: SuggestionTarget;
  fields: SuggestionField[];
}) {
  const { isSignedIn } = useAuth();
  const [open, setOpen] = useState(false);
  const [field, setField] = useState(fields[0].field);
  const [sent, setSent] = useState(false);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();
  const current = fields.find((f) => f.field === field)?.current;

  const link = (
    <button className="text-[13px] text-muted-foreground underline underline-offset-4 hover:text-foreground">
      Suggest a correction
    </button>
  );
  if (!isSignedIn) return <SignInButton mode="modal">{link}</SignInButton>;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        // Opening again starts a fresh suggestion.
        if (o) setSent(false);
      }}
    >
      <DialogTrigger asChild>{link}</DialogTrigger>
      <DialogContent>
        <DialogTitle>Suggest a correction</DialogTitle>
        {sent ? (
          <>
            <DialogDescription>
              Thanks. An admin will look at it soon.
            </DialogDescription>
            <Button onClick={() => setOpen(false)}>Done</Button>
          </>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              startTransition(async () => {
                const ok = await suggestCorrection(
                  target,
                  field,
                  form.get("proposed"),
                  form.get("note"),
                );
                setFailed(!ok);
                setSent(ok);
              });
            }}
          >
            <DialogDescription>
              Spotted something wrong? Tell us what it should be and an admin
              will review it.
            </DialogDescription>
            <label className="block space-y-1.5 text-[13px]">
              <span className="font-medium">What’s wrong</span>
              <select
                value={field}
                onChange={(e) => setField(e.target.value)}
                className={input}
              >
                {fields.map((f) => (
                  <option
                    key={f.field}
                    value={f.field}
                  >
                    {f.label}
                  </option>
                ))}
              </select>
              {current && (
                <span className="block text-muted-foreground">
                  Now: {current}
                </span>
              )}
            </label>
            <label className="block space-y-1.5 text-[13px]">
              <span className="font-medium">What it should be</span>
              <input
                name="proposed"
                required
                maxLength={300}
                className={input}
              />
            </label>
            <label className="block space-y-1.5 text-[13px]">
              <span className="font-medium">
                Anything else{" "}
                <span className="font-normal text-muted-foreground">
                  (optional)
                </span>
              </span>
              <textarea
                name="note"
                rows={3}
                maxLength={1000}
                placeholder="A source, or how you know"
                className={input}
              />
            </label>
            {failed && (
              <p className="text-[13px] text-destructive">
                That didn’t save. Please try again.
              </p>
            )}
            <Button
              type="submit"
              disabled={pending}
            >
              Send suggestion
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
