// Server actions for suggested corrections. `suggestCorrection` stores one
// from the signed-in user and says whether it was saved.
"use server";

import { auth } from "@clerk/nextjs/server";
import { parseTarget, saveSuggestion } from "@/lib/suggestions";

export async function suggestCorrection(
  target: unknown,
  field: unknown,
  proposed: unknown,
  note: unknown,
) {
  // Anyone can call a server action, so every input is checked.
  const { userId } = await auth();
  const checkedTarget = parseTarget(target);
  const text = (value: unknown, max: number) =>
    typeof value === "string" ? value.trim().slice(0, max) : "";
  const what = text(proposed, 300);
  if (!userId || !checkedTarget || typeof field !== "string" || !what) {
    return false;
  }
  return saveSuggestion(userId, checkedTarget, field, what, text(note, 1000));
}
