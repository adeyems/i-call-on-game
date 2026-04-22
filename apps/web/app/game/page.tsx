import { Suspense } from "react";
import { GameGate } from "@/components/game/GameGate";

export default function GamePage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-[var(--color-muted)]">Loading game…</p>}>
      <GameGate />
    </Suspense>
  );
}
