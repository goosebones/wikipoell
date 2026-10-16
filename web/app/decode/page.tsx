// The decoder at /decode?code=…: a pasted article code explained part by
// part (type, gender, model, procedures, material, process, color), each
// linking to its page, with a link to the garments it describes (matched on
// everything but procedures; see decodeArticleCode). Parts missing from the
// vocabulary are flagged; a code that can't be read gets a note on the format.
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Container } from "@/components/container";
import { DecodeForm } from "@/components/decode-form";
import { cleanArticleCode, decodeArticleCode } from "@/lib/article-code";
import { filterHref } from "@/lib/filters";
import { countGarments } from "@/lib/garments";
import { getVocabulary } from "@/lib/vocabulary";

export const metadata: Metadata = {
  title: "Decode an article code",
  description:
    "Paste a Carol Christian Poell article code to see what each part means and find matching garments.",
};

export default function DecodePage({ searchParams }: PageProps<"/decode">) {
  return (
    <Container className="pt-10">
      <Link
        href="/codebook"
        className="eyebrow hover:text-foreground"
      >
        Codebook
      </Link>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">
        Decode an article code
      </h1>
      {/* The code comes from the URL, so it is only known per request. */}
      <Suspense>
        {searchParams.then(({ code }) => (
          <Decoded code={typeof code === "string" ? code : ""} />
        ))}
      </Suspense>
    </Container>
  );
}

async function Decoded({ code }: { code: string }) {
  const vocab = await getVocabulary();
  const decoded = code.trim() ? decodeArticleCode(code, vocab) : null;
  const matches = decoded?.filters && {
    count: await countGarments(decoded.filters),
    href: filterHref("/garments", decoded.filters),
  };

  return (
    <>
      <div className="mt-6">
        <DecodeForm defaultValue={code} />
      </div>

      {code.trim() && !decoded && (
        <p className="mt-8 max-w-xl text-[14px] text-muted-foreground">
          “{code}” doesn’t read as an article code. Codes look like{" "}
          <span className="font-mono text-foreground">
            AM/2600-LR ROOMS/010
          </span>
          : type and gender, then the model number with any procedures, then the
          material with its process, and the color.
        </p>
      )}

      {decoded && (
        <>
          <p className="mt-10 font-mono text-xl sm:text-2xl">
            {cleanArticleCode(code)}
          </p>
          <dl className="mt-6 max-w-2xl divide-y divide-muted border-y border-muted text-[13px]">
            {decoded.parts.map((part) => (
              <div
                key={`${part.title} ${part.code}`}
                className="grid grid-cols-[6rem_5rem_1fr] items-baseline gap-3 py-2.5"
              >
                <dt className="text-muted-foreground">{part.title}</dt>
                <dd className="font-mono text-xs">{part.code}</dd>
                <dd>
                  {part.href ? (
                    <Link
                      href={part.href}
                      className="hover:underline"
                    >
                      {part.name ?? "No description yet"}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">
                      Not in the codebook
                    </span>
                  )}
                </dd>
              </div>
            ))}
          </dl>
          {matches && matches.count > 0 && (
            <Link
              href={matches.href}
              className="mt-6 inline-block text-[13px] underline underline-offset-4"
            >
              See {matches.count.toLocaleString("en")} matching{" "}
              {matches.count === 1 ? "garment" : "garments"} →
            </Link>
          )}
        </>
      )}
    </>
  );
}
