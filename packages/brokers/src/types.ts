import type { NormalizedTrade } from "@tradescribe/metaapi";

export type BrokerPlatform = "MT4" | "MT5" | "CTRADER" | "DXTRADE" | "MATCHTRADER" | "CSV";

export interface BrokerCapabilities {
  csvImport: boolean;
  equitySeries: boolean;
  liveSync: boolean;
  orderModificationHistory: boolean;
  readOnly: boolean;
}

export interface BrokerAdapterAccountInfo {
  balance: number;
  currency?: string | null;
  equity: number;
  name?: string | null;
  platform?: BrokerPlatform | null;
}

export interface BrokerAdapterConnectionInput {
  broker: string;
  investorPassword?: string;
  label?: string | null;
  login: string;
  platform: BrokerPlatform;
  server?: string | null;
}

export interface BrokerAdapter {
  readonly capabilities: BrokerCapabilities;
  readonly id: string;
  readonly label: string;
  readonly platforms: BrokerPlatform[];
  connect(input: BrokerAdapterConnectionInput): Promise<{ externalAccountId?: string | null; provisioningProfileId?: string | null }>;
  deploy(externalAccountId: string): Promise<void>;
  disconnect(externalAccountId: string): Promise<void>;
  getAccountInfo(externalAccountId: string): Promise<BrokerAdapterAccountInfo>;
  getEquitySeries(externalAccountId: string, range: { endTime: Date; startTime: Date }): Promise<Array<{ balance: number; equity: number; ts: Date }>>;
  getHistory(externalAccountId: string, range: { endTime: Date; startTime: Date }, options?: { accountCurrency?: string | null; brokerTimeZone?: string | null; platform?: BrokerPlatform }): Promise<NormalizedTrade[]>;
}

export type CanonicalTrade = NormalizedTrade;
