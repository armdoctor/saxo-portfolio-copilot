# Saxo Portfolio Copilot

A local-first web app that connects to your Saxo Bank account (read-only) and provides an AI chatbot for portfolio questions.

## Prerequisites

- Node.js 18+ and pnpm
- Docker (for PostgreSQL)
- A Saxo Bank developer account with app credentials
- An OpenAI API key (optional — chat is disabled without it)

## Quick Start

```bash
# 1. Start PostgreSQL
docker compose up -d

# 2. Copy and fill environment variables
cp .env.example .env
# Edit .env — see "Environment Variables" below for required values

# 3. Install dependencies
pnpm install

# 4. Generate Prisma client + run migrations
pnpm prisma generate
pnpm prisma migrate dev

# 5. Start the dev server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) and log in with `APP_USER_EMAIL` / `APP_USER_PASSWORD` from your `.env`.

The user is auto-created in the database on first login — no separate seed step needed.

### Clean Reset (if needed)

If you need to start fresh (e.g. schema changed):

```bash
docker compose down -v
docker compose up -d
pnpm prisma migrate dev
```

## Generating Keys

**NEXTAUTH_SECRET** (session signing):
```bash
openssl rand -base64 32
```

**TOKEN_ENCRYPTION_KEY** (AES-256-GCM for Saxo token encryption):
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## Saxo Bank Setup

1. Register at [Saxo Developer Portal](https://www.developer.saxo/)
2. Create an application:
   - Grant type: Authorization Code
   - PKCE: Enabled
   - Redirect URI: `http://localhost:3000/api/saxo/callback`
3. Copy the App Key to `SAXO_APP_KEY` in `.env`
4. Set `SAXO_ENV=sim` for the simulation environment (recommended for testing)

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | Yes | Secret for signing session JWTs |
| `NEXTAUTH_URL` | No | App URL (defaults to http://localhost:3000) |
| `APP_USER_EMAIL` | Yes | Login email for the single-user app |
| `APP_USER_PASSWORD` | Yes | Login password |
| `TOKEN_ENCRYPTION_KEY` | Yes | 32-byte base64 key for AES-256-GCM |
| `SAXO_APP_KEY` | Yes | Saxo Bank application key |
| `SAXO_APP_SECRET` | No | Saxo app secret (if required by your app) |
| `SAXO_REDIRECT_URI` | Yes | OAuth callback URL |
| `SAXO_ENV` | No | `sim` (default) or `live` |
| `OPENAI_API_KEY` | No | OpenAI API key — chat is disabled without it |

The app validates required env vars on startup and shows a clear error if any are missing.

## Usage

### Connect Saxo Account
1. Log in at http://localhost:3000
2. Go to **Settings** in the sidebar
3. Click **Connect Saxo Account**
4. Authorize on the Saxo Bank login page
5. Click **Refresh Portfolio** to fetch your data

### Dashboard
Shows total portfolio value, cash balance, unrealized P&L, asset class breakdown, currency exposure, and top 10 holdings.

A freshness banner indicates data age:
- Green: data < 6 hours old
- Amber: 6–24 hours old (refresh recommended)
- Red: > 24 hours old

### Chat
Ask the AI copilot questions about your portfolio:
- "What's my portfolio worth right now?"
- "Show me my top 5 holdings by value"
- "What's my asset class breakdown?"
- "How diversified am I across currencies?"

The chatbot uses real portfolio data from your latest snapshot and always shows the "As of" timestamp. If data is stale, it warns you.

### Verify It Works
1. Login with your `.env` credentials
2. Settings > Connect Saxo > authorize
3. Settings > Refresh Portfolio
4. Dashboard — check "As of" timestamp and green freshness banner
5. Chat — ask "What's my USD vs SGD exposure?"

## Architecture

```
Next.js 16 (App Router) + TypeScript
├── Auth: NextAuth v5 (Credentials, JWT sessions)
├── UI: Tailwind CSS v4 + shadcn/ui
├── DB: PostgreSQL 16 + Prisma v7 (driver adapter)
├── Saxo: OAuth 2.0 PKCE, encrypted tokens (AES-256-GCM)
├── AI: Vercel AI SDK v6 + OpenAI (gpt-4o)
└── Security: server-side only tokens, env validation
```

## Security

- Saxo tokens are encrypted at rest (AES-256-GCM) and never sent to the browser
- All Saxo API calls happen server-side
- Read-only: no trading endpoints are implemented
- Single-user authentication via environment variables
- Required env vars validated on startup
- Expired Saxo sessions are auto-detected and flagged to the user
