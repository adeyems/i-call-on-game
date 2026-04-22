"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { ManualEndPolicy, RoomParticipant, RoundEndRule, ScoringMode } from "@i-call-on/shared";
import { api } from "@/lib/api";
import { clearSession, readSession, writeSession, type RoomSession } from "@/lib/session";
import { useRoomSocket } from "@/lib/useRoomSocket";
import { PendingList } from "./PendingList";
import { AdmittedList } from "./AdmittedList";
import { RoundSettings, type RoundEndPreset } from "./RoundSettings";
import { HomeLink } from "@/components/shared/HomeLink";

function manualPolicyFromPreset(preset: RoundEndPreset): ManualEndPolicy {
  if (preset === "CALLER_OR_TIMER") return "CALLER_OR_TIMER";
  if (preset === "TIMER_ONLY") return "NONE";
  return "HOST_OR_CALLER";
}

function endRuleFromPreset(preset: RoundEndPreset): RoundEndRule {
  return preset === "NO_TIMER" ? "FIRST_SUBMISSION" : "TIMER";
}

export function LobbyView({ roomCode }: { roomCode: string }) {
  const router = useRouter();
  const [session, setSession] = useState<RoomSession | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Round settings
  const [roundSeconds, setRoundSeconds] = useState(20);
  const [roundEndPreset, setRoundEndPreset] = useState<RoundEndPreset>("HOST_OR_TIMER");
  const [scoringMode, setScoringMode] = useState<ScoringMode>("FIXED_10");
  const [letterPickEnabled, setLetterPickEnabled] = useState(false);
  const [letterPickSeconds, setLetterPickSeconds] = useState(15);

  useEffect(() => {
    const loaded = readSession(roomCode);
    setSession(loaded);
    setSessionLoaded(true);
  }, [roomCode]);

  const { state: roomState, connectedClients } = useRoomSocket({
    roomCode,
    participantId: session?.participantId
  });

  // Navigate away when game starts (hosts stay, participants move to /game/[code])
  useEffect(() => {
    if (!roomState || !session) return;
    if (roomState.game.status === "IN_PROGRESS") {
      router.push(`/game?code=${roomCode}`);
    }
  }, [roomState, session, router, roomCode]);

  const joinUrl = useMemo(
    () => (typeof window !== "undefined" ? `${window.location.origin}/join?code=${roomCode}` : ""),
    [roomCode]
  );

  const pendingParticipants = useMemo<RoomParticipant[]>(
    () => roomState?.participants.filter((p) => p.status === "PENDING") ?? [],
    [roomState]
  );
  const admittedParticipants = useMemo<RoomParticipant[]>(
    () =>
      roomState?.participants.filter((p) => p.status === "ADMITTED" && !p.isHost) ?? [],
    [roomState]
  );

  const canStart =
    !!roomState &&
    roomState.game.status === "LOBBY" &&
    pendingParticipants.length === 0 &&
    roomState.counts.admitted >= 2;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setError("Couldn’t copy the link. Select and copy it manually.");
    }
  };

  const review = async (requestId: string, approve: boolean) => {
    if (!session?.hostToken) return;
    const key = `${requestId}:${approve ? "approve" : "reject"}`;
    setAction(key);
    setError(null);
    try {
      await api.reviewJoinRequest(roomCode, session.hostToken, requestId, approve);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setAction(null);
    }
  };

  const remove = async (participantId: string) => {
    if (!session?.hostToken) return;
    const key = `${participantId}:remove`;
    setAction(key);
    setError(null);
    try {
      await api.removeParticipant(roomCode, session.hostToken, participantId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t remove the player.");
    } finally {
      setAction(null);
    }
  };

  const startGame = async () => {
    if (!session?.hostToken) return;
    setAction("start");
    setError(null);
    try {
      await api.startGame(roomCode, session.hostToken, {
        roundSeconds,
        endRule: endRuleFromPreset(roundEndPreset),
        manualEndPolicy: manualPolicyFromPreset(roundEndPreset),
        scoringMode,
        letterPickSeconds: letterPickEnabled ? letterPickSeconds : null
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t start the game.");
      setAction(null);
    }
  };

  const cancelGame = async () => {
    if (!session?.hostToken) return;
    setAction("cancel");
    setError(null);
    try {
      await api.cancelGameRoom(roomCode, session.hostToken);
      clearSession(roomCode);
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t close the room.");
      setAction(null);
    }
  };

  // Not a host → redirect home
  if (sessionLoaded && (!session || !session.isHost)) {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-4 px-6 py-12 text-center">
        <HomeLink />
        <div className="card-glow p-8">
          <h1 className="text-2xl font-bold">Not your room</h1>
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            You need to be the host to manage this lobby. If you were invited, join via the link your
            host shared.
          </p>
          <Link href="/" className="btn-primary mt-6 inline-flex">
            Back to home
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <HomeLink />

        <section className="card-glow p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-muted)]">
                Lobby · {connectedClients} connected
              </p>
              <h1 className="gradient-title mt-1 text-3xl font-extrabold sm:text-4xl">
                Room {roomCode}
              </h1>
              <p className="mt-1 text-sm text-[var(--color-muted)]">
                Share the link below so players can join. Start when everyone’s in.
              </p>
            </div>
            <button onClick={copyLink} className="btn-secondary">
              {copied ? "✓ Copied" : "Copy invite link"}
            </button>
          </div>

          <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-mono text-sm text-[#bbf3a9]">
            <span className="text-[var(--color-muted)]">{joinUrl.split(roomCode)[0]}</span>
            <span className="font-bold text-[var(--color-primary)]">{roomCode}</span>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="flex flex-col gap-6">
            <PendingList
              participants={pendingParticipants}
              actionKey={action}
              onReview={review}
            />
            <AdmittedList
              participants={admittedParticipants}
              hostName={roomState?.meta.hostName ?? session?.participantName ?? "Host"}
              maxPlayers={roomState?.meta.maxParticipants ?? 10}
              actionKey={action}
              onRemove={remove}
            />
          </div>

          <aside className="flex flex-col gap-6">
            <RoundSettings
              roundSeconds={roundSeconds}
              onRoundSecondsChange={setRoundSeconds}
              preset={roundEndPreset}
              onPresetChange={setRoundEndPreset}
              scoringMode={scoringMode}
              onScoringModeChange={setScoringMode}
              letterPickEnabled={letterPickEnabled}
              onLetterPickEnabledChange={setLetterPickEnabled}
              letterPickSeconds={letterPickSeconds}
              onLetterPickSecondsChange={setLetterPickSeconds}
            />

            <section className="card-glow p-6">
              {error ? (
                <p className="mb-3 rounded-xl border border-[rgba(255,114,114,0.3)] bg-[rgba(255,114,114,0.08)] px-3 py-2 text-sm text-[var(--color-danger)]">
                  {error}
                </p>
              ) : null}

              <button
                onClick={startGame}
                className="btn-primary w-full"
                disabled={!canStart || action === "start"}
              >
                {action === "start" ? "Starting…" : "Start game"}
              </button>
              {roomState && roomState.counts.admitted < 2 ? (
                <p className="mt-2 text-xs text-[var(--color-muted)]">
                  Need at least 2 players to start.
                </p>
              ) : null}
              {pendingParticipants.length > 0 ? (
                <p className="mt-2 text-xs text-[var(--color-muted)]">
                  Review pending join requests first.
                </p>
              ) : null}

              <button
                onClick={cancelGame}
                className="btn-secondary mt-3 w-full"
                disabled={action === "cancel"}
              >
                {action === "cancel" ? "Closing…" : "Close room"}
              </button>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
