// MongoDB connection and one typed handle per collection. The database comes
// from MONGODB_URL (pinch-seam locally, spur-biter in production). The driver
// connects lazily on the first query and pools connections itself; the client
// is kept on `globalThis` so dev hot reloads reuse it instead of opening new
// connections each time. The client itself stays private; writes that must
// land together go through withTransaction.
import { type ClientSession, MongoClient } from "mongodb";
import type {
  Category,
  Garment,
  HomepageBackground,
  IngestRun,
  Model,
  Suggestion,
  Term,
  TreeNode,
  User,
  UserFavorite,
} from "@/types";

const g = globalThis as { mongo?: MongoClient };
const client = (g.mongo ??= new MongoClient(process.env.MONGODB_URL!));
const db = client.db();

export const garments = db.collection<Garment>("garments");
export const models = db.collection<Model>("models");
export const categories = db.collection<Category>("categories");
export const colors = db.collection<TreeNode>("colors");
export const materials = db.collection<TreeNode>("materials");
export const extras = db.collection<TreeNode>("extras");
export const types = db.collection<Term>("types");
export const genders = db.collection<Term>("genders");
export const procedures = db.collection<Term>("procedures");
export const processes = db.collection<Term>("processes");
export const users = db.collection<User>("users");
export const userFavorites = db.collection<UserFavorite>("userFavorites");
export const suggestions = db.collection<Suggestion>("suggestions");
export const ingestRuns = db.collection<IngestRun>("ingestruns");
export const homepageBackgrounds = db.collection<HomepageBackground>(
  "homepagebackgrounds",
);

// Runs `work` as one transaction: every write it makes with the session it's
// given lands together, or none does.
export async function withTransaction(
  work: (session: ClientSession) => Promise<void>,
) {
  await client.withSession((session) =>
    session.withTransaction(() => work(session)),
  );
}
