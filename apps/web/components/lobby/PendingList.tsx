import type { RoomParticipant } from "@i-call-on/shared";

type Props = {
  participants: RoomParticipant[];
  actionKey: string | null;
  onReview: (requestId: string, approve: boolean) => void;
};

export function PendingList({ participants, actionKey, onReview }: Props) {
  return (
    <section className="card-glow p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Join requests</h2>
        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs font-semibold text-[var(--color-muted)]">
          {participants.length}
        </span>
      </div>

      {participants.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--color-muted)]">
          No pending requests. Players who click your invite link will appear here.
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {participants.map((p) => {
            const approveKey = `${p.id}:approve`;
            const rejectKey = `${p.id}:reject`;
            return (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3"
              >
                <span className="font-semibold">{p.name}</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => onReview(p.id, true)}
                    disabled={actionKey !== null}
                    className="rounded-lg bg-[rgba(70,236,19,0.15)] border border-[rgba(70,236,19,0.5)] px-3 py-1 text-sm font-semibold text-[#b9ff9f] transition-colors hover:bg-[rgba(70,236,19,0.22)] disabled:opacity-50"
                  >
                    {actionKey === approveKey ? "Admitting…" : "Admit"}
                  </button>
                  <button
                    onClick={() => onReview(p.id, false)}
                    disabled={actionKey !== null}
                    className="rounded-lg border border-white/15 bg-white/5 px-3 py-1 text-sm font-semibold text-[#e9f3ee] transition-colors hover:border-[rgba(255,114,114,0.5)] hover:bg-[rgba(255,114,114,0.08)] hover:text-[var(--color-danger)] disabled:opacity-50"
                  >
                    {actionKey === rejectKey ? "Declining…" : "Decline"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
