"use client";

import {
  ArrowLeftRight,
  BarChart3,
  BookMarked,
  BookOpen,
  Brain,
  CalendarDays,
  ShieldCheck,
  ChevronLeft,
  ChevronUp,
  CreditCard,
  FileText,
  Grid2X2,
  LifeBuoy,
  LogOut,
  MessageCircle,
  MoreHorizontal,
  Settings,
  X,
  Upload,
  UserCircle,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { KeyboardEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { fetchOnboardingStatus, useCurrentUser } from "../_lib/dashboard-data";
import { AccountSwitcher } from "./account-switcher";
import { AppAlertBell } from "./app-alert-bell";
import { GlobalSearch } from "./global-search";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: Grid2X2 },
  { label: "Trades", href: "/trades", icon: ArrowLeftRight },
  { label: "Calendar", href: "/calendar", icon: CalendarDays },
  { label: "Reports", href: "/reports", icon: BarChart3 },
  { label: "Journal", href: "/journal/review", icon: BookOpen },
  { label: "Playbooks", href: "/playbooks", icon: BookMarked },
  { label: "Referrals", href: "/referrals", icon: Users },
  { label: "Import", href: "/import", icon: Upload },
  { label: "Emotions", href: "/emotions", icon: Brain },
  { label: "Resources", href: "/resources", icon: FileText },
  { label: "Contact", href: "/contact", icon: MessageCircle },
  { label: "Settings", href: "/settings", icon: Settings }
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { data } = useCurrentUser();
  const [collapsed, setCollapsed] = useState(false);
  const displayNavItems = useMemo(
    () => (data?.user.role === "ADMIN" ? [...navItems, { label: "Admin", href: "/admin", icon: ShieldCheck }] : navItems),
    [data?.user.role]
  );

  return (
    <div className="flex h-[100dvh] w-[100vw] overflow-hidden bg-[#0A0E1A] text-[#F8FAFC]">
      <div className="flex h-full min-h-0 w-full overflow-hidden bg-[#0A0E1A]">
        <aside
          className={`relative hidden h-full min-h-0 shrink-0 border-r border-white/[0.06] bg-[#0C111F] transition-[width] duration-300 md:block ${
            collapsed ? "w-[72px]" : "w-[264px]"
          }`}
          aria-label="Primary"
        >
          <div className={`flex h-full min-h-0 flex-col py-6 ${collapsed ? "px-0" : "px-5"}`}>
            <div className={`flex shrink-0 items-center ${collapsed ? "justify-center" : "justify-between"}`}>
              <Link className={`text-[20px] font-bold text-white ${collapsed ? "sr-only" : ""}`} href="/dashboard">
                Tradescribe
              </Link>
              <button
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                className={`flex items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.05] text-[#94A3B8] transition hover:bg-white/[0.08] hover:text-white focus:outline-none focus:ring-2 focus:ring-[#3B82F6] ${
                  collapsed ? "h-10 w-10 shadow-[0_0_0_2px_rgba(59,130,246,0.55),0_10px_28px_rgba(59,130,246,0.18)]" : "h-9 w-9"
                }`}
                onClick={() => setCollapsed((value) => !value)}
                type="button"
              >
                <ChevronLeft className={`h-4 w-4 transition ${collapsed ? "rotate-180" : ""}`} aria-hidden />
              </button>
            </div>

            <nav
              className={`mt-8 min-h-0 flex-1 space-y-1 px-3 [scrollbar-width:thin] [scrollbar-color:rgba(148,163,184,0.25)_transparent] ${
                collapsed ? "overflow-visible" : "overflow-y-auto"
              }`}
            >
              {displayNavItems.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));

                return (
                  <Link
                    aria-label={collapsed ? item.label : undefined}
                    className={`group relative flex h-10 items-center rounded-xl text-sm font-medium transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[#3B82F6] ${
                      collapsed
                        ? `mx-auto w-10 justify-center p-0 ${active ? "text-white" : "text-[#94A3B8] hover:bg-white/[0.04] hover:text-white"}`
                        : `gap-4 overflow-hidden px-3 py-2.5 ${active ? "text-white" : "text-[#94A3B8] hover:bg-white/[0.04] hover:text-white"}`
                    }`}
                    href={item.href}
                    key={item.href}
                    title={undefined}
                  >
                    {active ? (
                      <span
                        aria-hidden
                        data-layout-id="nav-active"
                        className="absolute inset-0 rounded-xl bg-gradient-to-b from-[#3B82F6] to-[#2563EB] shadow-[0_14px_38px_rgba(37,99,235,0.24)] motion-safe:animate-[navActive_180ms_ease-out]"
                      />
                    ) : null}
                    <Icon className="relative h-5 w-5 shrink-0" aria-hidden />
                    <span className={collapsed ? "sr-only" : "relative"}>{item.label}</span>
                    {collapsed ? <RailTooltip label={item.label} /> : null}
                  </Link>
                );
              })}
            </nav>

            <div className={`mt-4 shrink-0 border-t border-white/[0.06] ${collapsed ? "mx-3 mb-12 px-0 pb-1 pt-5" : "pt-4"}`}>
              <SidebarUserMenu collapsed={collapsed} />
            </div>
          </div>
        </aside>

        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[linear-gradient(135deg,rgba(20,26,42,0.62),rgba(31,25,56,0.42)_45%,rgba(11,16,32,0.84))]">
          <MobileTopBar />
          <OnboardingGate pathname={pathname} />
          <div key={pathname} className="min-h-0 flex-1 motion-safe:animate-[routeIn_180ms_ease-out_both]">
            {children}
          </div>
          <MobileBottomNav pathname={pathname} />
        </main>
      </div>
    </div>
  );
}

function MobileTopBar() {
  const { data } = useCurrentUser();
  const accounts = data?.accounts ?? [];
  const primaryAccount = accounts.find((account) => account.isPrimary) ?? accounts[0] ?? null;
  const activeAccountId = data?.preferences.activeAccountId ?? primaryAccount?.id ?? null;
  const sample = accounts.length === 0;
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(activeAccountId);

  useEffect(() => {
    setSelectedAccountId(activeAccountId);
  }, [activeAccountId]);

  return (
    <header className="shrink-0 border-b border-white/[0.06] bg-[#0C111F]/95 px-3 py-3 backdrop-blur-xl md:hidden">
      <div className="flex items-center justify-between gap-2">
        <Link className="min-w-0 text-base font-bold text-white" href="/dashboard">
          Tradescribe
        </Link>
        <div className="flex shrink-0 items-center gap-2">
          <GlobalSearch activeAccountId={selectedAccountId} compact />
          <AppAlertBell sample={sample} />
        </div>
      </div>
      {accounts.length > 0 ? (
        <div className="mt-3 max-w-full">
          <AccountSwitcher
            accounts={accounts}
            activeAccountId={selectedAccountId}
            canUseAllAccounts={data?.user.role === "ADMIN" || data?.user.plan === "PRO"}
            onAccountChange={setSelectedAccountId}
            plan={data?.user.plan ?? "FREE"}
          />
        </div>
      ) : null}
    </header>
  );
}

function MobileBottomNav({ pathname }: { pathname: string }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const primaryItems = [
    { label: "Dashboard", href: "/dashboard", icon: Grid2X2 },
    { label: "Trades", href: "/trades", icon: ArrowLeftRight },
    { label: "Journal", href: "/journal/review", icon: BookOpen },
    { label: "Reports", href: "/reports", icon: BarChart3 }
  ];
  const { data } = useCurrentUser();
  const allItems = useMemo(
    () => (data?.user.role === "ADMIN" ? [...navItems, { label: "Admin", href: "/admin", icon: ShieldCheck }] : navItems),
    [data?.user.role]
  );
  const moreItems = allItems.filter((item) => !primaryItems.some((primary) => primary.href === item.href));

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  return (
    <>
      {moreOpen ? (
        <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={() => setMoreOpen(false)} role="presentation">
          <div
            className="absolute inset-x-0 bottom-0 max-h-[78dvh] overflow-y-auto rounded-t-3xl border border-white/[0.08] bg-[#0C111F] p-4 shadow-[0_-24px_80px_rgba(0,0,0,0.55)] motion-safe:animate-[menuRise_160ms_ease-out]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-bold text-white">More</p>
              <button className="grid h-10 w-10 place-items-center rounded-xl text-[#94A3B8] hover:bg-white/[0.06] hover:text-white" onClick={() => setMoreOpen(false)} type="button" aria-label="Close navigation menu">
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {moreItems.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
                return (
                  <Link
                    className={`flex min-h-12 items-center gap-3 rounded-2xl border px-3 py-3 text-sm font-bold ${
                      active ? "border-[#3B82F6]/30 bg-[#3B82F6]/15 text-white" : "border-white/[0.06] bg-white/[0.03] text-[#CBD5E1]"
                    }`}
                    href={item.href}
                    key={item.href}
                  >
                    <Icon className="h-5 w-5 shrink-0" aria-hidden />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
      <nav className="grid h-[76px] shrink-0 grid-cols-5 border-t border-white/[0.06] bg-[#0C111F]/95 px-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl md:hidden" aria-label="Mobile primary">
        {primaryItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <Link className={`flex min-h-11 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-bold ${active ? "bg-[#3B82F6] text-white shadow-lg shadow-blue-500/20" : "text-[#94A3B8]"}`} href={item.href} key={item.href}>
              <Icon className="h-5 w-5" aria-hidden />
              {item.label}
            </Link>
          );
        })}
        <button className={`flex min-h-11 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-bold ${moreOpen ? "bg-[#3B82F6] text-white" : "text-[#94A3B8]"}`} onClick={() => setMoreOpen(true)} type="button">
          <MoreHorizontal className="h-5 w-5" aria-hidden />
          More
        </button>
      </nav>
    </>
  );
}

function OnboardingGate({ pathname }: { pathname: string }) {
  const router = useRouter();

  useEffect(() => {
    const controller = new AbortController();
    fetchOnboardingStatus(controller.signal)
      .then((status) => {
        if (status.shouldShowOnboarding && !pathname.startsWith("/onboarding")) {
          router.replace("/onboarding/welcome");
        }
      })
      .catch(() => {
        // In local sample mode, keep the app usable even if the API is offline.
      });
    return () => controller.abort();
  }, [pathname, router]);

  return null;
}

function RailTooltip({ label }: { label: string }) {
  return (
    <span
      className="pointer-events-none absolute left-[calc(100%+12px)] top-1/2 z-50 -translate-y-1/2 whitespace-nowrap rounded-lg border border-white/[0.08] bg-[#111827]/95 px-2.5 py-1.5 text-xs font-semibold text-white opacity-0 shadow-[0_14px_40px_rgba(0,0,0,0.35)] transition delay-150 duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
      role="tooltip"
    >
      {label}
    </span>
  );
}

export function PlaceholderPage({ title, body }: { title: string; body: string }) {
  return (
    <div className="h-full min-h-0 overflow-y-auto px-5 py-6 sm:px-8">
      <div className="rounded-2xl border border-white/[0.06] bg-[#141A2A]/60 p-8 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        <p className="text-sm font-medium text-[#64748B]">TradeScribe</p>
        <h1 className="mt-2 text-[28px] font-bold text-white">{title}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[#94A3B8]">{body}</p>
        <div className="mt-8 flex items-center gap-3 rounded-xl border border-white/[0.06] bg-black/20 p-4 text-sm text-[#94A3B8]">
          <LifeBuoy className="h-5 w-5 text-[#3B82F6]" aria-hidden />
          This route is wired into the authenticated shell and ready for its full Segment implementation.
        </div>
      </div>
    </div>
  );
}

function SidebarUserMenu({ collapsed }: { collapsed: boolean }) {
  const { data } = useCurrentUser();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const displayName = data?.user.firstName || "Trader";
  const email = data?.user.email ?? "trader@example.com";
  const plan = data?.user.plan ?? "FREE";
  const initials = useMemo(() => email.slice(0, 2).toUpperCase(), [email]);
  const menuItems = [
    { label: "Account settings", icon: UserCircle, href: "/settings" },
    { label: "Billing & plan", icon: CreditCard, href: "/settings" },
    { label: "Sign out", icon: LogOut, href: "/", destructive: true }
  ];

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !buttonRef.current?.contains(target)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function onButtonKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowUp" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setOpen(true);
      window.requestAnimationFrame(() => {
        const firstItem = menuRef.current?.querySelector<HTMLAnchorElement>('[role="menuitem"]');
        firstItem?.focus();
      });
    }
  }

  function onMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLAnchorElement>('[role="menuitem"]') ?? []);
    const index = items.findIndex((item) => item === document.activeElement);
    if (event.key === "Tab" && items.length > 0) {
      if (event.shiftKey && document.activeElement === items[0]) {
        event.preventDefault();
        items[items.length - 1]?.focus();
      } else if (!event.shiftKey && document.activeElement === items[items.length - 1]) {
        event.preventDefault();
        items[0]?.focus();
      }
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      items[(index + 1) % items.length]?.focus();
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      items[(index - 1 + items.length) % items.length]?.focus();
    }
  }

  return (
    <div className="relative">
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Open user menu"
        className={`group flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.025] text-left shadow-[0_12px_36px_rgba(0,0,0,0.18)] transition hover:bg-white/[0.04] focus:outline-none focus:ring-2 focus:ring-[#3B82F6] ${
          collapsed ? "mx-auto h-10 w-10 justify-center border-transparent bg-transparent p-0 shadow-none" : "w-full p-2.5"
        }`}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={onButtonKeyDown}
        ref={buttonRef}
        type="button"
      >
        <Avatar initials={initials} />
        <span className={collapsed ? "sr-only" : "min-w-0 flex-1"}>
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-semibold text-white">{displayName}</span>
            <PlanBadge plan={plan} />
          </span>
          <span className="mt-1 block truncate text-xs font-medium text-[#64748B]">{email}</span>
        </span>
        <ChevronUp className={`h-4 w-4 shrink-0 text-[#64748B] transition group-hover:text-[#94A3B8] ${collapsed ? "sr-only" : ""}`} aria-hidden />
      </button>

      {open ? (
        <div
          aria-label="User menu"
          className={`absolute z-40 w-72 rounded-2xl border border-white/[0.08] bg-[#111827]/95 p-2 shadow-[0_24px_80px_rgba(0,0,0,0.48)] backdrop-blur-xl motion-safe:animate-[menuRise_160ms_ease-out] ${
            collapsed ? "bottom-0 left-[calc(100%+18px)]" : "bottom-[calc(100%+10px)] left-0"
          }`}
          onKeyDown={onMenuKeyDown}
          ref={menuRef}
          role="menu"
        >
          <div className="border-b border-white/[0.06] px-3 py-3">
            <div className="flex items-center gap-3">
              <Avatar initials={initials} />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-semibold text-white">{displayName}</p>
                  <PlanBadge plan={plan} />
                </div>
                <p className="mt-1 truncate text-xs text-[#64748B]">{email}</p>
              </div>
            </div>
          </div>

          <div className="py-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold outline-none transition hover:bg-white/[0.05] focus:bg-white/[0.06] focus:ring-2 focus:ring-[#3B82F6] ${
                    item.destructive ? "text-[#F87171]" : "text-[#CBD5E1]"
                  }`}
                  href={item.href}
                  key={item.label}
                  onClick={() => setOpen(false)}
                  role="menuitem"
                  tabIndex={0}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Avatar({ initials }: { initials: string }) {
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#3B82F6] via-[#6366F1] to-[#A855F7] text-xs font-bold text-white shadow-[0_10px_30px_rgba(59,130,246,0.22)]">
      {initials}
    </span>
  );
}

function PlanBadge({ plan }: { plan: "FREE" | "CORE" | "PRO" }) {
  const classes = {
    CORE: "border-[#3B82F6]/30 bg-[#3B82F6]/12 text-[#93C5FD]",
    FREE: "border-white/[0.08] bg-white/[0.05] text-[#94A3B8]",
    PRO: "border-transparent bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6] text-white"
  }[plan];

  return <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-normal ${classes}`}>{plan}</span>;
}
