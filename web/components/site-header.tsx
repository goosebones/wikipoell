// Site header: the wordmark linking home on the left and the account corner
// (sign in / avatar) on the right, in a bar that stays at the top while
// scrolling. Navigation dropdowns (milestone 6) and search (milestone 11) are
// added here later.
import Link from "next/link";
import { Suspense } from "react";
import { Container } from "@/components/container";
import { UserMenu } from "@/components/user-menu";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-muted bg-background/90 backdrop-blur">
      <Container className="flex h-14 items-center gap-8">
        <Link
          href="/"
          className="text-[15px] font-semibold tracking-tight"
        >
          wikipoell
        </Link>
        <div className="flex-1" />
        {/* The session is read per request, so the rest of the header can
            render instantly while this streams in. The placeholder keeps the
            avatar's space so nothing shifts. */}
        <Suspense fallback={<div className="size-7" />}>
          <UserMenu />
        </Suspense>
      </Container>
    </header>
  );
}
