import type { RoomParticipant } from "@i-call-on/shared";

type Props = {
  turnOrder: string[];
  currentTurnParticipantId: string | null;
  participantsById: Map<string, RoomParticipant>;
  currentParticipantId: string | null;
  letterPickCountdown: number | null;
};

export function TurnOrder({
  turnOrder,
  currentTurnParticipantId,
  participantsById,
  currentParticipantId,
  letterPickCountdown
}: Props) {
  const currentName =
    currentTurnParticipantId !== null
      ? participantsById.get(currentTurnParticipantId)?.name ?? "active caller"
      : "active caller";

  const isMyTurn = !!currentParticipantId && currentParticipantId === currentTurnParticipantId;

  return (
    <div className="flex flex-col gap-3">
      <div
        className={[
          "rounded-2xl border p-4",
          isMyTurn
            ? "border-[rgba(70,236,19,0.4)] bg-[rgba(70,236,19,0.06)]"
            : "border-white/10 bg-white/[0.02]"
        ].join(" ")}
      >
        <p className="text-xs font-bold uppercase tracking-widest text-[var(--color-muted)]">
          {isMyTurn ? "Your turn" : "Current turn"}
        </p>
        <p className="mt-1 font-display text-xl font-bold text-white">{currentName}</p>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          {isMyTurn
            ? "Pick a letter from the grid."
            : letterPickCountdown !== null && letterPickCountdown > 0
            ? `Auto-pick in ${letterPickCountdown}s.`
            : "Waiting for a letter to be called."}
        </p>
      </div>

      <div>
        <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-[var(--color-muted)]">
          Turn order
        </h3>
        <ol className="flex flex-col gap-1.5">
          {turnOrder.map((id) => {
            const participant = participantsById.get(id);
            const isCurrent = id === currentTurnParticipantId;
            return (
              <li
                key={id}
                className={[
                  "flex items-center gap-2 rounded-xl border px-3 py-2 text-sm",
                  isCurrent
                    ? "border-[rgba(70,236,19,0.35)] bg-[linear-gradient(135deg,rgba(70,236,19,0.06),rgba(70,236,19,0.02))]"
                    : "border-white/8 bg-white/[0.02]"
                ].join(" ")}
              >
                {isCurrent ? (
                  <span
                    className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--color-primary)]"
                    style={{ boxShadow: "0 0 8px rgba(70,236,19,0.4)" }}
                  />
                ) : null}
                <span className="font-semibold">{participant?.name ?? id}</span>
                {id === currentParticipantId ? (
                  <span className="ml-auto text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
                    you
                  </span>
                ) : null}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
