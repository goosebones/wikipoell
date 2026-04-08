import GarmentCard from "@/components/garment/garment-card";
import { SimpleGrid } from "@mantine/core";

export default function GarmentCardList({ garments }) {
  return (
    <>
      {garments.length > 0 ? (
        <SimpleGrid
          cols={{ base: 2, sm: 3, md: 4 }}
          className="mb-10"
          spacing="sm"
          verticalSpacing="sm"
        >
          {garments.map((garment) => (
            <GarmentCard
              key={garment._id}
              garment={garment}
            />
          ))}
        </SimpleGrid>
      ) : (
        <p className="text-muted-foreground">No garments found.</p>
      )}
    </>
  );
}
