import { unstable_noStore as noStore } from "next/cache";
import { getRandomHomepageBackground } from "@/lib/homepage-backgrounds";
import HomepageSearch from "@/components/homepage-search";

export default async function Page() {
  noStore();
  const backgroundUrl =
    (await getRandomHomepageBackground()) ?? "/default-background.png";

  return (
    <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <div
        className="absolute inset-0 bg-center bg-cover bg-no-repeat"
        style={{ backgroundImage: `url('${backgroundUrl}')` }}
      />
      <div className="absolute inset-0 bg-white/35" />

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4">
        <HomepageSearch />
      </div>
    </main>
  );
}
