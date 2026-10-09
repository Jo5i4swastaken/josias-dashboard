import { requireApiToken } from "@/lib/api-auth";
import { completeItem } from "@/lib/dashboard";
import { json, routeParams } from "@/lib/http";

export const POST = routeParams<{ section: string; id: string }>(async (req, params) => {
  requireApiToken(req);
  const item = await completeItem(params.section, params.id);
  return json({ item });
});
