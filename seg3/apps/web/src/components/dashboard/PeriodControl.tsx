'use client';

import type { Granularity } from '@/lib/useMetrics';

const GRANULARITIES: Granularity[] = ['day', 'week', 'month', 'year'];

export interface PeriodControlProps {
  label: string;
  granularity: Granularity;
  onStep: (direction: 1 | -1) => void;
  onGranularity: (g: Granularity) => void;
}

export function PeriodControl({ label, granularity, onStep, onGranularity }: PeriodControlProps) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/[0.06] bg-[#141A2A]/40 p-4">
      <div className="flex items-center gap-3">
        <button
          aria-label="Previous period"
          onClick={() => onStep(-1)}
          className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 hover:bg-white/5 hover:text-slate-200"
        >
          ‹
        </button>
        <div className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-sm font-medium text-slate-200">
          <span aria-hidden>📅</span>
          {label}
        </div>
        <button
          aria-label="Next period"
          onClick={() => onStep(1)}
          className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 hover:bg-white/5 hover:text-slate-200"
        >
          ›
        </button>
      </div>

      <div className="inline-flex rounded-xl border border-white/[0.08] bg-white/[0.03] p-1">
        {GRANULARITIES.map((g) => (
          <button
            key={g}
            onClick={() => onGranularity(g)}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium capitalize transition-colors ${
              g === granularity ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {g}
          </button>
        ))}
      </div>
    </div>
  );
}
