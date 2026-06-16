const SENSITIVE_KEYS = [
  "authorization",
  "cookie",
  "password",
  "investorPassword",
  "masterPassword",
  "token",
  "apiKey",
  "secret",
  "key"
];

export function redactSensitiveData<T>(value: T): T {
  if (!value || typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveData(item)) as T;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => {
      const isSensitive = SENSITIVE_KEYS.some((sensitiveKey) =>
        key.toLowerCase().includes(sensitiveKey.toLowerCase())
      );

      return [key, isSensitive ? "[REDACTED]" : redactSensitiveData(entry)];
    })
  ) as T;
}
