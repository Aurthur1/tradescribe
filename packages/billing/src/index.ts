export type BillingProviderName = "paystack" | "stripe";

export interface CheckoutSessionInput {
  userId: string;
  plan: "free" | "core" | "pro";
  currency: "NGN" | "USD";
}

export interface CheckoutSession {
  provider: BillingProviderName;
  url: string;
}

export interface BillingProvider {
  createCheckoutSession(input: CheckoutSessionInput): Promise<CheckoutSession>;
  verifyWebhook(payload: string, signature: string): Promise<boolean>;
}
