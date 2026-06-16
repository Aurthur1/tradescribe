FROM node:20-alpine

WORKDIR /app

RUN npm install -g pnpm@latest

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY apps/worker/package.json apps/worker/package.json
COPY packages/ai/package.json packages/ai/package.json
COPY packages/billing/package.json packages/billing/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/metaapi/package.json packages/metaapi/package.json
COPY packages/metrics/package.json packages/metrics/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/signals/package.json packages/signals/package.json

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm --filter @tradescribe/db generate
RUN pnpm build --filter=@tradescribe/worker

ENV NODE_ENV=production

CMD ["node", "--enable-source-maps", "apps/worker/dist/index.js"]
