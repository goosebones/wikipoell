// The browse menus for phones: a menu button (shown below tablet width) that
// slides in a sheet from the left. Category, Model, Color and Material are
// collapsible sections holding the same contents as the desktop dropdowns,
// including the model filter, then a Codebook link. Tapping any link closes
// the sheet.
// Props: menus (from browseMenus() in lib/nav.ts).
"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import type { BrowseMenus, NavGroup, NavLink } from "@/lib/nav";

export function MobileNav({ menus }: { menus: BrowseMenus }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Browse"
        onClick={() => setOpen(true)}
        className="-ml-2 md:hidden"
      >
        <Menu />
      </Button>
      <Sheet
        open={open}
        onOpenChange={setOpen}
      >
        <SheetContent
          side="left"
          className="gap-0 overflow-y-auto p-6"
        >
          <SheetTitle className="eyebrow">Browse</SheetTitle>
          <Section
            label="Category"
            all={{ href: "/category", label: "All categories" }}
            onNavigate={close}
          >
            <Groups
              groups={menus.categories}
              onNavigate={close}
            />
          </Section>
          <Section
            label="Model"
            all={{ href: "/model", label: "All models" }}
            onNavigate={close}
          >
            <ModelList
              models={menus.models}
              onNavigate={close}
            />
          </Section>
          <Section
            label="Color"
            all={{ href: "/color", label: "All colors" }}
            onNavigate={close}
          >
            <Groups
              groups={menus.colors}
              onNavigate={close}
            />
          </Section>
          <Section
            label="Material"
            all={{ href: "/material", label: "All materials" }}
            onNavigate={close}
          >
            <Groups
              groups={menus.materials}
              onNavigate={close}
            />
          </Section>
          <Link
            href="/codebook"
            onClick={close}
            className="border-b border-muted py-3 text-[15px] font-medium"
          >
            Codebook
          </Link>
        </SheetContent>
      </Sheet>
    </>
  );
}

// A collapsible section: the label opens it, revealing its contents and a link
// to that attribute's index page.
function Section({
  label,
  all,
  onNavigate,
  children,
}: {
  label: string;
  all: NavLink;
  onNavigate: () => void;
  children: React.ReactNode;
}) {
  return (
    <details className="group border-b border-muted py-3">
      <summary className="flex cursor-pointer list-none items-center justify-between text-[15px] font-medium">
        {label}
        <span className="text-muted-foreground transition group-open:rotate-45">
          +
        </span>
      </summary>
      <div className="pt-3 pb-1">
        {children}
        <Link
          href={all.href}
          onClick={onNavigate}
          className="eyebrow mt-4 inline-block hover:text-foreground"
        >
          {all.label} →
        </Link>
      </div>
    </details>
  );
}

// Each group's heading links to its page, with its children wrapped beneath.
function Groups({
  groups,
  onNavigate,
}: {
  groups: NavGroup[];
  onNavigate: () => void;
}) {
  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <div key={group.href}>
          <Link
            href={group.href}
            onClick={onNavigate}
            className="text-[14px] font-medium"
          >
            {group.label}
          </Link>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
            {group.children.map((child) => (
              <Link
                key={child.href}
                href={child.href}
                onClick={onNavigate}
                className="text-[13px] text-muted-foreground hover:text-foreground"
              >
                {child.label}
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// The full model list, filtered as you type by number or name.
function ModelList({
  models,
  onNavigate,
}: {
  models: NavLink[];
  onNavigate: () => void;
}) {
  const [query, setQuery] = useState("");
  const shown = models.filter((m) =>
    m.label.toLowerCase().includes(query.trim().toLowerCase()),
  );
  return (
    <>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Filter by number or name…"
        className="w-full rounded-md bg-muted px-3 py-2 text-[14px] outline-none"
      />
      <ul className="mt-2 max-h-72 overflow-y-auto">
        {shown.map((m) => (
          <li key={m.href}>
            <Link
              href={m.href}
              onClick={onNavigate}
              className="block py-1 text-[13px] text-muted-foreground hover:text-foreground"
            >
              {m.label}
            </Link>
          </li>
        ))}
        {shown.length === 0 && (
          <li className="py-1 text-[13px] text-muted-foreground">
            No model matches.
          </li>
        )}
      </ul>
    </>
  );
}
