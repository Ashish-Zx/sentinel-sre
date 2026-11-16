import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import { Activity, BookOpen, Cpu, DollarSign, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

export default function AuthHeader() {
  return (
    <header className="sticky top-0 z-50 flex w-full items-center justify-between border-b border-zinc-800 bg-zinc-950/90 px-6 py-3 backdrop-blur">
      <div className="flex items-center gap-8">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-400">
            <ShieldAlert className="h-4 w-4" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold tracking-tight text-zinc-50 flex items-center gap-2">
              SentinelSRE
              <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 font-mono text-[10px] font-medium text-emerald-400 border border-emerald-500/30">
                L4 VERIFIED
              </span>
            </span>
            <span className="text-[11px] text-zinc-400">
              Autonomous Incident & Root-Cause Engineer
            </span>
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-900 hover:text-white"
          >
            <Activity className="h-3.5 w-3.5 text-emerald-400" />
            Incident War Room
          </Link>
          <Link
            href="/dashboard/knowledge"
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-900 hover:text-white"
          >
            <BookOpen className="h-3.5 w-3.5 text-sky-400" />
            Knowledge & Rules Vault
          </Link>
          <Link
            href="/dashboard/finops"
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-900 hover:text-white"
          >
            <DollarSign className="h-3.5 w-3.5 text-violet-400" />
            FinOps & Telemetry
          </Link>
        </nav>
      </div>

      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/incidents/demo-inc-992"
          className="hidden sm:flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/40 px-3.5 py-1.5 text-xs font-medium text-emerald-300 transition hover:bg-emerald-500/25"
        >
          <Cpu className="h-3.5 w-3.5" />
          1-Click Recruiter Demo
        </Link>

        <Suspense fallback={<div className="h-8 w-8 rounded-full bg-zinc-800 animate-pulse" />}>
          <Show when="signed-out">
            <SignInButton mode="modal">
              <button
                type="button"
                className="rounded-lg bg-zinc-100 px-3.5 py-1.5 text-xs font-semibold text-zinc-900 transition-colors hover:bg-white cursor-pointer"
              >
                Sign in
              </button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button
                type="button"
                className="rounded-lg border border-zinc-700 bg-zinc-900 px-3.5 py-1.5 text-xs font-medium text-zinc-200 transition-colors hover:bg-zinc-800 cursor-pointer"
              >
                Sign up
              </button>
            </SignUpButton>
          </Show>
          <Show when="signed-in">
            <UserButton />
          </Show>
        </Suspense>
      </div>
    </header>
  );
}
