"use client";

import {
  SignInButton,
  SignUpButton,
  SignedIn,
  SignedOut,
  UserButton,
  useUser,
} from "@clerk/nextjs";
import { Button as MantineButton } from "@mantine/core";
import { CircleUserIcon } from "lucide-react";

export default function HeaderAuth() {
  const { user } = useUser();

  return (
    <>
      <SignedOut>
        <SignInButton>
          <MantineButton
            size="compact-xs"
            variant="transparent"
          >
            Log In
          </MantineButton>
        </SignInButton>
        <SignUpButton>
          <MantineButton
            size="compact-xs"
            variant="transparent"
          >
            Sign Up
          </MantineButton>
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
