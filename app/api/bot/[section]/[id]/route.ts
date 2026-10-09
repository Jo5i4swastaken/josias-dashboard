import { requireApiToken } from "@/lib/api-auth";
import { deleteItem, updateItem } from "@/lib/dashboard";
import { json, readJson, routeParams } from "@/lib/http";

export const PATCH = routeParams<{ section: string; id: string }>(async (req, params) => {
  requireApiToken(req);
  const item = await updateItem(params.section, params.id, await readJson(req));
  return json({ item });
});

export const DELETE = routeParams<{ section: string; id: string }>(async (req, params) => {
  requireApiToken(req);
  await deleteItem(params.section, params.id);
  return json({ ok: true });
});
