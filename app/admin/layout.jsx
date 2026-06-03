import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Box, Flex, Title } from "@mantine/core";
import AdminNav from "@/components/admin/admin-nav";

export default async function AdminLayout({ children }) {
  const { userId, sessionClaims } = await auth();
  if (!userId || sessionClaims?.metadata?.role !== "admin") {
    console.log("Admin layout: Unauthorized user");
    redirect("/");
  }

  return (
    <Flex
      align="stretch"
      gap={0}
    >
      <Box
        component="nav"
        w={220}
        py="md"
        px="sm"
        style={{
          flexShrink: 0,
          borderRight: "1px solid var(--mantine-color-gray-3)",
        }}
      >
        <Title
          order={5}
          mb="sm"
          px="xs"
        >
          Admin
        </Title>
        <AdminNav />
      </Box>
      <Box style={{ flex: 1, minWidth: 0 }}>{children}</Box>
    </Flex>
  );
}
