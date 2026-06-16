"use client";

import { ArrowRight, BookMarked, FileText, Loader2, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { searchTradeScribe, type SearchResponse } from "../_lib/dashboard-data";
import { formatCurrency } from "../_lib/format";

type FlatResult = {
  group: "Trades" | "Notes" | "Playbooks";
  href: string;
  id: string;
  meta: string;
  title: string;
};

const emptyResults: SearchResponse = { notes: [], playbooks: [], trades: [] };

export function GlobalSearch({ activeAccountId, compact = false }: { activeAccountId?: string | null; compact?: boolean }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(!compact);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResponse>(emptyResults);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const flatResults = useMemo(() => flattenResults(results), [results]);
  const hasQuery = query.trim().length >= 2;
  const open = expanded && (hasQuery || flatResults.length > 0 || loading);

  useEffect(() => {
    function onKeyDown(event: globalThis.KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      const isEditable = target?.isContentEditable || tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
      if (event.key === "/" && !isEditable) {
        event.preventDefault();
        setExpanded(true);
        window.requestAnimationFrame(() => inputRef.current?.focus());
      }
      if (event.key === "Escape") {
        setExpanded(!compact);
        setQuery("");
        setResults(emptyResults);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [compact]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setExpanded(!compact);
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [compact]);

  useEffect(() => {
    const q = query.trim();
    setActiveIndex(0);
    if (q.length < 2) {
      setResults(emptyResults);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      searchTradeScribe({ accountId: activeAccountId, q }, controller.signal)
        .then(setResults)
        .catch(() => setResults(emptyResults))
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [activeAccountId, query]);

  function selectResult(result: FlatResult) {
    setExpanded(!compact);
    setQuery("");
    setResults(emptyResults);
    router.push(result.href);
  }

  function onInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      setExpanded(!compact);
      setQuery("");
      setResults(emptyResults);
      return;
    }

    if (event.key === "ArrowDown" && flatResults.length > 0) {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % flatResults.length);
    }

    if (event.key === "ArrowUp" && flatResults.length > 0) {
      event.preventDefault();
      setActiveIndex((index) => (index - 1 + flatResults.length) % flatResults.length);
    }

    if (event.key === "Enter" && flatResults[activeIndex]) {
      event.preventDefault();
      selectResult(flatResults[activeIndex]);
    }
  }

  if (compact && !expanded) {
    return (
      <button
        aria-label="Open global search"
        className="grid h-11 w-11 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-[#CBD5E1] transition hover:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
        onClick={() => {
          setExpanded(true);
          window.requestAnimationFrame(() => inputRef.current?.focus());
        }}
        type="button"
      >
        <Search className="h-5 w-5" aria-hidden />
      </button>
    );
  }

  return (
    <div className={`${compact ? "fixed inset-x-3 top-3 z-50" : "relative w-full max-w-[360px]"}`} ref={rootRef}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" aria-hidden />
        <input
          aria-activedescendant={flatResults[activeIndex] ? `global-search-${flatResults[activeIndex].group}-${flatResults[activeIndex].id}` : undefined}
          aria-controls="global-search-results"
          aria-expanded={open}
          aria-label="Search trades, notes, and playbooks"
          className="h-11 w-full rounded-xl border border-white/[0.08] bg-[#0A0E1A]/95 pl-10 pr-10 text-sm font-semibold text-white outline-none shadow-[0_16px_50px_rgba(0,0,0,0.35)] placeholder:text-[#64748B] focus:ring-2 focus:ring-[#3B82F6]"
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setExpanded(true)}
          onKeyDown={onInputKeyDown}
          placeholder="Search trades, notes, playbooks..."
          ref={inputRef}
          role="combobox"
          value={query}
        />
        <button
          aria-label="Close search"
          className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg text-[#64748B] hover:bg-white/[0.06] hover:text-white"
          onClick={() => {
            setExpanded(!compact);
            setQuery("");
            setResults(emptyResults);
          }}
          type="button"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>

      {open ? (
        <div
          className="absolute left-0 right-0 z-50 mt-2 max-h-[70dvh] overflow-y-auto rounded-2xl border border-white/[0.08] bg-[#111827]/98 p-2 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-xl motion-safe:animate-[menuRise_160ms_ease-out]"
          id="global-search-results"
          role="listbox"
        >
          {loading ? (
            <div className="flex items-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold text-[#94A3B8]">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Searching...
            </div>
          ) : null}
          {!loading && hasQuery && flatResults.length === 0 ? (
            <p className="rounded-xl px-3 py-3 text-sm font-semibold text-[#94A3B8]">No matching trades, notes, or playbooks.</p>
          ) : null}
          <ResultGroup activeIndex={activeIndex} flatResults={flatResults} group="Trades" onSelect={selectResult} />
          <ResultGroup activeIndex={activeIndex} flatResults={flatResults} group="Notes" onSelect={selectResult} />
          <ResultGroup activeIndex={activeIndex} flatResults={flatResults} group="Playbooks" onSelect={selectResult} />
          <p className="border-t border-white/[0.06] px-3 py-2 text-[11px] font-semibold text-[#64748B]">Press / to search, ↑↓ to move, Enter to open.</p>
        </div>
      ) : null}
    </div>
  );
}

function ResultGroup({
  activeIndex,
  flatResults,
  group,
  onSelect
}: {
  activeIndex: number;
  flatResults: FlatResult[];
  group: FlatResult["group"];
  onSelect: (result: FlatResult) => void;
}) {
  const groupResults = flatResults.filter((result) => result.group === group);
  if (groupResults.length === 0) return null;

  const Icon = group === "Playbooks" ? BookMarked : group === "Notes" ? FileText : Search;
  return (
    <div className="py-1">
      <div className="flex items-center gap-2 px-3 py-2 text-[11px] font-bold uppercase text-[#64748B]">
        <Icon className="h-3.5 w-3.5" aria-hidden />
        {group}
      </div>
      {groupResults.map((result) => {
        const index = flatResults.findIndex((item) => item.group === result.group && item.id === result.id);
        const active = index === activeIndex;
        return (
          <button
            className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition ${active ? "bg-[#3B82F6]/16 ring-1 ring-[#3B82F6]/25" : "hover:bg-white/[0.05]"}`}
            id={`global-search-${result.group}-${result.id}`}
            key={`${result.group}-${result.id}`}
            onClick={() => onSelect(result)}
            role="option"
            type="button"
            aria-selected={active}
          >
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold text-white">{result.title}</span>
              <span className="mt-0.5 block truncate text-xs font-semibold text-[#94A3B8]">{result.meta}</span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-[#64748B]" aria-hidden />
          </button>
        );
      })}
    </div>
  );
}

function flattenResults(results: SearchResponse): FlatResult[] {
  return [
    ...results.trades.map((trade) => ({
      group: "Trades" as const,
      href: trade.href,
      id: trade.id,
      meta: `${trade.side} · ${formatCurrency(trade.netProfit)} · ${new Date(trade.closeTime).toLocaleDateString()}`,
      title: trade.symbol
    })),
    ...results.notes.map((note) => ({
      group: "Notes" as const,
      href: note.href,
      id: note.id,
      meta: [note.trade.symbol, note.emotionTags.slice(0, 2).join(", ")].filter(Boolean).join(" · "),
      title: note.body.length > 90 ? `${note.body.slice(0, 90)}...` : note.body || "Trade note"
    })),
    ...results.playbooks.map((playbook) => ({
      group: "Playbooks" as const,
      href: playbook.href,
      id: playbook.id,
      meta: playbook.description ?? "Strategy playbook",
      title: playbook.name
    }))
  ];
}
