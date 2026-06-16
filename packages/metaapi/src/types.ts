import type { TradingPlatform } from "@tradescribe/shared";

export type MetaTraderPlatform = Lowercase<TradingPlatform>;

export interface BrokerConnectionInput {
  broker: string;
  investorPassword: string;
  label?: string | null;
  login: string;
  platform: TradingPlatform;
  server: string;
}

export interface ProvisioningProfileInput {
  brokerTimezone?: string | null;
  name: string;
  server: string;
  version: 4 | 5;
}

export interface CreateAccountInput {
  login: string;
  name: string;
  password: string;
  platform: MetaTraderPlatform;
  provisioningProfileId: string;
  server: string;
  type?: "cloud";
}

export interface ProvisionedMetaApiAccount {
  metaApiAccountId: string;
  provisioningProfileId: string;
}

export interface MetaApiAccountInformation {
  balance: number;
  currency?: string | null;
  equity: number;
  leverage?: number | null;
  name?: string | null;
  platform?: string | null;
}

export interface HistoryRange {
  endTime: Date;
  startTime: Date;
}

export interface MetaApiGateway {
  createProvisioningProfile(input: ProvisioningProfileInput): Promise<{ id: string }>;
  createAccount(input: CreateAccountInput): Promise<{ id: string }>;
  deployAccount(accountId: string): Promise<void>;
  waitDeployed(accountId: string, timeoutMs?: number): Promise<void>;
  getAccountInformation(accountId: string): Promise<MetaApiAccountInformation>;
  getHistoryOrders(accountId: string, range: HistoryRange): Promise<unknown[]>;
  getDealsByTimeRange(accountId: string, range: HistoryRange): Promise<unknown[]>;
  removeAccount(accountId: string): Promise<void>;
}

export interface NormalizedTrade {
  brokerTimeZone?: string | null;
  closePrice: number;
  closeTime: Date;
  commission: number;
  durationSec: number | null;
  externalId: string;
  grossProfit: number;
  openPrice: number;
  openTime: Date;
  rMultiple: number | null;
  riskAmount: number | null;
  session: "Sydney" | "Tokyo" | "London" | "New_York";
  side: "BUY" | "SELL";
  stopLoss: number | null;
  swap: number;
  symbol: string;
  takeProfit: number | null;
  volume: number;
}

export class MetaApiConnectionError extends Error {
  readonly status: "degraded" | "disconnected";

  constructor(message: string, status: "degraded" | "disconnected" = "degraded") {
    super(message);
    this.name = "MetaApiConnectionError";
    this.status = status;
  }
}
