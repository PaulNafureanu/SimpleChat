import { OperationResult } from "./db";
import { getXataClient } from "./xata";
const xata = getXataClient();

const f = async () => {
  const o = await xata.db.Categories.readOrThrow("");
};
