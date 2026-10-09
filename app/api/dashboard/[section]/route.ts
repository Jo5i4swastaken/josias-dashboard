import { createItem } from "@/lib/dashboard";
import { requireUser } from "@/lib/guard";
import { json, readJson, routeParams } from "@/lib/http";

export const POST = routeParams<{ section: string }>(async (req, params) => {
  await requireUser(req);
  const item = await createItem(params.section, await readJson(req));
  return json({ item }, 201);
});
