import { LETTERS } from "@i-call-on/shared";

type Props = {
  usedNumbers: Set<number>;
  canCall: boolean;
  onCall: (number: number) => void;
  callingNumber: number | null;
};

export function LetterGrid({ usedNumbers, canCall, onCall, callingNumber }: Props) {
  return (
    <div className="grid grid-cols-4 gap-2 sm:grid-cols-8 md:grid-cols-13" role="region" aria-label="letter grid">
      {LETTERS.map((entry) => {
        const isUsed = usedNumbers.has(entry.number);
        const isCalling = callingNumber === entry.number;
        return (
          <button
            key={entry.number}
            type="button"
            disabled={!canCall || isUsed || callingNumber !== null}
            onClick={() => onCall(entry.number)}
            aria-label={`letter-${entry.letter}`}
            className={[
              "group flex flex-col items-center justify-center rounded-xl border px-0 py-3 font-bold transition-all",
              isUsed
                ? "border-white/5 bg-white/[0.02] text-[#576a60] line-through decoration-white/10"
                : isCalling
                ? "border-[rgba(70,236,19,0.75)] bg-[linear-gradient(140deg,var(--color-primary),var(--color-primary-dark))] text-[#0b1a0f]"
                : canCall
                ? "border-white/15 bg-white/5 text-[#ecf5ef] hover:border-[rgba(70,236,19,0.4)] hover:bg-[rgba(70,236,19,0.08)] hover:shadow-[0_0_14px_rgba(70,236,19,0.12)]"
                : "border-white/10 bg-white/[0.03] text-[#ecf5ef] opacity-60"
            ].join(" ")}
          >
            <span className="text-base leading-tight">{entry.letter}</span>
            <span
              className={[
                "mt-0.5 text-[10px] font-medium leading-none",
                isUsed ? "text-[#4a5c53]" : "text-[#7a8f82] group-hover:text-[#c8f5b8]"
              ].join(" ")}
            >
              {entry.number}
            </span>
          </button>
        );
      })}
    </div>
  );
}
