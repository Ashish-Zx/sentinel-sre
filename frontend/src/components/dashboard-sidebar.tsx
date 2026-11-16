"use client";

import { Activity, BookOpen, DollarSign, PlayCircle, ShieldCheck } from "lucide-react";
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
    <aside className="hidden w-64 flex-col justify-between border-r border-edge bg-surface-1/60 p-4 lg:flex">
      <div className="space-y-1">
        <div className="px-3 pb-2 text-[11px] font-medium uppercase tracking-wider text-ink-3">
          Workspace Operations
        </div>

        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                isActive
                  ? "border border-signal-edge bg-signal-dim text-signal"
                  : "text-ink-2 hover:bg-surface-3 hover:text-ink"
              }`}
            >
              <Icon className={`h-4 w-4 ${isActive ? "text-signal" : "text-ink-3 group-hover:text-ink-2"}`} />
              {item.label}
            </Link>
          );
        })}
      </div>

      <div className="space-y-2.5 rounded-xl border border-edge bg-surface-2 p-3.5">
        <div className="flex items-center gap-2 text-xs font-semibold text-ink">
          <ShieldCheck className="h-4 w-4 text-signal" />
          Procedural Safety Gate
        </div>
        <p className="text-[11px] leading-relaxed text-ink-3">
          Confidence threshold: <span className="text-ink tabular">85%</span>
          <br />
          Protected:{" "}
          <span className="font-mono text-[#7a4d00]">/auth, /payments, checkout.py</span>
        </p>
      </div>
    </aside>
  );
}
