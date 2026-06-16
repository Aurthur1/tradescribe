"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { fetchSettings, updateProfile, type SettingsResponse } from "../../_lib/dashboard-data";
import { SettingsShell } from "../_components/settings-shell";

export default function ProfileSettingsPage() {
  const [settings, setSettings] = useState<SettingsResponse | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [form, setForm] = useState({ avatarUrl: "", firstName: "", lastName: "" });
  const initials = useMemo(() => `${form.firstName || settings?.user.email || "T"}`.slice(0, 2).toUpperCase(), [form.firstName, settings?.user.email]);

  useEffect(() => {
    const controller = new AbortController();
    fetchSettings(controller.signal)
      .then((payload) => {
        setSettings(payload);
        setForm({
          avatarUrl: payload.user.avatarUrl ?? "",
          firstName: payload.user.firstName ?? "",
          lastName: payload.user.lastName ?? ""
        });
      })
      .catch(() => setSettings(null));
    return () => controller.abort();
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("saving");
    try {
      await updateProfile({ avatarUrl: form.avatarUrl || null, firstName: form.firstName, lastName: form.lastName });
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  return (
    <SettingsShell description="Keep your personal details current. Email changes should follow the verification flow of your auth provider." title="Profile">
      <form className="grid gap-6 lg:grid-cols-[180px_1fr]" onSubmit={onSubmit}>
        <div>
          <div
            className="grid h-24 w-24 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-[#3B82F6] via-[#6366F1] to-[#A855F7] bg-cover bg-center text-xl font-bold text-white"
            style={form.avatarUrl ? { backgroundImage: `url(${form.avatarUrl})` } : undefined}
          >
            {form.avatarUrl ? null : initials}
          </div>
          <p className="mt-3 text-xs font-semibold text-[#64748B]">Avatar URL preview</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="First name">
            <input className="input" onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))} value={form.firstName} />
          </Field>
          <Field label="Last name">
            <input className="input" onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))} value={form.lastName} />
          </Field>
          <Field label="Email">
            <input className="input opacity-70" readOnly value={settings?.user.email ?? ""} />
            <span className="mt-2 block text-xs leading-5 text-[#94A3B8]">Email changes require provider verification and are read-only here.</span>
          </Field>
          <Field label="Avatar URL">
            <input className="input" onChange={(event) => setForm((current) => ({ ...current, avatarUrl: event.target.value }))} placeholder="https://..." value={form.avatarUrl} />
          </Field>
          <div className="md:col-span-2">
            <button className="h-11 rounded-xl bg-[#3B82F6] px-5 text-sm font-bold text-white hover:bg-[#2563EB]" type="submit">
              Save profile
            </button>
            <span className="ml-3 text-xs font-semibold text-[#94A3B8]">{status === "saving" ? "Saving..." : status === "saved" ? "Saved" : status === "error" ? "Could not save" : ""}</span>
          </div>
        </div>
      </form>
    </SettingsShell>
  );
}

function Field({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-white">{label}</span>
      <div className="mt-2 [&_.input]:h-11 [&_.input]:w-full [&_.input]:rounded-xl [&_.input]:border [&_.input]:border-white/[0.08] [&_.input]:bg-[#0A0E1A] [&_.input]:px-3 [&_.input]:text-sm [&_.input]:font-semibold [&_.input]:text-white [&_.input]:outline-none [&_.input]:focus:ring-2 [&_.input]:focus:ring-[#3B82F6]">
        {children}
      </div>
    </label>
  );
}
