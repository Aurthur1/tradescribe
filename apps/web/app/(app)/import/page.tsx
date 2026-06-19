"use client";

import { AlertTriangle, ArrowRight, CheckCircle2, DatabaseZap, FileSpreadsheet, LockKeyhole, PlugZap, Search, UploadCloud } from "lucide-react";
import { type ChangeEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import {
  commitCsvImport,
  createConnection,
  fetchBrokerAdapters,
  previewCsvImport,
  type BrokerAdaptersResponse,
  type CreatedConnectionResponse,
  type CsvImportPreviewResponse
} from "../_lib/dashboard-data";
import { formatCurrency } from "../_lib/format";

type Mode = "metaapi" | "csv" | "coming-soon";

const canonicalFields = [
  "externalId",
  "symbol",
  "side",
  "openTime",
  "closeTime",
  "openPrice",
  "closePrice",
  "volume",
  "grossProfit",
  "commission",
  "swap",
  "stopLoss",
  "takeProfit"
];

const templateRows = [
  "ticket,symbol,type,open time,close time,open price,close price,volume,profit,commission,swap,sl,tp",
  "100421,XAUUSD,BUY,2025-04-09T09:15:00Z,2025-04-09T10:05:00Z,2321.40,2328.10,0.50,335.00,-3.50,0,2315.00,2332.00"
].join("\n");

export default function ImportPage() {
  const [adapters, setAdapters] = useState<BrokerAdaptersResponse["adapters"]>([]);
  const [mode, setMode] = useState<Mode>("metaapi");
  const [status, setStatus] = useState("");
  const [connectResult, setConnectResult] = useState<CreatedConnectionResponse | null>(null);
  const [metaForm, setMetaForm] = useState({
    broker: "MetaTrader Broker",
    currency: "USD",
    investorPassword: "",
    label: "",
    login: "",
    platform: "MT5" as "MT4" | "MT5",
    server: "",
    startingBalance: "0"
  });
  const [csvContent, setCsvContent] = useState("");
  const [csvFileName, setCsvFileName] = useState("");
  const [csvBroker, setCsvBroker] = useState("CSV Broker");
  const [csvLabel, setCsvLabel] = useState("CSV Import");
  const [csvCurrency, setCsvCurrency] = useState("USD");
  const [csvStartingBalance, setCsvStartingBalance] = useState("0");
  const [csvPreview, setCsvPreview] = useState<CsvImportPreviewResponse | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [csvCommit, setCsvCommit] = useState<{ created: number; updated: number } | null>(null);

  useEffect(() => {
    fetchBrokerAdapters()
      .then((payload) => setAdapters(payload.adapters))
      .catch(() => setAdapters([]));
  }, []);

  const activeAdapter = useMemo(() => adapters.find((adapter) => adapter.id === (mode === "csv" ? "csv" : "metaapi")), [adapters, mode]);

  async function submitMetaApi() {
    setStatus("Provisioning read-only MetaTrader account...");
    setConnectResult(null);
    try {
      const result = await createConnection({
        broker: metaForm.broker,
        currency: metaForm.currency,
        investorPassword: metaForm.investorPassword,
        label: metaForm.label || null,
        login: metaForm.login,
        platform: metaForm.platform,
        server: metaForm.server,
        startingBalance: Number(metaForm.startingBalance || 0)
      });
      setConnectResult(result);
      setStatus(result.lastError ? result.lastError : "Connected. Backfill sync is queued.");
    } catch {
      setStatus("Could not create the connection. Check broker server, login, and investor password.");
    }
  }

  async function readCsvFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setCsvFileName(file.name);
    const text = await file.text();
    setCsvContent(text);
    await previewCsv(text, undefined);
  }

  async function previewCsv(content = csvContent, nextMapping: Record<string, string> | undefined = mapping) {
    if (!content.trim()) return;
    setStatus("Reading CSV and validating rows...");
    try {
      const preview = await previewCsvImport({ content, currency: csvCurrency, mapping: Object.keys(nextMapping ?? {}).length ? nextMapping : undefined });
      setCsvPreview(preview);
      setMapping(preview.mapping);
      setStatus(`${preview.rowsOk} rows valid, ${preview.rowsSkipped} skipped, ${preview.errors.length} errors shown.`);
    } catch {
      setStatus("Could not parse this file. Export it as CSV and try again.");
    }
  }

  async function commitCsv() {
    if (!csvPreview) return;
    setStatus("Committing CSV trades...");
    try {
      const result = await commitCsvImport({
        broker: csvBroker,
        content: csvContent,
        currency: csvCurrency,
        label: csvLabel,
        mapping,
        startingBalance: Number(csvStartingBalance || 0)
      });
      setCsvCommit({ created: result.created, updated: result.updated });
      setStatus(`Import complete: ${result.created} created, ${result.updated} updated.`);
    } catch {
      setStatus("Could not commit import. Check plan limits and required column mappings.");
    }
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto px-5 py-6 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-[#64748B]">Connectivity Hub</p>
            <h1 className="mt-2 text-3xl font-bold text-white">Read-only broker connectivity</h1>
            <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-[#94A3B8]">
              Connect MT4/MT5 through MetaApi, import any broker export through CSV, and see future adapter coverage without pretending unsupported platforms are live.
            </p>
          </div>
          <a
            className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] px-4 py-2.5 text-sm font-bold text-[#CBD5E1] hover:bg-white/[0.04]"
            href="mailto:support@tradescribe.ai?subject=Broker%20adapter%20request"
          >
            Request a broker
          </a>
        </header>

        <section className="mt-6 grid gap-3 md:grid-cols-5">
          <PlatformCard active={mode === "metaapi"} label="MT4 / MT5" meta="MetaApi, read-only investor access" onClick={() => setMode("metaapi")} status="Ship now" />
          <PlatformCard active={mode === "csv"} label="CSV import" meta="Universal fallback for any broker" onClick={() => setMode("csv")} status="Ship now" />
          <PlatformCard active={false} label="cTrader" meta="Spotware Open API OAuth" onClick={() => setMode("coming-soon")} status="Beta soon" />
          <PlatformCard active={false} label="DXtrade" meta="Prop-firm roadmap adapter" onClick={() => setMode("coming-soon")} status="Soon" />
          <PlatformCard active={false} label="Match-Trader" meta="Prop-firm roadmap adapter" onClick={() => setMode("coming-soon")} status="Soon" />
        </section>

        {status ? <p className="mt-5 rounded-xl border border-white/[0.06] bg-[#101827]/80 px-4 py-3 text-sm font-bold text-[#CBD5E1]">{status}</p> : null}

        <div className="mt-6 grid gap-5 xl:grid-cols-[1fr_0.72fr]">
          {mode === "metaapi" ? (
            <section className="rounded-2xl border border-white/[0.06] bg-[#141A2A]/75 p-5">
              <div className="flex items-start gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#3B82F6]/12 text-[#93C5FD]">
                  <PlugZap className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <h2 className="text-xl font-bold text-white">MetaTrader read-only connection</h2>
                  <p className="mt-1 text-sm leading-6 text-[#94A3B8]">Use the investor password only. TradeScribe never needs, stores, or requests your master trading password.</p>
                </div>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <Field label="Platform">
                  <select className="input" onChange={(event) => setMetaForm((current) => ({ ...current, platform: event.target.value as "MT4" | "MT5" }))} value={metaForm.platform}>
                    <option value="MT5">MT5</option>
                    <option value="MT4">MT4</option>
                  </select>
                </Field>
                <Field label="Broker">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[#64748B]" aria-hidden />
                    <input className="input pl-9" onChange={(event) => setMetaForm((current) => ({ ...current, broker: event.target.value }))} placeholder="Broker name" value={metaForm.broker} />
                  </div>
                </Field>
                <Field label="Server">
                  <input className="input" onChange={(event) => setMetaForm((current) => ({ ...current, server: event.target.value }))} placeholder="Broker-Server-Live" value={metaForm.server} />
                </Field>
                <Field label="Login">
                  <input className="input" onChange={(event) => setMetaForm((current) => ({ ...current, login: event.target.value }))} placeholder="Account number" value={metaForm.login} />
                </Field>
                <Field label="Investor password">
                  <input className="input" onChange={(event) => setMetaForm((current) => ({ ...current, investorPassword: event.target.value }))} placeholder="Read-only investor password" type="password" value={metaForm.investorPassword} />
                </Field>
                <Field label="Label">
                  <input className="input" onChange={(event) => setMetaForm((current) => ({ ...current, label: event.target.value }))} placeholder="FTMO Challenge #1" value={metaForm.label} />
                </Field>
                <Field label="Currency">
                  <input className="input" onChange={(event) => setMetaForm((current) => ({ ...current, currency: event.target.value.toUpperCase() }))} value={metaForm.currency} />
                </Field>
                <Field label="Starting balance fallback">
                  <input className="input" inputMode="decimal" onChange={(event) => setMetaForm((current) => ({ ...current, startingBalance: event.target.value }))} value={metaForm.startingBalance} />
                </Field>
              </div>

              <div className="mt-5 rounded-2xl border border-[#3B82F6]/18 bg-[#3B82F6]/8 p-4">
                <div className="flex gap-3">
                  <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-[#93C5FD]" aria-hidden />
                  <p className="text-sm font-semibold leading-6 text-[#BFDBFE]">
                    Investor passwords are read-only MetaTrader credentials. They can view account history and balances, but cannot open, close, or modify trades.
                  </p>
                </div>
              </div>

              <button className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#3B82F6] px-4 py-2.5 text-sm font-bold text-white shadow-[0_18px_40px_rgba(59,130,246,0.25)]" onClick={() => void submitMetaApi()} type="button">
                Connect read-only account
                <ArrowRight className="h-4 w-4" aria-hidden />
              </button>

              {connectResult ? <StateMachine status={connectResult.status} error={connectResult.lastError} /> : null}
            </section>
          ) : null}

          {mode === "csv" ? (
            <section className="rounded-2xl border border-white/[0.06] bg-[#141A2A]/75 p-5">
              <div className="flex items-start gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#22C55E]/12 text-[#86EFAC]">
                  <FileSpreadsheet className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <h2 className="text-xl font-bold text-white">Universal CSV importer</h2>
                  <p className="mt-1 text-sm leading-6 text-[#94A3B8]">Upload a broker export, map columns once, preview validation, then commit idempotently.</p>
                </div>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <Field label="Broker name">
                  <input className="input" onChange={(event) => setCsvBroker(event.target.value)} value={csvBroker} />
                </Field>
                <Field label="Import account label">
                  <input className="input" onChange={(event) => setCsvLabel(event.target.value)} value={csvLabel} />
                </Field>
                <Field label="Currency">
                  <input className="input" onChange={(event) => setCsvCurrency(event.target.value.toUpperCase())} value={csvCurrency} />
                </Field>
                <Field label="Starting balance">
                  <input className="input" inputMode="decimal" onChange={(event) => setCsvStartingBalance(event.target.value)} value={csvStartingBalance} />
                </Field>
              </div>

              <label className="mt-5 grid cursor-pointer place-items-center rounded-2xl border border-dashed border-[#3B82F6]/35 bg-[#0B1220]/80 p-8 text-center hover:bg-[#101827]">
                <UploadCloud className="h-9 w-9 text-[#93C5FD]" aria-hidden />
                <span className="mt-3 text-sm font-bold text-white">{csvFileName || "Drop or choose a CSV broker export"}</span>
                <span className="mt-1 text-xs font-semibold text-[#64748B]">Excel exports should be saved as CSV before upload.</span>
                <input accept=".csv,.txt" className="sr-only" onChange={(event) => void readCsvFile(event)} type="file" />
              </label>

              {csvPreview ? (
                <div className="mt-5 space-y-4">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <ImportStat label="Rows OK" value={String(csvPreview.rowsOk)} tone="positive" />
                    <ImportStat label="Skipped" value={String(csvPreview.rowsSkipped)} />
                    <ImportStat label="Errors" value={String(csvPreview.errors.length)} tone={csvPreview.errors.length ? "negative" : undefined} />
                  </div>
                  <div className="rounded-2xl border border-white/[0.06] bg-black/20 p-4">
                    <h3 className="text-sm font-bold text-white">Column mapping</h3>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      {canonicalFields.map((field) => (
                        <label className="grid gap-1" key={field}>
                          <span className="text-[11px] font-bold uppercase text-[#64748B]">{field}</span>
                          <select
                            className="input"
                            onChange={(event) => setMapping((current) => ({ ...current, [field]: event.target.value }))}
                            value={mapping[field] ?? ""}
                          >
                            <option value="">Not mapped</option>
                            {csvPreview.headers.map((header) => (
                              <option key={header} value={header}>{header}</option>
                            ))}
                          </select>
                        </label>
                      ))}
                    </div>
                    <button className="mt-4 rounded-xl border border-white/[0.08] px-4 py-2 text-sm font-bold text-[#CBD5E1] hover:bg-white/[0.04]" onClick={() => void previewCsv(csvContent, mapping)} type="button">
                      Re-validate mapping
                    </button>
                  </div>

                  <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-black/20">
                    <div className="grid grid-cols-[1fr_0.7fr_0.7fr_0.7fr] gap-3 border-b border-white/[0.06] px-4 py-3 text-xs font-bold uppercase text-[#64748B]">
                      <span>Symbol</span>
                      <span>Side</span>
                      <span>Volume</span>
                      <span>Gross P&L</span>
                    </div>
                    {csvPreview.preview.map((trade) => (
                      <div className="grid grid-cols-[1fr_0.7fr_0.7fr_0.7fr] gap-3 px-4 py-3 text-sm" key={trade.externalId}>
                        <span className="font-bold text-white">{trade.symbol}</span>
                        <span className="text-[#CBD5E1]">{trade.side}</span>
                        <span className="tabular-nums text-[#94A3B8]">{trade.volume}</span>
                        <span className={`${trade.grossProfit >= 0 ? "text-[#22C55E]" : "text-[#EF4444]"} font-bold tabular-nums`}>{formatCurrency(trade.grossProfit, csvCurrency)}</span>
                      </div>
                    ))}
                  </div>

                  <button className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#22C55E] px-4 py-2.5 text-sm font-bold text-[#04130A]" onClick={() => void commitCsv()} type="button">
                    Commit import
                    <CheckCircle2 className="h-4 w-4" aria-hidden />
                  </button>
                  {csvCommit ? <p className="text-sm font-bold text-[#86EFAC]">{csvCommit.created} created, {csvCommit.updated} updated.</p> : null}
                </div>
              ) : null}
            </section>
          ) : null}

          {mode === "coming-soon" ? <ComingSoonPanel /> : null}

          <aside className="space-y-4">
            <section className="rounded-2xl border border-white/[0.06] bg-[#101827]/80 p-5">
              <h2 className="text-lg font-bold text-white">Adapter capabilities</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {Object.entries(activeAdapter?.capabilities ?? {}).map(([key, value]) => (
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${value ? "bg-[#3B82F6]/12 text-[#93C5FD]" : "bg-white/[0.04] text-[#64748B]"}`} key={key}>
                    {key}
                  </span>
                ))}
              </div>
              <p className="mt-4 text-sm leading-6 text-[#94A3B8]">TradeScribe gates features from adapter capabilities, so stop-widening, equity, and live sync are only shown when a source actually provides them.</p>
            </section>
            <section className="rounded-2xl border border-white/[0.06] bg-[#101827]/80 p-5">
              <h2 className="text-lg font-bold text-white">CSV templates</h2>
              <p className="mt-2 text-sm leading-6 text-[#94A3B8]">Start with this universal template or map your broker&apos;s export headers directly.</p>
              <a
                className="mt-4 inline-flex items-center gap-2 rounded-xl border border-white/[0.08] px-4 py-2 text-sm font-bold text-[#CBD5E1] hover:bg-white/[0.04]"
                download="tradescribe-csv-template.csv"
                href={`data:text/csv;charset=utf-8,${encodeURIComponent(templateRows)}`}
              >
                <DatabaseZap className="h-4 w-4" aria-hidden />
                Download template
              </a>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}

function PlatformCard({ active, label, meta, onClick, status }: { active: boolean; label: string; meta: string; onClick: () => void; status: string }) {
  return (
    <button
      className={`rounded-2xl border p-4 text-left transition ${active ? "border-[#3B82F6]/45 bg-[#3B82F6]/12 shadow-[0_18px_50px_rgba(59,130,246,0.16)]" : "border-white/[0.06] bg-[#141A2A]/70 hover:bg-white/[0.04]"}`}
      onClick={onClick}
      type="button"
    >
      <span className="text-sm font-bold text-white">{label}</span>
      <span className="mt-2 block text-xs font-semibold leading-5 text-[#94A3B8]">{meta}</span>
      <span className={`mt-3 inline-flex rounded-full px-2 py-1 text-[10px] font-bold uppercase ${status === "Ship now" ? "bg-[#22C55E]/12 text-[#86EFAC]" : "bg-[#F59E0B]/12 text-[#FCD34D]"}`}>{status}</span>
    </button>
  );
}

function Field({ children, label }: { children: ReactNode; label: string }) {
  return (
    <label>
      <span className="mb-2 block text-xs font-bold uppercase text-[#64748B]">{label}</span>
      {children}
    </label>
  );
}

function StateMachine({ error, status }: { error?: string | null; status: string }) {
  const steps = ["PENDING", "PROVISIONING", "SYNCING", "CONNECTED"];
  const index = Math.max(0, steps.indexOf(status));
  return (
    <div className="mt-5 rounded-2xl border border-white/[0.06] bg-black/20 p-4">
      <div className="flex items-center gap-2">
        {steps.map((step, stepIndex) => (
          <div className="flex flex-1 items-center gap-2" key={step}>
            <span className={`h-2 flex-1 rounded-full ${stepIndex <= index ? "bg-[#3B82F6]" : "bg-white/[0.08]"}`} />
            <span className="hidden text-[10px] font-bold uppercase text-[#64748B] sm:block">{step}</span>
          </div>
        ))}
      </div>
      {error ? <p className="mt-3 flex items-center gap-2 text-sm font-bold text-[#FCA5A5]"><AlertTriangle className="h-4 w-4" aria-hidden />{error}</p> : null}
    </div>
  );
}

function ImportStat({ label, tone, value }: { label: string; tone?: "positive" | "negative"; value: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3">
      <p className="text-[11px] font-bold uppercase text-[#64748B]">{label}</p>
      <p className={`mt-1 text-xl font-bold tabular-nums ${tone === "positive" ? "text-[#22C55E]" : tone === "negative" ? "text-[#EF4444]" : "text-white"}`}>{value}</p>
    </div>
  );
}

function ComingSoonPanel() {
  return (
    <section className="rounded-2xl border border-white/[0.06] bg-[#141A2A]/75 p-5">
      <h2 className="text-xl font-bold text-white">Adapter path reserved</h2>
      <p className="mt-2 text-sm leading-6 text-[#94A3B8]">
        This adapter is scaffolded in the broker layer, but not enabled because it needs platform credentials and a verified read-only auth flow. CSV import is available today for these brokers.
      </p>
    </section>
  );
}
