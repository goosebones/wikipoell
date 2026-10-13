// A member's public profile at /user/[username]: their avatar, username and
// when they joined. Favorites and owned pieces are added here in milestone 13.
// Unknown or deleted accounts get the 404 page.
import Image from "next/image";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Container } from "@/components/container";
import { getProfile } from "@/lib/users";

export default function UserPage({ params }: PageProps<"/user/[username]">) {
  return (
    <Container className="pt-10">
      {/* The username comes from the URL, so it is only known per request. */}
      <Suspense>
        {params.then(({ username }) => (
          <Profile username={decodeURIComponent(username)} />
        ))}
      </Suspense>
    </Container>
  );
}

async function Profile({ username }: { username: string }) {
  const profile = await getProfile(username);
  if (!profile) notFound();

  return (
    <div className="flex items-center gap-5">
      <div className="relative size-20 shrink-0 overflow-hidden rounded-full bg-muted">
        {profile.imageUrl && (
          <Image
            src={profile.imageUrl}
            alt=""
            fill
            sizes="80px"
            className="object-cover"
          />
        )}
      </div>
      <div>
        <p className="eyebrow">Member</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
          {profile.username}
        </h1>
        <p className="mt-1 font-mono text-xs text-muted-foreground">
          Joined{" "}
          {profile.joined.toLocaleDateString("en", {
            month: "long",
            year: "numeric",
          })}
        </p>
      </div>
    </div>
  );
}
