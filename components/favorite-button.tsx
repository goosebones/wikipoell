// The "Favorite" button on a garment page, filled in when the garment is one
// of the signed-in user's favorites. Visitors who aren't signed in get
// Clerk's sign-in when they press it.
// Props: garmentId, favorite (whether it's a favorite, or null for a
// visitor).
"use client";

import { SignInButton } from "@clerk/nextjs";
import { Heart } from "lucide-react";
import { useState, useTransition } from "react";
import { favoriteGarment } from "@/app/garment/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function FavoriteButton({
  garmentId,
  favorite: initial,
}: {
  garmentId: string;
  favorite: boolean | null;
}) {
  const [favorite, setFavorite] = useState(initial);
  const [pending, startTransition] = useTransition();

  const button = (
    <Button
      variant={favorite ? "default" : "outline"}
      size="sm"
      disabled={pending}
      onClick={
        favorite === null
          ? undefined
          : () =>
              startTransition(async () => {
                const saved = await favoriteGarment(garmentId, !favorite);
                if (saved !== null) setFavorite(saved);
              })
      }
    >
      <Heart className={cn(favorite && "fill-current")} />
      Favorite
    </Button>
  );

  // Without a user, the button opens the sign-in; it lands back here.
  return favorite === null ? (
    <SignInButton mode="modal">{button}</SignInButton>
  ) : (
    button
  );
}
