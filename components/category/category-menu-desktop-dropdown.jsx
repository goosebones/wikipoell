"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, SimpleGrid } from "@mantine/core";
import { ChevronDownIcon } from "lucide-react";

import { cn } from "@/styles/lib/utils";

function categoryHref(categoryId) {
  return `/category/${categoryId.split(".").join("/")}`;
}

export default function CategoriesMenuDesktopDropdown({ categoryTree }) {
  const [opened, setOpened] = useState(false);
  const closeMenu = () => setOpened(false);

  return (
    <Menu
      trigger="click"
      opened={opened}
      onChange={setOpened}
      middlewares={{ flip: false, shift: false }}
    >
      <Menu.Target>
        <button
          type="button"
          aria-expanded={opened}
          aria-haspopup="menu"
          className={cn(
            "inline-flex items-center gap-1 tracking-wide uppercase cursor-pointer",
            opened && "font-bold",
            !opened && "hover:font-bold",
          )}
        >
          <span>Categories</span>
          <ChevronDownIcon
            className={cn(
              "size-4 shrink-0 transition-transform duration-200 ease-out",
              opened && "rotate-180",
            )}
            aria-hidden
          />
        </button>
      </Menu.Target>
      <Menu.Dropdown
        className="rounded-none border-x-0 border-b border-black/10 bg-white shadow-md"
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          width: "100vw",
          maxWidth: "100vw",
          transform: "none",
          top: "var(--app-shell-header-height, 6rem)",
        }}
      >
        <div
          className="p-6"
          style={{ maxWidth: "1000px", margin: "0 auto" }}
        >
          <SimpleGrid
            cols={5}
            spacing="md"
          >
            {categoryTree.map((rootCategory) => (
              <div key={rootCategory._id}>
                <Link
                  href={categoryHref(rootCategory._id)}
                  onClick={closeMenu}
                  className="block text-sm font-semibold hover:opacity-70"
                >
                  {rootCategory.name}
                </Link>
                <div className="mt-2 flex flex-col gap-1">
                  {rootCategory.children.map((childCategory) => (
                    <Link
                      key={childCategory._id}
                      href={categoryHref(childCategory._id)}
                      onClick={closeMenu}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      {childCategory.name}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </SimpleGrid>

          <Link
            href="/category"
            onClick={closeMenu}
            className="text-sm font-medium hover:opacity-70"
          >
            <div className="mt-5">Browse All Categories</div>
          </Link>
        </div>
      </Menu.Dropdown>
    </Menu>
  );
}
