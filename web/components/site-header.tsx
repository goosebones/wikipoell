// Site header: the wordmark linking home, the browse menus (category, model,
// color, material; from tablet width up) and the account corner (sign in /
// avatar), in a bar that stays at the top while scrolling. The menus are built
// from the cached vocabulary, so they cost no database work per page. Search
// (milestone 11) and the phone menu (next chunk) are added here later.
import Link from "next/link";
import { Suspense } from "react";
import { Container } from "@/components/container";
import { SiteNav } from "@/components/site-nav";
import { UserMenu } from "@/components/user-menu";
import { browseMenus } from "@/lib/nav";
import { getVocabulary } from "@/lib/vocabulary";

export async function SiteHeader() {
  const menus = browseMenus(await getVocabulary());
  return (
    <header className="sticky top-0 z-20 border-b border-muted bg-background/90 backdrop-blur">
      <Container className="flex h-14 items-center gap-6">
        <Link
          href="/"
          className="text-[15px] font-semibold tracking-tight"
        >
          wikipoell
        </Link>
        <SiteNav menus={menus} />
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
