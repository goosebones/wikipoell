// 404 page. Shown for URLs that match no route and wherever a page calls
// `notFound()` (e.g. a garment id that doesn't exist). Renders inside the root
// layout, so the header and footer stay.
import Link from "next/link";
import { Container } from "@/components/container";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <Container className="pt-16">
      <p className="eyebrow">404</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">
        Nothing here.
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        This page doesn&apos;t exist, or the garment has been removed.
      </p>
      <Button
        asChild
        variant="outline"
        className="mt-8"
      >
        <Link href="/">Back home</Link>
      </Button>
    </Container>
  );
}
