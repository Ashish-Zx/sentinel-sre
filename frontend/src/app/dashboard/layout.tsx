import { Suspense } from "react";
import DashboardSidebar from "@/components/dashboard-sidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 min-h-[calc(100vh-57px)] bg-zinc-950 text-zinc-100">
      <Suspense fallback={<div className="hidden lg:flex w-64 border-r border-zinc-800/80" />}>
        <DashboardSidebar />
      </Suspense>
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
