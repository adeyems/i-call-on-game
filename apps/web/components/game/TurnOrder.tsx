import type { GameStatus, RoomParticipant } from "@i-call-on/shared";

type Props = {
  turnOrder: string[];
  currentTurnParticipantId: string | null;
  participantsById: Map<string, RoomParticipant>;
  currentParticipantId: string | null;
  letterPickCountdown: number | null;
  gameStatus: GameStatus;
};

export function TurnOrder({
  turnOrder,
  currentTurnParticipantId,
  participantsById,
  currentParticipantId,
  letterPickCountdown,
  gameStatus
}: Props) {
  const isMyTurn =
    gameStatus === "IN_PROGRESS" &&
    !!currentParticipantId &&
    currentParticipantId === currentTurnParticipantId;

  const currentName =
    currentTurnParticipantId !== null
      ? participantsById.get(currentTurnParticipantId)?.name ?? "active caller"
      : null;

  let headlineLabel: string;
  let headlineName: string;
  let hint: string;

  if (gameStatus === "LOBBY") {
    headlineLabel = "Status";
    headlineName = "Waiting for host to start";
    hint = "The game will begin when the host clicks start.";
  } else if (gameStatus === "FINISHED") {
    headlineLabel = "Game over";
    headlineName = "Final scores";
    hint = "No more turns.";
  } else if (gameStatus === "CANCELLED") {
    headlineLabel = "Status";
    headlineName = "Room closed";
    hint = "The host has disbanded the game.";
  } else if (isMyTurn) {
    headlineLabel = "Your turn";
    headlineName = "Pick a letter";
    hint =
      letterPickCountdown !== null && letterPickCountdown > 0
        ? `Auto-pick in ${letterPickCountdown}s if you don't choose.`
        : "Pick a letter from the grid.";
  } else if (currentName) {
    headlineLabel = "Current turn";
    headlineName = currentName;
    hint =
      letterPickCountdown !== null && letterPickCountdown > 0
        ? `Auto-pick in ${letterPickCountdown}s.`
        : "Waiting for them to pick a letter…";
  } else {
    headlineLabel = "Status";
    headlineName = "Waiting…";
    hint = "Waiting for the next turn.";
  }

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
          {headlineLabel}
        </p>
        <p className="mt-1 font-display text-xl font-bold text-white">{headlineName}</p>
        <p className="mt-1 text-sm text-[var(--color-muted)]">{hint}</p>
      </div>

      {turnOrder.length > 0 && gameStatus !== "LOBBY" ? (
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
      ) : null}
    </div>
  );
}
