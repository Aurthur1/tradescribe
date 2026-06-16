export interface TokenBudgetStore {
  get(key: string): Promise<string | null>;
  incrBy(key: string, amount: number): Promise<number>;
  expire(key: string, seconds: number): Promise<unknown>;
}

export function tokenBudgetKey(userId: string, now = new Date()) {
  return `ai_tokens:${userId}:${now.toISOString().slice(0, 10)}`;
}

export function dailyTokenLimit() {
  return Number(process.env.AI_MAX_TOKENS_PER_USER_DAILY ?? 50_000);
}

export async function canUseTokens(store: Pick<TokenBudgetStore, "get">, userId: string, requested = 0, now = new Date()) {
  const used = Number((await store.get(tokenBudgetKey(userId, now))) ?? 0);
  return used + requested <= dailyTokenLimit();
}

export async function recordTokens(store: TokenBudgetStore, userId: string, tokensUsed: number, now = new Date()) {
  if (tokensUsed <= 0) return 0;
  const key = tokenBudgetKey(userId, now);
  const total = await store.incrBy(key, tokensUsed);
  await store.expire(key, 48 * 60 * 60);
  return total;
}
