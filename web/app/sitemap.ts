// /sitemap.xml: every public page with content (lib/seo), as full URLs, so
// search engines find each garment, model and category, color and material.
import type { MetadataRoute } from "next";
import { getSitemapEntries } from "@/lib/seo";

const SITE = "https://wikipoell.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries = await getSitemapEntries();
  return entries.map(({ path, ...rest }) => ({
    url: `${SITE}${path}`,
    ...rest,
  }));
}
