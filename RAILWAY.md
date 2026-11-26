# Railway + GitHub deploy (Restaurant Manager)

## Prerequisites

- GitHub repo: `https://github.com/AysarSuri/restaurant.git`
- Deploy branch: `main`
- One Railway **service** (API + SPA from root `Dockerfile`) + Railway **PostgreSQL**

## First-time setup (browser)

1. Open [Railway](https://railway.app) → **New Project** → **Deploy from GitHub**.
2. Authorize GitHub if prompted, then select **`AysarSuri/restaurant`**.
3. Set branch to **`main`**. Leave **Root Directory** empty (monorepo root).
4. Railway should detect `Dockerfile` / `railway.toml`.
5. **Add PostgreSQL** plugin/service in the same project.
6. On the app service → **Variables**:
   - `DATABASE_URL` — reference from Postgres (`${{Postgres.DATABASE_URL}}`)
   - `NODE_ENV=production`
   - `JWT_SECRET` — strong secret (`openssl rand -hex 32`)
   - `CORS_ORIGIN=https://<your-railway-domain>`
   - `BASE_PATH=/`
   - optional: `TABLE_LOGIN_PIN` (default `1234`)
7. Enable **Auto Deploy** on push to `main`.
8. Generate a public domain under **Settings → Networking**.

## Schema migrate (first deploy / schema changes)

From a machine with `DATABASE_URL` pointed at Railway Postgres:

```bash
pnpm --filter @workspace/db push
```

Or run the same as a one-off Railway release command / shell.

## Daily workflow

```text
local change → commit → push to main on AysarSuri/restaurant → Railway auto-deploy → check /api/healthz
```

Never push this project to `jrapp`.

## Security checklist before sharing the public URL

- [ ] Login works for admin / cashier / table
- [ ] Requests without `Authorization` get `401` (except health, login, GET employees/branches/tables)
- [ ] Employee list responses do **not** include raw PINs
- [ ] System reset requires admin JWT
- [ ] Cashier polling / POS / kitchen updates are not rate-blocked
