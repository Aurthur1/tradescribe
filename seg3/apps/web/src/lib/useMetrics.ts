'use client';

import useSWR from 'swr';

export type Granularity = 'day' | 'week' | 'month' | 'year';

export interface DeltaValue { current: number; previous: number; absolute: number; percent: number | null }
export interface DailyPoint { date: string; netPnl: number; tradeCount: number; cumulativePnl: number }

export interface MetricsResponse {
  netPnl: number;
  winRate: number;
  profitFactor: number | null;
  profitFactorReason: 'no_trades' | 'no_losses' | null;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  expectancyCurrency: number;
  expectancyR: number | null;
  avgHoldSeconds: number | null;
  drawdown: { abs: number; pct: number };
  dailySeries: DailyPoint[];
  bySymbol: { symbol: string; trades: number; netPnl: number; winRate: number }[];
  bySession: { session: string; trades: number; netPnl: number; winRate: number }[];
  deltas: {
    netPnl: DeltaValue;
    winRate: DeltaValue;
    profitFactor: DeltaValue;
    totalTrades: DeltaValue;
  } | null;
  period: { label: string; granularity: Granularity };
}

const fetcher = (url: string) =>
  fetch(url, { credentials: 'include' }).then((r) => {
    if (!r.ok) throw new Error(`Request failed: ${r.status}`);
    return r.json();
  });

const API = process.env.NEXT_PUBLIC_API_BASE ?? '';

export function useMetrics(accountId: string | null, params: { granularity: Granularity; anchor?: string; tz: string }) {
  const qs = new URLSearchParams({ granularity: params.granularity, tz: params.tz, ...(params.anchor ? { anchor: params.anchor } : {}) });
  const key = accountId ? `${API}/accounts/${accountId}/metrics?${qs}` : null;
  const { data, error, isLoading } = useSWR<MetricsResponse>(key, fetcher, { revalidateOnFocus: false });
  return { metrics: data, error, isLoading };
}

export function useTrades(accountId: string | null, params: Record<string, string | number>) {
  const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]));
  const key = accountId ? `${API}/accounts/${accountId}/trades?${qs}` : null;
  const { data, error, isLoading } = useSWR(key, fetcher, { revalidateOnFocus: false });
  return { trades: data, error, isLoading };
}
