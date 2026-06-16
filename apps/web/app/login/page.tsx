import { ArrowRight, ShieldCheck } from "lucide-react";
import Link from "next/link";

export default async function LoginPage({
  searchParams
}: {
  searchParams?: Promise<{ redirect_url?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const redirectTo = resolvedSearchParams?.redirect_url ?? "/dashboard";
  const hostedUrl = process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL;
  const href = hostedUrl
    ? `${hostedUrl}${hostedUrl.includes("?") ? "&" : "?"}redirect_url=${encodeURIComponent(redirectTo)}`
    : "/dashboard";

  return (
    <main className="grid min-h-[100dvh] place-items-center bg-[#0A0E1A] px-6 text-white">
      <section className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#111827]/80 p-8 shadow-[0_28px_90px_rgba(0,0,0,0.38)]">
        <div className="mb-7 inline-grid h-12 w-12 place-items-center rounded-2xl bg-[#3B82F6]/15 text-[#93C5FD]">
          <ShieldCheck className="h-6 w-6" aria-hidden />
        </div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#64748B]">TradeScribe</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">Sign in</h1>
        <p className="mt-3 text-sm leading-6 text-[#94A3B8]">
          Continue through TradeScribe&apos;s managed auth provider. MFA and session policy are handled by the Clerk project settings.
        </p>
        <Link
          className="mt-7 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#3B82F6] px-4 text-sm font-bold text-white shadow-lg shadow-blue-500/20 transition hover:bg-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#93C5FD]"
          href={href}
        >
          Continue to sign in
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
        {!hostedUrl ? (
          <p className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/10 p-3 text-xs leading-5 text-amber-100">
            Local sample mode is active because `NEXT_PUBLIC_CLERK_SIGN_IN_URL` is not configured.
          </p>
        ) : null}
      </section>
    </main>
  );
}
