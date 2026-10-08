// Home page. A placeholder for now; it becomes the search-led homepage in
// milestone 11.
import { Container } from "@/components/container";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <Container className="pt-16">
      <p className="eyebrow">Wikipoell</p>
      <div className="mt-8 flex gap-3">
        <Button>Browse the archive</Button>
        <Button variant="outline">Decode a code</Button>
      </div>
    </Container>
  );
}
