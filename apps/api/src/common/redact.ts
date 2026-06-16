const SENSITIVE_KEY_PATTERN = /password|token|secret|key/i;

export function redactMetadata<T>(value: T): T {
  if (!value || typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactMetadata(item)) as T;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        return [key, "[REDACTED]"];
      }

      return [key, redactMetadata(entry)];
    })
  ) as T;
}
