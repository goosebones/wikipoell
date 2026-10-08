// Site footer: a single quiet line at the bottom of every page saying what the
// site is.
import { Container } from "@/components/container";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-muted">
      <Container className="py-8">
        <p className="eyebrow">Wikipoell · A Carol Christian Poell archive</p>
      </Container>
    </footer>
  );
}
