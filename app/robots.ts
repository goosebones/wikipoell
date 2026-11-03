// /robots.txt: public pages may be crawled; admin pages, APIs and any URL
// with a query string (filtered views) may not. The sitemap lists every page.
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Query strings are filters, sorts and searches: endless combinations
      // of pages the sitemap already covers.
      disallow: ["/admin", "/api", "/*?"],
    },
    sitemap: "https://wikipoell.com/sitemap.xml",
  };
}
