import { Container, Title, Group, Badge } from "@mantine/core";
import { getProperties } from "@/lib/properties";
import PropertiesManager from "@/components/admin/properties/properties-manager";

export default async function AdminPropertiesPage() {
  const properties = await getProperties();

  return (
    <Container
      size="lg"
      py="md"
    >
      <Group
        mb="lg"
        align="center"
      >
        <Title>Properties</Title>
        <Badge
          size="lg"
          variant="light"
          color="violet"
        >
          {properties.length} total
        </Badge>
      </Group>
      <PropertiesManager initialProperties={properties} />
    </Container>
  );
}
