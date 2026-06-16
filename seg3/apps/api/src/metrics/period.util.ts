import { DateTime } from 'luxon';

export type Granularity = 'day' | 'week' | 'month' | 'year';

export interface Period {
  start: Date;
  end: Date; // exclusive
  label: string;
}

export interface PeriodWithPrevious {
  current: Period;
  previous: Period;
  granularity: Granularity;
}

/**
 * Resolve the current and previous period for a granularity, anchored on a date,
 * in the user's time zone. Weeks are Sunday..Saturday to match the dashboard.
 */
export function resolvePeriod(
  granularity: Granularity,
  anchorISO: string | undefined,
  timeZone = 'UTC',
): PeriodWithPrevious {
  const anchor = (anchorISO ? DateTime.fromISO(anchorISO, { zone: timeZone }) : DateTime.now().setZone(timeZone));

  let start: DateTime;
  let end: DateTime;
  let label: string;

  switch (granularity) {
    case 'day':
      start = anchor.startOf('day');
      end = start.plus({ days: 1 });
      label = start.toFormat('LLL d, yyyy');
      break;
    case 'week': {
      // luxon weeks start Monday; shift to Sunday start.
      const dow = anchor.weekday % 7; // Sun=0
      start = anchor.startOf('day').minus({ days: dow });
      end = start.plus({ weeks: 1 });
      label = `${start.toFormat('LLL d')} - ${end.minus({ days: 1 }).toFormat('LLL d, yyyy')}`;
      break;
    }
    case 'month':
      start = anchor.startOf('month');
      end = start.plus({ months: 1 });
      label = start.toFormat('LLLL yyyy');
      break;
    case 'year':
      start = anchor.startOf('year');
      end = start.plus({ years: 1 });
      label = start.toFormat('yyyy');
      break;
  }

  const span = end.diff(start);
  const prevStart = start.minus(span);
  const previous: Period = { start: prevStart.toJSDate(), end: start.toJSDate(), label: 'previous ' + granularity };

  return {
    current: { start: start.toJSDate(), end: end.toJSDate(), label },
    previous,
    granularity,
  };
}

/** Step the anchor by one unit of the granularity (for the chevron controls). */
export function stepAnchor(anchorISO: string, granularity: Granularity, direction: 1 | -1, timeZone = 'UTC'): string {
  const a = DateTime.fromISO(anchorISO, { zone: timeZone });
  const unit = granularity === 'day' ? { days: 1 } : granularity === 'week' ? { weeks: 1 } : granularity === 'month' ? { months: 1 } : { years: 1 };
  return (direction === 1 ? a.plus(unit) : a.minus(unit)).toISO()!;
}
