import { HttpError } from "@/lib/errors";
import { safeEqual } from "@/lib/safe-equal";

const MAX_TOKEN_LENGTH = 512;

export function tokenFromRequest(req: Request): string | null {
  const header = req.headers.get("authorization");
  if (!header) {
    return null;
  }
  const match = /^Bearer\s+(\S+)\s*$/i.exec(header);
  return match?.[1] ?? null;
}

export function isValidApiToken(presented: string | null): boolean {
  const expected = process.env.DASHBOARD_API_TOKEN ?? "";
  if (!presented || !expected || presented.length > MAX_TOKEN_LENGTH || expected.length > MAX_TOKEN_LENGTH) {
    safeEqual(presented ?? "", expected || "missing-api-token");
    return false;
  }
  return safeEqual(presented, expected);
}

export function requireApiToken(req: Request): void {
  if (!isValidApiToken(tokenFromRequest(req))) {
    throw new HttpError(401, "Unauthorized.");
  }
}
