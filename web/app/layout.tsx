// Root layout: the <html> and <body> shell every page renders inside, plus the
// site-wide metadata and global styles.
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wikipoell",
  description: "An archive of Carol Christian Poell garments.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
