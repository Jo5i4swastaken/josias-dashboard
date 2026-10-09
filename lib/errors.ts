export class HttpError extends Error {
  readonly status: number;
  readonly retryAfterSeconds?: number;

  constructor(status: number, message: string, retryAfterSeconds?: number) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export function minutesLeft(retryAt: number, now: number): number {
  return Math.max(1, Math.ceil((retryAt - now) / 60_000));
}

export function tooManyAttempts(retryAt: number, now: number): HttpError {
  const minutes = minutesLeft(retryAt, now);
  const unit = minutes === 1 ? "minute" : "minutes";
  const retryAfterSeconds = Math.max(1, Math.ceil((retryAt - now) / 1000));
  return new HttpError(
    429,
    `Too many attempts. Try again in ${minutes} ${unit}.`,
    retryAfterSeconds,
  );
}
