type Props = {
  label: string;
  value: string;
  hint: string;
  urgency?: "normal" | "warning" | "danger";
};

export function TimerCard({ label, value, hint, urgency = "normal" }: Props) {
  const valueColor =
    urgency === "danger"
      ? "text-[#ff8e8e]"
      : urgency === "warning"
      ? "text-[var(--color-warning)]"
      : "text-[#d8ffe0]";

  const glow =
    urgency === "danger"
      ? "0 0 16px rgba(255, 98, 98, 0.3)"
      : urgency === "warning"
      ? "0 0 16px rgba(255, 200, 60, 0.25)"
      : "0 0 16px rgba(70, 236, 19, 0.24)";

  const borderClass =
    urgency === "danger"
      ? "border-[rgba(255,114,114,0.4)] animate-pulse"
      : "border-[rgba(70,236,19,0.34)]";

  return (
    <div
      className={`rounded-2xl border ${borderClass} bg-[radial-gradient(circle_at_50%_0%,rgba(70,236,19,0.14),transparent_58%),linear-gradient(160deg,rgba(12,28,15,0.92),rgba(7,12,10,0.92))] px-4 py-3`}
    >
      <p className="text-[11px] font-bold uppercase tracking-widest text-[#9eb4a8]">{label}</p>
      <p
        className={`mt-1 font-display text-3xl font-bold leading-none tracking-wide sm:text-4xl ${valueColor}`}
        style={{ textShadow: glow }}
      >
        {value}
      </p>
      <p className="mt-1 text-xs text-[#9db1a7]">{hint}</p>
    </div>
  );
}
