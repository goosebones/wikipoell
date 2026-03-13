import "./globals.css";
import "@mantine/core/styles.css";
import {
  ColorSchemeScript,
  MantineProvider,
  mantineHtmlProps,
  createTheme,
  SimpleGrid,
  Flex,
} from "@mantine/core";
import Link from "next/link";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { ClerkProvider } from "@clerk/nextjs";
import { light } from "@clerk/themes";

import CategoriesMenu from "@/components/category/category-menu";
import SidebarMenu from "@/components/sidebar-menu";
import UploadGarmentLink from "@/components/upload-garment-link";
import { getProperties } from "@/lib/properties";
import { PropertiesProvider } from "@/components/context/property-context-provider";
import { getCategories } from "@/lib/categories";
import { CategoriesProvider } from "@/components/context/category-context-provider";
import HeaderAuth from "@/components/header-auth";

const lightTheme = createTheme({
  // White background, black text, gray accents
  primaryColor: "gray",
  primaryShade: { light: 7, dark: 7 },
  black: "#000000",
  white: "#ffffff",
  colors: {
    // Gray accents (borders, subtle buttons, etc.)
    gray: [
      "#f8f9fa",
      "#f1f3f5",
      "#e9ecef",
      "#dee2e6",
      "#ced4da",
      "#adb5bd",
      "#868e96",
      "#495057",
      "#343a40",
      "#212529",
    ],
  },
});

export default async function RootLayout({ children }) {
  const properties = await getProperties();
  const categories = await getCategories();

  return (
    <html
      lang="en"
      {...mantineHtmlProps}
    >
      <head>
        <ColorSchemeScript defaultColorScheme="light" />
      </head>
      <body className="mb-10 mx-2 mt-1 bg-white text-black">
        <MantineProvider
          theme={lightTheme}
          defaultColorScheme="light"
        >
          <ClerkProvider
            appearance={{
              baseTheme: light,
            }}
          >
            <PropertiesProvider properties={properties}>
              <CategoriesProvider categories={categories}>
                <SimpleGrid
                  cols={3}
                  className="p-2"
                >
                  <Flex
                    justify="start"
                    align="center"
                  >
                    <SidebarMenu>
                      <UploadGarmentLink className="mb-6" />
                      <CategoriesMenu className="mb-6" />
                    </SidebarMenu>
                  </Flex>
                  <h1 className="text-2xl font-bold text-center">
                    <Link href="/">Wikipoell</Link>
                  </h1>
                  <Flex
                    justify="end"
                    align="center"
                  >
                    <HeaderAuth />
                  </Flex>
                </SimpleGrid>
                {children}
                <Analytics />
                <SpeedInsights />
              </CategoriesProvider>
            </PropertiesProvider>
          </ClerkProvider>
        </MantineProvider>
      </body>
    </html>
  );
}
