import { classifySession } from "@tradescribe/metrics";
import { calculateRiskAmount } from "./contractSpecs.js";
import type { NormalizedTrade } from "./types.js";

type RawRecord = Record<string, unknown>;

const balanceTypes = new Set([
  "BALANCE",
  "CREDIT",
  "DEAL_TYPE_BALANCE",
  "DEAL_TYPE_CREDIT",
  "DEAL_BALANCE",
  "DEAL_CREDIT",
  "WITHDRAWAL",
  "DEPOSIT"
]);

function stringValue(record: RawRecord, keys: string[], fallback = "") {
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && String(value).trim()) return String(value);
  }
  return fallback;
}

function numberValue(record: RawRecord, keys: string[], fallback = 0) {
  for (const key of keys) {
    const value = record[key];
    if (value === undefined || value === null || value === "") continue;
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function dateValue(record: RawRecord, keys: string[], fallback?: Date) {
  for (const key of keys) {
    const value = record[key];
    if (!value) continue;
    const date = new Date(String(value));
    if (!Number.isNaN(date.getTime())) return date;
  }
  return fallback ?? new Date(0);
}

function normalizeSide(raw: string): "BUY" | "SELL" | null {
  const value = raw.toUpperCase();
  if (value.includes("BUY") || value === "0") return "BUY";
  if (value.includes("SELL") || value === "1") return "SELL";
  return null;
}

function isBalanceOperation(record: RawRecord) {
  const type = stringValue(record, ["type", "entryType", "dealType", "orderType"]).toUpperCase();
  const comment = stringValue(record, ["comment", "description"]).toUpperCase();
  return balanceTypes.has(type) || /BALANCE|CREDIT|DEPOSIT|WITHDRAWAL/.test(comment);
}

function isClosingMt5Deal(record: RawRecord) {
  const entry = stringValue(record, ["entryType", "entry", "dealEntry"]).toUpperCase();
  const type = stringValue(record, ["type", "dealType"]).toUpperCase();
  return entry.includes("OUT") || type.includes("SELL") || type.includes("BUY");
}

function weightedAverage(items: Array<{ price: number; volume: number }>) {
  const volume = items.reduce((sum, item) => sum + item.volume, 0);
  if (volume <= 0) return items[0]?.price ?? 0;
  return items.reduce((sum, item) => sum + item.price * item.volume, 0) / volume;
}

function netProfit(input: { commission: number; grossProfit: number; swap: number }) {
  return input.grossProfit + input.commission + input.swap;
}

function finalizeTrade(input: Omit<NormalizedTrade, "durationSec" | "rMultiple" | "riskAmount" | "session"> & { accountCurrency?: string | null }) {
  const riskAmount = calculateRiskAmount({
    accountCurrency: input.accountCurrency,
    openPrice: input.openPrice,
    side: input.side,
    stopLoss: input.stopLoss,
    symbol: input.symbol,
    volume: input.volume
  });
  const durationMs = input.closeTime.getTime() - input.openTime.getTime();
  const durationSec = Number.isFinite(durationMs) && durationMs >= 0 ? Math.round(durationMs / 1000) : null;
  const rMultiple = riskAmount ? netProfit(input) / riskAmount : null;
  const session = classifySession(input.openTime).replace(" ", "_") as NormalizedTrade["session"];

  return {
    ...input,
    durationSec,
    rMultiple: rMultiple !== null && Number.isFinite(rMultiple) ? rMultiple : null,
    riskAmount,
    session
  };
}

export function normalizeMt4Orders(
  orders: unknown[],
  options: { accountCurrency?: string | null; brokerTimeZone?: string | null } = {}
): NormalizedTrade[] {
  return orders
    .filter((order): order is RawRecord => Boolean(order) && typeof order === "object" && !isBalanceOperation(order as RawRecord))
    .map((order) => {
      const record = order as RawRecord;
      const side = normalizeSide(stringValue(record, ["side", "type", "orderType"])) ?? "BUY";
      const openTime = dateValue(record, ["openTime", "time", "open_time"]);
      const closeTime = dateValue(record, ["closeTime", "doneTime", "close_time"], openTime);
      return finalizeTrade({
        accountCurrency: options.accountCurrency,
        brokerTimeZone: options.brokerTimeZone ?? null,
        closePrice: numberValue(record, ["closePrice", "close_price", "currentPrice", "price"]),
        closeTime,
        commission: numberValue(record, ["commission"]),
        externalId: stringValue(record, ["id", "ticket", "orderId"], `${stringValue(record, ["symbol"])}-${closeTime.toISOString()}`),
        grossProfit: numberValue(record, ["profit", "grossProfit"]),
        openPrice: numberValue(record, ["openPrice", "open_price", "price"]),
        openTime,
        side,
        stopLoss: numberValue(record, ["stopLoss", "sl"], 0) || null,
        swap: numberValue(record, ["swap"]),
        symbol: stringValue(record, ["symbol"]),
        takeProfit: numberValue(record, ["takeProfit", "tp"], 0) || null,
        volume: numberValue(record, ["volume", "lots"])
      });
    })
    .filter((trade) => trade.symbol && trade.externalId && trade.closeTime.getTime() > 0);
}

export function normalizeMt5Deals(
  deals: unknown[],
  options: { accountCurrency?: string | null; brokerTimeZone?: string | null } = {}
): NormalizedTrade[] {
  const groups = new Map<string, RawRecord[]>();
  for (const raw of deals) {
    if (!raw || typeof raw !== "object") continue;
    const deal = raw as RawRecord;
    if (isBalanceOperation(deal)) continue;
    const positionId = stringValue(deal, ["positionId", "position_id", "position", "id"]);
    if (!positionId) continue;
    groups.set(positionId, [...(groups.get(positionId) ?? []), deal]);
  }

  const trades: NormalizedTrade[] = [];
  for (const [positionId, group] of groups) {
    const sorted = group.sort((a, b) => dateValue(a, ["time", "brokerTime", "doneTime"]).getTime() - dateValue(b, ["time", "brokerTime", "doneTime"]).getTime());
    const openings = sorted.filter((deal) => stringValue(deal, ["entryType", "entry", "dealEntry"]).toUpperCase().includes("IN"));
    const closings = sorted.filter((deal) => isClosingMt5Deal(deal) && !openings.includes(deal));
    const openingDeals = openings.length ? openings : [sorted[0]!];
    const closingDeals = closings.length ? closings : sorted.slice(-1);
    const firstOpen = openingDeals[0]!;
    const lastClose = closingDeals[closingDeals.length - 1]!;
    const side = normalizeSide(stringValue(firstOpen, ["side", "type", "dealType"])) ?? "BUY";
    const volume = closingDeals.reduce((sum, deal) => sum + Math.abs(numberValue(deal, ["volume", "lots"])), 0) || Math.abs(numberValue(firstOpen, ["volume", "lots"]));

    // TradeScribe treats a position as the analytical unit; partial closes are
    // aggregated, not split, to keep R-multiple and risk-per-trade meaningful.
    trades.push(
      finalizeTrade({
        accountCurrency: options.accountCurrency,
        brokerTimeZone: options.brokerTimeZone ?? null,
        closePrice: weightedAverage(closingDeals.map((deal) => ({ price: numberValue(deal, ["price", "closePrice"]), volume: Math.abs(numberValue(deal, ["volume", "lots"])) || 1 }))),
        closeTime: dateValue(lastClose, ["time", "brokerTime", "doneTime"]),
        commission: sorted.reduce((sum, deal) => sum + numberValue(deal, ["commission"]), 0),
        externalId: positionId,
        grossProfit: sorted.reduce((sum, deal) => sum + numberValue(deal, ["profit", "grossProfit"]), 0),
        openPrice: weightedAverage(openingDeals.map((deal) => ({ price: numberValue(deal, ["price", "openPrice"]), volume: Math.abs(numberValue(deal, ["volume", "lots"])) || 1 }))),
        openTime: dateValue(firstOpen, ["time", "brokerTime", "doneTime"]),
        side,
        stopLoss: numberValue(lastClose, ["stopLoss", "sl"], 0) || null,
        swap: sorted.reduce((sum, deal) => sum + numberValue(deal, ["swap"]), 0),
        symbol: stringValue(firstOpen, ["symbol"]),
        takeProfit: numberValue(lastClose, ["takeProfit", "tp"], 0) || null,
        volume
      })
    );
  }
  return trades.filter((trade) => trade.symbol && trade.externalId && trade.closeTime.getTime() > 0);
}

export function normalizeMetaApiHistory(input: {
  accountCurrency?: string | null;
  brokerTimeZone?: string | null;
  platform: "MT4" | "MT5";
  records: unknown[];
}) {
  return input.platform === "MT5"
    ? normalizeMt5Deals(input.records, { accountCurrency: input.accountCurrency, brokerTimeZone: input.brokerTimeZone })
    : normalizeMt4Orders(input.records, { accountCurrency: input.accountCurrency, brokerTimeZone: input.brokerTimeZone });
}
