"use client";

import { ArrowDown, ArrowLeft, ArrowUp, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormEvent, ReactNode } from "react";
import { useState } from "react";
import { createPlaybook, updatePlaybook, type Playbook, type PlaybookPayload, type PlaybookRule } from "../../_lib/dashboard-data";

const palette = ["#3B82F6", "#8B5CF6", "#22C55E", "#F59E0B", "#EF4444", "#14B8A6"];
const inputClass =
  "min-h-11 w-full rounded-xl border border-white/[0.08] bg-[#0A0E1A] px-3 py-2.5 text-sm font-semibold text-white outline-none placeholder:text-[#475569] focus:ring-2 focus:ring-[#3B82F6]";
const sessionOptions = ["Sydney", "Tokyo", "London", "New York"];

export function PlaybookForm({ mode, playbook }: { mode: "create" | "edit"; playbook?: Playbook }) {
  const router = useRouter();
  const initialConstraints = parseConstraintTags(playbook?.tags ?? []);
  const [name, setName] = useState(playbook?.name ?? "");
  const [description, setDescription] = useState(playbook?.description ?? "");
  const [color, setColor] = useState(playbook?.color ?? "#3B82F6");
  const [tags, setTags] = useState((playbook?.tags ?? []).filter((tag) => !tag.startsWith("__ts_")).join(", "));
  const [targetR, setTargetR] = useState(initialConstraints.targetR);
  const [maxRiskPct, setMaxRiskPct] = useState(initialConstraints.maxRiskPct);
  const [allowedSessions, setAllowedSessions] = useState(initialConstraints.allowedSessions);
  const [allowedSymbols, setAllowedSymbols] = useState(initialConstraints.allowedSymbols.join(", "));
  const [rules, setRules] = useState<PlaybookRule[]>(playbook?.rules?.length ? normalizeRules(playbook.rules) : [{ order: 0, text: "" }]);
  const [saving, setSaving] = useState<"idle" | "saving" | "error">("idle");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const payload: PlaybookPayload = {
      color,
      description: description.trim() || null,
      name: name.trim(),
      rules: normalizeRules(rules).filter((rule) => rule.text.trim()),
      tags: tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
        .concat(buildConstraintTags({ allowedSessions, allowedSymbols, maxRiskPct, targetR }))
    };
    setSaving("saving");
    try {
      const saved = mode === "edit" && playbook ? await updatePlaybook(playbook.id, payload) : await createPlaybook(payload);
      router.push(`/playbooks/${saved.id}`);
    } catch {
      setSaving("error");
    }
  }

  function updateRule(index: number, text: string) {
    setRules((current) => current.map((rule, ruleIndex) => (ruleIndex === index ? { ...rule, text } : rule)));
  }

  function moveRule(index: number, direction: -1 | 1) {
    setRules((current) => {
      const next = [...current];
      const target = index + direction;
      const currentRule = next[index];
      const targetRule = next[target];
      if (!currentRule || !targetRule || target < 0 || target >= next.length) return current;
      next[index] = targetRule;
      next[target] = currentRule;
      return normalizeRules(next);
    });
  }

  return (
    <form className="mx-auto max-w-4xl space-y-5" onSubmit={(event) => void onSubmit(event)}>
      <Link className="inline-flex items-center gap-2 text-sm font-bold text-[#93C5FD] hover:text-white" href="/playbooks">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to playbooks
      </Link>

      <section className="rounded-2xl border border-white/[0.06] bg-[#141A2A]/75 p-4 sm:p-6">
        <p className="text-sm font-semibold text-[#64748B]">Playbooks</p>
        <h1 className="mt-2 text-3xl font-bold text-white">{mode === "edit" ? "Edit Playbook" : "New Playbook"}</h1>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Field label="Name">
            <input required className={inputClass} onChange={(event) => setName(event.target.value)} placeholder="London Breakout" value={name} />
          </Field>
          <Field label="Tags">
            <input className={inputClass} onChange={(event) => setTags(event.target.value)} placeholder="London, Momentum" value={tags} />
          </Field>
          <Field label="Description">
            <textarea className={`${inputClass} min-h-28 resize-none md:col-span-2`} onChange={(event) => setDescription(event.target.value)} placeholder="What this setup is designed to capture." value={description} />
          </Field>
          <div className="md:col-span-2">
            <span className="text-xs font-bold uppercase text-[#64748B]">Color</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {palette.map((item) => (
                <button
                  aria-label={`Use ${item}`}
                  className={`h-11 w-11 rounded-xl border transition ${color === item ? "border-white shadow-[0_0_0_3px_rgba(59,130,246,0.25)]" : "border-white/[0.08]"}`}
                  key={item}
                  onClick={() => setColor(item)}
                  style={{ backgroundColor: item }}
                  type="button"
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-white/[0.06] bg-[#141A2A]/75 p-4 sm:p-6">
        <div>
          <h2 className="text-lg font-bold text-white">Strategy Constraints</h2>
          <p className="mt-1 text-sm font-semibold text-[#94A3B8]">Optional guardrails that make this playbook more than a label.</p>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Field label="Target R">
            <input className={inputClass} inputMode="decimal" onChange={(event) => setTargetR(event.target.value)} placeholder="2.0" value={targetR} />
          </Field>
          <Field label="Max risk %">
            <input className={inputClass} inputMode="decimal" onChange={(event) => setMaxRiskPct(event.target.value)} placeholder="1.0" value={maxRiskPct} />
          </Field>
          <div>
            <span className="mb-2 block text-xs font-bold uppercase text-[#64748B]">Allowed sessions</span>
            <div className="flex flex-wrap gap-2">
              {sessionOptions.map((session) => {
                const active = allowedSessions.includes(session);
                return (
                  <button
                    className={`min-h-11 rounded-xl border px-3 py-2 text-sm font-bold transition ${active ? "border-[#3B82F6]/40 bg-[#3B82F6]/15 text-[#93C5FD]" : "border-white/[0.08] text-[#94A3B8] hover:bg-white/[0.04]"}`}
                    key={session}
                    onClick={() => setAllowedSessions((current) => (active ? current.filter((item) => item !== session) : [...current, session]))}
                    type="button"
                  >
                    {session}
                  </button>
                );
              })}
            </div>
          </div>
          <Field label="Allowed symbols">
            <input className={inputClass} onChange={(event) => setAllowedSymbols(event.target.value.toUpperCase())} placeholder="XAUUSD, EURUSD" value={allowedSymbols} />
          </Field>
        </div>
      </section>

      <section className="rounded-2xl border border-white/[0.06] bg-[#141A2A]/75 p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">Entry Rules</h2>
            <p className="mt-1 text-sm font-semibold text-[#94A3B8]">Your checklist for deciding whether a trade belongs to this strategy.</p>
          </div>
          <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#3B82F6] px-3 py-2 text-sm font-bold text-white" onClick={() => setRules((current) => [...current, { order: current.length, text: "" }])} type="button">
            <Plus className="h-4 w-4" aria-hidden />
            Add rule
          </button>
        </div>
        <div className="mt-5 space-y-3">
          {rules.map((rule, index) => (
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]" key={`${rule.order}-${index}`}>
              <input className={inputClass} onChange={(event) => updateRule(index, event.target.value)} placeholder="Price above 200 EMA" value={rule.text} />
              <div className="flex gap-1">
                <IconButton disabled={index === 0} label="Move up" onClick={() => moveRule(index, -1)}><ArrowUp className="h-4 w-4" /></IconButton>
                <IconButton disabled={index === rules.length - 1} label="Move down" onClick={() => moveRule(index, 1)}><ArrowDown className="h-4 w-4" /></IconButton>
                <IconButton disabled={rules.length === 1} label="Remove" onClick={() => setRules((current) => normalizeRules(current.filter((_, ruleIndex) => ruleIndex !== index)))}><Trash2 className="h-4 w-4" /></IconButton>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="flex items-center justify-end gap-3">
        {saving === "error" ? <span className="text-sm font-bold text-[#F87171]">Could not save playbook.</span> : null}
        <button className="min-h-11 rounded-xl border border-white/[0.08] px-4 py-2 text-sm font-bold text-[#CBD5E1] hover:bg-white/[0.04]" onClick={() => router.back()} type="button">
          Cancel
        </button>
        <button className="min-h-11 rounded-xl bg-[#3B82F6] px-4 py-2 text-sm font-bold text-white disabled:opacity-60" disabled={saving === "saving" || !name.trim()} type="submit">
          {saving === "saving" ? "Saving..." : "Save playbook"}
        </button>
      </div>
    </form>
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

function IconButton({ children, disabled, label, onClick }: { children: ReactNode; disabled?: boolean; label: string; onClick: () => void }) {
  return (
    <button aria-label={label} className="grid h-11 w-11 place-items-center rounded-xl border border-white/[0.08] text-[#94A3B8] hover:bg-white/[0.04] disabled:opacity-35" disabled={disabled} onClick={onClick} type="button">
      {children}
    </button>
  );
}

function normalizeRules(rules: PlaybookRule[]) {
  return rules.map((rule, index) => ({ order: index, text: rule.text }));
}

function parseConstraintTags(tags: string[]) {
  const getValue = (prefix: string) => tags.find((tag) => tag.startsWith(prefix))?.slice(prefix.length) ?? "";
  return {
    allowedSessions: tags.filter((tag) => tag.startsWith("__ts_session=")).map((tag) => tag.slice("__ts_session=".length)),
    allowedSymbols: tags.filter((tag) => tag.startsWith("__ts_symbol=")).map((tag) => tag.slice("__ts_symbol=".length)),
    maxRiskPct: getValue("__ts_maxRiskPct=").replace("% max", ""),
    targetR: getValue("__ts_targetR=").replace("R", "")
  };
}

function buildConstraintTags({
  allowedSessions,
  allowedSymbols,
  maxRiskPct,
  targetR
}: {
  allowedSessions: string[];
  allowedSymbols: string;
  maxRiskPct: string;
  targetR: string;
}) {
  return [
    targetR.trim() ? `__ts_targetR=${targetR.trim()}R` : null,
    maxRiskPct.trim() ? `__ts_maxRiskPct=${maxRiskPct.trim()}% max` : null,
    ...allowedSessions.map((session) => `__ts_session=${session}`),
    ...allowedSymbols
      .split(",")
      .map((symbol) => symbol.trim().toUpperCase())
      .filter(Boolean)
      .map((symbol) => `__ts_symbol=${symbol}`)
  ].filter((tag): tag is string => Boolean(tag));
}
