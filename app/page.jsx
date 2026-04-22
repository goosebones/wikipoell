import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { getRandomHomepageBackground } from "@/lib/homepage-backgrounds";

export default async function Page() {
  noStore();
  const backgroundUrl =
    (await getRandomHomepageBackground()) ?? "/background7.png";

  return (
    <main className="relative min-h-[calc(100vh-56px)] overflow-hidden">
      <div
        className="absolute inset-0 bg-center bg-cover bg-no-repeat"
        style={{ backgroundImage: `url('${backgroundUrl}')` }}
      />
      <div className="absolute inset-0 bg-white/35" />

      <div className="relative z-10 flex items-center justify-center min-h-[calc(100vh-56px)] px-4">
        <Link
          href="/category"
          className="inline-flex items-center justify-center rounded-md border border-black/20 bg-white/80 px-8 py-4 text-2xl font-semibold text-black shadow-sm backdrop-blur-sm transition hover:bg-white"
        >
          Start Browsing
        </Link>
      </div>
    </main>
  );
}
