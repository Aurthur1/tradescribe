import * as Sentry from "@sentry/node";
import { redactSensitiveData } from "./redact.js";

export function initSentry() {
  if (!process.env.SENTRY_DSN) {
    return;
  }

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    beforeSend(event) {
      return redactSensitiveData(event);
    }
  });
}
