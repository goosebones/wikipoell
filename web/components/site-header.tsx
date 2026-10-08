// Site header: the wordmark linking home, in a bar that stays at the top while
// scrolling. Navigation dropdowns (milestone 6), search (milestone 11) and the
// sign-in button (milestone 2) are added here later.
import Link from "next/link";
import { Container } from "@/components/container";

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
      </Container>
    </header>
  );
}
