import type { SignalsConfig } from "./types.js";

export const DEFAULT_SIGNALS_CONFIG: SignalsConfig = {
  asymmetryRatio: 1,
  correlationGroups: {
    GOLD_USD: ["XAUUSD", "USDCHF"],
    USD_MAJORS: ["EURUSD", "GBPUSD", "AUDUSD", "NZDUSD"],
    USD_SAFE_HAVENS: ["USDJPY", "USDCHF"],
    US_INDICES: ["US30", "US500", "NAS100"]
  },
  missingStopCriticalLossPct: 0.02,
  minTradesForCv: 5,
  overtradeRatio: 2,
  overtradeStdMultiplier: 2,
  revengeSizeMultiplier: 1.5,
  revengeWindowMinutes: 15,
  riskCvThreshold: 0.5,
  singleTradeRiskPct: 0.02,
  timeZone: "UTC",
  trailingBaselineDays: 20
};

export function mergeSignalsConfig(config?: Partial<SignalsConfig>): SignalsConfig {
  return {
    ...DEFAULT_SIGNALS_CONFIG,
    ...config,
    correlationGroups: config?.correlationGroups ?? DEFAULT_SIGNALS_CONFIG.correlationGroups
  };
}
