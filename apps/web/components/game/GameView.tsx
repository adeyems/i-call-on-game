"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  emptyAnswers,
  type RoundAnswerInput,
  type RoundField,
  type RoundMarks
} from "@i-call-on/shared";
import { api } from "@/lib/api";
import { readSession, writeSession, clearDraft, readDraft, writeDraft, type RoomSession } from "@/lib/session";
import { useNowTick } from "@/lib/useNowTick";
import { useRoomSocket } from "@/lib/useRoomSocket";
import {
  playNotificationSound,
  playRoundEndSound,
  playSubmissionSound,
  playTurnStartSound,
  startRoundTimerSong,
  stopRoundTimerSong
} from "@/lib/sound";
import { HomeLink } from "@/components/shared/HomeLink";
import { LetterGrid } from "./LetterGrid";
import { LetterModal } from "./LetterModal";
import { TimerCard } from "./TimerCard";
import { AnswerForm } from "./AnswerForm";
import { Leaderboard } from "./Leaderboard";
import { TurnOrder } from "./TurnOrder";
import { ScoringPanel } from "./ScoringPanel";

function formatTimerDisplay(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return "--:--";
  const safe = Math.max(0, Math.floor(seconds));
  const mm = Math.floor(safe / 60).toString().padStart(2, "0");
  const ss = (safe % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

export function GameView({ roomCode }: { roomCode: string }) {
  const router = useRouter();
  const [session, setSession] = useState<RoomSession | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [roundAnswers, setRoundAnswers] = useState<RoundAnswerInput>(emptyAnswers());
  const [submitting, setSubmitting] = useState(false);
  const [callingNumber, setCallingNumber] = useState<number | null>(null);
  const [endingRound, setEndingRound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hostAction, setHostAction] = useState<string | null>(null);
  const draftSyncRef = useRef<number | null>(null);
  const previousRoundRef = useRef<number | null>(null);

  // Load session
  useEffect(() => {
    setSession(readSession(roomCode));
    setSessionLoaded(true);
  }, [roomCode]);

  const { state: roomState, connectedClients } = useRoomSocket({
    roomCode,
    participantId: session?.participantId,
    onEvent: (event) => {
      if (event.type === "turn_called") {
        setRoundAnswers(emptyAnswers());
        playTurnStartSound();
      }
      if (event.type === "submission_received") playSubmissionSound();
      if (event.type === "round_ended") {
        stopRoundTimerSong();
        playRoundEndSound();
        if (draftSyncRef.current !== null) {
          window.clearTimeout(draftSyncRef.current);
          draftSyncRef.current = null;
        }
        setRoundAnswers(emptyAnswers());
      }
      if (event.type === "game_started") playNotificationSound();
      if (event.type === "game_cancelled") {
        stopRoundTimerSong();
        playNotificationSound();
      }
      if (event.type === "game_ended") {
        stopRoundTimerSong();
        playNotificationSound();
      }
      if (event.type === "host_transferred" && event.hostToken && session) {
        const updated: RoomSession = { ...session, isHost: true, hostToken: event.hostToken };
        writeSession(roomCode, updated);
        setSession(updated);
      }
    }
  });

  // Derive game state
  const participantId = session?.participantId ?? null;
  const me = participantId ? roomState?.participants.find((p) => p.id === participantId) ?? null : null;
  const isAdmitted = me?.status === "ADMITTED";
  const isHost = !!me?.isHost;
  const activeRound = roomState?.game.activeRound ?? null;
  const completedRounds = roomState?.game.completedRounds ?? [];
  const unpublishedRounds = useMemo(
    () => completedRounds.filter((round) => !round.scorePublishedAt),
    [completedRounds]
  );
  const currentTurnParticipantId = roomState?.game.currentTurnParticipantId ?? null;
  const isMyTurn = !!participantId && participantId === currentTurnParticipantId;
  const alreadySubmitted =
    !!participantId && !!activeRound?.submissions.some((e) => e.participantId === participantId);

  const countdownEpoch = activeRound ? new Date(activeRound.countdownEndsAt).getTime() : null;
  const endsAtEpoch = activeRound?.endsAt ? new Date(activeRound.endsAt).getTime() : null;
  const letterPickDeadlineEpoch = roomState?.game.letterPickDeadline
    ? new Date(roomState.game.letterPickDeadline).getTime()
    : null;

  const needsTick =
    !!activeRound ||
    (letterPickDeadlineEpoch !== null && (activeRound === null || endsAtEpoch === null));
  const nowEpoch = useNowTick(needsTick);

  // Treat nowEpoch === 0 as "not yet mounted on client" — avoid all time-based UI
  // until we know the real client time to prevent SSG/hydration drift.
  const clientReady = nowEpoch > 0;
  const countdownSecondsLeft =
    clientReady && countdownEpoch !== null
      ? Math.max(0, Math.ceil((countdownEpoch - nowEpoch) / 1000))
      : null;
  const showLetterModal =
    clientReady && !!activeRound && countdownEpoch !== null && nowEpoch < countdownEpoch;
  const isRoundOpen =
    clientReady && !!activeRound && countdownEpoch !== null && nowEpoch >= countdownEpoch;
  const timerSecondsLeft =
    isRoundOpen && endsAtEpoch ? Math.max(0, Math.ceil((endsAtEpoch - nowEpoch) / 1000)) : null;
  const letterPickCountdown =
    clientReady && letterPickDeadlineEpoch !== null && !activeRound
      ? Math.max(0, Math.ceil((letterPickDeadlineEpoch - nowEpoch) / 1000))
      : null;

  const usedNumberSet = useMemo(
    () => new Set(roomState?.game.scoring.usedNumbers ?? []),
    [roomState?.game.scoring.usedNumbers]
  );

  const participantsById = useMemo(() => {
    const map = new Map<string, NonNullable<typeof me>>();
    for (const p of roomState?.participants ?? []) {
      map.set(p.id, p);
    }
    return map;
  }, [roomState?.participants]);

  // Ambient timer song
  useEffect(() => {
    if (activeRound && activeRound.endsAt && isRoundOpen) {
      startRoundTimerSong();
    } else {
      stopRoundTimerSong();
    }
    return () => {
      stopRoundTimerSong();
    };
  }, [activeRound, isRoundOpen]);

  // Load draft for new rounds
  useEffect(() => {
    if (!activeRound || !participantId) return;
    const roundNumber = activeRound.roundNumber;

    if (previousRoundRef.current !== null && previousRoundRef.current !== roundNumber) {
      clearDraft(roomCode, participantId, previousRoundRef.current);
    }
    previousRoundRef.current = roundNumber;

    if (alreadySubmitted) return;

    const restored = readDraft(roomCode, participantId, roundNumber);
    if (restored) {
      setRoundAnswers({
        name: restored.name ?? "",
        animal: restored.animal ?? "",
        place: restored.place ?? "",
        thing: restored.thing ?? "",
        food: restored.food ?? ""
      });
    }
  }, [activeRound, alreadySubmitted, participantId, roomCode]);

  // Auto-save draft + debounced server sync
  useEffect(() => {
    if (!activeRound || !participantId || alreadySubmitted || !isRoundOpen) return;

    writeDraft(roomCode, participantId, activeRound.roundNumber, roundAnswers);

    if (draftSyncRef.current !== null) {
      window.clearTimeout(draftSyncRef.current);
    }

    // Urgent flush near timer end
    const urgent =
      endsAtEpoch !== null && endsAtEpoch - Date.now() < 3000;
    const delay = urgent ? 0 : 280;

    draftSyncRef.current = window.setTimeout(() => {
      void api.updateRoundDraft(roomCode, participantId, roundAnswers).catch(() => {});
      draftSyncRef.current = null;
    }, delay);

    return () => {
      if (draftSyncRef.current !== null) {
        window.clearTimeout(draftSyncRef.current);
        draftSyncRef.current = null;
      }
    };
  }, [roundAnswers, activeRound, participantId, roomCode, alreadySubmitted, isRoundOpen, endsAtEpoch]);

  const onAnswerChange = (field: RoundField, value: string) => {
    setRoundAnswers((prev) => ({ ...prev, [field]: value }));
  };

  const onCallLetter = async (number: number) => {
    if (!participantId) return;
    setCallingNumber(number);
    setError(null);
    try {
      await api.callTurnNumber(roomCode, participantId, number);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t call that letter.");
    } finally {
      setCallingNumber(null);
    }
  };

  const onSubmitRound = async () => {
    if (!participantId) return;
    setSubmitting(true);
    setError(null);
    if (activeRound) {
      writeDraft(roomCode, participantId, activeRound.roundNumber, roundAnswers);
    }
    try {
      if (draftSyncRef.current !== null) {
        window.clearTimeout(draftSyncRef.current);
        draftSyncRef.current = null;
      }
      await api.submitRoundAnswers(roomCode, participantId, roundAnswers);
      if (activeRound) clearDraft(roomCode, participantId, activeRound.roundNumber);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t submit your answers.");
    } finally {
      setSubmitting(false);
    }
  };

  const onEndRoundEarly = async () => {
    if (!participantId) return;
    setEndingRound(true);
    setError(null);
    try {
      await api.endRoundNow(roomCode, participantId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t end the round.");
    } finally {
      setEndingRound(false);
    }
  };

  const onMarkSubmission = async (roundNumber: number, targetId: string, marks: RoundMarks) => {
    if (!session?.hostToken) return;
    await api.scoreRoundSubmission(roomCode, session.hostToken, roundNumber, targetId, marks);
  };

  const onPublishRound = async (roundNumber: number) => {
    if (!session?.hostToken) return;
    await api.publishRoundScores(roomCode, session.hostToken, roundNumber);
  };

  const onDiscardRound = async (roundNumber: number) => {
    if (!session?.hostToken) return;
    await api.discardRoundScores(roomCode, session.hostToken, roundNumber);
  };

  const onEndGame = async () => {
    if (!session?.hostToken) return;
    if (!confirm("End the game now? This finalizes all scores.")) return;
    setHostAction("end-game");
    setError(null);
    try {
      await api.endGameRoom(roomCode, session.hostToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t end the game.");
    } finally {
      setHostAction(null);
    }
  };

  const canSubmit =
    !!activeRound &&
    isAdmitted &&
    isRoundOpen &&
    !alreadySubmitted &&
    !submitting &&
    roomState?.game.status === "IN_PROGRESS";

  const canCallLetter =
    !!roomState &&
    roomState.game.status === "IN_PROGRESS" &&
    !activeRound &&
    unpublishedRounds.length === 0 &&
    isMyTurn &&
    isAdmitted &&
    callingNumber === null &&
    !roomState.game.scoring.isComplete;

  const canEndEarly =
    !!activeRound &&
    !!participantId &&
    isAdmitted &&
    !endingRound &&
    (() => {
      const policy = roomState?.game.config.manualEndPolicy ?? "HOST_OR_CALLER";
      const isCaller = participantId === activeRound.turnParticipantId;
      if (policy === "HOST_OR_CALLER") return isHost || isCaller;
      if (policy === "CALLER_ONLY" || policy === "CALLER_OR_TIMER") return isCaller;
      return false;
    })();

  // Early exits
  if (sessionLoaded && !session) {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-4 px-6 py-12 text-center">
        <HomeLink />
        <div className="card-glow p-8">
          <h1 className="text-2xl font-bold">Not in this room</h1>
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            You need a session for this room. Rejoin via the invite link.
          </p>
          <Link href={`/join?code=${roomCode}`} className="btn-primary mt-6 inline-flex">
            Go to join page
          </Link>
        </div>
      </main>
    );
  }

  if (!roomState) {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl items-center justify-center px-6 py-12">
        <p className="text-sm text-[var(--color-muted)]">Connecting to game…</p>
      </main>
    );
  }

  const { game } = roomState;
  const timerUrgency: "normal" | "warning" | "danger" =
    activeRound?.endsAt && !showLetterModal && isRoundOpen && (timerSecondsLeft ?? 999) <= 5
      ? "danger"
      : activeRound?.endsAt && !showLetterModal && isRoundOpen && (timerSecondsLeft ?? 999) <= 10
      ? "warning"
      : "normal";

  const sidebarTimer = (() => {
    if (!activeRound) {
      if (letterPickCountdown !== null && letterPickCountdown > 0) {
        return {
          label: "Auto-pick in",
          value: formatTimerDisplay(letterPickCountdown),
          hint: "Waiting for caller"
        };
      }
      return {
        label: "Round timer",
        value: "--:--",
        hint: "Waiting for next letter"
      };
    }
    if (showLetterModal) {
      return {
        label: "Starting in",
        value: formatTimerDisplay(countdownSecondsLeft),
        hint: `R${activeRound.roundNumber} · Letter ${activeRound.activeLetter}`
      };
    }
    if (activeRound.endsAt) {
      return {
        label: "Time left",
        value: formatTimerDisplay(timerSecondsLeft),
        hint: `R${activeRound.roundNumber} · Letter ${activeRound.activeLetter}`
      };
    }
    return {
      label: "No timer",
      value: "∞",
      hint: `R${activeRound.roundNumber} · Letter ${activeRound.activeLetter}`
    };
  })();

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <HomeLink />

        <header className="card-glow flex flex-wrap items-start justify-between gap-4 p-5 sm:p-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-muted)]">
              Game · {connectedClients} connected
            </p>
            <h1 className="gradient-title text-3xl font-extrabold sm:text-4xl">Room {roomCode}</h1>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              {game.status === "LOBBY"
                ? "Waiting for host to start."
                : game.status === "CANCELLED"
                ? "Room closed by host."
                : game.status === "FINISHED"
                ? "Game over. Final scores below."
                : "Letters A–Z · Race the clock"}
            </p>
          </div>
          {isHost && game.status === "IN_PROGRESS" ? (
            <button onClick={onEndGame} className="btn-secondary" disabled={hostAction === "end-game"}>
              {hostAction === "end-game" ? "Ending…" : "End game"}
            </button>
          ) : null}
        </header>

        {error ? (
          <p className="rounded-2xl border border-[rgba(255,114,114,0.3)] bg-[rgba(255,114,114,0.08)] px-4 py-3 text-sm text-[var(--color-danger)]">
            {error}
          </p>
        ) : null}

        {game.status === "LOBBY" ? (
          <section className="card-glow flex flex-col items-center gap-4 p-10 text-center sm:p-12">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-[rgba(70,236,19,0.35)] bg-[rgba(70,236,19,0.08)]">
              <div
                className="h-3 w-3 animate-pulse rounded-full bg-[var(--color-primary)]"
                style={{ boxShadow: "0 0 12px rgba(70,236,19,0.6)" }}
              />
            </div>
            <div>
              <h2 className="text-xl font-bold sm:text-2xl">Waiting for the host to start…</h2>
              <p className="mt-2 text-sm text-[var(--color-muted)]">
                You&apos;re in the room as <strong className="text-[var(--color-ink)]">{me?.name ?? session?.participantName}</strong>.
                The game will begin when the host clicks start.
              </p>
            </div>
            <div className="mt-2 w-full max-w-sm">
              <p className="mb-2 text-xs font-bold uppercase tracking-widest text-[var(--color-muted)]">
                Players in room ({roomState.counts.admitted}/{roomState.meta.maxParticipants})
              </p>
              <ul className="flex flex-col gap-1.5">
                {roomState.participants
                  .filter((p) => p.status === "ADMITTED")
                  .map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm"
                    >
                      <span className="font-semibold">{p.name}</span>
                      {p.isHost ? (
                        <span className="rounded-full border border-[rgba(70,236,19,0.4)] bg-[rgba(70,236,19,0.1)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--color-primary)]">
                          Host
                        </span>
                      ) : p.id === participantId ? (
                        <span className="text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
                          you
                        </span>
                      ) : null}
                    </li>
                  ))}
              </ul>
            </div>
          </section>
        ) : null}

        {game.status === "CANCELLED" ? (
          <section className="card-glow p-10 text-center">
            <h2 className="text-xl font-bold">The host has closed this room.</h2>
            <p className="mt-2 text-sm text-[var(--color-muted)]">
              The invite link is no longer valid. Head home to start a new game.
            </p>
          </section>
        ) : null}

        {game.status === "IN_PROGRESS" || game.status === "FINISHED" ? (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <section className="flex flex-col gap-5">
              <TimerCard
                label={sidebarTimer.label}
                value={sidebarTimer.value}
                hint={sidebarTimer.hint}
                urgency={timerUrgency}
              />

              {game.status === "IN_PROGRESS" && !activeRound && unpublishedRounds.length === 0 ? (
                <div className="card-glow p-5">
                  <h2 className="mb-2 text-lg font-bold">
                    {isMyTurn ? "Your turn — pick a letter" : `Waiting for ${participantsById.get(currentTurnParticipantId ?? "")?.name ?? "caller"} to pick a letter`}
                  </h2>
                  <LetterGrid
                    usedNumbers={usedNumberSet}
                    canCall={canCallLetter}
                    onCall={onCallLetter}
                    callingNumber={callingNumber}
                  />
                </div>
              ) : null}

              {activeRound && isRoundOpen && isAdmitted ? (
                <div className="card-glow p-5">
                  <AnswerForm
                    letter={activeRound.activeLetter}
                    answers={roundAnswers}
                    onAnswerChange={onAnswerChange}
                    disabled={!isRoundOpen || submitting}
                    submitting={submitting}
                    alreadySubmitted={alreadySubmitted}
                    canSubmit={!!canSubmit}
                    onSubmit={onSubmitRound}
                  />
                  {canEndEarly ? (
                    <div className="mt-3 flex justify-end">
                      <button onClick={onEndRoundEarly} className="btn-secondary text-sm" disabled={endingRound}>
                        {endingRound ? "Ending round…" : "End round now"}
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {isHost && unpublishedRounds.length > 0 ? (
                <div className="flex flex-col gap-4">
                  {unpublishedRounds.map((round) => (
                    <ScoringPanel
                      key={round.roundNumber}
                      round={round}
                      onMark={onMarkSubmission}
                      onPublish={onPublishRound}
                      onDiscard={onDiscardRound}
                    />
                  ))}
                </div>
              ) : null}

              {!isHost && unpublishedRounds.length > 0 ? (
                <div className="card-glow p-5 text-center">
                  <p className="text-sm font-semibold">Host is scoring the round…</p>
                  <p className="mt-1 text-xs text-[var(--color-muted)]">
                    Scores will publish shortly.
                  </p>
                </div>
              ) : null}

              <div className="card-glow p-4 text-xs text-[var(--color-muted)]">
                <p className="mb-2 font-bold uppercase tracking-widest">Game settings</p>
                <div className="grid gap-1 sm:grid-cols-2">
                  <span>
                    Round end:{" "}
                    <strong className="text-[var(--color-ink)]">
                      {game.config.endRule === "FIRST_SUBMISSION"
                        ? "No timer — submit to end"
                        : game.config.manualEndPolicy === "NONE"
                        ? "Timer only"
                        : game.config.manualEndPolicy === "CALLER_OR_TIMER" || game.config.manualEndPolicy === "CALLER_ONLY"
                        ? "Caller or timer"
                        : "Host or timer"}
                    </strong>
                  </span>
                  {game.config.endRule !== "FIRST_SUBMISSION" ? (
                    <span>
                      Round timer:{" "}
                      <strong className="text-[var(--color-ink)]">{game.config.roundSeconds}s</strong>
                    </span>
                  ) : null}
                  <span>
                    Scoring:{" "}
                    <strong className="text-[var(--color-ink)]">
                      {game.config.scoringMode === "SHARED_10" ? "Shared 10" : "Fixed 10/0"}
                    </strong>
                  </span>
                  <span>
                    Letter pick:{" "}
                    <strong className="text-[var(--color-ink)]">
                      {game.config.letterPickSeconds ? `Auto ${game.config.letterPickSeconds}s` : "Manual"}
                    </strong>
                  </span>
                </div>
              </div>
            </section>

            <aside className="flex flex-col gap-5">
              <div className="card-glow p-5">
                <h2 className="mb-3 text-lg font-bold">Leaderboard</h2>
                <Leaderboard scoring={game.scoring} currentParticipantId={participantId} />
              </div>

              <div className="card-glow p-5">
                <TurnOrder
                  turnOrder={game.turnOrder}
                  currentTurnParticipantId={currentTurnParticipantId}
                  participantsById={participantsById}
                  currentParticipantId={participantId}
                  letterPickCountdown={letterPickCountdown}
                  gameStatus={game.status}
                />
              </div>
            </aside>
          </div>
        ) : null}

        {showLetterModal && activeRound ? (
          <LetterModal
            letter={activeRound.activeLetter}
            countdownSecondsLeft={countdownSecondsLeft ?? 0}
          />
        ) : null}
      </div>
    </main>
  );
}
