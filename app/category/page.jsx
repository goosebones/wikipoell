import { getGarments } from "@/lib/garments";
import FilterMenuClient from "@/components/filter/filter-menu-client";
import GarmentCardList from "@/components/garment/garment-card-list";
import { Container, Title, Box } from "@mantine/core";

export default async function CategoryIndexPage({ searchParams }) {
  const resolvedSearchParams = await searchParams;
  const garments = await getGarments(resolvedSearchParams);

  return (
    <Container>
      <Title
        order={1}
        mb="md"
        mt="sm"
      >
        All Categories
      </Title>

      <Box pb="sm">
        <FilterMenuClient />
      </Box>

      <GarmentCardList garments={garments} />
    </Container>
  );
}
