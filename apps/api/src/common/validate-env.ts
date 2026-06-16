const REQUIRED_IN_PRODUCTION = ["DATABASE_URL", "REDIS_URL", "AUTH_PROVIDER_SECRET", "APP_BASE_URL"] as const;
const RECOMMENDED_IN_PRODUCTION = ["METAAPI_TOKEN", "ANTHROPIC_API_KEY", "ENCRYPTION_KEY", "SENTRY_DSN"] as const;

function missing(keys: readonly string[]) {
  return keys.filter((key) => !process.env[key]?.trim());
}

export function validateEnv() {
  const requiredMissing = missing(REQUIRED_IN_PRODUCTION);
  const recommendedMissing = missing(RECOMMENDED_IN_PRODUCTION);

  if (process.env.NODE_ENV === "production") {
    if (requiredMissing.length) {
      throw new Error(`Missing required production environment variables: ${requiredMissing.join(", ")}`);
    }
    if (recommendedMissing.length) {
      console.warn(`Missing recommended production environment variables: ${recommendedMissing.join(", ")}`);
    }
    return;
  }

  const optionalMissing = missing([...REQUIRED_IN_PRODUCTION, ...RECOMMENDED_IN_PRODUCTION]);
  if (optionalMissing.length) {
    console.info(`Optional environment variables unset: ${optionalMissing.join(", ")}`);
  }
}
