import Image from "next/image";
import { notFound } from "next/navigation";

import { Container, Title, Center, Flex, Divider } from "@mantine/core";

import { getUserByUsername } from "@/lib/users";
import { getGarmentsByUserId } from "@/lib/garments";
import GarmentCardList from "@/components/garment/garment-card-list";

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

      <GarmentCardList garments={garments} />
    </Container>
  );
}
