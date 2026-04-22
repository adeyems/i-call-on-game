const steps = [
  {
    n: "1",
    title: "Create or join a room",
    body: "Host creates a room and shares the link. Players join with a name."
  },
  {
    n: "2",
    title: "Call a letter",
    body: "Each turn, one player picks a number (1–26) which maps to A–Z. That letter locks for the round."
  },
  {
    n: "3",
    title: "Fill 5 categories",
    body: "Everyone races to answer Name, Animal, Place, Thing, Food — all starting with the chosen letter."
  },
  {
    n: "4",
    title: "Submit before time’s up",
    body: "Clock is ticking. Empty boxes score nothing. Late submissions get blocked."
  },
  {
    n: "5",
    title: "Host scores",
    body: "Host reviews each answer. Correct answers score points. Leaderboard updates."
  },
  {
    n: "6",
    title: "Climb the board",
    body: "A new caller takes the next turn. Most points at the end wins."
  }
];

export function HowToPlay() {
  return (
    <section className="card-glow p-6 sm:p-8">
      <h2 className="text-2xl font-bold sm:text-3xl">How to play</h2>
      <p className="mt-1 text-sm text-[var(--color-muted)]">
        A fast-paced party game. Think quick, answer first.
      </p>

      <ol className="mt-6 grid gap-3 sm:grid-cols-2">
        {steps.map((step) => (
          <li
            key={step.n}
            className="flex items-start gap-3 rounded-2xl border border-white/8 bg-white/[0.02] p-4 transition-colors hover:border-[rgba(70,236,19,0.25)] hover:bg-[rgba(70,236,19,0.03)]"
          >
            <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl border border-[rgba(70,236,19,0.35)] bg-[rgba(70,236,19,0.08)] font-display text-sm font-extrabold text-[var(--color-primary)]">
              {step.n}
            </span>
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-white">{step.title}</h3>
              <p className="mt-0.5 text-sm leading-snug text-[var(--color-muted)]">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-6 rounded-2xl border border-[rgba(70,236,19,0.2)] bg-[rgba(70,236,19,0.04)] p-4">
        <p className="text-xs font-bold uppercase tracking-widest text-[var(--color-muted)]">
          Categories
        </p>
        <ul className="mt-2 flex flex-wrap gap-2">
          {["Name", "Animal", "Place", "Thing", "Food"].map((cat) => (
            <li
              key={cat}
              className="rounded-full border border-[rgba(70,236,19,0.3)] bg-[rgba(70,236,19,0.08)] px-3 py-1 text-sm font-semibold text-[#c8f5b8]"
            >
              {cat}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
