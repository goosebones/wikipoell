// Who may do what. Admins are Clerk users whose public metadata has
// `role: "admin"` (set in the Clerk dashboard). Every admin page and server
// action calls `requireAdmin()` itself: layouts don't re-run on navigation, so
// they can't be the gate. Reads the session, so callers must sit inside
// <Suspense>.
import { currentUser } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";

export async function isAdmin() {
  const user = await currentUser();
  return user?.publicMetadata.role === "admin";
}

// Non-admins get the 404 page rather than "forbidden", so admin pages don't
// advertise that they exist.
export async function requireAdmin() {
  if (!(await isAdmin())) notFound();
}
