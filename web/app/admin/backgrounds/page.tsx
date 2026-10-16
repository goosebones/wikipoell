// Homepage backgrounds at /admin/backgrounds: every background image, with
// whether it's in the homepage's rotation, and an upload for new ones.
// Admins only; everyone else gets the 404 page.
import { Suspense } from "react";
import { AdminNav } from "@/components/admin-nav";
import { BackgroundManager } from "@/components/background-manager";
import { Container } from "@/components/container";
import { requireAdmin } from "@/lib/auth";
import { getBackgrounds } from "@/lib/backgrounds";

export default function BackgroundsPage() {
  return (
    <Container className="pt-10">
      {/* Everything sits inside the boundary, so nothing renders for a
          non-admin before the check fails. */}
      <Suspense fallback={null}>
        <Backgrounds />
      </Suspense>
    </Container>
  );
}

async function Backgrounds() {
  await requireAdmin();
  const backgrounds = await getBackgrounds();
  return (
    <>
      <AdminNav current="backgrounds" />
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">
        Homepage backgrounds
      </h1>
      <p className="mt-2 text-[13px] text-muted-foreground">
        {backgrounds.filter((b) => b.active).length} of {backgrounds.length} in
        the rotation. The homepage crossfades through them in order.
      </p>
      <BackgroundManager backgrounds={backgrounds} />
    </>
  );
}
