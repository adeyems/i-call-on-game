"use client";

import { ROUND_FIELDS, type RoundAnswerInput, type RoundField } from "@i-call-on/shared";
import type { FormEvent } from "react";

const FIELD_LABELS: Record<RoundField, string> = {
  name: "Name",
  animal: "Animal",
  place: "Place",
  thing: "Thing",
  food: "Food"
};

type Props = {
  letter: string;
  answers: RoundAnswerInput;
  onAnswerChange: (field: RoundField, value: string) => void;
  disabled: boolean;
  submitting: boolean;
  alreadySubmitted: boolean;
  canSubmit: boolean;
  onSubmit: () => void;
};

export function AnswerForm({
  letter,
  answers,
  onAnswerChange,
  disabled,
  submitting,
  alreadySubmitted,
  canSubmit,
  onSubmit
}: Props) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (canSubmit) onSubmit();
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="grid gap-3 rounded-2xl border border-[rgba(70,236,19,0.2)] bg-black/40 p-4 sm:p-5"
      aria-label="round answers"
    >
      <p className="text-sm font-semibold text-[#d7e6df]">
        All answers must start with{" "}
        <span className="font-display text-xl font-extrabold text-[var(--color-primary)]">
          {letter}
        </span>
      </p>

      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-5">
        {ROUND_FIELDS.map((field) => (
          <div key={field} className="grid gap-1">
            <label
              htmlFor={`field-${field}`}
              className="text-xs font-bold uppercase tracking-widest text-[#c6d8cf]"
            >
              {FIELD_LABELS[field]}
            </label>
            <input
              id={`field-${field}`}
              type="text"
              value={answers[field]}
              onChange={(event) => onAnswerChange(field, event.target.value)}
              disabled={disabled || alreadySubmitted}
              maxLength={48}
              autoComplete="off"
              className={[
                "input min-h-[2.65rem]",
                alreadySubmitted ? "border-[rgba(70,236,19,0.25)] bg-[rgba(70,236,19,0.04)] text-[#a8d0b0]" : "",
                disabled && !alreadySubmitted ? "opacity-60" : ""
              ].join(" ")}
              placeholder={letter + "…"}
            />
          </div>
        ))}
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <p className="text-xs text-[var(--color-muted)]">
          {alreadySubmitted
            ? "✓ Submitted. Waiting for others…"
            : "Auto-saves as you type."}
        </p>
        <button
          type="submit"
          className="btn-primary sm:min-w-44"
          disabled={!canSubmit}
        >
          {submitting ? "Submitting…" : alreadySubmitted ? "Submitted" : "Submit answers →"}
        </button>
      </div>
    </form>
  );
}
