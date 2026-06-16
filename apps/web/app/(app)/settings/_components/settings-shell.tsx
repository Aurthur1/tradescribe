"use client";

import { Bell, CreditCard, MonitorCog, PlugZap, Shield, SlidersHorizontal, UserCircle } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";

const sections = [
  { href: "/settings/profile", icon: UserCircle, label: "Profile" },
  { href: "/settings/notifications", icon: Bell, label: "Notifications" },
  { href: "/settings/display", icon: MonitorCog, label: "Display" },
  { href: "/settings/connections", icon: PlugZap, label: "Connections" },
  { href: "/settings/prop-rules", icon: SlidersHorizontal, label: "Prop rules" },
  { href: "/settings/billing", icon: CreditCard, label: "Billing" },
  { href: "/settings/privacy", icon: Shield, label: "Privacy" }
];

export function SettingsShell({ children, description, title }: { children: ReactNode; description: string; title: string }) {
  const pathname = usePathname();

  return (
    <div className="h-full min-h-0 overflow-y-auto px-4 py-5 sm:px-8 sm:py-6">
      <div className="mx-auto max-w-7xl">
        <div>
          <p className="text-sm font-semibold text-[#64748B]">TradeScribe</p>
          <h1 className="mt-2 text-[28px] font-bold text-white">Settings</h1>
          <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-[#94A3B8]">Manage account, preferences, billing, and data controls.</p>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[240px_1fr]">
          <nav className="flex h-fit gap-2 overflow-x-auto rounded-2xl border border-white/[0.06] bg-[#111827]/70 p-2 [scrollbar-width:none] lg:block lg:space-y-1 lg:overflow-visible">
            {sections.map((section) => {
              const Icon = section.icon;
              const active = pathname === section.href;
              return (
                <Link
                  className={`flex min-h-11 shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition ${
                    active ? "bg-[#3B82F6] text-white shadow-[0_14px_36px_rgba(59,130,246,0.18)]" : "text-[#94A3B8] hover:bg-white/[0.04] hover:text-white"
                  }`}
                  href={section.href}
                  key={section.href}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  {section.label}
                </Link>
              );
            })}
          </nav>

          <section className="min-w-0 rounded-2xl border border-white/[0.06] bg-[#141A2A]/70 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:p-6">
            <div className="mb-6 border-b border-white/[0.06] pb-5">
              <h2 className="text-xl font-bold text-white">{title}</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#94A3B8]">{description}</p>
            </div>
            {children}
          </section>
        </div>
      </div>
    </div>
  );
}

export function EmptySettingsState({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-white/[0.06] bg-black/20 p-5 text-sm font-semibold text-[#94A3B8]">{children}</div>;
}
