import type { ScoringSummary } from "@i-call-on/shared";

type Props = {
  scoring: ScoringSummary;
  currentParticipantId: string | null;
};

const rankStyles = [
  // 1st
  "border-[rgba(255,215,0,0.6)] bg-[linear-gradient(140deg,rgba(255,215,0,0.18),rgba(255,180,0,0.08))] text-[var(--color-gold)] shadow-[0_0_8px_rgba(255,215,0,0.15)]",
  // 2nd
  "border-[rgba(192,210,225,0.5)] bg-[linear-gradient(140deg,rgba(192,210,225,0.14),rgba(180,200,220,0.06))] text-[var(--color-silver)]",
  // 3rd
  "border-[rgba(205,127,50,0.5)] bg-[linear-gradient(140deg,rgba(205,127,50,0.14),rgba(180,110,40,0.06))] text-[var(--color-bronze)]"
];

export function Leaderboard({ scoring, currentParticipantId }: Props) {
  if (scoring.leaderboard.length === 0) {
    return (
      <p className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-[var(--color-muted)]">
        Scores will appear here once a round is published.
      </p>
    );
  }

  return (
    <ol className="grid gap-2">
      {scoring.leaderboard.map((entry, index) => {
        const isMe = entry.participantId === currentParticipantId;
        const rankClass =
          index < 3
            ? rankStyles[index]
            : "border-[rgba(70,236,19,0.45)] bg-[rgba(10,24,12,0.9)] text-[#b6f9a3]";
        return (
          <li
            key={entry.participantId}
            className={[
              "relative overflow-hidden rounded-2xl border p-3 transition-transform",
              isMe
                ? "border-[rgba(70,236,19,0.35)] bg-[linear-gradient(135deg,rgba(70,236,19,0.06),rgba(70,236,19,0.02))]"
                : "border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.045),rgba(255,255,255,0.015))]"
            ].join(" ")}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className={`flex-none rounded-full border px-2 py-0.5 text-[11px] font-extrabold ${rankClass}`}
                >
                  #{index + 1}
                </span>
                <span className="min-w-0 truncate font-semibold text-white">
                  {entry.participantName}
                  {isMe ? <span className="ml-1 text-xs text-[var(--color-muted)]">(you)</span> : null}
                </span>
              </div>
              <strong className="flex-none font-display text-xl font-extrabold tabular-nums text-[var(--color-primary)]">
                {entry.totalScore}
              </strong>
            </div>
            {entry.history.length > 0 ? (
              <p className="mt-1.5 line-clamp-2 text-xs text-[#9fb3a8]">
                {entry.history.map((h) => `R${h.roundNumber} ${h.activeLetter}:${h.score}`).join(" · ")}
              </p>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
