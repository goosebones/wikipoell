// The signed-in user's avatar menu (Clerk's UserButton), with a "Your
// profile" link added between Clerk's own entries when the user has a
// username. It renders once Clerk has loaded in the browser (an avatar-sized
// blank holds its place until then): rendered on the server too, it could
// differ from the browser's first render and trip a hydration error.
// A client component because Clerk's menu items are only reachable from one.
// Props: username (the user's, or null).
"use client";

import { ClerkLoaded, ClerkLoading, UserButton } from "@clerk/nextjs";
import { User } from "lucide-react";

export function AccountButton({ username }: { username: string | null }) {
  return (
    <>
      <ClerkLoading>
        <div className="size-7" />
      </ClerkLoading>
      <ClerkLoaded>
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
      </ClerkLoaded>
    </>
  );
}
