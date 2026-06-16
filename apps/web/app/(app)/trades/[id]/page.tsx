"use client";

/* eslint-disable @next/next/no-img-element */

import { ArrowLeft, Camera, Info, UploadCloud, X } from "lucide-react";
import { ChangeEvent, DragEvent, Suspense, useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import {
  addTradeScreenshot,
  createScreenshotUpload,
  fetchPlaybooks,
  fetchTrade,
  saveTradeNote,
  type LeakFlagResponse,
  type Playbook,
  type TradeDetailResponse,
  type TradeScreenshotResponse
} from "../../_lib/dashboard-data";
import { SAMPLE_PLAYBOOKS, sampleTradeDetail } from "../../_lib/dashboard-sample";
import { formatCurrency } from "../../_lib/format";
import { PlaybookSelect } from "../../playbooks/_components/playbook-select";

const emotionTags = ["Confident", "Fearful", "Impulsive", "Disciplined", "FOMO", "Bored", "Revenge"];

export default function TradeDetailPage() {
  return (
    <Suspense fallback={<div className="h-full bg-[#0A0E1A]" />}>
      <TradeDetailContent />
    </Suspense>
  );
}

function TradeDetailContent() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const from = searchParams.get("from") || "/trades";
  const isSample = id.startsWith("sample-");
  const [trade, setTrade] = useState<TradeDetailResponse | null>(() => (isSample ? sampleTradeDetail(id) : null));
  const [error, setError] = useState<string | null>(null);
  const [noteBody, setNoteBody] = useState("");
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [playbookChecklist, setPlaybookChecklist] = useState<Array<{ checked: boolean; ruleIndex: number }>>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [saving, setSaving] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [lightbox, setLightbox] = useState<TradeScreenshotResponse | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isSample) return;
    const controller = new AbortController();
    fetchTrade(id, controller.signal)
      .then((payload) => {
        setTrade(payload);
        setError(null);
      })
      .catch(() => setError("Trade could not be loaded."));
    return () => controller.abort();
  }, [id, isSample]);

  useEffect(() => {
    if (isSample) {
      setPlaybooks(SAMPLE_PLAYBOOKS);
      return;
    }
    const controller = new AbortController();
    fetchPlaybooks(controller.signal)
      .then(setPlaybooks)
      .catch(() => setPlaybooks([]));
    return () => controller.abort();
  }, [isSample]);

  useEffect(() => {
    const note = trade?.notes?.[0];
    setNoteBody(note?.body ?? "");
    setTags(note?.emotionTags ?? (note?.emotion ? [note.emotion] : []));
    setPlaybookChecklist(note?.playbookChecklist ?? []);
  }, [trade?.id, trade?.notes]);

  const currency = trade?.tradingAccount?.currency ?? "USD";
  const pnlPositive = (trade?.netProfit ?? 0) >= 0;
  const duration = trade?.durationSec ?? (trade ? Math.round((new Date(trade.closeTime).getTime() - new Date(trade.openTime).getTime()) / 1000) : 0);

  function queueSave(nextBody = noteBody, nextTags = tags, nextChecklist = playbookChecklist) {
    if (isSample) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void persistNote(nextBody, nextTags, nextChecklist), 900);
  }

  async function persistNote(nextBody = noteBody, nextTags = tags, nextChecklist = playbookChecklist) {
    if (!trade || isSample) return;
    setSaving("saving");
    try {
      const note = await saveTradeNote(trade.id, { body: nextBody, emotionTags: nextTags, playbookChecklist: nextChecklist });
      setTrade((current) => (current ? { ...current, notes: [note, ...current.notes.filter((item) => item.id !== note.id)] } : current));
      setSaving("saved");
      window.setTimeout(() => setSaving("idle"), 1400);
    } catch {
      setSaving("error");
    }
  }

  async function uploadFiles(files: FileList | File[]) {
    if (!trade || isSample) return;
    const next: TradeScreenshotResponse[] = [];
    for (const file of Array.from(files)) {
      const signed = await createScreenshotUpload(trade.id, { filename: file.name, mimeType: file.type || "application/octet-stream" });
      const url = await readFileAsDataUrl(file);
      const saved = await addTradeScreenshot(trade.id, {
        filename: file.name,
        mimeType: file.type,
        storageKey: signed.storageKey,
        url
      });
      next.push(saved);
    }
    if (next.length) setTrade((current) => (current ? { ...current, screenshots: [...next, ...current.screenshots] } : current));
  }

  if (!trade) {
    return (
      <div className="grid h-full place-items-center px-6 text-center">
        <div className="rounded-2xl border border-white/[0.06] bg-[#141A2A]/80 p-8">
          <p className="text-lg font-bold text-white">{error ?? "Loading trade..."}</p>
          <a className="mt-4 inline-flex text-sm font-bold text-[#93C5FD]" href={from}>Back to journal</a>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto px-4 py-5 sm:px-8 sm:py-6">
      <div className="mx-auto max-w-7xl">
        <a className="inline-flex items-center gap-2 text-sm font-bold text-[#93C5FD] hover:text-white" href={from}>
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back
        </a>

        <header className="mt-5 rounded-2xl border border-white/[0.06] bg-[#141A2A]/75 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-bold text-white">{trade.symbol}</h1>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${trade.side === "BUY" ? "bg-[#22C55E]/12 text-[#86EFAC]" : "bg-[#EF4444]/12 text-[#FCA5A5]"}`}>{trade.side}</span>
                {isSample ? <span className="rounded-full bg-[#3B82F6]/12 px-3 py-1 text-xs font-bold text-[#93C5FD]">Sample</span> : null}
              </div>
              <p className="mt-3 text-sm font-semibold text-[#94A3B8]">
                {formatDateTime(trade.openTime)} → {formatDateTime(trade.closeTime)} · {formatDuration(duration)}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <span className="text-xs font-bold uppercase text-[#64748B]">Playbook</span>
                <PlaybookSelect
                  disabled={isSample}
                  onChange={(playbook) => {
                    const fullPlaybook = playbook ? playbooks.find((item) => item.id === playbook.id) ?? playbook : null;
                    setTrade((current) => (current ? { ...current, playbook: fullPlaybook, playbookId: playbook?.id ?? null } : current));
                  }}
                  playbooks={playbooks}
                  tradeId={trade.id}
                  value={trade.playbook ?? null}
                />
              </div>
            </div>
            <div className="text-left sm:text-right">
              <p className={`${pnlPositive ? "text-[#22C55E]" : "text-[#EF4444]"} text-3xl font-bold tabular-nums`}>{formatCurrency(trade.netProfit, currency)}</p>
              <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-[#94A3B8] sm:justify-end">
                R multiple
                {trade.rMultiple == null ? (
                  <span className="group relative cursor-help text-white">
                    —
                    <span className="pointer-events-none absolute right-0 top-[calc(100%+8px)] z-20 w-56 rounded-xl border border-white/[0.08] bg-[#111827] p-3 text-left text-xs leading-5 text-[#CBD5E1] opacity-0 shadow-2xl group-hover:opacity-100">
                      R multiple needs an initial stop loss or risk amount.
                    </span>
                  </span>
                ) : (
                  <span className="text-white tabular-nums">{trade.rMultiple.toFixed(2)}R</span>
                )}
              </div>
            </div>
          </div>
        </header>

        <div className="mt-5 grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <PriceContext trade={trade} />
          <JournalCard trade={trade} />
          <LeakFlagsCard flags={trade.leakFlags} />
          <NotesCard
            disabled={isSample}
            noteBody={noteBody}
            onBlur={() => void persistNote()}
            onDrop={(event) => {
              event.preventDefault();
              void uploadFiles(event.dataTransfer.files);
            }}
            onFile={(event) => {
              if (event.target.files) void uploadFiles(event.target.files);
            }}
            onNoteChange={(value) => {
              setNoteBody(value);
              queueSave(value, tags);
            }}
            onTag={(tag) => {
              const next = tags.includes(tag) ? tags.filter((item) => item !== tag) : [...tags, tag];
              setTags(next);
              queueSave(noteBody, next, playbookChecklist);
            }}
            onToggleRule={(ruleIndex) => {
              const next = toggleRule(playbookChecklist, ruleIndex);
              setPlaybookChecklist(next);
              queueSave(noteBody, tags, next);
            }}
            playbook={trade.playbook ? playbooks.find((item) => item.id === trade.playbook?.id) ?? (trade.playbook as Playbook) : null}
            playbookChecklist={playbookChecklist}
            saving={saving}
            screenshots={trade.screenshots}
            tags={tags}
            setLightbox={setLightbox}
          />
        </div>
      </div>

      {lightbox ? (
        <button className="fixed inset-0 z-50 grid touch-pan-pinch place-items-center bg-black/80 p-3 sm:p-6" onClick={() => setLightbox(null)} type="button">
          <X className="absolute right-6 top-6 h-6 w-6 text-white" aria-hidden />
          <img alt={lightbox.filename ?? "Trade screenshot"} className="max-h-[88dvh] max-w-[92vw] rounded-2xl border border-white/[0.1]" src={lightbox.url} />
        </button>
      ) : null}
    </div>
  );
}

function PriceContext({ trade }: { trade: TradeDetailResponse }) {
  const values = [trade.openPrice, trade.closePrice, trade.stopLoss, trade.takeProfit].filter((value): value is number => typeof value === "number");
  const min = Math.min(...values);
  const max = Math.max(...values);
  const y = (value: number) => 180 - ((value - min) / (max - min || 1)) * 130;
  const openY = y(trade.openPrice);
  const closeY = y(trade.closePrice);

  return (
    <section className="rounded-2xl border border-white/[0.06] bg-[#141A2A]/70 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white">Price Context</h2>
          <p className="mt-2 text-sm font-semibold text-[#94A3B8]">Entry/exit overview — full tick replay not yet available</p>
        </div>
        <Info className="h-5 w-5 text-[#64748B]" aria-hidden />
      </div>
      <svg className="mt-5 h-56 w-full overflow-visible" viewBox="0 0 640 220" role="img" aria-label="Entry and exit overview">
        {[0, 1, 2, 3].map((line) => (
          <line key={line} stroke="rgba(148,163,184,0.12)" strokeDasharray="5 8" x1="20" x2="620" y1={40 + line * 45} y2={40 + line * 45} />
        ))}
        {trade.stopLoss ? <ReferenceLine label="SL" value={trade.stopLoss} y={y(trade.stopLoss)} color="#EF4444" /> : null}
        {trade.takeProfit ? <ReferenceLine label="TP" value={trade.takeProfit} y={y(trade.takeProfit)} color="#22C55E" /> : null}
        <path d={`M 80 ${openY} C 220 ${openY}, 420 ${closeY}, 560 ${closeY}`} fill="none" stroke="#3B82F6" strokeWidth="4" />
        <circle cx="80" cy={openY} fill="#0A0E1A" r="8" stroke="#93C5FD" strokeWidth="4" />
        <circle cx="560" cy={closeY} fill="#3B82F6" r="8" />
        <text fill="#CBD5E1" fontSize="13" fontWeight="700" x="58" y={openY - 16}>Entry {trade.openPrice}</text>
        <text fill="#CBD5E1" fontSize="13" fontWeight="700" textAnchor="end" x="582" y={closeY - 16}>Exit {trade.closePrice}</text>
      </svg>
    </section>
  );
}

function ReferenceLine({ color, label, value, y }: { color: string; label: string; value: number; y: number }) {
  return (
    <>
      <line stroke={color} strokeDasharray="8 8" strokeOpacity="0.65" x1="20" x2="620" y1={y} y2={y} />
      <text fill={color} fontSize="12" fontWeight="800" x="24" y={y - 8}>{label} {value}</text>
    </>
  );
}

function JournalCard({ trade }: { trade: TradeDetailResponse }) {
  const summary = trade.journalEntry?.summary;
  const observed = trade.journalEntry?.observed ?? summary?.match(/Observed:(.*?)(Inferred:|$)/i)?.[1]?.trim();
  const inferred = trade.journalEntry?.inferred ?? summary?.match(/Inferred:(.*)$/i)?.[1]?.trim();

  return (
    <section className="rounded-2xl border border-white/[0.06] bg-[#141A2A]/70 p-6">
      <h2 className="text-lg font-bold text-white">AI Journal Entry</h2>
      {!summary ? (
        <p className="mt-4 rounded-xl bg-white/[0.03] p-4 text-sm font-semibold text-[#94A3B8]">Journal entry will appear after your next sync.</p>
      ) : (
        <div className="mt-4 space-y-3">
          <Fact label="Observed" text={observed || `Closed ${trade.symbol} for ${trade.rMultiple == null ? "an unscored R outcome" : `${trade.rMultiple.toFixed(2)}R`}.`} />
          <Fact label="Inferred" text={inferred || "No inferred coaching text was included with this entry."} muted />
          <p className="rounded-xl border border-white/[0.06] bg-black/20 p-4 text-sm leading-6 text-[#CBD5E1]">{summary}</p>
        </div>
      )}
    </section>
  );
}

function Fact({ label, muted, text }: { label: string; muted?: boolean; text: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
      <span className={`text-[11px] font-bold uppercase ${muted ? "text-[#A78BFA]" : "text-[#93C5FD]"}`}>{label}</span>
      <p className="mt-1 text-sm leading-6 text-[#CBD5E1]">{text}</p>
    </div>
  );
}

function LeakFlagsCard({ flags }: { flags: LeakFlagResponse[] }) {
  return (
    <section className="rounded-2xl border border-white/[0.06] bg-[#141A2A]/70 p-6">
      <h2 className="text-lg font-bold text-white">Leak Flags</h2>
      {flags.length === 0 ? <p className="mt-4 rounded-xl bg-white/[0.03] p-4 text-sm font-semibold text-[#94A3B8]">No behavioral flags on this trade.</p> : null}
      <div className="mt-4 space-y-3">
        {flags.map((flag) => (
          <div className="rounded-xl border border-white/[0.06] bg-black/20 p-4" key={flag.id}>
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-bold text-white">{humanLeakType(flag.type)}</p>
              <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${flag.severity === "critical" ? "bg-[#EF4444]/15 text-[#FCA5A5]" : flag.severity === "warning" ? "bg-[#F59E0B]/15 text-[#FCD34D]" : "bg-[#3B82F6]/15 text-[#93C5FD]"}`}>{flag.severity}</span>
            </div>
            <p className="mt-2 text-sm text-[#CBD5E1]">{describeLeak(flag)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function NotesCard({
  disabled,
  noteBody,
  onBlur,
  onDrop,
  onFile,
  onNoteChange,
  onTag,
  onToggleRule,
  playbook,
  playbookChecklist,
  saving,
  screenshots,
  setLightbox,
  tags
}: {
  disabled: boolean;
  noteBody: string;
  onBlur: () => void;
  onDrop: (event: DragEvent<HTMLLabelElement>) => void;
  onFile: (event: ChangeEvent<HTMLInputElement>) => void;
  onNoteChange: (value: string) => void;
  onTag: (tag: string) => void;
  onToggleRule: (ruleIndex: number) => void;
  playbook: Playbook | null;
  playbookChecklist: Array<{ checked: boolean; ruleIndex: number }>;
  saving: "idle" | "saving" | "saved" | "error";
  screenshots: TradeScreenshotResponse[];
  setLightbox: (value: TradeScreenshotResponse) => void;
  tags: string[];
}) {
  return (
    <section className="rounded-2xl border border-white/[0.06] bg-[#141A2A]/70 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white">Your Notes</h2>
          <p className="mt-2 text-sm font-semibold text-[#94A3B8]">{disabled ? "Connect an account to start journaling your own trades." : "Autosaves after a short pause or when the field loses focus."}</p>
        </div>
        <span className="text-xs font-bold text-[#64748B]">{saving === "saving" ? "Saving..." : saving === "saved" ? "Saved" : saving === "error" ? "Save failed" : ""}</span>
      </div>
      <textarea className="mt-4 min-h-36 w-full resize-none rounded-xl border border-white/[0.08] bg-[#0A0E1A] p-4 text-sm leading-6 text-white outline-none focus:ring-2 focus:ring-[#3B82F6] disabled:cursor-not-allowed disabled:opacity-60" disabled={disabled} onBlur={onBlur} onChange={(event) => onNoteChange(event.target.value)} value={noteBody} />
      {playbook ? (
        <div className="mt-4 rounded-xl border border-white/[0.06] bg-black/20 p-4">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: playbook.color }} />
            <h3 className="text-sm font-bold text-white">{playbook.name} checklist</h3>
          </div>
          <div className="mt-3 space-y-2">
            {playbook.rules.map((rule, index) => {
              const checked = playbookChecklist.some((item) => item.ruleIndex === index && item.checked);
              return (
                <label className="flex items-start gap-3 rounded-lg bg-white/[0.03] p-3 text-sm text-[#CBD5E1]" key={`${rule.order}-${rule.text}`}>
                  <input className="mt-1 h-4 w-4 rounded border-white/[0.12] accent-[#3B82F6]" checked={checked} disabled={disabled} onChange={() => onToggleRule(index)} type="checkbox" />
                  <span>{rule.text}</span>
                </label>
              );
            })}
            {playbook.rules.length === 0 ? <p className="text-sm font-semibold text-[#94A3B8]">This playbook has no rules yet.</p> : null}
          </div>
        </div>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        {emotionTags.map((tag) => {
          const selected = tags.includes(tag);
          return (
            <button className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${selected ? "border-[#3B82F6]/40 bg-[#3B82F6] text-white" : "border-white/[0.08] bg-white/[0.03] text-[#CBD5E1] hover:bg-white/[0.06]"}`} disabled={disabled} key={tag} onClick={() => onTag(tag)} title={disabled ? "Connect an account to start journaling your own trades." : undefined} type="button">
              {tag}
            </button>
          );
        })}
      </div>
      <label className={`mt-5 grid min-h-32 place-items-center rounded-2xl border border-dashed border-white/[0.12] bg-black/20 p-5 text-center ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-white/[0.03]"}`} onDragOver={(event) => event.preventDefault()} onDrop={onDrop} title={disabled ? "Connect an account to start journaling your own trades." : undefined}>
        <input className="hidden" disabled={disabled} multiple onChange={onFile} type="file" accept="image/*" />
        <span>
          <UploadCloud className="mx-auto h-7 w-7 text-[#3B82F6]" aria-hidden />
          <span className="mt-2 block text-sm font-bold text-white">Drop screenshots or click to upload</span>
        </span>
      </label>
      <div className="mt-4 grid grid-cols-3 gap-3">
        {screenshots.map((screenshot) => (
          <button className="group relative overflow-hidden rounded-xl border border-white/[0.08] bg-black/30" key={screenshot.id} onClick={() => setLightbox(screenshot)} type="button">
            <img alt={screenshot.filename ?? "Trade screenshot"} className="h-28 w-full object-cover transition group-hover:scale-105" src={screenshot.url} />
          </button>
        ))}
        {screenshots.length === 0 ? (
          <div className="col-span-3 flex items-center gap-2 rounded-xl bg-white/[0.03] p-3 text-sm font-semibold text-[#94A3B8]">
            <Camera className="h-4 w-4" aria-hidden />
            No screenshots attached.
          </div>
        ) : null}
      </div>
    </section>
  );
}

function toggleRule(checklist: Array<{ checked: boolean; ruleIndex: number }>, ruleIndex: number) {
  const byRule = new Map(checklist.map((item) => [item.ruleIndex, item.checked]));
  byRule.set(ruleIndex, !byRule.get(ruleIndex));
  return Array.from(byRule.entries()).map(([index, checked]) => ({ checked, ruleIndex: index }));
}

function describeLeak(flag: LeakFlagResponse) {
  const n = (key: string) => Number(flag.evidence[key] ?? 0);
  switch (flag.type) {
    case "revenge_trade":
      return `Revenge trade: re-entered ${n("minutesAfter")} min after a loss at ${n("sizeMultiplier")}x size`;
    case "overtrading":
      return `Overtrading: ${n("dayCount")} trades vs ${n("threshold")} threshold`;
    case "missing_stop_loss":
      return `Missing stop loss: ${flag.evidence.symbol ?? "trade"} closed with ${flag.evidence.netProfit ?? "unknown"} net P&L`;
    case "stop_widened":
      return `Stop widened: risk increased ${Math.round(n("riskIncreasePct") * 100)}%`;
    case "risk_inconsistency":
      return `Risk inconsistency: risk variation CV ${n("cv")}`;
    case "asymmetric_win_loss":
      return `Asymmetric win/loss: avg winner is ${n("ratio")}x avg loser in R`;
    case "correlated_cluster":
      return `Correlated cluster: ${flag.evidence.group ?? "group"} overlap from ${flag.evidence.overlapStart ?? "unknown"}`;
    case "excessive_single_trade_risk":
      return `Single-trade risk: ${Math.round(n("riskPct") * 1000) / 10}% of equity at open`;
    default:
      return "Behavioral flag detected";
  }
}

function humanLeakType(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", { day: "numeric", hour: "numeric", minute: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

function formatDuration(seconds: number) {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}
