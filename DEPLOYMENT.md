# SentinelSRE — Production Deployment Runbook

This runbook takes the project from local dev to a deployed production demo.
Architecture: **Next.js frontend (Vercel)** → **FastAPI backend (Render, Docker)**
→ **Neon Postgres (pgvector)** with optional **Upstash Redis** rate limiting.

All credentials are already in `backend/.env` and `frontend/.env.local` for local
dev. Deploying means wiring the same values into the hosting dashboards.

---

## 1. Database — Neon (free)

1. Create a project at [neon.tech](https://neon.tech) (free plan).
2. Connect → get the connection string: `postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require`
3. Convert to asyncpg form for the backend (`+asyncpg` after `postgresql`):
   `postgresql+asyncpg://user:pass@ep-xxx...neon.tech/neondb?sslmode=require`
4. We rely on our Docker entrypoint to run `alembic upgrade head` automatically on
   every deploy, so the schema is created for you.

---

## 2. Backend — Render (free Docker web service)

**Option A — Blueprint (recommended):** `backend/render.yaml` is included.
When creating a new Web Service on Render, choose "Blueprint" and point at this repo,
or run `render blueprint launch` with `render.yaml`.

**Option B — Manual:**
1. Dashboard → **New → Web Service** → connect the `sentinel-sre` repo.
2. Name `sentinel-backend`, choose **Docker** runtime, root directory `backend`,
   plan **Free**.
3. Add the environment variables (see table below). Secrets are stored encrypted.
4. Deploy. The image runs migrations (entrypoint) then serves on `/api/health`.

| Variable | Source |
| :--- | :--- |
| `APP_ENV` | `production` |
| `DATABASE_URL` | Neon connection string (step 1) |
| `CLERK_JWKS_URL`, `CLERK_ISSUER` | from `backend/.env` |
| `INCEPTION_API_KEY`, `INCEPTION_BASE_URL`, `LLM_MODEL` | LLM provider |
| `GITHUB_ACCESS_TOKEN`, `GITHUB_DEFAULT_REPO` | *optional* shared fallback for auto hotfix PRs |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `ENCRYPTION_KEY` | per-user GitHub OAuth (recommended) |
| `GITHUB_OAUTH_CALLBACK_URL`, `FRONTEND_URL` | OAuth callback + post-connect redirect |
| `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `SLACK_OAUTH_CALLBACK_URL` | per-user Slack OAuth |
| `SLACK_WEBHOOK_URL` | Slack incoming webhook |
| `R2_*` | Cloudflare R2 credentials |
| `UPSTASH_REDIS_REST_URL/TOKEN` | optional rate limiting |

**Free-tier caveats:** Render free services spin down after 15 min of inactivity
(cold start ~20–60s). For a demo, that's fine. To keep it warm, add a cron job
(e.g. cron-job.org) hitting `https://<your-service>.onrender.com/api/health` every
10 minutes.

---

## 3. Frontend — Vercel

1. Import the repo at [vercel.com](https://vercel.com) → framework **Next.js**.
2. Add environment variables (from `frontend/.env.example`):
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, Clerk URLs
   - `NEXT_PUBLIC_API_BASE_URL` = your Render service URL (e.g.
     `https://sentinel-backend.onrender.com`)
3. Deploy. In the CI, `pnpm build` runs and must pass.

---

## 4. Clerk — production application

1. In the Clerk dashboard, switch the app from **Development** to **Production**.
2. Add your Vercel domains to **Allowed origins / redirect URLs**.
3. Add the backend's Render URL to **Allowed origins** for the API (CORS).
4. Copy the production `CLERK_SECRET_KEY` / publishable key into Vercel and Render.

---

## 5. Rate limiting (optional, Upstash)

1. Create a free DB at [upstash.com](https://upstash.com).
2. Copy `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` into Render.
   The middleware activates automatically when both are set (fail-open otherwise).

---

## 6. Verify end-to-end (production)

1. Open the deployed frontend → sign up as the first user (Clerk).
2. Go to **Knowledge Vault** → upload a `.log` file → confirm it shows `indexed`.
3. Create an incident (**New Incident**) → watch the **War Room** stream the 4
   parallel specialists, the synthesizer, and the L4 verifier.
4. Approve the hotfix → the backend opens a **draft PR** using the user's own
   connected GitHub account (falls back to `GITHUB_DEFAULT_REPO` if the user
   hasn't connected one) and posts to Slack.
5. Check `dashboard/finops` — it should show real cost/latency from the
   `llm_traces` table.

---

## 6b. Per-user GitHub connections (OAuth)

By default every user would share `GITHUB_ACCESS_TOKEN`. To let each user connect
**their own** GitHub account:

1. Create a GitHub **OAuth App** at https://github.com/settings/developers
   - **Authorization callback URL** = `https://<your-backend>/api/github/callback`
   - Scope requested automatically: `repo` (read/write for draft PRs).
2. Add to the backend env: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`,
   `GITHUB_OAUTH_CALLBACK_URL` (or let it default), `FRONTEND_URL`.
3. Set `ENCRYPTION_KEY` (Fernet key). Generate with:
   `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`
   - This key encrypts each user's token at rest; keep it secret and stable.
4. Users click **Connect GitHub** on the dashboard → OAuth flow → their token is
   stored encrypted on their workspace. Incident PRs then use *their* identity.

The `github_oauth_states` table (added by migration) tracks in-flight OAuth
flows; state rows are one-time and deleted after the callback.

---

## 6c. Per-user Slack notifications (OAuth)

By default notifications use the shared `SLACK_WEBHOOK_URL`. To let each user
connect **their own** Slack workspace/channel:

1. Create a Slack app at https://api.slack.com/apps → **OAuth & Permissions**
   - **Bot Token Scopes**: `chat:write`, `channels:read`
   - **Redirect URL**: `https://<your-backend>/api/slack/callback`
   - Install the app to your workspace.
2. Add to the backend env: `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`,
   `SLACK_OAUTH_CALLBACK_URL` (or let it default), `FRONTEND_URL`.
3. Users click **Connect Slack** on the dashboard → authorize → pick a notify
   channel. Incident notifications then post using their bot token.

The `slack_oauth_states` table and `slack_token_encrypted` /
`slack_team_name` workspace columns are added by migration; the token is stored
encrypted with `ENCRYPTION_KEY`.

---

## 7. CI

`.github/workflows/ci.yml` runs on every push/PR:
- backend `pytest` suite against a pgvector service container,
- backend Docker image build,
- frontend `pnpm lint` + `pnpm build`.

---

## Notes / gotchas

- Never commit `backend/.env` or `frontend/.env.local` (both are gitignored).
- The backend entrypoint runs migrations before boot; migrations are idempotent.
- Production startup logs a warning if required secrets are missing
  (`APP_ENV=production`), but never blocks boot.
- Set `APP_ENV=production` on Render to enable HSTS security headers.
