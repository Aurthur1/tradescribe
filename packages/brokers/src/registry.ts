import { CsvImportAdapter, csvCapabilities } from "./csv.js";
import { MetaApiAdapter } from "./metaapi-adapter.js";
import { ComingSoonAdapter } from "./stubs.js";
import type { BrokerAdapter, BrokerCapabilities, BrokerPlatform } from "./types.js";

export const brokerAdapters: BrokerAdapter[] = [
  new MetaApiAdapter(),
  new CsvImportAdapter(),
  new ComingSoonAdapter("ctrader", "cTrader Open API", ["CTRADER"]),
  new ComingSoonAdapter("dxtrade", "DXtrade", ["DXTRADE"]),
  new ComingSoonAdapter("matchtrader", "Match-Trader", ["MATCHTRADER"])
];

export function adapterCatalog() {
  return brokerAdapters.map((adapter) => ({
    capabilities: adapter.capabilities,
    id: adapter.id,
    label: adapter.label,
    platforms: adapter.platforms,
    status: adapter.id === "metaapi" || adapter.id === "csv" ? "available" as const : adapter.id === "ctrader" ? "beta_coming_soon" as const : "coming_soon" as const
  }));
}

export function capabilitiesFor(provider: string, platform?: string | null): BrokerCapabilities {
  if (provider === "csv" || platform === "CSV") return csvCapabilities;
  const adapter = brokerAdapters.find((item) => item.id === provider);
  return (
    adapter?.capabilities ?? {
      csvImport: false,
      equitySeries: false,
      liveSync: false,
      orderModificationHistory: false,
      readOnly: true
    }
  );
}

export function platformLabel(platform?: string | null) {
  const labels: Record<BrokerPlatform, string> = {
    CSV: "CSV",
    CTRADER: "cTrader",
    DXTRADE: "DXtrade",
    MATCHTRADER: "Match-Trader",
    MT4: "MT4",
    MT5: "MT5"
  };
  return labels[platform as BrokerPlatform] ?? platform ?? "Broker";
}
