"use client";

import Link from "next/link";
import { useMemo } from "react";
import { AppShell, Burger, Flex } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";

import UploadGarmentLink from "@/components/upload-garment-link";
import HeaderAuth from "@/components/header-auth";
import CategoriesMenuClient from "@/components/category/category-menu-client";

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

  const [opened, { toggle }] = useDisclosure(false);

  return (
    <AppShell
      padding={0}
      header={{ height: 56 }}
      navbar={{
        width: 280,
        breakpoint: "sm",
        collapsed: { desktop: false, mobile: !opened },
      }}
    >
      <AppShell.Navbar p="xs">
        <Flex
          direction="column"
          className="bg-white"
        >
          <UploadGarmentLink className="mb-6" />
          <CategoriesMenuClient
            categoryTree={categoryTree}
            className="mb-6"
          />
        </Flex>
      </AppShell.Navbar>

      <AppShell.Header p={0}>
        <div className="grid grid-cols-3 items-center w-full h-full bg-white px-2">
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
      </AppShell.Header>

      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  );
}
