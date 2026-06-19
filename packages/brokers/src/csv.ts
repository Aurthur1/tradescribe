import { classifySession } from "@tradescribe/metrics";
import { calculateRiskAmount, type NormalizedTrade } from "@tradescribe/metaapi";
import type { BrokerAdapter, BrokerCapabilities } from "./types.js";

export const csvCapabilities: BrokerCapabilities = {
  csvImport: true,
  equitySeries: false,
  liveSync: false,
  orderModificationHistory: false,
  readOnly: true
};

export const canonicalCsvFields = [
  "externalId",
  "symbol",
  "side",
  "openTime",
  "closeTime",
  "openPrice",
  "closePrice",
  "volume",
  "grossProfit",
  "commission",
  "swap",
  "stopLoss",
  "takeProfit"
] as const;

export type CsvCanonicalField = (typeof canonicalCsvFields)[number];
export type CsvColumnMapping = Partial<Record<CsvCanonicalField, string>>;

type CsvRecord = Record<string, string>;

const aliases: Record<CsvCanonicalField, string[]> = {
  closePrice: ["close price", "close_price", "exit", "exit price", "price close"],
  closeTime: ["close time", "close_time", "closed at", "exit time", "time close", "close date"],
  commission: ["commission", "commissions", "fee", "fees"],
  externalId: ["ticket", "order", "order id", "orderid", "deal", "deal id", "position id", "id"],
  grossProfit: ["profit", "gross profit", "grossprofit", "p/l", "pnl", "pl"],
  openPrice: ["open price", "open_price", "entry", "entry price", "price open"],
  openTime: ["open time", "open_time", "opened at", "entry time", "time open", "open date"],
  side: ["type", "side", "direction", "buy/sell"],
  stopLoss: ["s/l", "sl", "stop loss", "stoploss"],
  swap: ["swap", "rollover"],
  symbol: ["symbol", "instrument", "market", "pair"],
  takeProfit: ["t/p", "tp", "take profit", "takeprofit"],
  volume: ["volume", "lots", "size", "qty", "quantity"]
};

const balancePatterns = /balance|deposit|withdrawal|credit/i;

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

export function parseDelimited(text: string) {
  const delimiter = detectDelimiter(text);
  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      row.push(current.trim());
      current = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(current.trim());
      if (row.some((cell) => cell.length > 0)) rows.push(row);
      row = [];
      current = "";
    } else {
      current += char ?? "";
    }
  }
  row.push(current.trim());
  if (row.some((cell) => cell.length > 0)) rows.push(row);

  const headers = (rows.shift() ?? []).map((header) => header.trim());
  const records = rows.map((cells) =>
    headers.reduce<CsvRecord>((record, header, index) => {
      record[header] = cells[index] ?? "";
      return record;
    }, {})
  );
  return { delimiter, headers, records };
}

function detectDelimiter(text: string) {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const comma = (firstLine.match(/,/g) ?? []).length;
  const semicolon = (firstLine.match(/;/g) ?? []).length;
  const tab = (firstLine.match(/\t/g) ?? []).length;
  if (tab > comma && tab > semicolon) return "\t";
  if (semicolon > comma) return ";";
  return ",";
}

export function guessCsvMapping(headers: string[]): CsvColumnMapping {
  const normalized = new Map(headers.map((header) => [normalizeHeader(header), header]));
  return canonicalCsvFields.reduce<CsvColumnMapping>((mapping, field) => {
    const match = aliases[field].map(normalizeHeader).find((alias) => normalized.has(alias));
    if (match) mapping[field] = normalized.get(match);
    return mapping;
  }, {});
}

function value(record: CsvRecord, mapping: CsvColumnMapping, field: CsvCanonicalField) {
  const header = mapping[field];
  return header ? record[header]?.trim() ?? "" : "";
}

function numberValue(input: string) {
  const sanitized = input.replace(/[$£€,]/g, "").trim();
  if (!sanitized) return 0;
  const parsed = Number(sanitized);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function dateValue(input: string) {
  const parsed = new Date(input);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function sideValue(input: string) {
  const upper = input.toUpperCase();
  if (upper.includes("BUY") || upper === "0") return "BUY" as const;
  if (upper.includes("SELL") || upper === "1") return "SELL" as const;
  return null;
}

export function normalizeCsvRecords(
  records: CsvRecord[],
  mapping: CsvColumnMapping,
  options: { accountCurrency?: string | null; brokerTimeZone?: string | null } = {}
) {
  const trades: NormalizedTrade[] = [];
  const errors: Array<{ message: string; row: number }> = [];
  let skipped = 0;

  records.forEach((record, index) => {
    const rowNumber = index + 2;
    const symbol = value(record, mapping, "symbol").toUpperCase();
    const rawSide = value(record, mapping, "side");
    if (balancePatterns.test(`${symbol} ${rawSide} ${Object.values(record).join(" ")}`)) {
      skipped += 1;
      return;
    }

    const side = sideValue(rawSide);
    const openTime = dateValue(value(record, mapping, "openTime"));
    const closeTime = dateValue(value(record, mapping, "closeTime"));
    const openPrice = numberValue(value(record, mapping, "openPrice"));
    const closePrice = numberValue(value(record, mapping, "closePrice"));
    const volume = numberValue(value(record, mapping, "volume"));
    const grossProfit = numberValue(value(record, mapping, "grossProfit"));
    const commission = numberValue(value(record, mapping, "commission"));
    const swap = numberValue(value(record, mapping, "swap"));
    const stopLoss = numberValue(value(record, mapping, "stopLoss"));
    const takeProfit = numberValue(value(record, mapping, "takeProfit"));
    const externalId = value(record, mapping, "externalId") || `${symbol}-${closeTime?.toISOString() ?? rowNumber}`;

    const missing = [
      !symbol ? "symbol" : null,
      !side ? "side" : null,
      !openTime ? "openTime" : null,
      !closeTime ? "closeTime" : null,
      !Number.isFinite(openPrice) || openPrice <= 0 ? "openPrice" : null,
      !Number.isFinite(closePrice) || closePrice <= 0 ? "closePrice" : null,
      !Number.isFinite(volume) || volume <= 0 ? "volume" : null,
      !Number.isFinite(grossProfit) ? "grossProfit" : null
    ].filter(Boolean);

    if (missing.length) {
      errors.push({ message: `Missing or invalid ${missing.join(", ")}`, row: rowNumber });
      return;
    }

    if (!side || !openTime || !closeTime) {
      errors.push({ message: "Missing side or timestamps", row: rowNumber });
      return;
    }

    const riskAmount = calculateRiskAmount({
      accountCurrency: options.accountCurrency,
      openPrice,
      side,
      stopLoss: Number.isFinite(stopLoss) && stopLoss > 0 ? stopLoss : null,
      symbol,
      volume
    });
    const netProfit = grossProfit + (Number.isFinite(commission) ? commission : 0) + (Number.isFinite(swap) ? swap : 0);
    const durationMs = closeTime.getTime() - openTime.getTime();

    trades.push({
      brokerTimeZone: options.brokerTimeZone ?? null,
      closePrice,
      closeTime,
      commission: Number.isFinite(commission) ? commission : 0,
      durationSec: durationMs >= 0 ? Math.round(durationMs / 1000) : null,
      externalId,
      grossProfit,
      openPrice,
      openTime,
      rMultiple: riskAmount ? netProfit / riskAmount : null,
      riskAmount,
      session: classifySession(openTime).replace(" ", "_") as NormalizedTrade["session"],
      side,
      stopLoss: Number.isFinite(stopLoss) && stopLoss > 0 ? stopLoss : null,
      swap: Number.isFinite(swap) ? swap : 0,
      symbol,
      takeProfit: Number.isFinite(takeProfit) && takeProfit > 0 ? takeProfit : null,
      volume
    });
  });

  return { errors, skipped, trades };
}

export function previewCsvImport(text: string, mapping?: CsvColumnMapping, options: { accountCurrency?: string | null } = {}) {
  const parsed = parseDelimited(text);
  const guessedMapping = mapping ?? guessCsvMapping(parsed.headers);
  const normalized = normalizeCsvRecords(parsed.records, guessedMapping, { accountCurrency: options.accountCurrency });
  return {
    delimiter: parsed.delimiter,
    errors: normalized.errors.slice(0, 25),
    headers: parsed.headers,
    mapping: guessedMapping,
    preview: normalized.trades.slice(0, 10),
    rowsOk: normalized.trades.length,
    rowsSkipped: normalized.skipped,
    totalRows: parsed.records.length
  };
}

export class CsvImportAdapter implements BrokerAdapter {
  readonly capabilities = csvCapabilities;
  readonly id = "csv";
  readonly label = "CSV / Excel Import";
  readonly platforms = ["CSV" as const];

  async connect() {
    return { externalAccountId: null, provisioningProfileId: null };
  }

  async deploy() {}

  async disconnect() {}

  async getAccountInfo() {
    return { balance: 0, currency: null, equity: 0, name: "CSV Import", platform: "CSV" as const };
  }

  async getEquitySeries() {
    return [];
  }

  async getHistory() {
    return [];
  }
}
