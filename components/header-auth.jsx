"use client";

import {
  SignInButton,
  SignUpButton,
  SignedIn,
  SignedOut,
  UserButton,
  useUser,
} from "@clerk/nextjs";
import { CircleUserIcon } from "lucide-react";

const authTriggerClassName =
  "inline-flex items-center rounded px-2 py-1 text-xs font-medium text-black hover:bg-gray-100";

export default function HeaderAuth() {
  const { user } = useUser();

  return (
    <>
      <SignedOut>
        <SignInButton>
          <button
            type="button"
            className={authTriggerClassName}
          >
            Log In
          </button>
        </SignInButton>
        <SignUpButton>
          <button
            type="button"
            className={authTriggerClassName}
          >
            Sign Up
          </button>
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
