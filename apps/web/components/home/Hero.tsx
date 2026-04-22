export function Hero() {
  return (
    <section className="text-center sm:text-left">
      <p className="mb-3 inline-block rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-[var(--color-muted)]">
        Multiplayer party game
      </p>
      <h1 className="gradient-title text-5xl font-extrabold leading-tight sm:text-6xl md:text-7xl">
        I Call On
      </h1>
      <p className="mx-auto mt-4 max-w-xl text-base text-[var(--color-muted)] sm:mx-0 sm:text-lg">
        Pick a letter. Everyone races to fill <strong className="text-[var(--color-ink)]">Name</strong>,{" "}
        <strong className="text-[var(--color-ink)]">Animal</strong>,{" "}
        <strong className="text-[var(--color-ink)]">Place</strong>,{" "}
        <strong className="text-[var(--color-ink)]">Thing</strong>, and{" "}
        <strong className="text-[var(--color-ink)]">Food</strong>. Fast, funny, friends only.
      </p>
    </section>
  );
}
