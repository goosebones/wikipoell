"use client";

import {
  SignInButton,
  SignUpButton,
  UserButton,
  useAuth,
  useUser,
} from "@clerk/nextjs";
import { CircleUserIcon } from "lucide-react";

const authTriggerClassName =
  "inline-flex items-center rounded px-2 py-1 text-xs font-medium text-black hover:bg-gray-100";

export default function HeaderAuth() {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();

  if (!isLoaded) {
    return (
      <div
        className="flex justify-end gap-1"
        aria-busy="true"
        aria-label="Account"
      >
        <span
          className="h-7 w-14 shrink-0 rounded"
          aria-hidden
        />
        <span
          className="h-7 w-16 shrink-0 rounded"
          aria-hidden
        />
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <>
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
      </>
    );
  }

  return (
    <UserButton userProfileMode="modal">
      <UserButton.MenuItems>
        {user?.username ? (
          <UserButton.Link
            label="Profile"
            labelIcon={<CircleUserIcon className="size-4" />}
            href={`/user/${user.username}`}
          />
        ) : null}
        <UserButton.Action label="manageAccount" />
        <UserButton.Action label="signOut" />
      </UserButton.MenuItems>
    </UserButton>
  );
}
