# Josias

A private, single-user week-at-a-glance dashboard. Josias signs in, sees urgent work, the current week, stalled items, incoming channels, and deadlines, and edits all of it in the browser. An assistant bot can read and update the same board through a bearer-token API.

The app is a Next.js (App Router, TypeScript) project. Josias imports this GitHub repository into Vercel himself. Nothing here deploys automatically.

## Local development

```bash
npm install
cp .env.example .env.local
# fill in the secrets below
npm run dev
```

Open [http://localhost:3000/setup](http://localhost:3000/setup) for the first run. After setup, that page disables itself and sign-in is at `/login`.

```bash
npm test
npm run build
```

Without `KV_REST_API_URL` and `KV_REST_API_TOKEN`, development uses a JSON file in `.data/` (or `DASHBOARD_DATA_DIR`). That file store is refused when `NODE_ENV=production`.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DASHBOARD_SESSION_SECRET` | Yes | Password for the encrypted session cookie. At least 32 characters. |
| `DASHBOARD_ENC_KEY` | Yes | 32-byte AES-256-GCM key. Encrypts the TOTP secret at rest. Also the HMAC key for one-time codes. |
| `DASHBOARD_SETUP_TOKEN` | Yes, for first run | Token typed on `/setup`. After setup finishes, the endpoint stays closed even if this value is still set. |
| `DASHBOARD_API_TOKEN` | Yes, for the bot | Bearer token for `/api/bot/*`. Compared with SHA-256 digests and `timingSafeEqual`. |
| `EMAIL_FROM` | Yes, to send mail | From address, for example `Josias <dash@example.com>`. |
| `DASHBOARD_2FA_EMAIL` | No | Inbox for emailed codes. If set, it overrides the address saved at setup, so the inbox can change without redoing setup. If unset, codes go to the address entered on `/setup`. |
| `RESEND_API_KEY` | One transport | Sends mail through [Resend](https://resend.com). Used first when it is set. |
| `SMTP_HOST` | One transport | SMTP host, used when `RESEND_API_KEY` is unset. |
| `SMTP_PORT` | With SMTP | Defaults to `587`. Port `465` turns on implicit TLS. |
| `SMTP_USER` | With SMTP auth | SMTP username. Omit, along with `SMTP_PASS`, for an open relay on a trusted network. |
| `SMTP_PASS` | With SMTP auth | SMTP password. |
| `KV_REST_API_URL` | Production | Upstash Redis REST URL. Vercel's Upstash integration sets this name. |
| `KV_REST_API_TOKEN` | Production | Upstash Redis REST token. |
| `DASHBOARD_TIMEZONE` | No | IANA timezone for "this week" and "today". Defaults to `UTC`. Example: `America/New_York`. |
| `DASHBOARD_DATA_DIR` | Dev only | Directory for the JSON file store. Defaults to `.data`. Ignored when the Redis variables are set. |

In production, sign-in email needs `EMAIL_FROM` and either `RESEND_API_KEY` or `SMTP_HOST`. In development, if neither transport is set, the code is printed in the server log instead of sent.

Copy `.env.example` to `.env.local`. Do not commit `.env`, `.env.local`, or anything in `.data/`.

## Generate secrets

Run each command once and paste the output into the matching variable. Do not reuse one secret for two variables.

```bash
# DASHBOARD_SESSION_SECRET  (32+ characters)
openssl rand -base64 32

# DASHBOARD_ENC_KEY  (32 bytes, base64 or 64 hex chars)
openssl rand -base64 32

# DASHBOARD_SETUP_TOKEN
openssl rand -base64 32

# DASHBOARD_API_TOKEN
openssl rand -base64 32
```

`openssl rand -hex 32` is also valid for `DASHBOARD_ENC_KEY`.

## Import the repo in Vercel from GitHub

1. Push this repository to GitHub. The default branch is `main`.
2. In the Vercel dashboard, choose **Add New… → Project**.
3. Import the GitHub repository. Vercel should detect Next.js. Leave the framework preset and build command (`next build`) as detected.
4. Before the first deploy, add every required variable under **Settings → Environment Variables** for Production (and Preview, if you use preview URLs). Use the openssl commands above. Do not put the secrets in the repo.
5. Deploy from the Vercel UI. This project does not call the Vercel API or CLI.

## Add Upstash Redis

1. In the Vercel project, open **Storage** (or the Marketplace) and create an **Upstash Redis** database.
2. Connect it to this project. The integration injects `KV_REST_API_URL` and `KV_REST_API_TOKEN`. Those are the names this app reads. `KV_REST_API_READ_ONLY_TOKEN` is not used.
3. Redeploy so the new variables are present at runtime.

Production will not boot the data layer without those two variables. Wiping the Redis database deletes the account and the board. `/setup` can run again only when no completed account is stored, and only with `DASHBOARD_SETUP_TOKEN`.

## First-run `/setup`

1. Set the environment variables, including `DASHBOARD_SETUP_TOKEN`, and start the app.
2. Open `/setup`.
3. Enter the setup token, a username (3–32 characters: letters, numbers, `.`, `_`, `-`), a password of at least 10 characters, and the email that should receive sign-in codes.
4. Scan the QR code with an authenticator app. The issuer is `JosiasDashboard`. If you can't scan, type the manual key.
5. Enter the 6-digit code from the app.
6. Write down the 8 recovery codes. They are shown once and stored only as HMAC-SHA256 hashes. Each code works a single time.
7. Setup then sets a permanent flag and `/setup` will not run again. Later visits only offer a link to sign in.

Sign-in is two steps:

1. Username and password. Passwords are hashed with argon2id. Five failed attempts per username lock that username for 15 minutes.
2. A second factor, chosen on the next screen:
   - **Authenticator app (recommended).** TOTP, RFC 6238, 30-second step, ±1 step for clock skew. A code that has already been accepted is rejected, including inside that window. Five failures in 15 minutes lock TOTP as well.
   - **Email a code.** Six digits, 10-minute expiry, single use, stored hashed, five attempts, 60-second resend cooldown. Sent with Resend or SMTP to `DASHBOARD_2FA_EMAIL` when that is set, otherwise to the address saved at setup.
   - **Recovery code.** One of the eight codes from setup.

The signed-in session is an encrypted, `httpOnly`, `SameSite=Lax` cookie (iron-session). It lasts 7 days. In production the cookie is `Secure`. The password step only sets a 10-minute pending cookie; the 7-day session is written after the second factor succeeds.

## Bot API

Send `Authorization: Bearer $DASHBOARD_API_TOKEN` on every request. A missing or wrong token returns `401` and does not reveal the expected value.

`GET /api/bot/state` returns the full board, including tasks from past weeks. The UI's `GET /api/dashboard` is session-authenticated and returns only the current week.

```json
{
  "state": {
    "urgent": [],
    "week": [],
    "stalled": [],
    "channels": [],
    "deadlines": []
  },
  "weekStart": "2026-10-05",
  "weekEnd": "2026-10-11",
  "today": "2026-10-08",
  "timeZone": "UTC"
}
```

Sections are `urgent`, `week`, `stalled`, `channels`, and `deadlines`.

| Method | Path | Body |
| --- | --- | --- |
| `POST` | `/api/bot/:section` | Create. See fields below. |
| `PATCH` | `/api/bot/:section/:id` | Update any subset of those fields, including `"done": true` or `false`. |
| `POST` | `/api/bot/:section/:id/complete` | Sets `done` to `true`. |
| `DELETE` | `/api/bot/:section/:id` | Removes the item. |

Create bodies:

```json
{ "title": "Call the supplier" }
```

```json
{ "title": "Draft the lab report", "day": "thu", "notes": "Section 2" }
```

`day` is `mon`, `tue`, `wed`, `thu`, `fri`, `sat`, or `sun`. The task is filed on the current week. Pass `"weekStart": "2026-10-05"` (a Monday) to target another week.

```json
{ "title": "Logo revision", "blockedOn": "Maya at the print shop", "notes": "" }
```

```json
{ "name": "WhatsApp", "status": "3 unread from the studio" }
```

```json
{ "title": "Essay draft", "dueAt": "2026-10-12", "notes": "History seminar" }
```

`dueAt` is `YYYY-MM-DD`. Deadlines come back soonest first, with finished ones after open ones. Create and update responses are `{ "item": { ... } }`. Errors are `{ "error": "..." }` with a 4xx or 5xx status.

The same paths exist under `/api/dashboard` for the signed-in browser. Those routes require the session cookie and a same-origin request. The bot should use `/api/bot`.

Example:

```bash
curl -sS "$ORIGIN/api/bot/state" \
  -H "Authorization: Bearer $DASHBOARD_API_TOKEN"

curl -sS -X POST "$ORIGIN/api/bot/week" \
  -H "Authorization: Bearer $DASHBOARD_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Office hours","day":"wed"}'
```

## What the board holds

- **Urgent** sits at the top.
- **This week** is Monday through Sunday in `DASHBOARD_TIMEZONE`. Checking a task sets `done`. The flag is stored in Redis (or the dev file) and is still set after a reload.
- **Stalled** items record who or what they are blocked on.
- **Channels** start as WhatsApp, Email, and School LMS. Each has a short status. Checking one marks it caught up.
- **Deadlines** are sorted soonest first.

Every section can be added, edited, checked off, and removed in the UI.

## Tests

`npm test` covers password hashing (argon2id), TOTP including replay, emailed codes (hash, expiry, single use, five attempts, resend cooldown), recovery codes, the 5-per-15-minute rate limit, and the API token on `GET /api/bot/state`.
