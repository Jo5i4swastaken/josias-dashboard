import { PASSWORD_MAX } from "@/lib/constants";
import { HttpError } from "@/lib/errors";

export function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

export function jsonError(error: unknown): Response {
  if (error instanceof HttpError) {
    const headers: Record<string, string> = { "cache-control": "no-store" };
    if (error.retryAfterSeconds) {
      headers["retry-after"] = String(error.retryAfterSeconds);
    }
    return Response.json({ error: error.message }, { status: error.status, headers });
  }
  if (error instanceof Error && /DASHBOARD_|KV_REST_API|EMAIL_FROM|Email is not configured/.test(error.message)) {
    return Response.json(
      { error: error.message },
      { status: 500, headers: { "cache-control": "no-store" } },
    );
  }
  console.error(error);
  return Response.json(
    { error: "Something went wrong." },
    { status: 500, headers: { "cache-control": "no-store" } },
  );
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new HttpError(400, "Expected a JSON body.");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new HttpError(400, "Expected a JSON object.");
  }
  return body as Record<string, unknown>;
}

export function requireString(
  body: Record<string, unknown>,
  key: string,
  max: number,
  required = true,
): string | undefined {
  const value = body[key];
  if (value === undefined || value === null || value === "") {
    if (required) {
      throw new HttpError(400, `Enter ${key}.`);
    }
    return undefined;
  }
  if (typeof value !== "string") {
    throw new HttpError(400, `${key} must be a string.`);
  }
  const trimmed = value.trim();
  if (!trimmed) {
    if (required) {
      throw new HttpError(400, `Enter ${key}.`);
    }
    return undefined;
  }
  if (trimmed.length > max) {
    throw new HttpError(400, `${key} must be at most ${max} characters.`);
  }
  return trimmed;
}

export function requirePassword(body: Record<string, unknown>): string {
  const value = body.password;
  if (typeof value !== "string" || value.length < 1) {
    throw new HttpError(400, "Enter password.");
  }
  if (value.length > PASSWORD_MAX) {
    throw new HttpError(400, `Password must be at most ${PASSWORD_MAX} characters.`);
  }
  return value;
}

export function optionalBoolean(body: Record<string, unknown>, key: string): boolean | undefined {
  const value = body[key];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "boolean") {
    throw new HttpError(400, `${key} must be true or false.`);
  }
  return value;
}

export function route(handler: (req: Request) => Promise<Response>) {
  return async (req: Request) => {
    try {
      return await handler(req);
    } catch (error) {
      return jsonError(error);
    }
  };
}

export function routeParams<T extends Record<string, string>>(
  handler: (req: Request, params: T) => Promise<Response>,
) {
  return async (req: Request, ctx: { params: Promise<T> }) => {
    try {
      return await handler(req, await ctx.params);
    } catch (error) {
      return jsonError(error);
    }
  };
}
