import { requireApiToken } from "@/lib/api-auth";
import { getBotState } from "@/lib/dashboard";
import { json, route } from "@/lib/http";

export const GET = route(async (req) => {
  requireApiToken(req);
  return json(await getBotState());
});
