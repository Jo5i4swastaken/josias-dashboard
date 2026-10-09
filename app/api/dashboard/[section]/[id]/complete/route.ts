import { completeItem } from "@/lib/dashboard";
import { requireUser } from "@/lib/guard";
import { json, routeParams } from "@/lib/http";

export const POST = routeParams<{ section: string; id: string }>(async (req, params) => {
  await requireUser(req);
  const item = await completeItem(params.section, params.id);
  return json({ item });
});
