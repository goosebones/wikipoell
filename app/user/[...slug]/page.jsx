import Image from "next/image";
import { notFound } from "next/navigation";

import {
  Container,
  Title,
  Center,
  Flex,
  Divider,
  SimpleGrid,
} from "@mantine/core";

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
      <Center mt="md">
        <Flex
          direction="column"
          gap="md"
          align="center"
        >
          <Image
            src={imageUrl}
            alt={displayName ? `${displayName}'s avatar` : "User avatar"}
            width={128}
            height={128}
            className="rounded-full"
            unoptimized
          />
          <Title order={1}>{displayName}</Title>
        </Flex>
      </Center>

      <Divider my="md" />

      <Title
        order={3}
        mb="md"
      >
        Uploaded garments
      </Title>

      {garments.length > 0 ? (
        <SimpleGrid
          cols={2}
          className="mb-10"
        >
          {garments.map((garment) => (
            <GarmentCard
              key={garment._id}
              garment={garment}
            />
          ))}
        </SimpleGrid>
      ) : (
        <p className="text-muted-foreground">No garments uploaded yet.</p>
      )}
    </Container>
  );
}
