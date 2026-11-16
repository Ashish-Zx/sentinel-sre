"use client";

import {
  Activity,
  BookOpen,
  DollarSign,
  PlayCircle,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Incident War Room", icon: Activity, exact: true },
  { href: "/dashboard/incidents/demo-inc-992", label: "Live Sample Incident #992", icon: PlayCircle, exact: false },
  { href: "/dashboard/knowledge", label: "Knowledge & Rules Vault", icon: BookOpen, exact: false },
  { href: "/dashboard/finops", label: "FinOps & Cost Telemetry", icon: DollarSign, exact: false },
];

export default function DashboardSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:flex w-64 flex-col justify-between border-r border-zinc-800/80 bg-zinc-950 p-4">
      <div className="space-y-1">
        <div className="px-3 py-2 text-[11px] font-mono uppercase tracking-wider text-zinc-500">
          Workspace Operations
        </div>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                isActive
                  ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                  : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
              }`}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3.5 space-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
          <ShieldCheck className="h-4 w-4 text-emerald-400" />
          Procedural Safety Gate
        </div>
        <p className="text-[11px] text-zinc-400 leading-relaxed">
          Confidence threshold: <strong className="text-zinc-200">85%</strong>
          <br />
          Protected: <code className="text-amber-300">/auth, /payments, checkout.py</code>
        </p>
      </div>
    </aside>
  );
}
