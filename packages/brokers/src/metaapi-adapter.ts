import { metaApiGateway, normalizeMetaApiHistory, provisionReadOnlyAccount } from "@tradescribe/metaapi";
import type { BrokerAdapter, BrokerAdapterConnectionInput } from "./types.js";

export class MetaApiAdapter implements BrokerAdapter {
  readonly capabilities = {
    csvImport: false,
    equitySeries: true,
    liveSync: true,
    orderModificationHistory: false,
    readOnly: true
  };
  readonly id = "metaapi";
  readonly label = "MetaApi";
  readonly platforms = ["MT4" as const, "MT5" as const];

  async connect(input: BrokerAdapterConnectionInput) {
    if (input.platform !== "MT4" && input.platform !== "MT5") throw new Error("MetaApi supports MT4 and MT5 only");
    if (!input.investorPassword) throw new Error("Investor password is required");
    const provisioned = await provisionReadOnlyAccount({
      broker: input.broker,
      investorPassword: input.investorPassword,
      label: input.label,
      login: input.login,
      platform: input.platform,
      server: input.server ?? ""
    });
    return { externalAccountId: provisioned.metaApiAccountId, provisioningProfileId: provisioned.provisioningProfileId };
  }

  async deploy(externalAccountId: string) {
    await metaApiGateway.deployAccount(externalAccountId);
    await metaApiGateway.waitDeployed(externalAccountId);
  }

  async disconnect(externalAccountId: string) {
    await metaApiGateway.removeAccount(externalAccountId);
  }

  async getAccountInfo(externalAccountId: string) {
    const info = await metaApiGateway.getAccountInformation(externalAccountId);
    return { ...info, platform: info.platform?.toUpperCase() === "MT4" ? "MT4" as const : "MT5" as const };
  }

  async getEquitySeries() {
    return [];
  }

  async getHistory(externalAccountId: string, range: { endTime: Date; startTime: Date }, options: { accountCurrency?: string | null; brokerTimeZone?: string | null; platform?: "MT4" | "MT5" } = {}) {
    const records =
      options.platform === "MT5"
        ? await metaApiGateway.getDealsByTimeRange(externalAccountId, range)
        : await metaApiGateway.getHistoryOrders(externalAccountId, range);
    return normalizeMetaApiHistory({
      accountCurrency: options.accountCurrency,
      brokerTimeZone: options.brokerTimeZone,
      platform: options.platform ?? "MT5",
      records
    });
  }
}
