"use client";

import { useEffect, useMemo, useState } from "react";
import { SAMPLE_DASHBOARD_DATA } from "./dashboard-sample";

export type Granularity = "day" | "week" | "month" | "year";
export type TradingSession = "Sydney" | "Tokyo" | "London" | "New York";
export type TradeSide = "BUY" | "SELL";

export interface AccountSummary {
  balance?: number;
  broker?: string;
  brokerConnectionId?: string;
  id: string;
  label?: string | null;
  name: string;
  login: string;
  maskedLogin?: string;
  platform: "MT4" | "MT5";
  currency: string;
  equity?: number;
  isPrimary: boolean;
  connectionStatus: string;
  lastSyncAt?: string | null;
}

export interface CurrentUserResponse {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName?: string | null;
    avatarUrl?: string | null;
    role: "ADMIN" | "USER";
    plan: "FREE" | "CORE" | "PRO";
  };
  subscription: null | {
    plan: "FREE" | "CORE" | "PRO";
    status: string;
    provider: string;
  };
  preferences: {
    activeAccountId: string | null;
    displayCurrencyAccountId?: string | null;
    notificationPreferences?: NotificationPreferences;
    onboardingCompletedAt?: string | null;
    onboardingSampleModeAt?: string | null;
    timeZone?: string | null;
  };
  accounts: AccountSummary[];
}

export interface DeltaValue {
  current: number;
  previous: number;
  absolute: number;
  percent: number | null;
}

export interface DailyPoint {
  date: string;
  netPnl: number;
  tradeCount: number;
  cumulativePnl: number;
  winRate?: number;
}

export interface RecentTrade {
  id: string;
  closeTime: string;
  netProfit: number;
  side: TradeSide;
  symbol: string;
}

export interface LeakSummary {
  missingStopTrades: number;
  overtradingDays: number;
  revengeTrades: number;
  riskInconsistencyScore: number;
}

export type LeakSeverity = "critical" | "info" | "warning";
export type LeakType =
  | "revenge_trade"
  | "overtrading"
  | "missing_stop_loss"
  | "stop_widened"
  | "risk_inconsistency"
  | "asymmetric_win_loss"
  | "correlated_cluster"
  | "excessive_single_trade_risk";

export interface LeakFlagResponse {
  id: string;
  evidence: Record<string, number | string>;
  periodEnd?: string | null;
  periodStart?: string | null;
  severity: LeakSeverity;
  status: "active" | "acknowledged" | "dismissed";
  tradeIds: string[];
  type: LeakType;
}

export interface GuardrailStatus {
  consistency?: { worstDayPct: number; limitPct: number; status: "ok" | "warning" | "breached" };
  dailyLoss?: { usedPct: number; limitPct: number; status: "ok" | "warning" | "breached"; remainingAmount: number };
  drawdown?: { usedPct: number; limitPct: number; status: "ok" | "warning" | "breached"; remainingAmount: number; mode: "static" | "trailing" };
  overallStatus: "ok" | "warning" | "breached";
  profitTarget?: { progressPct: number; targetPct: number; status: "in_progress" | "reached" };
}

export interface PropFirmRuleSet {
  alertThresholdPct: number;
  consistencyMaxDailyProfitPct?: number | null;
  maxDailyLossMode: "balance" | "equity";
  maxDailyLossPct?: number | null;
  maxDrawdownMode: "static" | "trailing";
  maxDrawdownPct?: number | null;
  profitTargetPct?: number | null;
}

export interface AlertResponse {
  id: string;
  createdAt: string;
  payload: unknown;
  readAt?: string | null;
  severity: LeakSeverity | "breached";
  type: string;
}

export interface TradeNoteResponse {
  id: string;
  body: string;
  emotion?: string | null;
  emotionTags: string[];
  playbookChecklist?: Array<{ checked: boolean; ruleIndex: number }> | null;
  createdAt: string;
  updatedAt: string;
}

export interface TradeScreenshotResponse {
  id: string;
  createdAt: string;
  filename?: string | null;
  mimeType?: string | null;
  storageKey?: string | null;
  url: string;
}

export interface JournalEntryResponse {
  id: string;
  observed?: string | null;
  inferred?: string | null;
  summary: string;
  model?: string | null;
  tokensUsed?: number;
  createdAt: string;
  updatedAt: string;
}

export interface TradeDetailResponse {
  id: string;
  tradingAccountId: string;
  tradingAccount?: { currency: string; id: string; login: string; name?: string | null };
  closePrice: number;
  closeTime: string;
  commission: number;
  durationSec?: number | null;
  externalId?: string | null;
  grossProfit: number;
  journalEntry?: JournalEntryResponse | null;
  leakFlags: LeakFlagResponse[];
  netProfit: number;
  notes: TradeNoteResponse[];
  openPrice: number;
  openTime: string;
  playbook?: (PlaybookSummary & { rules?: PlaybookRule[] }) | null;
  playbookId?: string | null;
  rMultiple?: number | null;
  riskAmount?: number | null;
  screenshots: TradeScreenshotResponse[];
  session?: TradingSession | null;
  side: TradeSide;
  stopLoss?: number | null;
  swap: number;
  symbol: string;
  takeProfit?: number | null;
  volume: number;
}

export interface TradesListResponse {
  data: Array<RecentTrade & {
    commission: number;
    grossProfit: number;
    notes?: TradeNoteResponse[];
    openTime: string;
    playbook?: PlaybookSummary | null;
    playbookId?: string | null;
    session?: TradingSession | null;
    swap: number;
    volume: number;
  }>;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PlaybookRule {
  order: number;
  text: string;
}

export interface PlaybookSummary {
  color: string;
  id: string;
  name: string;
}

export interface Playbook extends PlaybookSummary {
  createdAt: string;
  description?: string | null;
  isArchived: boolean;
  recentTrades?: TradesListResponse["data"];
  rules: PlaybookRule[];
  tags: string[];
  tradeCount?: number;
  updatedAt: string;
}

export interface PlaybookPayload {
  color: string;
  description?: string | null;
  isArchived?: boolean;
  name: string;
  rules: PlaybookRule[];
  tags: string[];
}

export interface PlaybookPerformanceResponse {
  metrics: MetricsResponse;
  period: { label: string; granularity: Granularity };
  playbook: Playbook;
  recentTrades: TradesListResponse["data"];
}

export interface PlaybookPerformanceSummaryResponse {
  playbooks: Array<PlaybookSummary & { metrics: MetricsResponse }>;
  untagged: { metrics: MetricsResponse };
}

export interface PortfolioResponse {
  locked: boolean;
  reason?: string;
  period?: { label: string; granularity: Granularity };
  accounts: Array<AccountSummary & {
    metrics: MetricsResponse;
    riskRoom?: GuardrailStatus | null;
  }>;
}

export interface ConnectionsResponse {
  connections: Array<{
    accounts: Array<AccountSummary & { status: string }>;
    broker: string;
    id: string;
    lastError?: string | null;
    lastSyncAt?: string | null;
    provider: string;
    server?: string | null;
    status: string;
  }>;
  limits: {
    accountCount: number;
    canConnectMore: boolean;
    maxAccounts: number | null;
    plan: "FREE" | "CORE" | "PRO";
  };
}

export type NotificationPreferenceKey = "leak_critical" | "leak_warning" | "guardrail_warning" | "guardrail_breach" | "weekly_review_ready";
export type NotificationPreferences = Record<NotificationPreferenceKey, { email: boolean; inApp: boolean }>;

export interface SettingsResponse {
  accounts: Array<{
    broker: string;
    currency: string;
    id: string;
    label?: string | null;
    maskedLogin: string;
    name: string;
    platform: "MT4" | "MT5";
  }>;
  billing: {
    amountCents: number;
    currency: string;
    plan: "FREE" | "CORE" | "PRO";
    provider: "STRIPE" | "PAYSTACK" | null;
    renewalDate: string | null;
    status: string;
    usage: {
      accountsConnected: number;
      accountsLimit: number | null;
      storageMb: number | null;
    };
  };
  emailEnabled: boolean;
  preferences: {
    displayCurrencyAccountId: string | null;
    notificationPreferences: NotificationPreferences;
    timeZone: string | null;
  };
  user: {
    avatarUrl: string | null;
    email: string;
    firstName: string;
    lastName: string;
  };
}

export interface SearchResponse {
  notes: Array<{
    body: string;
    emotionTags: string[];
    href: string;
    id: string;
    trade: {
      closeTime: string;
      id: string;
      netProfit: number;
      side: TradeSide;
      symbol: string;
    };
  }>;
  playbooks: Array<{
    color: string;
    description?: string | null;
    href: string;
    id: string;
    name: string;
  }>;
  trades: Array<{
    closeTime: string;
    href: string;
    id: string;
    netProfit: number;
    side: TradeSide;
    symbol: string;
  }>;
}

export interface OnboardingStatusResponse {
  completedAt: string | null;
  connectionCount: number;
  hasConnections: boolean;
  sampleModeAt: string | null;
  shouldShowFinishSetupPrompt: boolean;
  shouldShowOnboarding: boolean;
}

export interface CreatedConnectionResponse {
  accountId: string | null;
  id: string;
  lastError?: string | null;
  status: string;
}

export interface ConnectionStatusResponse {
  id: string;
  status: string;
  tradingAccounts?: Array<{ id: string }>;
}

export interface WeeklyReviewLeak {
  evidence: Record<string, number | string>;
  explanation: string;
  id: string;
  severity: LeakSeverity;
  tradeIds: string[];
  type: LeakType;
}

export interface WeeklyReview {
  id: string;
  actions: string[];
  createdAt: string;
  leaks: WeeklyReviewLeak[];
  periodEnd: string;
  periodStart: string;
  strengths: string[];
  summary: string;
  updatedAt: string;
}

export interface WeeklyReviewResponse {
  locked: boolean;
  reason?: string;
  plan?: "FREE" | "CORE" | "PRO";
  review?: WeeklyReview | null;
  canGenerate?: boolean;
  cooldownUntil?: string | null;
}

export interface CoachProfileResponse {
  locked: boolean;
  profile: {
    goals: string[];
    recurringLeaks: Array<{ label: string; count: number; weeks: number }>;
    riskProfileSummary: string;
    updatedAt: string;
  };
  advice: Array<{
    id: string;
    text: string;
    status: "pending" | "did_this" | "didnt_do_this";
    weekStart?: string | null;
    createdAt: string;
  }>;
}

export interface MetricsResponse {
  grossWin: number;
  grossLoss: number;
  netPnl: number;
  winRate: number;
  profitFactor: number | null;
  profitFactorReason: "no_trades" | "no_losses" | null;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  breakevenTrades: number;
  avgWin: number;
  avgLoss: number;
  expectancyCurrency: number;
  avgWinR: number | null;
  avgLossR: number | null;
  expectancyR: number | null;
  avgHoldSeconds: number | null;
  largestWin: number;
  largestLoss: number;
  currentStreak: { type: "win" | "loss" | "breakeven" | null; count: number };
  longestWinStreak: number;
  longestLossStreak: number;
  drawdown: { abs: number; pct: number };
  dailySeries: DailyPoint[];
  bySymbol: { symbol: string; trades: number; netPnl: number; winRate: number }[];
  bySession: { session: string; trades: number; netPnl: number; winRate: number }[];
  byDayOfWeek: { weekday: "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun"; trades: number; netPnl: number; winRate: number }[];
  rMultipleHistogram: { bin: string; count: number; netPnl: number }[];
  bestDay: { date: string; netPnl: number } | null;
  worstDay: { date: string; netPnl: number } | null;
  deltas: {
    netPnl: DeltaValue;
    winRate: DeltaValue;
    profitFactor: DeltaValue;
    totalTrades: DeltaValue;
  } | null;
  period: { label: string; granularity: Granularity };
}

export interface DashboardFilters {
  day?: string;
  symbol?: string;
  session?: TradingSession;
  side?: TradeSide;
}

export interface DashboardLayoutItem {
  order: number;
  size: "sm" | "md" | "lg";
  visible: boolean;
  widgetId: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:4000";

async function fetchJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    signal
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}

async function sendJson<T>(path: string, payload: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    body: JSON.stringify(payload),
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    method: "PUT",
    signal
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}

async function postJson<T>(path: string, payload: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    body: JSON.stringify(payload),
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    method: "POST",
    signal
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}

async function patchJson<T>(path: string, payload?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    body: payload === undefined ? undefined : JSON.stringify(payload),
    credentials: "include",
    headers: payload === undefined ? undefined : { "Content-Type": "application/json" },
    method: "PATCH",
    signal
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}

async function deleteJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    method: "DELETE",
    signal
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}

async function deleteJsonWithBody<T>(path: string, payload: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    body: JSON.stringify(payload),
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    method: "DELETE",
    signal
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function useCurrentUser() {
  const [data, setData] = useState<CurrentUserResponse | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);

    fetchJson<CurrentUserResponse>("/me", controller.signal)
      .then((payload) => {
        setData(payload);
        setError(null);
      })
      .catch((reason: unknown) => {
        if ((reason as Error).name !== "AbortError") {
          if (process.env.NODE_ENV !== "production") {
            setData({
              accounts: [],
              preferences: { activeAccountId: null, onboardingCompletedAt: null, onboardingSampleModeAt: null },
              subscription: null,
              user: {
                email: "trader@example.com",
                firstName: "Trader",
                lastName: "",
                avatarUrl: null,
                id: "dev-user",
                plan: "FREE",
                role: "ADMIN"
              }
            });
            setError(null);
            return;
          }

          setError(reason instanceof Error ? reason : new Error("Could not load account context"));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, []);

  return { data, error, isLoading };
}

export function useMetrics(
  accountId: string | null,
  params: { granularity: Granularity; anchor: string; tz: string; filters: DashboardFilters }
) {
  const [data, setData] = useState<MetricsResponse | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const queryString = useMemo(() => {
    const query = new URLSearchParams({
      anchor: params.anchor,
      granularity: params.granularity,
      tz: params.tz
    });

    if (params.filters.symbol) query.set("symbol", params.filters.symbol);
    if (params.filters.session) query.set("session", params.filters.session);
    if (params.filters.side) query.set("side", params.filters.side);
    if (params.filters.day) query.set("date", params.filters.day);
    return query.toString();
  }, [params.anchor, params.filters.day, params.filters.session, params.filters.side, params.filters.symbol, params.granularity, params.tz]);

  useEffect(() => {
    if (!accountId) {
      setData(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);

    fetchJson<MetricsResponse>(`/accounts/${accountId}/metrics?${queryString}`, controller.signal)
      .then((payload) => {
        setData(payload);
        setError(null);
      })
      .catch((reason: unknown) => {
        if ((reason as Error).name !== "AbortError") {
          setError(reason instanceof Error ? reason : new Error("Could not load metrics"));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [accountId, queryString]);

  return { data, error, isLoading };
}

export function useDashboardData(
  accountId: string | null,
  params: { granularity: Granularity; anchor: string; tz: string; filters: DashboardFilters }
) {
  const metrics = useMetrics(accountId, params);
  const liveData = accountId && metrics.data ? metrics.data : null;

  return {
    data: liveData ?? SAMPLE_DASHBOARD_DATA,
    error: liveData ? null : metrics.error,
    isLoading: Boolean(accountId && metrics.isLoading && !metrics.data),
    status: liveData ? ("live" as const) : ("sample" as const)
  };
}

export function useLeaks(accountId: string | null, params: { granularity: Granularity; anchor: string; tz: string }) {
  const [data, setData] = useState<LeakFlagResponse[]>([]);
  useEffect(() => {
    if (!accountId) {
      setData([]);
      return;
    }
    const controller = new AbortController();
    const query = new URLSearchParams({ anchor: params.anchor, granularity: params.granularity, tz: params.tz });
    fetchJson<LeakFlagResponse[]>(`/accounts/${accountId}/leaks?${query}`, controller.signal)
      .then(setData)
      .catch(() => setData([]));
    return () => controller.abort();
  }, [accountId, params.anchor, params.granularity, params.tz]);
  return data;
}

export function useGuardrails(accountId: string | null, tz: string) {
  const [data, setData] = useState<GuardrailStatus | null>(null);
  useEffect(() => {
    if (!accountId) {
      setData(null);
      return;
    }
    const controller = new AbortController();
    fetchJson<GuardrailStatus | null>(`/accounts/${accountId}/guardrails?tz=${encodeURIComponent(tz)}`, controller.signal)
      .then(setData)
      .catch(() => setData(null));
    return () => controller.abort();
  }, [accountId, tz]);
  return data;
}

export function useAlerts(unreadOnly = true) {
  const [data, setData] = useState<AlertResponse[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    fetchJson<AlertResponse[]>(`/alerts?unreadOnly=${unreadOnly}`, controller.signal)
      .then(setData)
      .catch(() => setData([]));
    return () => controller.abort();
  }, [unreadOnly]);
  return data;
}

export function markAlertRead(alertId: string) {
  return patchJson<AlertResponse>(`/alerts/${alertId}/read`);
}

export function usePropRules(accountId: string | null) {
  const [data, setData] = useState<PropFirmRuleSet | null>(null);
  useEffect(() => {
    if (!accountId) {
      setData(null);
      return;
    }
    const controller = new AbortController();
    fetchJson<PropFirmRuleSet | null>(`/accounts/${accountId}/prop-rules`, controller.signal)
      .then(setData)
      .catch(() => setData(null));
    return () => controller.abort();
  }, [accountId]);
  return data;
}

export function savePropRules(accountId: string, payload: PropFirmRuleSet) {
  return sendJson<PropFirmRuleSet>(`/accounts/${accountId}/prop-rules`, payload);
}

export function fetchTrades(accountId: string, query: URLSearchParams, signal?: AbortSignal) {
  return fetchJson<TradesListResponse>(`/accounts/${accountId}/trades?${query}`, signal);
}

export function savePreferences(payload: { activeAccountId: string | null }) {
  return patchJson<{ activeAccountId: string | null; id: string; userId: string }>("/me/preferences", payload);
}

export function fetchSettings(signal?: AbortSignal) {
  return fetchJson<SettingsResponse>("/me/settings", signal);
}

export function searchTradeScribe(query: { accountId?: string | null; q: string }, signal?: AbortSignal) {
  const params = new URLSearchParams({ q: query.q });
  if (query.accountId) params.set("accountId", query.accountId);
  return fetchJson<SearchResponse>(`/search?${params}`, signal);
}

export function updateProfile(payload: { avatarUrl?: string | null; firstName?: string | null; lastName?: string | null }) {
  return patchJson<SettingsResponse["user"]>("/me/profile", payload);
}

export function updateNotificationPreferences(payload: NotificationPreferences) {
  return patchJson<unknown>("/me/notification-preferences", payload);
}

export function updateDisplayPreferences(payload: { displayCurrencyAccountId: string | null; timeZone: string }) {
  return patchJson<unknown>("/me/display-preferences", payload);
}

export function openBillingPortal() {
  return postJson<{ provider: string; url: string }>("/me/billing-portal", {});
}

export function exportMyData(signal?: AbortSignal) {
  return fetchJson<unknown>("/me/export", signal);
}

export function deleteMyAccount(confirmation: string) {
  return deleteJsonWithBody<{ deleted: boolean }>("/me", { confirmation });
}

export function fetchOnboardingStatus(signal?: AbortSignal) {
  return fetchJson<OnboardingStatusResponse>("/me/onboarding-status", signal);
}

export function markOnboarding(action: "complete" | "dismiss" | "start_sample") {
  return patchJson<{ id: string; userId: string }>("/me/onboarding", { action });
}

export function fetchTrade(tradeId: string, signal?: AbortSignal) {
  return fetchJson<TradeDetailResponse>(`/trades/${tradeId}`, signal);
}

export function saveTradeNote(tradeId: string, payload: { body: string; emotionTags: string[]; playbookChecklist?: Array<{ checked: boolean; ruleIndex: number }> }) {
  return postJson<TradeNoteResponse>(`/trades/${tradeId}/notes`, payload);
}

export function fetchPlaybooks(signal?: AbortSignal) {
  return fetchJson<Playbook[]>("/playbooks", signal);
}

export function fetchPlaybook(playbookId: string, signal?: AbortSignal) {
  return fetchJson<Playbook>(`/playbooks/${playbookId}`, signal);
}

export function createPlaybook(payload: PlaybookPayload) {
  return postJson<Playbook>("/playbooks", payload);
}

export function updatePlaybook(playbookId: string, payload: Partial<PlaybookPayload>) {
  return patchJson<Playbook>(`/playbooks/${playbookId}`, payload);
}

export function archivePlaybook(playbookId: string) {
  return deleteJson<Playbook>(`/playbooks/${playbookId}`);
}

export function tagTradePlaybook(tradeId: string, playbookId: string | null) {
  return patchJson<TradesListResponse["data"][number]>(`/trades/${tradeId}/playbook`, { playbookId });
}

export function fetchPlaybookPerformance(playbookId: string, query: URLSearchParams, signal?: AbortSignal) {
  return fetchJson<PlaybookPerformanceResponse>(`/playbooks/${playbookId}/performance?${query}`, signal);
}

export function fetchPlaybookPerformanceSummary(query: URLSearchParams, signal?: AbortSignal) {
  return fetchJson<PlaybookPerformanceSummaryResponse>(`/playbooks/performance-summary?${query}`, signal);
}

export function fetchPortfolio(query: URLSearchParams, signal?: AbortSignal) {
  return fetchJson<PortfolioResponse>(`/portfolio?${query}`, signal);
}

export function fetchConnections(signal?: AbortSignal) {
  return fetchJson<ConnectionsResponse>("/me/connections", signal);
}

export function createConnection(payload: {
  broker: string;
  currency: string;
  investorPassword: string;
  label?: string | null;
  login: string;
  platform: "MT4" | "MT5";
  server: string;
  startingBalance: number;
}) {
  return postJson<CreatedConnectionResponse>("/connections", payload);
}

export function fetchConnectionStatus(connectionId: string, signal?: AbortSignal) {
  return fetchJson<ConnectionStatusResponse>(`/connections/${connectionId}`, signal);
}

export function saveAccountLabel(accountId: string, label: string | null) {
  return patchJson<AccountSummary>(`/accounts/${accountId}/label`, { label });
}

export function syncConnection(connectionId: string) {
  return postJson<{ id: string; status: string }>(`/connections/${connectionId}/sync`, {});
}

export function disconnectConnection(connectionId: string, deleteTradeHistory = false) {
  return deleteJsonWithBody<{ id: string; status?: string }>(`/connections/${connectionId}`, { deleteTradeHistory });
}

export function createScreenshotUpload(tradeId: string, payload: { filename: string; mimeType: string }) {
  return postJson<{ headers: Record<string, string>; method: "PUT"; publicUrl: string | null; storageKey: string; uploadUrl: string | null }>(
    `/trades/${tradeId}/screenshots/sign`,
    payload
  );
}

export function addTradeScreenshot(tradeId: string, payload: { filename?: string; mimeType?: string; storageKey?: string; url: string }) {
  return postJson<TradeScreenshotResponse>(`/trades/${tradeId}/screenshots`, payload);
}

export function fetchWeeklyReview(signal?: AbortSignal, accountId?: string | null) {
  const query = accountId ? `?accountId=${encodeURIComponent(accountId)}` : "";
  return fetchJson<WeeklyReviewResponse>(`/reviews/weekly/latest${query}`, signal);
}

export function generateWeeklyReview(accountId?: string | null) {
  const query = accountId ? `?accountId=${encodeURIComponent(accountId)}` : "";
  return postJson<WeeklyReviewResponse>(`/reviews/weekly/generate${query}`, {});
}

export function fetchCoachProfile(signal?: AbortSignal) {
  return fetchJson<CoachProfileResponse>("/coach/profile", signal);
}

export function saveCoachGoals(goals: string[]) {
  return patchJson<CoachProfileResponse["profile"]>("/coach/profile", { goals });
}

export function updateAdviceStatus(id: string, status: "pending" | "did_this" | "didnt_do_this") {
  return patchJson<CoachProfileResponse["advice"][number]>(`/coach/advice/${id}`, { status });
}

export function useDashboardLayout(defaultLayout: DashboardLayoutItem[]) {
  const [data, setData] = useState<DashboardLayoutItem[]>(defaultLayout);
  const [isLoading, setIsLoading] = useState(true);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);

    fetchJson<{ layout: DashboardLayoutItem[] | null }>("/me/dashboard-layout", controller.signal)
      .then((payload) => {
        if (payload.layout?.length) setData(normalizeLayout(payload.layout, defaultLayout));
      })
      .catch(() => {
        setData(defaultLayout);
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [defaultLayout]);

  function save(layout: DashboardLayoutItem[]) {
    setData(layout);
    setSaveState("saving");
    const controller = new AbortController();
    window.setTimeout(() => {
      sendJson<{ layout: DashboardLayoutItem[] }>("/me/dashboard-layout", { layout }, controller.signal)
        .then((payload) => {
          setData(normalizeLayout(payload.layout, defaultLayout));
          setSaveState("saved");
          window.setTimeout(() => setSaveState("idle"), 1600);
        })
        .catch(() => {
          setSaveState("error");
          window.setTimeout(() => setSaveState("idle"), 2200);
        });
    }, 250);
  }

  return { data, isLoading, save, saveState, setData };
}

function normalizeLayout(layout: DashboardLayoutItem[], defaults: DashboardLayoutItem[]) {
  const byId = new Map(layout.map((item) => [item.widgetId, item]));
  return defaults
    .map((fallback) => ({ ...fallback, ...byId.get(fallback.widgetId) }))
    .sort((a, b) => a.order - b.order)
    .map((item, index) => ({ ...item, order: index }));
}
