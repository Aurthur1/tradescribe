# Railway Deployment Reference

TradeScribe deploys to Railway as three app services plus Railway-managed Postgres and Redis plugins. Set each app service's Root Directory to `/` so Turbo can build the app and all workspace packages from the monorepo root.

This repo uses scoped workspace package names, so use `@tradescribe/web`, `@tradescribe/api`, and `@tradescribe/worker` in filter commands.

## Environment Variables

### web service

```env
NEXT_PUBLIC_API_BASE=https://<your-api-service>.up.railway.app
NEXT_PUBLIC_APP_URL=https://<your-web-service>.up.railway.app
AUTH_PROVIDER_KEY=(Clerk publishable key - pk_live_... in production)
SENTRY_DSN=(your Sentry DSN)
SENTRY_AUTH_TOKEN=(Sentry auth token for source map upload at build time)
SENTRY_ORG=(Sentry organization slug, used with SENTRY_AUTH_TOKEN)
SENTRY_PROJECT=(Sentry project slug, used with SENTRY_AUTH_TOKEN)
```

### api service

```env
DATABASE_URL=(copy from Railway Postgres plugin -> Connect tab)
REDIS_URL=(copy from Railway Redis plugin -> Connect tab)
APP_BASE_URL=https://<your-web-service>.up.railway.app
API_PORT=4000
AUTH_PROVIDER_SECRET=(Clerk secret key - sk_live_...)
METAAPI_TOKEN=(your MetaApi token)
METAAPI_REGION=london
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=(your Anthropic key)
OPENAI_API_KEY=(optional fallback)
AI_MAX_TOKENS_PER_USER_DAILY=50000
AI_MODEL_ANTHROPIC=claude-sonnet-4-6
S3_ENDPOINT=(Cloudflare R2 endpoint)
S3_BUCKET=tradescribe-screenshots
S3_ACCESS_KEY=(R2 access key)
S3_SECRET_KEY=(R2 secret key)
STRIPE_SECRET_KEY=(sk_live_...)
STRIPE_WEBHOOK_SECRET=(whsec_...)
PAYSTACK_SECRET_KEY=(sk_live_...)
PAYSTACK_WEBHOOK_SECRET=(same as PAYSTACK_SECRET_KEY)
ENCRYPTION_KEY=(32-byte base64 key - generate fresh for production)
SENTRY_DSN=(your Sentry DSN)
ADMIN_EMAILS=(comma-separated allowlist)
CORS_EXTRA_ORIGINS=(optional extra allowed origins)
```

Railway also injects `PORT` for HTTP services. The API reads `PORT` first and falls back to `API_PORT`/`4000`.

### worker service

```env
DATABASE_URL=(same as api - copy from Postgres plugin)
REDIS_URL=(same as api - copy from Redis plugin)
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=(same as api)
AI_MAX_TOKENS_PER_USER_DAILY=50000
AI_MODEL_ANTHROPIC=claude-sonnet-4-6
METAAPI_TOKEN=(same as api)
METAAPI_REGION=london
ENCRYPTION_KEY=(same as api - must match)
S3_ENDPOINT=(same as api)
S3_BUCKET=(same as api)
S3_ACCESS_KEY=(same as api)
S3_SECRET_KEY=(same as api)
SENTRY_DSN=(same as api)
EMAIL_PROVIDER=(optional: "resend" if you set up email alerts)
RESEND_API_KEY=(optional)
ALERTS_FROM_EMAIL=(optional)
```

## Railway Dashboard Settings

### web service

| Setting | Value |
| --- | --- |
| Root Directory | `/` |
| Builder | Nixpacks |
| Build Command | Leave blank so Nixpacks reads `nixpacks.toml`, or set `pnpm build --filter=@tradescribe/web` |
| Start Command | `pnpm --filter @tradescribe/web start` |
| Watch Paths | `apps/web/**, packages/**` |

### api service

| Setting | Value |
| --- | --- |
| Root Directory | `/` |
| Builder | Dockerfile |
| Dockerfile Path | `apps/api/Dockerfile` |
| Healthcheck Path | `/health` |
| Watch Paths | `apps/api/**, packages/**` |

The API container runs `pnpm --filter @tradescribe/api migrate:deploy` before starting, so `DATABASE_URL` must be present and reachable during deploy.

### worker service

| Setting | Value |
| --- | --- |
| Root Directory | `/` |
| Builder | Dockerfile |
| Dockerfile Path | `apps/worker/Dockerfile` |
| Healthcheck Path | Disabled |
| Watch Paths | `apps/worker/**, packages/**` |

## Managed Plugins

Create Railway Postgres and Redis plugins in the same project. Copy the plugin connection strings into the API and worker services as `DATABASE_URL` and `REDIS_URL`.

## Deployment Checks

Run these from the repo root before deploying:

```bash
pnpm build --filter=@tradescribe/web
pnpm build --filter=@tradescribe/api
pnpm build --filter=@tradescribe/worker
docker build -f apps/api/Dockerfile .
docker build -f apps/worker/Dockerfile .
```

The API healthcheck should return a 2xx response from:

```bash
GET /health
```

Expected body:

```json
{ "status": "ok", "ts": "2026-06-16T00:00:00.000Z" }
```

Do not commit `.env` files or real secret values. Production secrets belong only in Railway service variables.
