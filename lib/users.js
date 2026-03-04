import { initMongo } from "./mongodb";
import User from "@/models/User";

const notDeleted = { $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }] };

export async function getUserByClerkId(userId) {
  if (!userId) return null;
  await initMongo();
  const user = await User.findOne({ userId, ...notDeleted }).lean();
  return user ? { ...user, id: user._id.toString() } : null;
}

export async function getUserByUsername(username) {
  if (!username || typeof username !== "string") return null;
  const normalized = username.trim();
  if (!normalized) return null;
  await initMongo();
  const user = await User.findOne({ username: normalized, ...notDeleted }).lean();
  return user ? { ...user, id: user._id.toString() } : null;
}
