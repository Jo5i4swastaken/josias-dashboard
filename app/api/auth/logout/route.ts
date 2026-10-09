import { json, route } from "@/lib/http";
import { assertSameOrigin } from "@/lib/origin";
import { readPending, readSession, readSetupSession } from "@/lib/session";

export const POST = route(async (req) => {
  assertSameOrigin(req);
  const session = await readSession();
  session.destroy();
  const pending = await readPending();
  pending.destroy();
  const setup = await readSetupSession();
  setup.destroy();
  return json({ ok: true });
});
