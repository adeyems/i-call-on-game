const steps = [
  { n: "1", title: "Host creates a room", body: "Share the code with friends." },
  { n: "2", title: "Players join", body: "Each player enters their name." },
  { n: "3", title: "Caller picks a letter", body: "1–26 maps to A–Z. Locked for the round." },
  { n: "4", title: "Fill 5 categories", body: "Name · Animal · Place · Thing · Food." },
  { n: "5", title: "Submit fast", body: "Timer ticks. Empty boxes score nothing." },
  { n: "6", title: "Host scores", body: "Correct answers win points. Next caller up." }
];

export function HowToPlay() {
  return (
    <section className="card-glow p-5 sm:p-6">
      <h2 className="text-lg font-bold sm:text-xl">How to play</h2>
      <p className="mt-0.5 text-xs text-[var(--color-muted)]">
        Fast-paced party game. Think quick, answer first.
      </p>

      <ol className="mt-4 grid gap-2">
        {steps.map((step) => (
          <li
            key={step.n}
            className="flex items-start gap-3 rounded-xl border border-white/8 bg-white/[0.02] p-3 transition-colors hover:border-[rgba(70,236,19,0.2)] hover:bg-[rgba(70,236,19,0.025)]"
          >
            <span className="flex h-7 w-7 flex-none items-center justify-center rounded-lg border border-[rgba(70,236,19,0.35)] bg-[rgba(70,236,19,0.08)] font-display text-xs font-extrabold text-[var(--color-primary)]">
              {step.n}
            </span>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-white">{step.title}</h3>
              <p className="mt-0.5 text-xs leading-snug text-[var(--color-muted)]">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
