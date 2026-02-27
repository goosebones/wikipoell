"use client";

import { SignInButton, SignUpButton } from "@clerk/nextjs";

import { Button } from "@/styles/components/ui/button";

export default function SignInPrompt({ children, message }) {
  const text = children ?? message ?? "Please sign in to continue";

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="flex w-full max-w-sm flex-col items-stretch gap-4 text-center">
        <p className="text-xl font-semibold">{text}</p>
        <SignUpButton>
          <Button
            size="lg"
            className="w-full"
          >
            Sign Up
          </Button>
        </SignUpButton>
        <SignInButton>
          <Button
            size="lg"
            variant="outline"
            className="w-full"
          >
            Log In
          </Button>
        </SignInButton>
      </div>
    </div>
  );
}
