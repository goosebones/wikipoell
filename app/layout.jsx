import "./globals.css";
import "@radix-ui/themes/styles.css";
import { Theme, Grid, Flex } from "@radix-ui/themes";
import { UserCircleIcon } from "lucide-react";
import Link from "next/link";

import CategoriesMenu from "@/components/categories-menu";
import SidebarMenu  from "@/components/sidebar-menu";

export default async function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="mb-10 mx-2 mt-1">
        <Theme>
          <Grid columns="3" gap="4">
            <Flex align="center">
              <SidebarMenu>
                <CategoriesMenu />
              </SidebarMenu>
            </Flex>
            <Flex align="center" justify="center">
              <h1 className="text-2xl font-bold">
                <Link href="/">
                  Wikipoell
                </Link>
              </h1>
            </Flex>
            <Flex align="center" justify="end">
              <UserCircleIcon />
            </Flex>
          </Grid>
          {children}
          </Theme>
      </body>
    </html>
  );
}