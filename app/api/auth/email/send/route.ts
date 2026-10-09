import { sendLoginEmail } from "@/lib/auth";
import { requirePendingUsername } from "@/lib/guard";
import { json, route } from "@/lib/http";

export const POST = route(async (req) => {
  const username = await requirePendingUsername(req);
  const result = await sendLoginEmail(username);
  return json({ ok: true, maskedEmail: result.maskedEmail });
});
