import { Activity, BookOpen, DollarSign, ScrollText, ShieldAlert } from "lucide-react";
import Link from "next/link";
import AuthActions from "@/components/auth-actions";

const NAV_ITEMS = [
  { href: "/dashboard", label: "War Room", icon: Activity },
  { href: "/dashboard/knowledge", label: "Knowledge", icon: BookOpen },
  { href: "/dashboard/finops", label: "FinOps", icon: DollarSign },
  { href: "/blog", label: "Blog", icon: ScrollText },
];

export default function AuthHeader() {
  return (
    <header className="sticky top-0 z-50 flex w-full items-center justify-between border-b border-edge bg-canvas/80 px-5 py-3 backdrop-blur-xl sm:px-6">
      <div className="flex items-center gap-7">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-signal-edge bg-signal-dim text-signal">
            <ShieldAlert className="h-4 w-4" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold tracking-tight text-ink">
              SentinelSRE
            </span>
            <span className="text-[11px] text-ink-3">
              Autonomous Incident Engineering
            </span>
          </div>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-ink-2 transition-colors hover:bg-surface-3 hover:text-ink"
              >
                <Icon className="h-3.5 w-3.5 text-signal" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <AuthActions />
    </header>
  );
}
