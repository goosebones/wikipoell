// The archive at /garments: every published garment, loading more as the
// visitor scrolls, with sort (?sort=model|title) and view (?view=list) in the
// URL.
import type { Metadata } from "next";
import { Suspense } from "react";
import { Container } from "@/components/container";
import { GarmentBrowser } from "@/components/garment-browser";

export const metadata: Metadata = {
  title: "All garments",
  description:
    "Every garment in the Carol Christian Poell archive, filterable by model, type, material, color, procedure and more.",
};

export default function GarmentsPage({ searchParams }: PageProps<"/garments">) {
  return (
    <Container className="pt-10">
      <p className="eyebrow">Archive</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">
        All garments
      </h1>
      {/* Sort and view come from the URL, which is only known per request. */}
      <Suspense>
        <GarmentBrowser
          searchParams={searchParams}
          scope={{}}
          basePath="/garments"
        />
      </Suspense>
    </Container>
  );
}
