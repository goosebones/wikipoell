"use client";

import {
  SignInButton,
  SignUpButton,
  SignedIn,
  SignedOut,
  UserButton,
  useUser,
} from "@clerk/nextjs";

import { Button } from "@/styles/components/ui/button";
import { CircleUserIcon } from "lucide-react";

export default function HeaderAuth() {
  const { user } = useUser();

  return (
    <>
      <SignedOut>
        <SignInButton>
          <Button
            size="xs"
            variant="ghost"
          >
            Log In
          </Button>
        </SignInButton>
        <SignUpButton>
          <Button
            size="xs"
            variant="ghost"
          >
            Sign Up
          </Button>
        </SignUpButton>
      </SignedOut>
      <SignedIn>
        <UserButton userProfileMode="modal">
          <UserButton.MenuItems>
            {user && (
              <UserButton.Link
                label="Profile"
                labelIcon={<CircleUserIcon className="size-4" />}
                href={`/user/${user.username}`}
              />
            )}
            <UserButton.Action label="manageAccount" />
            <UserButton.Action label="signOut" />
          </UserButton.MenuItems>
        </UserButton>
      </SignedIn>
    </>
  );
}
