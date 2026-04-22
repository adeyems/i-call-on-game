export function Hero() {
  return (
    <section className="text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--color-muted)]">
        Multiplayer party game
      </p>
      <h1 className="gradient-title mt-2 font-display text-5xl font-extrabold tracking-tight sm:text-6xl">
        I Call On
      </h1>
      <p className="mx-auto mt-3 max-w-sm text-sm text-[var(--color-muted)] sm:text-base">
        Pick a letter. Everyone races to fill{" "}
        <strong className="text-[var(--color-ink)]">Name</strong>,{" "}
        <strong className="text-[var(--color-ink)]">Animal</strong>,{" "}
        <strong className="text-[var(--color-ink)]">Place</strong>,{" "}
        <strong className="text-[var(--color-ink)]">Thing</strong>,{" "}
        <strong className="text-[var(--color-ink)]">Food</strong>.
      </p>
    </section>
  );
}
