// Home page. For now it shows the design tokens (type, label, code and button
// styles) so the look can be reviewed; it becomes the search-led homepage in
// milestone 11.
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-[1400px] px-4 pt-16 sm:px-6">
      <p className="eyebrow">Wikipoell</p>
      <div className="mt-8 flex gap-3">
        <Button>Browse the archive</Button>
        <Button variant="outline">Decode a code</Button>
      </div>
    </main>
  );
}
