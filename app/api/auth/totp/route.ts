import { verifyTotpLogin } from "@/lib/auth";
import { establishSession, requirePendingUsername } from "@/lib/guard";
import { json, readJson, requireString, route } from "@/lib/http";

export const POST = route(async (req) => {
  const username = await requirePendingUsername(req);
  const body = await readJson(req);
  const code = requireString(body, "code", 16)!;
  await verifyTotpLogin(username, code);
  await establishSession(username);
  return json({ ok: true });
});
