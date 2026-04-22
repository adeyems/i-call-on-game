import type { ScoringMode } from "@i-call-on/shared";

export type RoundEndPreset = "HOST_OR_TIMER" | "CALLER_OR_TIMER" | "TIMER_ONLY" | "NO_TIMER";

type Props = {
  roundSeconds: number;
  onRoundSecondsChange: (value: number) => void;
  preset: RoundEndPreset;
  onPresetChange: (value: RoundEndPreset) => void;
  scoringMode: ScoringMode;
  onScoringModeChange: (value: ScoringMode) => void;
  letterPickEnabled: boolean;
  onLetterPickEnabledChange: (value: boolean) => void;
  letterPickSeconds: number;
  onLetterPickSecondsChange: (value: number) => void;
};

export function RoundSettings({
  roundSeconds,
  onRoundSecondsChange,
  preset,
  onPresetChange,
  scoringMode,
  onScoringModeChange,
  letterPickEnabled,
  onLetterPickEnabledChange,
  letterPickSeconds,
  onLetterPickSecondsChange
}: Props) {
  const hasTimer = preset !== "NO_TIMER";

  return (
    <section className="card-glow p-6">
      <h2 className="text-lg font-bold">Round settings</h2>
      <p className="mt-1 text-xs text-[var(--color-muted)]">
        Configure how rounds play out. Players see these when the game starts.
      </p>

      <div className="mt-5 grid gap-5">
        <div>
          <label htmlFor="endRule" className="block text-sm font-semibold text-[#d7e6df]">
            Round end rule
          </label>
          <select
            id="endRule"
            value={preset}
            onChange={(event) => onPresetChange(event.target.value as RoundEndPreset)}
            className="input mt-1.5"
          >
            <option value="HOST_OR_TIMER">Host submits or timer expires</option>
            <option value="CALLER_OR_TIMER">Caller submits or timer expires</option>
            <option value="TIMER_ONLY">Timer only (submissions never end round)</option>
            <option value="NO_TIMER">No timer (first submit ends round)</option>
          </select>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            {preset === "HOST_OR_TIMER"
              ? "When the host submits, the round ends and all drafts are auto-submitted."
              : preset === "CALLER_OR_TIMER"
              ? "When the current caller submits, the round ends for everyone."
              : preset === "TIMER_ONLY"
              ? "Only the timer ends the round. Everyone submits at their own pace."
              : "The very first submission ends the round. Be quick."}
          </p>
        </div>

        {hasTimer ? (
          <div>
            <label htmlFor="roundSeconds" className="block text-sm font-semibold text-[#d7e6df]">
              Round timer:{" "}
              <span className="font-bold text-[var(--color-primary)]">{roundSeconds}s</span>
            </label>
            <input
              id="roundSeconds"
              type="range"
              min={5}
              max={120}
              value={roundSeconds}
              onChange={(event) => onRoundSecondsChange(Number(event.target.value))}
              className="mt-1.5 w-full accent-[var(--color-primary)]"
            />
            <div className="flex justify-between text-xs text-[var(--color-muted)]">
              <span>5s</span>
              <span>120s</span>
            </div>
          </div>
        ) : null}

        <div>
          <label htmlFor="scoringMode" className="block text-sm font-semibold text-[#d7e6df]">
            Scoring
          </label>
          <select
            id="scoringMode"
            value={scoringMode}
            onChange={(event) => onScoringModeChange(event.target.value as ScoringMode)}
            className="input mt-1.5"
          >
            <option value="FIXED_10">Fixed 10 per correct answer</option>
            <option value="SHARED_10">Shared 10 by matching answers</option>
          </select>
        </div>

        <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={letterPickEnabled}
              onChange={(event) => onLetterPickEnabledChange(event.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[var(--color-primary)]"
            />
            <span>
              <span className="block text-sm font-semibold text-[#d7e6df]">
                Auto-pick letter on timeout
              </span>
              <span className="mt-0.5 block text-xs text-[var(--color-muted)]">
                If the caller takes too long to pick, server picks a random unused letter.
              </span>
            </span>
          </label>

          {letterPickEnabled ? (
            <div className="mt-3">
              <label htmlFor="letterPickSeconds" className="block text-xs font-semibold text-[#d7e6df]">
                Timeout:{" "}
                <span className="font-bold text-[var(--color-primary)]">{letterPickSeconds}s</span>
              </label>
              <input
                id="letterPickSeconds"
                type="range"
                min={5}
                max={60}
                value={letterPickSeconds}
                onChange={(event) => onLetterPickSecondsChange(Number(event.target.value))}
                className="mt-1.5 w-full accent-[var(--color-primary)]"
              />
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
