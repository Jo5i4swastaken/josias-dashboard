import { authenticatePassword } from "@/lib/auth";
import { requirePassword, json, readJson, requireString, route } from "@/lib/http";
import { assertSameOrigin } from "@/lib/origin";
import { readPending } from "@/lib/session";

export const POST = route(async (req) => {
  assertSameOrigin(req);
  const body = await readJson(req);
  const username = requireString(body, "username", 32)!;
  const password = requirePassword(body);
  const result = await authenticatePassword(username, password);
  const pending = await readPending();
  pending.username = result.username;
  pending.issuedAt = Date.now();
  await pending.save();
  return json({ ok: true, next: "2fa" });
});
