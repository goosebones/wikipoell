// The data quality dashboard at /admin/quality: each issue with how many
// garments have it (rejected ones aside), each opening those garments in
// bulk edit to fix them, then the models no garment uses. Admins only;
// everyone else gets the 404 page.
import Link from "next/link";
import { Suspense } from "react";
import { AdminNav } from "@/components/admin-nav";
import { Container } from "@/components/container";
import { requireAdmin } from "@/lib/auth";
import { getQualityReport } from "@/lib/quality";
import { cn } from "@/lib/utils";

export default function QualityPage() {
  return (
    <Container className="pt-10">
      {/* Everything sits inside the boundary, so nothing renders for a
          non-admin before the check fails. */}
      <Suspense fallback={null}>
        <Report />
      </Suspense>
    </Container>
  );
}

async function Report() {
  await requireAdmin();
  const { issues, unusedModels } = await getQualityReport();

  return (
    <>
      <AdminNav current="quality" />
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">
        Data quality
      </h1>
      <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {issues.map(({ issue, title, count }) => (
          <li key={issue}>
            <Link
              href={`/admin/bulk?issue=${issue}`}
              className={cn(
                "flex h-full flex-col justify-between rounded-md border p-4 hover:bg-muted",
                count > 0 && "border-amber-300 bg-amber-50 hover:bg-amber-100",
              )}
            >
              <span className="font-medium">{title}</span>
              <span className="mt-3 flex items-baseline justify-between">
                <span className="font-mono text-2xl">{count}</span>
                <span className="eyebrow">
                  {count > 0 ? "Fix in bulk →" : "All clear"}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <h2 className="mt-12 flex items-baseline justify-between border-b border-muted pb-2 font-medium">
        Models no garment uses
        <span className="font-mono text-xs text-muted-foreground">
          {unusedModels.length}
        </span>
      </h2>
      {unusedModels.length === 0 ? (
        <p className="mt-4 text-[13px] text-muted-foreground">
          Every model has garments.
        </p>
      ) : (
        <ul className="mt-3 text-[13px]">
          {unusedModels.map((m) => (
            <li
              key={m.id}
              className="py-1"
            >
              <span className="mr-3 font-mono text-xs">{m.id}</span>
              {m.label}
            </li>
          ))}
        </ul>
      )}
      <Link
        href="/admin/vocabulary/models"
        className="mt-4 inline-block text-[13px] underline underline-offset-4"
      >
        Edit or delete them in the vocabulary →
      </Link>
    </>
  );
}
