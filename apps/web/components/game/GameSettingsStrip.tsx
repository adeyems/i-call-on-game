import type { RoomStateResponse } from "@i-call-on/shared";

type Props = {
  config: RoomStateResponse["game"]["config"];
};

export function GameSettingsStrip({ config }: Props) {
  const endRuleLabel =
    config.endRule === "FIRST_SUBMISSION"
      ? "First submit ends round"
      : config.manualEndPolicy === "NONE"
      ? "Timer only"
      : config.manualEndPolicy === "CALLER_OR_TIMER" || config.manualEndPolicy === "CALLER_ONLY"
      ? "Caller submits ends round"
      : "Host submits ends round";

  const chips: Array<{ label: string; value: string }> = [
    { label: "Rule", value: endRuleLabel }
  ];

  if (config.endRule !== "FIRST_SUBMISSION") {
    chips.push({ label: "Timer", value: `${config.roundSeconds}s` });
  }

  chips.push({
    label: "Scoring",
    value: config.scoringMode === "SHARED_10" ? "Shared 10" : "Fixed 10/0"
  });

  chips.push({
    label: "Letter pick",
    value: config.letterPickSeconds ? `Auto-pick ${config.letterPickSeconds}s` : "Manual"
  });

  return (
    <section
      aria-label="Game settings"
      className="card-glow flex flex-wrap items-center gap-2 p-3 sm:p-4"
    >
      <span className="px-1 text-[10px] font-bold uppercase tracking-widest text-[var(--color-muted)]">
        Rules
      </span>
      {chips.map((chip) => (
        <span
          key={chip.label}
          className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs"
        >
          <span className="font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            {chip.label}
          </span>
          <span className="font-semibold text-[var(--color-ink)]">{chip.value}</span>
        </span>
      ))}
    </section>
  );
}
