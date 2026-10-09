import { HttpError } from "@/lib/errors";
import { getKv } from "@/lib/store";
import type { UserRecord } from "@/lib/types";

const USER_KEY = "user";

export async function getUser(): Promise<UserRecord | null> {
  return getKv().get<UserRecord>(USER_KEY);
}

export async function saveUser(user: UserRecord): Promise<void> {
  await getKv().set(USER_KEY, user);
}

export async function isSetupComplete(): Promise<boolean> {
  const user = await getUser();
  return Boolean(user?.setupComplete);
}

export function parseUsername(username: string): string {
  const normalized = username.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(normalized)) {
    throw new HttpError(
      400,
      "Username must be 3–32 characters and use letters, numbers, dots, underscores, or hyphens.",
    );
  }
  return normalized;
}
