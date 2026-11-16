import { Suspense } from "react";
import IncidentWarRoom from "@/components/war-room/incident-war-room";

// Block static prerendering: this route reads runtime Clerk auth data
export const instant = false;

export default async function IncidentWarRoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center p-12 font-mono text-xs text-zinc-400">
          Loading Incident War Room #{id}...
        </div>
      }
    >
      <IncidentWarRoom incidentId={id} />
    </Suspense>
  );
}
