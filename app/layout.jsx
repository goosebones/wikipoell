import "./globals.css";
import "@radix-ui/themes/styles.css";
import { Theme, Grid, Flex } from "@radix-ui/themes";
import { UserCircleIcon } from "lucide-react";
import Link from "next/link";

import CategoriesMenu from "@/components/category/category-menu";
import SidebarMenu  from "@/components/sidebar-menu";
import { getProperties } from "@/lib/properties";
import { PropertiesProvider } from "@/components/context/property-context-provider";

export default async function RootLayout({ children }) {
  const properties = await getProperties();

  return (
    <html lang="en">
      <body className="mb-10 mx-2 mt-1">
        <Theme>
          <PropertiesProvider properties={properties}>
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
          </PropertiesProvider>
          </Theme>
      </body>
    </html>
  );
}