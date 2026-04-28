"use client";

import Link from "next/link";
import { useMemo } from "react";
import { AppShell, Burger, Flex } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";

import UploadGarmentLink from "@/components/upload-garment-link";
import HeaderAuth from "@/components/header-auth";
import CategoriesMenuClient from "@/components/category/category-menu-client";
import CategoriesMenuDesktopDropdown from "@/components/category/category-menu-desktop-dropdown";

function buildCategoryTree(categories) {
  const categoryMap = {};
  const rootNodes = [];

  categories.forEach((category) => {
    categoryMap[category._id] = {
      ...category,
      children: [],
    };
  });

  categories.forEach((category) => {
    const node = categoryMap[category._id];
    if (category.parent === null) {
      rootNodes.push(node);
    } else {
      const parentNode = categoryMap[category.parent];
      if (parentNode) parentNode.children.push(node);
    }
  });

  return rootNodes;
}

export default function AppShellLayout({ categories, children }) {
  const categoryTree = useMemo(
    () => buildCategoryTree(categories),
    [categories],
  );

  const [opened, { toggle, close }] = useDisclosure(false);

  return (
    <AppShell
      padding={0}
      className="min-h-dvh"
      header={{ height: { base: 56, sm: 96 } }}
      navbar={{
        width: 280,
        breakpoint: "sm",
        collapsed: { desktop: true, mobile: !opened },
      }}
    >
      <AppShell.Navbar p="xs">
        <Flex
          direction="column"
          className="bg-white"
        >
          <UploadGarmentLink
            className="mb-6"
            onNavigate={close}
          />
          <CategoriesMenuClient
            categoryTree={categoryTree}
            className="mb-6"
            onNavigate={close}
          />
        </Flex>
      </AppShell.Navbar>

      <AppShell.Header p={0}>
        <div className="w-full h-full bg-white">
          <div className="grid grid-cols-3 items-center h-14 px-2 border-b border-black/10">
            <div className="flex items-center">
              <Burger
                opened={opened}
                onClick={toggle}
                hiddenFrom="sm"
                size="sm"
                aria-label="Toggle sidebar"
              />
            </div>
            <h1 className="text-2xl font-bold text-center">
              <Link href="/">Wikipoell</Link>
            </h1>
            <div className="flex justify-end">
              <HeaderAuth />
            </div>
          </div>

          <div className="hidden md:flex h-10 items-center justify-center gap-12 px-4">
            <Link
              href="/garment/create"
              className="inline-flex items-center gap-1  tracking-wide"
            >
              Upload
            </Link>
            <CategoriesMenuDesktopDropdown categoryTree={categoryTree} />
          </div>
        </div>
      </AppShell.Header>

      <AppShell.Main className="flex min-h-0 flex-1 flex-col">
        {children}
      </AppShell.Main>
    </AppShell>
  );
}
