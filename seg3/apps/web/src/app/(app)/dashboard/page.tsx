'use client';

import { useMemo, useState } from 'react';
import { DateTime } from 'luxon';
import { ArrowUpRight, Zap, TrendingUp, BarChart3, Download, Filter } from 'lucide-react';
import { useMetrics, type Granularity } from '@/lib/useMetrics';
import { KpiCard } from '@/components/dashboard/KpiCard';
import { PeriodControl } from '@/components/dashboard/PeriodControl';
import { PerformanceChart } from '@/components/dashboard/PerformanceChart';
import { ActivityCalendar } from '@/components/dashboard/ActivityCalendar';
import { formatCurrency, formatPercent, formatNumber, formatProfitFactor } from '@/lib/format';

// In real usage this comes from the account switcher / user context.
const useActiveAccount = () => ({ accountId: 'PRIMARY_ACCOUNT_ID', currency: 'USD', firstName: 'Trader' });

export default function DashboardPage() {
  const { accountId, currency, firstName } = useActiveAccount();
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const [granularity, setGranularity] = useState<Granularity>('week');
  const [anchor, setAnchor] = useState<string>(() => DateTime.now().setZone(tz).toISO()!);
  const [selectedDate, setSelectedDate] = useState<string | undefined>();

  const { metrics, error, isLoading } = useMetrics(accountId, { granularity, anchor, tz });

  function step(direction: 1 | -1) {
    const unit = granularity === 'day' ? { days: 1 } : granularity === 'week' ? { weeks: 1 } : granularity === 'month' ? { months: 1 } : { years: 1 };
    const a = DateTime.fromISO(anchor, { zone: tz });
    setAnchor((direction === 1 ? a.plus(unit) : a.minus(unit)).toISO()!);
  }

  const weekDates = useMemo(() => {
    const a = DateTime.fromISO(anchor, { zone: tz });
    const start = a.startOf('day').minus({ days: a.weekday % 7 }); // Sunday
    return Array.from({ length: 7 }, (_, i) => start.plus({ days: i }).toFormat('yyyy-MM-dd'));
  }, [anchor, tz]);

  if (!accountId) return <NoAccount />;

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-[28px] font-bold text-slate-50">Dashboard</h1>
          <p className="mt-1 text-slate-400">Welcome back, {firstName}. Here&apos;s your performance overview.</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-sm text-slate-200 hover:bg-white/[0.06]">
            <Download size={16} /> Export
          </button>
          <button className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-sm text-slate-200 hover:bg-white/[0.06]">
            <Filter size={16} /> Filter
          </button>
        </div>
      </header>

      <PeriodControl
        label={metrics?.period.label ?? '…'}
        granularity={granularity}
        onStep={step}
        onGranularity={setGranularity}
      />

      {error ? (
        <ErrorState onRetry={() => location.reload()} />
      ) : isLoading || !metrics ? (
        <DashboardSkeleton />
      ) : metrics.totalTrades === 0 ? (
        <EmptyPeriod />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label={granularity === 'week' ? 'Weekly P&L' : 'Net P&L'}
              value={formatCurrency(metrics.netPnl, currency)}
              accent={metrics.netPnl >= 0 ? 'green' : 'white'}
              icon={<ArrowUpRight size={16} />}
              deltaPercent={metrics.deltas?.netPnl.percent ?? null}
              deltaLabel={`vs previous ${granularity}`}
            />
            <KpiCard
              label="Win Rate"
              value={formatPercent(metrics.winRate, 0)}
              accent="blue"
              icon={<Zap size={16} />}
              deltaPercent={metrics.deltas?.winRate.percent ?? null}
              deltaLabel="vs previous period"
            />
            <KpiCard
              label="Profit Factor"
              value={formatProfitFactor(metrics.profitFactor, metrics.profitFactorReason)}
              accent="violet"
              icon={<TrendingUp size={16} />}
              deltaPercent={metrics.deltas?.profitFactor.percent ?? null}
              deltaLabel="vs previous period"
            />
            <KpiCard
              label="Total Trades"
              value={formatNumber(metrics.totalTrades)}
              accent="white"
              icon={<BarChart3 size={16} />}
              deltaPercent={metrics.deltas?.totalTrades.percent ?? null}
              deltaLabel="vs previous period"
              deltaIsValueJudged={false}
            />
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[2fr_1fr]">
            <PerformanceChart data={metrics.dailySeries} currency={currency} />
            <ActivityCalendar
              weekDates={weekDates}
              series={metrics.dailySeries}
              selectedDate={selectedDate}
              currency={currency}
              onSelectDay={setSelectedDate}
            />
          </div>
        </>
      )}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-[130px] animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.03]" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[2fr_1fr]">
        <div className="h-[340px] animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.03]" />
        <div className="h-[340px] animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.03]" />
      </div>
    </div>
  );
}

function EmptyPeriod() {
  return (
    <div className="grid place-items-center rounded-2xl border border-white/[0.06] bg-[#141A2A]/40 py-20 text-center">
      <p className="text-slate-300">No trades in this period.</p>
      <p className="mt-1 text-sm text-slate-500">Step to another period or connect more history.</p>
    </div>
  );
}

function NoAccount() {
  return (
    <div className="grid place-items-center rounded-2xl border border-white/[0.06] bg-[#141A2A]/40 py-24 text-center">
      <h2 className="text-xl font-semibold text-slate-100">Connect a read-only MetaTrader account</h2>
      <p className="mt-2 max-w-md text-sm text-slate-400">
        Link your MT4 or MT5 account with an investor (read-only) password to see your dashboard. No trade execution, ever.
      </p>
      <a href="/import" className="mt-5 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-500">
        Connect read-only account
      </a>
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="grid place-items-center rounded-2xl border border-red-500/20 bg-red-500/[0.04] py-20 text-center">
      <p className="text-slate-200">Could not load your metrics.</p>
      <button onClick={onRetry} className="mt-4 rounded-xl border border-white/[0.08] px-4 py-2 text-sm text-slate-200 hover:bg-white/5">
        Retry
      </button>
    </div>
  );
}
