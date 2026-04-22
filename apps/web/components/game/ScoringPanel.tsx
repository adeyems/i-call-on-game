"use client";

import { ROUND_FIELDS, type CompletedRoundSnapshot, type RoundField, type RoundMarks } from "@i-call-on/shared";
import { useState } from "react";

const FIELD_LABELS: Record<RoundField, string> = {
  name: "Name",
  animal: "Animal",
  place: "Place",
  thing: "Thing",
  food: "Food"
};

type Props = {
  round: CompletedRoundSnapshot;
  onMark: (roundNumber: number, participantId: string, marks: RoundMarks) => Promise<void>;
  onPublish: (roundNumber: number) => Promise<void>;
  onDiscard: (roundNumber: number) => Promise<void>;
};

function emptyMarks(): RoundMarks {
  return { name: false, animal: false, place: false, thing: false, food: false };
}

function submissionMarks(submission: CompletedRoundSnapshot["submissions"][number]): RoundMarks {
  if (submission.review) return submission.review.marks;
  const marks = emptyMarks();
  for (const field of ROUND_FIELDS) {
    marks[field] = submission.answers[field].trim().length > 0;
  }
  return marks;
}

export function ScoringPanel({ round, onMark, onPublish, onDiscard }: Props) {
  const [workingMarks, setWorkingMarks] = useState<Record<string, RoundMarks>>({});
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const getMarks = (submission: CompletedRoundSnapshot["submissions"][number]) =>
    workingMarks[submission.participantId] ?? submissionMarks(submission);

  const toggleField = async (
    submission: CompletedRoundSnapshot["submissions"][number],
    field: RoundField,
    value: boolean
  ) => {
    const current = getMarks(submission);
    const next = { ...current, [field]: value };
    setWorkingMarks((prev) => ({ ...prev, [submission.participantId]: next }));
    const key = `${submission.participantId}:${field}`;
    setActionKey(key);
    setError(null);
    try {
      await onMark(round.roundNumber, submission.participantId, next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t save that mark.");
    } finally {
      setActionKey(null);
    }
  };

  const allReviewed = round.submissions.every((s) => !!s.review);

  const handlePublish = async () => {
    setActionKey("publish");
    setError(null);
    try {
      await onPublish(round.roundNumber);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t publish.");
    } finally {
      setActionKey(null);
    }
  };

  const handleDiscard = async () => {
    if (!confirm("Discard this round? Scores will be reset.")) return;
    setActionKey("discard");
    setError(null);
    try {
      await onDiscard(round.roundNumber);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t discard.");
    } finally {
      setActionKey(null);
    }
  };

  return (
    <section className="card-glow p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-[var(--color-muted)]">
            Round {round.roundNumber} · Letter {round.activeLetter}
          </p>
          <h3 className="text-xl font-bold">Score submissions</h3>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleDiscard}
            disabled={actionKey !== null}
            className="btn-secondary text-sm"
          >
            {actionKey === "discard" ? "Discarding…" : "Discard round"}
          </button>
          <button
            onClick={handlePublish}
            disabled={!allReviewed || actionKey !== null}
            className="btn-primary text-sm"
          >
            {actionKey === "publish" ? "Publishing…" : "Publish scores"}
          </button>
        </div>
      </div>

      {!allReviewed ? (
        <p className="mt-2 text-xs text-[var(--color-muted)]">
          Tap ✓ for correct, ✕ for wrong. Publish when every row is reviewed.
        </p>
      ) : null}

      {error ? (
        <p className="mt-3 rounded-xl border border-[rgba(255,114,114,0.3)] bg-[rgba(255,114,114,0.08)] px-3 py-2 text-sm text-[var(--color-danger)]">
          {error}
        </p>
      ) : null}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full border-separate border-spacing-y-2">
          <thead>
            <tr className="text-left text-[11px] font-bold uppercase tracking-widest text-[var(--color-muted)]">
              <th className="px-2">Player</th>
              {ROUND_FIELDS.map((field) => (
                <th key={field} className="px-2">
                  {FIELD_LABELS[field]}
                </th>
              ))}
              <th className="px-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {round.submissions.map((submission) => {
              const marks = getMarks(submission);
              const total = submission.review?.scores.total ?? 0;
              return (
                <tr key={submission.participantId} className="align-top">
                  <td className="rounded-l-xl border-y border-l border-white/10 bg-white/[0.02] px-3 py-2">
                    <span className="block font-semibold">{submission.participantName}</span>
                  </td>
                  {ROUND_FIELDS.map((field) => {
                    const answer = submission.answers[field];
                    const isCorrect = marks[field];
                    const key = `${submission.participantId}:${field}`;
                    return (
                      <td key={field} className="border-y border-white/10 bg-white/[0.02] px-2 py-2">
                        <div className="grid gap-1">
                          <span
                            className={[
                              "truncate rounded-md border px-2 py-1 text-xs",
                              answer.trim().length === 0
                                ? "border-white/5 bg-white/[0.02] text-[var(--color-muted)]"
                                : "border-white/10 bg-white/[0.04] text-[#e6f0ea]"
                            ].join(" ")}
                            title={answer}
                          >
                            {answer.trim().length === 0 ? "—" : answer}
                          </span>
                          <div className="flex gap-1">
                            <button
                              type="button"
                              disabled={actionKey === key}
                              onClick={() => toggleField(submission, field, true)}
                              className={[
                                "flex h-8 w-8 items-center justify-center rounded-md border text-sm transition-transform hover:scale-105",
                                isCorrect
                                  ? "border-[rgba(70,236,19,0.65)] bg-[linear-gradient(140deg,rgba(70,236,19,0.28),rgba(70,236,19,0.18))] text-[#b9ff9f]"
                                  : "border-white/15 bg-white/5 text-[#e3ece6]"
                              ].join(" ")}
                              aria-label={`mark ${field} correct`}
                            >
                              ✓
                            </button>
                            <button
                              type="button"
                              disabled={actionKey === key}
                              onClick={() => toggleField(submission, field, false)}
                              className={[
                                "flex h-8 w-8 items-center justify-center rounded-md border text-sm transition-transform hover:scale-105",
                                !isCorrect
                                  ? "border-[rgba(255,114,114,0.55)] bg-[linear-gradient(140deg,rgba(255,114,114,0.24),rgba(255,114,114,0.14))] text-[#ffd3d3]"
                                  : "border-white/15 bg-white/5 text-[#e3ece6]"
                              ].join(" ")}
                              aria-label={`mark ${field} wrong`}
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      </td>
                    );
                  })}
                  <td className="rounded-r-xl border-y border-r border-white/10 bg-white/[0.02] px-3 py-2 text-right">
                    <span className="font-display font-bold text-[var(--color-primary)]">
                      {submission.review ? total : "—"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
