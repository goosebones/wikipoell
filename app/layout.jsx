import "./globals.css";
import "@radix-ui/themes/styles.css";
import { Theme, Grid, Flex } from "@radix-ui/themes";
import Link from "next/link";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import {
  ClerkProvider,
  SignInButton,
  SignUpButton,
  SignedIn,
  SignedOut,
  UserButton,
} from "@clerk/nextjs";
import { shadcn } from "@clerk/themes";

import CategoriesMenu from "@/components/category/category-menu";
import SidebarMenu from "@/components/sidebar-menu";
import UploadGarmentLink from "@/components/upload-garment-link";
import { getProperties } from "@/lib/properties";
import { PropertiesProvider } from "@/components/context/property-context-provider";
import { getCategories } from "@/lib/categories";
import { CategoriesProvider } from "@/components/context/category-context-provider";
import { Button } from "@/styles/components/ui/button";

export default async function RootLayout({ children }) {
  const properties = await getProperties();
  const categories = await getCategories();

  return (
    <html lang="en">
      <body className="mb-10 mx-2 mt-1">
        <Theme>
          <ClerkProvider appearance={{ theme: shadcn }}>
            <PropertiesProvider properties={properties}>
              <CategoriesProvider categories={categories}>
                <Grid
                  columns="3"
                  gap="4"
                >
                  <Flex align="center">
                    <SidebarMenu>
                      <UploadGarmentLink className="mb-6" />
                      <CategoriesMenu className="mb-6" />
                    </SidebarMenu>
                  </Flex>
                  <Flex
                    align="center"
                    justify="center"
                  >
                    <h1 className="text-2xl font-bold">
                      <Link href="/">Wikipoell</Link>
                    </h1>
                  </Flex>
                  <Flex
                    align="center"
                    justify="end"
                  >
                    {/* Show the sign-in and sign-up buttons when the user is signed out */}
                    <SignedOut>
                      <SignInButton>
                        <Button
                          size="xs"
                          variant="ghost"
                        >
                          Log In
                        </Button>
                      </SignInButton>
                      <SignUpButton>
                        <Button
                          size="xs"
                          variant="ghost"
                        >
                          Sign Up
                        </Button>
                      </SignUpButton>
                    </SignedOut>
                    {/* Show the user button when the user is signed in */}
                    <SignedIn>
                      <UserButton />
                    </SignedIn>
                  </Flex>
                </Grid>
                {children}
                <Analytics />
                <SpeedInsights />
              </CategoriesProvider>
            </PropertiesProvider>
          </ClerkProvider>
        </Theme>
      </body>
    </html>
  );
}
