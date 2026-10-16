// POST /api/admin/backgrounds: uploads one homepage background (form field
// "image") to R2 as WebP and returns its URL; the backgrounds screen then
// records it with a server action. A route rather than a server action, so a
// large photo isn't held to server actions' small body limit. Admins only;
// anything that isn't an image up to 20 MB is refused.
import { isAdmin } from "@/lib/auth";
import { uploadBackground } from "@/lib/r2";

export async function POST(request: Request) {
  if (!(await isAdmin())) return new Response("Not allowed", { status: 403 });
  const image = (await request.formData()).get("image");
  if (!(image instanceof File) || !image.type.startsWith("image/")) {
    return Response.json({ error: "Choose an image." }, { status: 400 });
  }
  if (image.size > 20 * 1024 * 1024) {
    return Response.json(
      { error: "Images can be up to 20 MB." },
      { status: 400 },
    );
  }
  try {
    const url = await uploadBackground(Buffer.from(await image.arrayBuffer()));
    return Response.json({ url });
  } catch (error) {
    // The visitor gets a plain message; the server log keeps the reason
    // (e.g. R2 refusing the write).
    console.error("Background upload failed:", error);
    return Response.json(
      { error: "That image couldn’t be read or stored." },
      { status: 400 },
    );
  }
}
