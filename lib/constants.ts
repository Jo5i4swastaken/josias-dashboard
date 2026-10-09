export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 128;

export const LOGIN_MAX_ATTEMPTS = 5;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;

export const EMAIL_CODE_TTL_MS = 10 * 60 * 1000;
export const EMAIL_CODE_MAX_ATTEMPTS = 5;
export const EMAIL_RESEND_COOLDOWN_MS = 60 * 1000;

export const TOTP_PERIOD_SECONDS = 30;
export const TOTP_WINDOW = 1;
export const TOTP_DIGITS = 6;
export const TOTP_ISSUER = "JosiasDashboard";
export const TOTP_ALGORITHM = "SHA1";

export const RECOVERY_CODE_COUNT = 8;
export const SECOND_FACTOR_MAX_ATTEMPTS = 5;
export const SECOND_FACTOR_WINDOW_MS = 15 * 60 * 1000;

export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
export const PENDING_TTL_SECONDS = 60 * 10;
export const SETUP_TTL_SECONDS = 60 * 15;

export const SESSION_COOKIE = "josias_session";
export const PENDING_COOKIE = "josias_pending";
export const SETUP_COOKIE = "josias_setup";
