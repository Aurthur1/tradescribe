import { Injectable } from "@nestjs/common";

interface CacheEntry {
  expiresAt: number;
  value: string;
}

@Injectable()
export class RedisService {
  private readonly cache = new Map<string, CacheEntry>();

  async get(key: string) {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (entry.expiresAt <= Date.now()) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  async set(key: string, value: string, mode: "EX", seconds: number) {
    const ttlMs = mode === "EX" ? seconds * 1000 : seconds;
    this.cache.set(key, {
      expiresAt: Date.now() + ttlMs,
      value
    });
  }

  async incrBy(key: string, amount: number) {
    const current = Number((await this.get(key)) ?? 0);
    const next = current + amount;
    const existing = this.cache.get(key);
    this.cache.set(key, {
      expiresAt: existing?.expiresAt ?? Date.now() + 48 * 60 * 60 * 1000,
      value: String(next)
    });
    return next;
  }

  async expire(key: string, seconds: number) {
    const existing = this.cache.get(key);
    if (!existing) return 0;
    this.cache.set(key, {
      expiresAt: Date.now() + seconds * 1000,
      value: existing.value
    });
    return 1;
  }
}
