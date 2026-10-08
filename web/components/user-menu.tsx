// The header's account corner: a "Sign in" button for visitors (opens Clerk's
// sign-in in a modal) or the user's avatar menu (profile, sign out) once
// signed in. Reads the session, so it must be rendered inside <Suspense>.
import { Show, SignInButton, UserButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";

export function UserMenu() {
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
        <UserButton />
      </Show>
    </>
  );
}
