export interface AlertEmailPayload {
  email?: string;
  payload: unknown;
  severity: string;
  type: string;
}

export interface AlertEmailSender {
  send(payload: AlertEmailPayload): Promise<void>;
}

export class NoopAlertEmailSender implements AlertEmailSender {
  async send(payload: AlertEmailPayload) {
    console.info({ severity: payload.severity, type: payload.type }, "email alerts disabled; in-app alert recorded");
  }
}

export class ResendAlertEmailSender implements AlertEmailSender {
  async send(payload: AlertEmailPayload) {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.ALERTS_FROM_EMAIL;
    if (!apiKey || !from || !payload.email) {
      console.warn({ type: payload.type }, "resend alert email skipped; missing configuration");
      return;
    }

    await fetch("https://api.resend.com/emails", {
      body: JSON.stringify({
        from,
        to: payload.email,
        subject: `TradeScribe ${payload.severity} alert`,
        text: JSON.stringify(payload.payload, null, 2)
      }),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      method: "POST"
    });
  }
}

export function createAlertEmailSender(): AlertEmailSender {
  if (process.env.EMAIL_PROVIDER === "resend") return new ResendAlertEmailSender();
  return new NoopAlertEmailSender();
}
