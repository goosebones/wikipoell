// Root layout: the <html> and <body> shell every page renders inside, with the
// site header above and footer below each page. Wraps everything in Clerk's
// provider so any component can read the signed-in user. Also sets the
// site-wide metadata, global styles and fonts (Inter for text, JetBrains Mono
// for codes and labels), and loads Vercel Analytics and Speed Insights.
import { ClerkProvider } from "@clerk/nextjs";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
});

// Defaults for every page: pages set their own title (shown as "Title ·
// Wikipoell"), description and preview image on top. The base address makes
// preview images and canonical links absolute.
export const metadata: Metadata = {
  metadataBase: new URL("https://wikipoell.com"),
  title: { default: "Wikipoell", template: "%s · Wikipoell" },
  description:
    "An archive of Carol Christian Poell garments: every piece by model, material, color and article code.",
  openGraph: { siteName: "Wikipoell", type: "website" },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <ClerkProvider>
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <SiteFooter />
        </ClerkProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
