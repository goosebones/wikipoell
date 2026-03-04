import Image from "next/image";
import { notFound } from "next/navigation";

import { Container, Section, Heading } from "@radix-ui/themes";

import { getUserByUsername } from "@/lib/users";
import { getGarmentsByUserId } from "@/lib/garments";
import GarmentCard from "@/components/garment-card";

export default async function UserProfilePage({ params }) {
  const { slug } = await params;
  const username = Array.isArray(slug) ? slug[0] : slug;

  const user = await getUserByUsername(username);
  if (!user) {
    notFound();
  }

  const garments = await getGarmentsByUserId(user.userId);

  const { username: displayName, imageUrl } = user;

  return (
    <Container>
      <Section size="2">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:gap-8">
          {imageUrl && (
            <div className="relative size-24 shrink-0 overflow-hidden rounded-full bg-muted sm:size-32">
              <Image
                src={imageUrl}
                alt={displayName ? `${displayName}'s avatar` : "User avatar"}
                width={128}
                height={128}
                className="object-cover"
                unoptimized
              />
            </div>
          )}
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <Heading
              size="7"
              className="mb-1"
            >
              {displayName}
            </Heading>
          </div>
        </div>
      </Section>

      <Section size="2">
        <div className="mb-6">
          <Heading size="5">Uploaded garments</Heading>
        </div>
        {garments.length > 0 ? (
          <div className="flex flex-wrap gap-4 justify-center">
            {garments.map((garment) => (
              <div
                className="w-45"
                key={garment._id}
              >
                <GarmentCard garment={garment} />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground">No garments uploaded yet.</p>
        )}
      </Section>
    </Container>
  );
}
