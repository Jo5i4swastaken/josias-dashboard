import { requireApiToken } from "@/lib/api-auth";
import { createItem } from "@/lib/dashboard";
import { json, readJson, routeParams } from "@/lib/http";

export const POST = routeParams<{ section: string }>(async (req, params) => {
  requireApiToken(req);
  const item = await createItem(params.section, await readJson(req));
  return json({ item }, 201);
});
