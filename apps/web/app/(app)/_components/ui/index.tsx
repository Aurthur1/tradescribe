"use client";

import { Info, type LucideIcon } from "lucide-react";
import { ReactNode, SVGProps, useMemo } from "react";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function Panel({
  accent,
  children,
  className,
  interactive,
  padding = "normal"
}: {
  accent?: boolean;
  children: ReactNode;
  className?: string;
  interactive?: boolean;
  padding?: "compact" | "normal" | "primary";
}) {
  return (
    <section
      className={cx(
        "terminal-panel relative overflow-hidden rounded-2xl",
        padding === "compact" ? "p-3" : padding === "primary" ? "p-5" : "p-4",
        interactive && "terminal-panel-interactive",
        accent && "before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-[#3B82F6] before:to-[#22D3EE]",
        className
      )}
    >
      {children}
    </section>
  );
}

export function PanelHeader({
  action,
  eyebrow,
  info,
  title
}: {
  action?: ReactNode;
  eyebrow?: string;
  info?: string;
  title: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        {eyebrow ? <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[--text-low]">{eyebrow}</p> : null}
        <div className="flex items-center gap-1.5">
          <h2 className="truncate text-[15px] font-bold leading-5 text-[--text-hi]">{title}</h2>
          {info ? (
            <span className="group/info relative inline-flex">
              <button className="rounded-full text-[--text-low] hover:text-[--text-hi] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]" type="button" aria-label={`${title} info`}>
                <Info className="h-3.5 w-3.5" aria-hidden />
              </button>
              <span className="pointer-events-none absolute left-0 top-[calc(100%+8px)] z-20 w-64 rounded-xl border border-white/[0.08] bg-[#0B1120]/95 p-3 text-xs font-medium leading-5 text-[#CBD5E1] opacity-0 shadow-2xl transition group-hover/info:opacity-100 group-focus-within/info:opacity-100">
                {info}
              </span>
            </span>
          ) : null}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function Stat({
  delta,
  gradient,
  label,
  sparkline,
  tone = "neutral",
  value
}: {
  delta?: ReactNode;
  gradient?: boolean;
  label: string;
  sparkline?: ReactNode;
  tone?: "neutral" | "positive" | "negative" | "blue" | "warning";
  value: ReactNode;
}) {
  const toneClass = {
    blue: "text-[#60A5FA]",
    negative: "text-[--neg]",
    neutral: "text-[--text-hi]",
    positive: "text-[--pos]",
    warning: "text-[--warn]"
  }[tone];
  return (
    <div className="min-w-0">
      <p className="truncate text-[11px] font-bold uppercase tracking-[0.08em] text-[--text-mid]">{label}</p>
      <p className={cx("terminal-number mt-1 truncate text-[22px] font-semibold leading-none", gradient ? "bg-gradient-to-r from-[#3B82F6] to-[#22D3EE] bg-clip-text text-transparent" : toneClass)}>
        {value}
      </p>
      {(delta || sparkline) ? (
        <div className="mt-2 flex min-w-0 items-center gap-2 text-[12px] font-semibold text-[--text-mid]">
          {delta ? <span className="min-w-0 flex-shrink-0">{delta}</span> : null}
          {sparkline ? <span className="ml-auto max-w-16 flex-shrink-0">{sparkline}</span> : null}
        </div>
      ) : null}
    </div>
  );
}

export function StatGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4", className)}>{children}</div>;
}

export function Pill({
  children,
  tone = "info"
}: {
  children: ReactNode;
  tone?: "critical" | "info" | "neutral" | "positive" | "warning";
}) {
  const toneClass = {
    critical: "bg-[#FB7185]/15 text-[#FDA4AF]",
    info: "bg-[#3B82F6]/15 text-[#93C5FD]",
    neutral: "bg-white/[0.06] text-[#CBD5E1]",
    positive: "bg-[#34D399]/15 text-[#86EFAC]",
    warning: "bg-[#FBBF24]/15 text-[#FDE68A]"
  }[tone];
  return <span className={cx("inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase", toneClass)}>{children}</span>;
}

export function EmptyPreview({
  cta,
  lines = ["Daily loss used", "Drawdown room", "Target progress"],
  title
}: {
  cta?: ReactNode;
  lines?: string[];
  title: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3">
      <p className="text-xs font-semibold text-[--text-mid]">{title}</p>
      <div className="mt-3 space-y-3 opacity-70">
        {lines.map((line, index) => (
          <div key={line}>
            <div className="flex items-center justify-between text-[11px] font-semibold text-[--text-low]">
              <span>{line}</span>
              <span>Preview</span>
            </div>
            <div className="mt-1.5 h-1.5 rounded-full bg-white/[0.06]">
              <div className="h-full rounded-full bg-[#64748B]/70" style={{ width: `${36 + index * 16}%` }} />
            </div>
          </div>
        ))}
      </div>
      {cta ? <div className="mt-3">{cta}</div> : null}
    </div>
  );
}

export function SectionDivider({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-px flex-1 bg-white/[0.06]" />
      {label ? <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[--text-low]">{label}</span> : null}
      <div className="h-px flex-1 bg-white/[0.06]" />
    </div>
  );
}

export function MiniBar({ className, value, tone = "blue" }: { className?: string; value: number; tone?: "blue" | "negative" | "positive" | "warning" }) {
  const color = {
    blue: "bg-[#3B82F6]",
    negative: "bg-[--neg]",
    positive: "bg-[--pos]",
    warning: "bg-[--warn]"
  }[tone];
  return (
    <div className={cx("h-1.5 rounded-full bg-white/[0.06]", className)}>
      <div className={cx("h-full rounded-full", color)} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

type SparklineProps = Omit<SVGProps<SVGSVGElement>, "values"> & {
  color?: string;
  values: number[];
};

export function Sparkline({ color = "#22D3EE", values, ...props }: SparklineProps) {
  const path = useMemo(() => {
    const width = 60;
    const height = 20;
    const clean = values.length > 1 ? values.slice(-14) : [0, ...(values.length ? values : [0])];
    const min = Math.min(...clean);
    const max = Math.max(...clean);
    const span = max - min || 1;
    return clean
      .map((value, index) => {
        const x = (index / Math.max(1, clean.length - 1)) * width;
        const y = height - ((value - min) / span) * (height - 4) - 2;
        return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ");
  }, [values]);

  return (
    <svg aria-hidden height="20" viewBox="0 0 60 20" width="60" {...props}>
      <path d={path} fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}

export function DataTable({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("overflow-x-auto rounded-xl border border-white/[0.06] text-sm", className)}>{children}</div>;
}

export type IconComponent = LucideIcon;
