export interface ContractSpec {
  contractSize: number;
  pipDecimalPlaces: number;
  pointValue: number;
  quoteCurrency?: string;
}

const explicitSpecs: Record<string, ContractSpec> = {
  AUDUSD: { contractSize: 100000, pipDecimalPlaces: 4, pointValue: 10, quoteCurrency: "USD" },
  EURGBP: { contractSize: 100000, pipDecimalPlaces: 4, pointValue: 10, quoteCurrency: "GBP" },
  EURJPY: { contractSize: 100000, pipDecimalPlaces: 2, pointValue: 1000, quoteCurrency: "JPY" },
  EURUSD: { contractSize: 100000, pipDecimalPlaces: 4, pointValue: 10, quoteCurrency: "USD" },
  GBPJPY: { contractSize: 100000, pipDecimalPlaces: 2, pointValue: 1000, quoteCurrency: "JPY" },
  GBPUSD: { contractSize: 100000, pipDecimalPlaces: 4, pointValue: 10, quoteCurrency: "USD" },
  NAS100: { contractSize: 1, pipDecimalPlaces: 1, pointValue: 1, quoteCurrency: "USD" },
  NZDUSD: { contractSize: 100000, pipDecimalPlaces: 4, pointValue: 10, quoteCurrency: "USD" },
  SPX500: { contractSize: 1, pipDecimalPlaces: 1, pointValue: 1, quoteCurrency: "USD" },
  US100: { contractSize: 1, pipDecimalPlaces: 1, pointValue: 1, quoteCurrency: "USD" },
  US30: { contractSize: 1, pipDecimalPlaces: 1, pointValue: 1, quoteCurrency: "USD" },
  US500: { contractSize: 1, pipDecimalPlaces: 1, pointValue: 1, quoteCurrency: "USD" },
  USDCAD: { contractSize: 100000, pipDecimalPlaces: 4, pointValue: 10, quoteCurrency: "CAD" },
  USDCHF: { contractSize: 100000, pipDecimalPlaces: 4, pointValue: 10, quoteCurrency: "CHF" },
  USDJPY: { contractSize: 100000, pipDecimalPlaces: 2, pointValue: 1000, quoteCurrency: "JPY" },
  XAGUSD: { contractSize: 5000, pipDecimalPlaces: 3, pointValue: 5, quoteCurrency: "USD" },
  XAUUSD: { contractSize: 100, pipDecimalPlaces: 2, pointValue: 1, quoteCurrency: "USD" }
};

function normalizeSymbol(symbol: string) {
  return symbol.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function getContractSpec(symbol: string): ContractSpec {
  const normalized = normalizeSymbol(symbol);
  if (explicitSpecs[normalized]) return explicitSpecs[normalized];
  const quoteCurrency = normalized.length >= 6 ? normalized.slice(-3) : undefined;
  const isJpy = quoteCurrency === "JPY";
  return {
    contractSize: 100000,
    pipDecimalPlaces: isJpy ? 2 : 4,
    pointValue: isJpy ? 1000 : 10,
    quoteCurrency
  };
}

export function calculateRiskAmount(input: {
  accountCurrency?: string | null;
  openPrice: number;
  side: "BUY" | "SELL";
  stopLoss?: number | null;
  symbol: string;
  volume: number;
}) {
  if (!input.stopLoss || input.stopLoss <= 0) return null;
  const spec = getContractSpec(input.symbol);
  const accountCurrency = input.accountCurrency?.toUpperCase();

  // MVP limitation: if account currency differs from the quote currency, a live
  // conversion rate is required. Leave R metrics null instead of inventing one.
  if (accountCurrency && spec.quoteCurrency && accountCurrency !== spec.quoteCurrency) {
    return null;
  }

  const distance = Math.abs(input.openPrice - input.stopLoss);
  const riskAmount = distance * input.volume * spec.contractSize;
  return Number.isFinite(riskAmount) && riskAmount > 0 ? riskAmount : null;
}
