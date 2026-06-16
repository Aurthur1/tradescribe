"use client";

import { useState } from "react";
import { tagTradePlaybook, type Playbook, type PlaybookSummary } from "../../_lib/dashboard-data";

export function PlaybookSelect({
  disabled,
  onChange,
  playbooks,
  tradeId,
  value
}: {
  disabled?: boolean;
  onChange?: (playbook: PlaybookSummary | null) => void;
  playbooks: Playbook[];
  tradeId: string;
  value?: PlaybookSummary | null;
}) {
  const [selected, setSelected] = useState(value?.id ?? "");
  const [saving, setSaving] = useState(false);

  async function update(nextId: string) {
    setSelected(nextId);
    if (disabled) return;
    setSaving(true);
    try {
      const trade = await tagTradePlaybook(tradeId, nextId || null);
      onChange?.(trade.playbook ?? null);
    } finally {
      setSaving(false);
    }
  }

  return (
    <label className="inline-flex min-w-[150px] items-center gap-2 rounded-xl border border-white/[0.08] bg-[#0A0E1A] px-2.5 py-2 text-xs font-bold text-[#CBD5E1]">
      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: playbooks.find((playbook) => playbook.id === selected)?.color ?? "rgba(148,163,184,0.35)" }} />
      <select
        aria-label="Assign playbook"
        className="min-w-0 flex-1 bg-transparent text-xs font-bold text-white outline-none disabled:cursor-not-allowed disabled:opacity-60"
        disabled={disabled || saving}
        onChange={(event) => void update(event.target.value)}
        value={selected}
      >
        <option value="">No playbook</option>
        {playbooks
          .filter((playbook) => !playbook.isArchived)
          .map((playbook) => (
            <option key={playbook.id} value={playbook.id}>
              {playbook.name}
            </option>
          ))}
      </select>
    </label>
  );
}
