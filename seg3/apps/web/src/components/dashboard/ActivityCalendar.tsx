'use client';

import type { DailyPoint } from '@/lib/useMetrics';
import { formatCurrency } from '@/lib/format';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Week-grid activity calendar. Colors each day by net P&L; "No activity" when none.
 * `weekDates` is 7 YYYY-MM-DD strings (Sun..Sat) for the selected week.
 */
export function ActivityCalendar({
  weekDates,
  series,
  selectedDate,
  currency = 'USD',
  onSelectDay,
}: {
  weekDates: string[];
  series: DailyPoint[];
  selectedDate?: string;
  currency?: string;
  onSelectDay?: (date: string) => void;
}) {
  const byDate = new Map(series.map((d) => [d.date, d]));

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#141A2A]/60 p-5">
      <h3 className="text-lg font-semibold text-slate-50">Activity Calendar</h3>
      <p className="text-sm text-slate-400">Daily trading activity</p>

      <div className="mt-5 rounded-xl border border-white/[0.06] bg-[#0B0F1A] p-4">
        <div className="grid grid-cols-7 gap-2 text-center text-xs text-slate-500">
          {DOW.map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-7 gap-2 text-center">
          {weekDates.map((date) => {
            const day = byDate.get(date);
            const num = Number(date.slice(-2));
            const isSelected = date === selectedDate;
            const hasActivity = !!day && day.tradeCount > 0;
            const positive = (day?.netPnl ?? 0) >= 0;
            return (
              <button
                key={date}
                onClick={() => onSelectDay?.(date)}
                className="flex flex-col items-center gap-1 rounded-lg py-2 hover:bg-white/[0.03]"
              >
                <span
                  className={`grid h-8 w-8 place-items-center rounded-full text-sm font-semibold ${
                    isSelected ? 'bg-blue-600 text-white' : 'text-slate-200'
                  }`}
                >
                  {num}
                </span>
                {hasActivity ? (
                  <span className={`text-[11px] font-medium ${positive ? 'text-emerald-400' : 'text-red-400'}`}>
                    {formatCurrency(day!.netPnl, currency)}
                  </span>
                ) : (
                  <span className="text-[11px] leading-tight text-slate-600">No activity</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
