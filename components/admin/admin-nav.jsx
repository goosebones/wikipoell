"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavLink, Stack } from "@mantine/core";
import { ClipboardList, History, Tags } from "lucide-react";

const NAV_ITEMS = [
  {
    href: "/admin",
    label: "Garment review",
    icon: ClipboardList,
    isActive: (pathname) => pathname === "/admin",
  },
  {
    href: "/admin/runs",
    label: "Ingest runs",
    icon: History,
    isActive: (pathname) => pathname.startsWith("/admin/runs"),
  },
  {
    href: "/admin/properties",
    label: "Properties",
    icon: Tags,
    isActive: (pathname) => pathname.startsWith("/admin/properties"),
  },
];

export default function AdminNav() {
  const pathname = usePathname();

  return (
    <Stack gap={4}>
      {NAV_ITEMS.map(({ href, label, icon: Icon, isActive }) => (
        <NavLink
          key={href}
          component={Link}
          href={href}
          label={label}
          leftSection={
            <Icon
              size={18}
              strokeWidth={1.75}
            />
          }
          active={isActive(pathname)}
        />
      ))}
    </Stack>
  );
}
