// Homepage backgrounds (the `homepagebackgrounds` collection): every image
// with whether it's in the homepage's rotation. Admins add them by upload,
// switch them in or out of the rotation, and remove them (which also deletes
// the file from R2). The homepage caches its backgrounds under
// "backgrounds", which every change refreshes; changes call updateTag, so
// they run from server actions.
import { ObjectId } from "mongodb";
import { updateTag } from "next/cache";
import { homepageBackgrounds } from "@/lib/db";
import { deleteBackground } from "@/lib/r2";

// Every background, newest first.
export async function getBackgrounds() {
  const docs = await homepageBackgrounds.find().sort({ _id: -1 }).toArray();
  return docs.map((b) => ({
    id: b._id.toString(),
    imageUrl: b.imageUrl,
    active: b.active,
  }));
}

// Records an uploaded image (lib/r2), into the rotation from the start.
export async function addBackground(imageUrl: string) {
  await homepageBackgrounds.insertOne({
    _id: new ObjectId(),
    imageUrl,
    active: true,
  });
  updateTag("backgrounds");
}

export async function setBackgroundActive(id: string, active: boolean) {
  await homepageBackgrounds.updateOne(
    { _id: new ObjectId(id) },
    { $set: { active } },
  );
  updateTag("backgrounds");
}

export async function removeBackground(id: string) {
  const doc = await homepageBackgrounds.findOneAndDelete({
    _id: new ObjectId(id),
  });
  if (doc) await deleteBackground(doc.imageUrl);
  updateTag("backgrounds");
}
