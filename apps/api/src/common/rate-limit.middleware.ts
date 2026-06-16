type RateLimitRequest = {
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
};

type RateLimitResponse = {
  status(statusCode: number): { json(body: unknown): void };
};

type NextFunction = () => void;

export const RATE_LIMIT_PROFILES = {
  default: { limit: 100, windowMs: 60_000 },
  authAdjacent: { limit: 20, windowMs: 60_000 },
  writeHeavy: { limit: 40, windowMs: 60_000 }
} as const;

type RateLimitProfileName = keyof typeof RATE_LIMIT_PROFILES;

const buckets = new Map<string, { count: number; resetAt: number }>();

export function createRateLimitMiddleware(profileName: RateLimitProfileName = "default") {
  const profile = RATE_LIMIT_PROFILES[profileName];

  return function rateLimit(request: RateLimitRequest, response: RateLimitResponse, next: NextFunction) {
    const now = Date.now();
    const forwardedFor = request.headers["x-forwarded-for"];
    const ip = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor?.split(",")[0]?.trim() || request.ip || "unknown";
    const key = `${profileName}:${ip}`;
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + profile.windowMs });
      next();
      return;
    }

    bucket.count += 1;
    if (bucket.count > profile.limit) {
      response.status(429).json({ message: "Too many requests" });
      return;
    }

    next();
  };
}
