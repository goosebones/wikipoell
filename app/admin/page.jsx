import { getAdminQueue } from "@/lib/garments";
import { getProperties } from "@/lib/properties";
import { getCategories } from "@/lib/categories";
import { Container, Title, Text, Group, Badge } from "@mantine/core";
import GarmentReviewCard from "@/components/admin/garment-review/garment-review-card";
import AdminPagination from "@/components/admin/admin-pagination";
import AdminFilters from "@/components/admin/admin-filters";

const PAGE_SIZE = 50;

export default async function AdminPage({ searchParams }) {
  const resolved = await searchParams;
  const page = Math.max(1, parseInt(resolved.page ?? "1", PAGE_SIZE));
  const statusFilter = resolved.status ?? "pending";
  const titleFilter = resolved.title ?? "";
  const idFilter = resolved.id ?? "";

  const [{ garments, total }, properties, categories] = await Promise.all([
    getAdminQueue({
      status: statusFilter,
      page,
      limit: PAGE_SIZE,
      title: titleFilter,
      id: idFilter,
    }),
    getProperties(),
    getCategories(),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <Container
      size="lg"
      py="md"
    >
      <Group
        mb="md"
        align="center"
      >
        <Title>Admin Review</Title>
        <Badge
          color={statusFilter === "pending" ? "yellow" : "gray"}
          size="lg"
        >
          {total} {statusFilter}
        </Badge>
        <a
          href="/admin/agent"
          style={{ textDecoration: "none" }}
        >
          <Badge
            variant="outline"
            color="violet"
            style={{ cursor: "pointer" }}
          >
            Agent Review
          </Badge>
        </a>
      </Group>

      <AdminFilters
        title={titleFilter}
        id={idFilter}
      />

      <Group
        mb="lg"
        gap="xs"
      >
        {["pending", "published", "rejected"].map((s) => (
          <a
            key={s}
            href={`/admin?status=${s}`}
            style={{ textDecoration: "none" }}
          >
            <Badge
              variant={statusFilter === s ? "filled" : "outline"}
              color="gray"
              style={{ cursor: "pointer" }}
            >
              {s}
            </Badge>
          </a>
        ))}
      </Group>

      {garments.length === 0 ? (
        <Text c="dimmed">No {statusFilter} garments.</Text>
      ) : (
        <div
          style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}
        >
          {garments.map((garment) => (
            <GarmentReviewCard
              key={garment._id}
              garment={garment}
              properties={properties}
              categories={categories}
            />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <AdminPagination
          page={page}
          totalPages={totalPages}
          status={statusFilter}
          title={titleFilter}
          id={idFilter}
        />
      )}
    </Container>
  );
}
