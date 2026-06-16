# TradeScribe

TradeScribe is a read-only MT4/MT5 trade journaling and behavioral coaching SaaS for forex and prop-firm traders.

## Architecture

- `apps/web`: Next.js App Router, TypeScript, Tailwind, shadcn-ready UI structure.
- `apps/api`: NestJS API with `/health`, Zod request validation foundation, and redacted Sentry setup.
- `apps/worker`: Node worker with BullMQ bootstrap and a repeatable no-op job.
- `packages/db`: Prisma schema, migration, and client package.
- `packages/shared`: shared Zod schemas, constants, and TypeScript types.
- `packages/ai`: provider-agnostic AI stubs.
- `packages/metaapi`: MetaApi integration stubs.
- `packages/metrics`: deterministic metrics stubs.
- `packages/signals`: deterministic behavioral leak detection and prop-firm guardrail evaluation.
- `packages/billing`: Stripe/Paystack abstraction stubs.

## Local Development

1. Copy `.env.example` to `.env` and fill in local values.
2. Install dependencies with `pnpm install`.
3. Generate Prisma client with `pnpm db:generate`.
4. Start all apps with `pnpm dev`.

Default local ports:

- Web: `http://localhost:3000`
- API: `http://localhost:4000`
- API health: `http://localhost:4000/health`

## Deployment Targets

- Web: Vercel
- API: Railway or Render using `apps/api/Dockerfile`
- Worker: Railway or Render using `apps/worker/Dockerfile`
- Database: managed Postgres
- Queue/cache: managed Redis
- Screenshots: Cloudflare R2 or S3-compatible storage

## Deployment

Railway deployment uses three app services from the monorepo root: `web`, `api`, and `worker`, plus Railway-managed Postgres and Redis plugins. See [docs/railway-env-vars.md](docs/railway-env-vars.md) for the exact service settings, environment variables, Dockerfile paths, and predeploy checks.

## Security Notes

Never commit secrets. Broker access must stay read-only: investor passwords only, no trade execution, no master password handling. Sentry integrations must redact authorization headers, cookies, credentials, tokens, passwords, and API keys.

Authentication is backed by Clerk. `AUTH_PROVIDER_KEY` is the publishable key used by the web app and `AUTH_PROVIDER_SECRET` is the API secret key used to verify/fetch Clerk users. The API provisions the internal `User` row on the first authenticated request, so the app does not depend on webhook timing before a signed-in user can use protected routes.

Enable MFA in the Clerk dashboard for the TradeScribe application. The code treats Clerk as the session authority and does not shortcut MFA, trusted-device, or session policy decisions locally.

Admin access is bootstrapped only from `ADMIN_EMAILS` during first-request provisioning, or by running `pnpm grant-admin <email>` for an existing user. Role changes are written to `AuditLog`; no customer-facing UI or non-admin API path can self-assign `ADMIN`.

Tenant-scoped data access should always include a direct `userId` filter or first call the shared account ownership helper before querying account-owned resources. If a Prisma query for customer data lacks that ownership path, treat it as a security bug.

## Alerts

In-app alerts are always enabled and are stored as `Alert` rows for the notification bell and alerts list. Email alerts are optional: when `EMAIL_PROVIDER` is unset, the alert email sender is a no-op and logs the skipped send. Set `EMAIL_PROVIDER="resend"` with `RESEND_API_KEY` and `ALERTS_FROM_EMAIL` to send alert emails through Resend.

## Broker Connectivity

TradeScribe provisions read-only MT4/MT5 accounts through MetaApi using `METAAPI_TOKEN` and `METAAPI_REGION`. The connection flow accepts the investor password only, passes it directly to MetaApi during provisioning, and never stores it in Postgres, logs, Sentry metadata, or worker payloads. Install/configure `metaapi.cloud-sdk` in deployments that need live broker access; without the SDK or token, connection attempts are marked disconnected with a clear setup error.

The worker owns idempotent sync jobs: `connection.backfill` fetches historical orders/deals, normalizes MT4 orders and MT5 positions into the internal `Trade` shape, upserts by `(tradingAccountId, externalId)`, and writes equity snapshots. `connection.sync` uses a small overlap window from `lastSyncAt`, recovers degraded connections on success, and creates in-app `sync_failure` alerts on repeated failures.
