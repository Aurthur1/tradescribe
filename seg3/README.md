# TradeScribe — Segment 3 (Deterministic Metrics + Dashboard)

This is real, working code, not pseudocode. The metrics engine ships with a passing test suite (17 tests). The API and dashboard are drop-in files for the monorepo.

## What is included
```
packages/metrics/         the trustworthy core: pure, deterministic, fully tested
  src/                    types, calculations, sessions, drawdown, series, period
  test/metrics.test.ts    17 tests, all passing
apps/api/src/metrics/     NestJS module: controller, service, DTOs, period + mapper
apps/web/src/             dashboard UI: hooks, KPI cards, chart, calendar, page
```

## The one rule
Every number shown in the product comes from `packages/metrics`. The AI layer (Segment 4) never computes a displayed figure. The service feeds the engine trusted DB rows; the engine returns numbers; the UI only formats them.

## Install / run the core
```bash
cd packages/metrics
pnpm install
pnpm test        # 17 passing
pnpm build
```

## Dependencies to add
- API: `luxon` (period math), `zod` (already in stack).
- Web: `swr` (data fetching), `recharts` (chart), `lucide-react` (icons), `luxon` (week dates). All are already in the approved stack except luxon and swr — add them.

## Wiring notes (adjust to your Segment 1/2 code)
1. `metrics.service.ts` imports your existing `PrismaService` and `RedisService`. Point the import paths at your actual providers.
2. The service assumes these Prisma relations exist from Segment 2:
   - `TradingAccount.brokerConnection.userId` (for ownership / IDOR protection)
   - `TradingAccount.startingBalance`, `TradingAccount.currency`
   - `Trade.tradingAccountId`, `Trade.closeTime`, `Trade.symbol`, `Trade.side`, plus the numeric fields in `TradeRow`.
   - `EquitySnapshot.tradingAccountId`, `ts`, `equity`, `balance`.
   - Recommended: persist a `Trade.session` column at normalization so session filtering happens in the DB. If absent, it is derived in app (already handled).
3. Register `MetricsModule` in your `AppModule`.
4. `ZodValidationPipe`, `AuthGuard`, `CurrentUser` come from Segments 0/1. The references match the names used in those segments.
5. Web: set `NEXT_PUBLIC_API_BASE` to your API origin. Replace `useActiveAccount()` in `dashboard/page.tsx` with your real account-switcher/user context.

## Security carried through from the spec
- Ownership is enforced in `assertOwnership` on every metrics/trades call: a user can only read their own account's data. This is the IDOR control.
- No raw broker credentials touch this layer; it reads only normalized trades and equity snapshots.

## Codex prompt to integrate
```
Integrate the provided Segment 3 code into the monorepo. Add luxon and swr as dependencies. Wire packages/metrics into apps/api by registering MetricsModule, and fix the import paths in metrics.service.ts to point at the existing PrismaService and RedisService. Ensure the Prisma schema exposes the relations the service expects (TradingAccount.brokerConnection.userId, startingBalance, currency; Trade fields; EquitySnapshot fields); add a persisted Trade.session column populated at normalization. Replace useActiveAccount() in the dashboard page with the real user/account context and set NEXT_PUBLIC_API_BASE. Keep the rule that all displayed numbers come from packages/metrics. Run packages/metrics tests and confirm they pass, then verify the dashboard renders against a seeded account with both profitable and losing weeks, plus the empty-period and no-account states.
```
