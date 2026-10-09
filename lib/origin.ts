import { HttpError } from "@/lib/errors";

/**
 * Cookie-authenticated mutations must come from the same site.
 * Browsers set Sec-Fetch-Site and Origin; scripts cannot spoof Sec-Fetch-Site.
 */
export function assertSameOrigin(req: Request): void {
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") {
    throw new HttpError(403, "Cross-origin request blocked.");
  }

  const origin = req.headers.get("origin");
  if (!origin) {
    throw new HttpError(403, "Missing origin.");
  }

  let originHost = "";
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new HttpError(403, "Cross-origin request blocked.");
  }

  const forwarded = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = req.headers.get("host")?.trim();
  const allowed = [forwarded, host].filter((value): value is string => Boolean(value));
  if (!allowed.includes(originHost)) {
    throw new HttpError(403, "Cross-origin request blocked.");
  }
}
