import { Suspense } from "react";
import { LobbyGate } from "@/components/lobby/LobbyGate";

export default function LobbyPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-[var(--color-muted)]">Loading lobby…</p>}>
      <LobbyGate />
    </Suspense>
  );
}
