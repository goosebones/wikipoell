// Admin home at /admin. Admins only; everyone else gets the 404 page. A
// placeholder for now: the review queue, vocabulary editor and other tools are
// added here from milestone 15 on.
import { Suspense } from "react";
import { Container } from "@/components/container";
import { requireAdmin } from "@/lib/auth";

export default function AdminPage() {
  return (
    <Container className="pt-16">
      {/* Everything sits inside the boundary, so nothing renders for a
          non-admin before the check fails. */}
      <Suspense fallback={null}>
        <AdminHome />
      </Suspense>
    </Container>
  );
}

async function AdminHome() {
  await requireAdmin();
  return (
    <>
      <p className="eyebrow">Admin</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">
        Admin tools
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Nothing here yet. The review queue and vocabulary editor come later.
      </p>
    </>
  );
}
