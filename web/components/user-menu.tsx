// The header's account corner: a "Sign in" button for visitors (opens Clerk's
// sign-in in a modal), or the user's avatar menu (their profile page, account
// settings, sign out) once signed in, with an "Admin" link for admins. Reads
// the session, so it must be rendered inside <Suspense>.
import { Show, SignInButton } from "@clerk/nextjs";
import { currentUser } from "@clerk/nextjs/server";
import Link from "next/link";
import { AccountButton } from "@/components/account-button";
import { Button } from "@/components/ui/button";
import { isAdmin } from "@/lib/auth";

export async function UserMenu() {
  const user = await currentUser();
  return (
    <>
      <Show when="signed-out">
        <SignInButton mode="modal">
          <Button
            variant="ghost"
            size="sm"
          >
            Sign in
          </Button>
        </SignInButton>
      </Show>
      <Show when="signed-in">
        {(await isAdmin()) && (
          <Link
            href="/admin"
            className="text-[13px] text-muted-foreground hover:text-foreground"
          >
            Admin
          </Link>
        )}
        <AccountButton username={user?.username ?? null} />
      </Show>
    </>
  );
}
