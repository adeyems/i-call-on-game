import { Suspense } from "react";
import { JoinGate } from "@/components/join/JoinGate";

export default function JoinPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-[var(--color-muted)]">Loading room…</p>}>
      <JoinGate />
    </Suspense>
  );
}
