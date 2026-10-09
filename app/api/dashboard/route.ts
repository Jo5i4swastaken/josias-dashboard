import { getUiView } from "@/lib/dashboard";
import { requireUser } from "@/lib/guard";
import { json, route } from "@/lib/http";

export const GET = route(async (req) => {
  const username = await requireUser(req);
  const view = await getUiView();
  return json({ ...view, username });
});
