'use client';

import { ReactNode } from 'react';
import { formatDeltaPercent } from '@/lib/format';

type Accent = 'green' | 'blue' | 'violet' | 'white';

const valueColor: Record<Accent, string> = {
  green: 'text-emerald-400',
  blue: 'text-blue-400',
  violet: 'text-violet-400',
  white: 'text-slate-50',
};

const chipColor: Record<Accent, string> = {
  green: 'bg-emerald-500/15 text-emerald-400',
  blue: 'bg-blue-500/15 text-blue-400',
  violet: 'bg-violet-500/15 text-violet-400',
  white: 'bg-slate-500/15 text-slate-300',
};

export interface KpiCardProps {
  label: string;
  value: string;
  accent: Accent;
  icon: ReactNode;
  deltaPercent: number | null;
  deltaLabel: string;
  /** When false (e.g. Total Trades), the delta arrow is directional only, not good/bad. */
  deltaIsValueJudged?: boolean;
}

export function KpiCard({ label, value, accent, icon, deltaPercent, deltaLabel, deltaIsValueJudged = true }: KpiCardProps) {
  const up = (deltaPercent ?? 0) >= 0;
  const deltaTextColor = !deltaIsValueJudged
    ? 'text-slate-400'
    : up
      ? 'text-emerald-400'
      : 'text-red-400';

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#141A2A]/60 p-5 shadow-[0_1px_2px_rgba(0,0,0,0.4)] [box-shadow:inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div className="flex items-start justify-between">
        <span className="text-sm font-medium text-slate-400">{label}</span>
        <span className={`grid h-9 w-9 place-items-center rounded-full ${chipColor[accent]}`}>{icon}</span>
      </div>
      <div className={`mt-4 text-[34px] font-bold leading-none tracking-tight ${valueColor[accent]}`}>{value}</div>
      <div className="mt-3 flex items-center gap-1 text-[13px]">
        <span className="text-slate-500">{deltaLabel}</span>
        <span className={`inline-flex items-center gap-0.5 font-medium ${deltaTextColor}`}>
          <span aria-hidden>{up ? '↗' : '↘'}</span>
          {formatDeltaPercent(deltaPercent)}
        </span>
      </div>
    </div>
  );
}
