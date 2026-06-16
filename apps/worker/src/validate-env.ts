const REQUIRED_IN_PRODUCTION = ["DATABASE_URL", "REDIS_URL"] as const;
const RECOMMENDED_IN_PRODUCTION = ["ANTHROPIC_API_KEY", "METAAPI_TOKEN", "ENCRYPTION_KEY"] as const;

function missing(keys: readonly string[]) {
  return keys.filter((key) => !process.env[key]?.trim());
}

export function validateWorkerEnv() {
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
    console.info(`Optional worker environment variables unset: ${optionalMissing.join(", ")}`);
  }
}
