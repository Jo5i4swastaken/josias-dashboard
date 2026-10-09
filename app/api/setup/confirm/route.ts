import { confirmSetup } from "@/lib/auth";
import { establishSession, requireSetupNonce } from "@/lib/guard";
import { json, readJson, requireString, route } from "@/lib/http";
import { getUser } from "@/lib/user";

export const POST = route(async (req) => {
  const nonce = await requireSetupNonce(req);
  const body = await readJson(req);
  const recoveryCodes = await confirmSetup(nonce, requireString(body, "code", 16)!);
  const user = await getUser();
  if (user?.username) {
    await establishSession(user.username);
  }
  return json({ ok: true, recoveryCodes });
});
