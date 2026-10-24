// Site header: the wordmark linking home, the browse menus (category, model,
// color, material: dropdowns from tablet width up, a slide-out sheet behind a
// menu button on phones), a search link and the account corner (sign in /
// avatar), in a bar that stays at the top while scrolling. The menus are
// built from the cached vocabulary, so they cost no database work per page.
import { Search } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { Container } from "@/components/container";
import { MobileNav } from "@/components/mobile-nav";
import { SiteNav } from "@/components/site-nav";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/user-menu";
import { browseMenus } from "@/lib/nav";
import { getVocabulary } from "@/lib/vocabulary";

export async function SiteHeader() {
  const menus = browseMenus(await getVocabulary());
  return (
    <header className="sticky top-0 z-20 border-b border-muted bg-background/90 backdrop-blur">
      <Container className="flex h-14 items-center gap-2 md:gap-6">
        <MobileNav menus={menus} />
        <Link
          href="/"
          className="text-[15px] font-semibold tracking-tight"
        >
          wikipoell
        </Link>
        <SiteNav menus={menus} />
        <div className="flex-1" />
        <Button
          asChild
          variant="ghost"
          size="icon"
        >
          <Link
            href="/search"
            aria-label="Search"
          >
            <Search />
          </Link>
        </Button>
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
