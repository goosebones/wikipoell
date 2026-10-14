// The signed-in user's avatar menu (Clerk's UserButton), with a "Your
// profile" link added between Clerk's own entries when the user has a
// username.
// A client component because Clerk's menu items are only reachable from one.
// Props: username (the user's, or null).
"use client";

import { UserButton } from "@clerk/nextjs";
import { User } from "lucide-react";

export function AccountButton({ username }: { username: string | null }) {
  return (
    <UserButton>
      {username && (
        <UserButton.MenuItems>
          <UserButton.Link
            label="Your profile"
            labelIcon={<User className="size-4" />}
            href={`/user/${username}`}
          />
        </UserButton.MenuItems>
      )}
    </UserButton>
  );
}
