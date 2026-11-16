import { Suspense } from "react";
import DashboardSidebar from "@/components/dashboard-sidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 min-h-[calc(100vh-57px)] bg-canvas text-ink">
      <Suspense fallback={<div className="hidden w-64 border-r border-edge lg:flex" />}>
        <DashboardSidebar />
      </Suspense>
      <div className="motion-enter flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
