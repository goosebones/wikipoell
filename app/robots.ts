// /robots.txt: everything public may be crawled, admin pages and APIs not,
// and the sitemap is where to find every page.
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api"] },
    sitemap: "https://wikipoell.com/sitemap.xml",
  };
}
