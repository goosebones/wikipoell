// The header's browse menus, from tablet width up: Category, Model, Color and
// Material, each opening a panel on hover or click. Category, color and
// material panels show their top-level groups as columns with the next level
// beneath; the model panel has a filter box over the full list of models.
// Every panel ends with a link to that attribute's index page.
// Props: menus (from browseMenus() in lib/nav.ts).
"use client";

import Link from "next/link";
import { useState } from "react";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import type { BrowseMenus, NavGroup } from "@/lib/nav";
import { cn } from "@/lib/utils";

const trigger =
  "h-8 bg-transparent px-2 text-[13px] font-normal text-muted-foreground hover:bg-transparent hover:text-foreground focus:bg-transparent data-open:bg-transparent data-open:text-foreground data-open:hover:bg-transparent";

export function SiteNav({ menus }: { menus: BrowseMenus }) {
  return (
    <NavigationMenu className="hidden md:flex">
      <NavigationMenuList>
        <Menu
          label="Category"
          all={{ href: "/category", label: "All categories" }}
        >
          <Columns
            groups={menus.categories}
            cols={5}
          />
        </Menu>
        <Menu
          label="Model"
          all={{ href: "/model", label: "All models" }}
        >
          <ModelList models={menus.models} />
        </Menu>
        <Menu
          label="Color"
          all={{ href: "/color", label: "All colors" }}
        >
          <Columns
            groups={menus.colors}
            cols={6}
          />
        </Menu>
        <Menu
          label="Material"
          all={{ href: "/material", label: "All materials" }}
        >
          <Columns
            groups={menus.materials}
            cols={4}
          />
        </Menu>
      </NavigationMenuList>
    </NavigationMenu>
  );
}

function Menu({
  label,
  all,
  children,
}: {
  label: string;
  all: { href: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <NavigationMenuItem>
      <NavigationMenuTrigger className={trigger}>{label}</NavigationMenuTrigger>
      <NavigationMenuContent className="p-5">
        {children}
        <NavigationMenuLink
          asChild
          className="eyebrow mt-4 inline-flex p-0 hover:bg-transparent hover:text-foreground"
        >
          <Link href={all.href}>{all.label} →</Link>
        </NavigationMenuLink>
      </NavigationMenuContent>
    </NavigationMenuItem>
  );
}

// Top-level groups side by side, each heading linking to its page with its
// children listed beneath. Up to `cols` columns; on narrower screens the
// panel is capped to the window and the columns wrap onto more rows.
function Columns({ groups, cols }: { groups: NavGroup[]; cols: number }) {
  return (
    <div
      className="grid grid-cols-[repeat(auto-fill,9.5rem)] gap-x-8 gap-y-6"
      style={{ width: `min(${cols * 9.5 + (cols - 1) * 2}rem, 100vw - 10rem)` }}
    >
      {groups.map((group) => (
        <div key={group.href}>
          <NavLink
            href={group.href}
            className="font-medium text-foreground"
          >
            {group.label}
          </NavLink>
          <ul className="mt-1">
            {group.children.map((child) => (
              <li key={child.href}>
                <NavLink href={child.href}>{child.label}</NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

// 294 models don't fit a menu, so the list is filtered as you type, by number
// or name.
function ModelList({ models }: { models: { label: string; href: string }[] }) {
  const [query, setQuery] = useState("");
  const shown = models.filter((m) =>
    m.label.toLowerCase().includes(query.trim().toLowerCase()),
  );
  return (
    <div className="w-80">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Filter by number or name…"
        className="w-full rounded-md bg-muted px-3 py-1.5 text-[13px] outline-none"
      />
      <ul className="mt-2 max-h-80 overflow-y-auto">
        {shown.map((m) => (
          <li key={m.href}>
            <NavLink href={m.href}>{m.label}</NavLink>
          </li>
        ))}
        {shown.length === 0 && (
          <li className="py-1 text-[13px] text-muted-foreground">
            No model matches.
          </li>
        )}
      </ul>
    </div>
  );
}

function NavLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <NavigationMenuLink
      asChild
      className={cn(
        "block rounded-none p-0 py-0.5 text-[13px] text-muted-foreground hover:bg-transparent hover:text-foreground focus:bg-transparent",
        className,
      )}
    >
      <Link href={href}>{children}</Link>
    </NavigationMenuLink>
  );
}
