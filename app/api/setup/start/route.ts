import { beginSetup } from "@/lib/auth";
import { json, readJson, requirePassword, requireString, route } from "@/lib/http";
import { assertSameOrigin } from "@/lib/origin";
import { readSetupSession } from "@/lib/session";

export const POST = route(async (req) => {
  assertSameOrigin(req);
  const body = await readJson(req);
  const result = await beginSetup({
    token: requireString(body, "token", 512)!,
    username: requireString(body, "username", 32)!,
    password: requirePassword(body),
    email: requireString(body, "email", 254)!,
  });
  const setup = await readSetupSession();
  setup.nonce = result.nonce;
  await setup.save();
  return json({
    qrDataUrl: result.qrDataUrl,
    otpauthUrl: result.otpauthUrl,
    manualKey: result.manualKey,
  });
});
