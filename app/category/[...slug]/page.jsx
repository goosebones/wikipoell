import { getCategories } from "@/lib/categories";
import { getGarments } from "@/lib/garments";
import { notFound } from "next/navigation";
import FilterMenuClient from "@/components/filter/filter-menu-client";
import GarmentCardList from "@/components/garment/garment-card-list";
import { Container, Title, Box } from "@mantine/core";

export default async function CategoryPage({ params, searchParams }) {
  const categories = await getCategories();
  const { slug } = await params;

  const resolvedSearchParams = await searchParams;

  const categoryId = slug.join(".");
  const currentCategory = categories.find((cat) => cat._id === categoryId);
  if (!currentCategory) {
    notFound();
  }

  const garments = await getGarments({
    ...resolvedSearchParams,
    category: categoryId,
  });

  return (
    <Container>
      <Title
        order={1}
        mb="md"
        mt="sm"
      >
        {currentCategory.name}
      </Title>

      <Box pb="sm">
        <FilterMenuClient />
      </Box>

      <GarmentCardList garments={garments} />
    </Container>
  );
}
