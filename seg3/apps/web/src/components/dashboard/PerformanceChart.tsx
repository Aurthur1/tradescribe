'use client';

import { useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { DailyPoint } from '@/lib/useMetrics';
import { formatCurrency } from '@/lib/format';

export function PerformanceChart({ data, currency = 'USD' }: { data: DailyPoint[]; currency?: string }) {
  const [mode, setMode] = useState<'cumulative' | 'daily'>('cumulative');
  const key = mode === 'cumulative' ? 'cumulativePnl' : 'netPnl';

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#141A2A]/60 p-5">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-50">Performance</h3>
          <p className="text-sm text-slate-400">Daily P&amp;L and cumulative results</p>
        </div>
        <button
          onClick={() => setMode((m) => (m === 'cumulative' ? 'daily' : 'cumulative'))}
          className="rounded-lg border border-white/[0.08] px-3 py-1 text-xs text-slate-400 hover:text-slate-200"
        >
          {mode === 'cumulative' ? 'Cumulative' : 'Daily'}
        </button>
      </div>

      {data.length === 0 ? (
        <div className="grid h-[280px] place-items-center text-sm text-slate-500">No trades in this period</div>
      ) : (
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 8, bottom: 0, left: -8 }}>
              <defs>
                <linearGradient id="perfFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="4 4" stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: '#64748B', fontSize: 12 }} tickLine={false} axisLine={false} minTickGap={24} />
              <YAxis tick={{ fill: '#64748B', fontSize: 12 }} tickLine={false} axisLine={false} width={56} />
              <Tooltip
                contentStyle={{ background: '#0C111F', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, color: '#F8FAFC' }}
                formatter={(v: number) => [formatCurrency(v, currency), mode === 'cumulative' ? 'Cumulative' : 'Daily']}
              />
              <Area
                type="monotone"
                dataKey={key}
                stroke="#3B82F6"
                strokeWidth={2.5}
                fill="url(#perfFill)"
                dot={{ r: 3, fill: '#3B82F6', strokeWidth: 0 }}
                activeDot={{ r: 5 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
