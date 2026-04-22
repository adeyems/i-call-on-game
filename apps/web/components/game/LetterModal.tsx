type Props = {
  letter: string;
  countdownSecondsLeft: number;
};

export function LetterModal({ letter, countdownSecondsLeft }: Props) {
  return (
    <div
      className="fixed inset-0 z-40 grid place-items-center bg-black/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="letter countdown"
    >
      <div className="w-[92vw] max-w-lg rounded-[22px] border border-[rgba(70,236,19,0.25)] bg-[linear-gradient(150deg,rgba(7,14,10,0.96),rgba(9,19,13,0.98))] px-6 py-10 text-center shadow-[0_22px_48px_rgba(0,0,0,0.45),0_0_35px_rgba(70,236,19,0.14)]">
        <p className="text-sm font-bold uppercase tracking-widest text-[var(--color-muted)]">
          The letter is…
        </p>
        <p
          className="mt-2 font-display font-extrabold leading-none text-[var(--color-primary)]"
          style={{ fontSize: "clamp(6rem, 24vw, 12rem)", textShadow: "0 0 28px rgba(70,236,19,0.35)" }}
        >
          {letter}
        </p>
        <p className="mt-3 font-display text-5xl font-bold text-white sm:text-6xl">
          {Math.max(0, countdownSecondsLeft)}
        </p>
        <p className="mt-2 text-xs text-[var(--color-muted)]">
          Get ready — answers unlock in {countdownSecondsLeft}s
        </p>
      </div>
    </div>
  );
}
