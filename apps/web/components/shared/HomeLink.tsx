import Link from "next/link";

export function HomeLink() {
  return (
    <Link
      href="/"
      className="group inline-flex w-fit items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-semibold text-[#cddbd2] transition-all hover:border-[rgba(70,236,19,0.35)] hover:bg-[rgba(70,236,19,0.07)] hover:text-[var(--color-primary)]"
    >
      <span className="transition-transform group-hover:-translate-x-0.5">←</span>
      <span>Home</span>
    </Link>
  );
}
