import type { RoomParticipant } from "@i-call-on/shared";

type Props = {
  participants: RoomParticipant[];
  hostName: string;
  maxPlayers: number;
  actionKey: string | null;
  onRemove: (participantId: string) => void;
};

export function AdmittedList({ participants, hostName, maxPlayers, actionKey, onRemove }: Props) {
  const totalAdmitted = participants.length + 1; // +1 host

  return (
    <section className="card-glow p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Players in room</h2>
        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs font-semibold text-[var(--color-muted)]">
          {totalAdmitted} / {maxPlayers}
        </span>
      </div>

      <ul className="mt-4 flex flex-col gap-2">
        <li className="flex items-center justify-between rounded-2xl border border-[rgba(70,236,19,0.25)] bg-[rgba(70,236,19,0.05)] px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{hostName}</span>
            <span className="rounded-full border border-[rgba(70,236,19,0.4)] bg-[rgba(70,236,19,0.1)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--color-primary)]">
              Host · You
            </span>
          </div>
        </li>

        {participants.map((p) => {
          const removeKey = `${p.id}:remove`;
          return (
            <li
              key={p.id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3"
            >
              <span className="font-semibold">{p.name}</span>
              <button
                onClick={() => onRemove(p.id)}
                disabled={actionKey !== null}
                className="rounded-lg border border-white/15 bg-white/5 px-3 py-1 text-sm font-semibold text-[#e9f3ee] transition-colors hover:border-[rgba(255,114,114,0.5)] hover:bg-[rgba(255,114,114,0.08)] hover:text-[var(--color-danger)] disabled:opacity-50"
              >
                {actionKey === removeKey ? "Removing…" : "Remove"}
              </button>
            </li>
          );
        })}
      </ul>

      {participants.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--color-muted)]">
          Waiting for other players to join…
        </p>
      ) : null}
    </section>
  );
}
