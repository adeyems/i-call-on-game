"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { api } from "@/lib/api";
import { writeSession } from "@/lib/session";
import { useRoomSocket } from "@/lib/useRoomSocket";
import { HomeLink } from "@/components/shared/HomeLink";
import { HowToPlay } from "@/components/home/HowToPlay";

type PageState =
  | { kind: "loading" }
  | { kind: "form" }
  | { kind: "waiting"; requestId: string }
  | { kind: "error"; message: string };

export function JoinView({ roomCode, initialName = "" }: { roomCode: string; initialName?: string }) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [submitting, setSubmitting] = useState(false);
  const [pageState, setPageState] = useState<PageState>({ kind: "loading" });
  const requestIdRef = useRef<string | null>(null);
  const autoSubmittedRef = useRef(false);

  const { state: roomState, connectedClients } = useRoomSocket({
    roomCode,
    onEvent: (event) => {
      if (event.type === "admission_update" && requestIdRef.current === event.participant.id) {
        if (event.participant.status === "ADMITTED") {
          writeSession(roomCode, {
            participantId: event.participant.id,
            participantName: event.participant.name,
            isHost: false
          });
          router.push(`/game?code=${roomCode}`);
        } else if (event.participant.status === "REJECTED") {
          requestIdRef.current = null;
          setPageState({
            kind: "error",
            message: "The host declined your request. Try again with a different name or room."
          });
        }
      }

      if (
        event.type === "participant_removed" &&
        requestIdRef.current === event.participant.id
      ) {
        requestIdRef.current = null;
        setPageState({
          kind: "error",
          message: "You were removed from the room by the host."
        });
      }

      if (event.type === "game_cancelled") {
        setPageState({
          kind: "error",
          message: "The host has closed this room."
        });
      }

      if (event.type === "game_ended") {
        setPageState({
          kind: "error",
          message: "This game has already ended."
        });
      }
    }
  });

  // Once we have room state, decide form state
  useEffect(() => {
    if (!roomState) return;
    if (pageState.kind === "waiting" || pageState.kind === "error") return;
    if (roomState.game.status === "IN_PROGRESS") {
      setPageState({
        kind: "error",
        message: "This game is already in progress. Ask the host for the next game!"
      });
    } else if (roomState.game.status === "FINISHED") {
      setPageState({ kind: "error", message: "This game has already ended." });
    } else if (roomState.game.status === "CANCELLED") {
      setPageState({ kind: "error", message: "This room has been closed by the host." });
    } else {
      setPageState({ kind: "form" });
    }
  }, [roomState, pageState.kind]);

  const submitJoin = async (candidateName: string) => {
    const trimmed = candidateName.trim();
    if (trimmed.length < 2) {
      setPageState({ kind: "error", message: "Please enter a name (at least 2 characters)." });
      return;
    }

    setSubmitting(true);

    try {
      const response = await api.submitJoinRequest(roomCode, trimmed);
      requestIdRef.current = response.requestId;
      setPageState({ kind: "waiting", requestId: response.requestId });
    } catch (err) {
      setPageState({
        kind: "error",
        message: err instanceof Error ? err.message : "Couldn’t submit your request."
      });
    } finally {
      setSubmitting(false);
    }
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await submitJoin(name);
  };

  // Auto-submit when arriving from home with a name pre-filled.
  useEffect(() => {
    if (
      pageState.kind === "form" &&
      initialName.trim().length >= 2 &&
      !autoSubmittedRef.current &&
      !submitting
    ) {
      autoSubmittedRef.current = true;
      void submitJoin(initialName);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageState.kind]);

  const resetToForm = () => {
    requestIdRef.current = null;
    setPageState({ kind: "form" });
  };

  return (
    <main className="min-h-screen px-4 py-10 sm:py-14">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
        <HomeLink />

        <section className="card-glow p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-muted)]">
            Room code
          </p>
          <h1 className="gradient-title mt-1 text-4xl font-extrabold sm:text-5xl">{roomCode}</h1>

          {roomState ? (
            <p className="mt-2 text-sm text-[var(--color-muted)]">
              Host: <strong className="text-[var(--color-ink)]">{roomState.meta.hostName}</strong> ·{" "}
              {roomState.counts.admitted}/{roomState.meta.maxParticipants} players ·{" "}
              {connectedClients} connected
            </p>
          ) : null}

          <div className="mt-6">
            {pageState.kind === "loading" ? (
              <p className="text-sm text-[var(--color-muted)]">Loading room…</p>
            ) : null}

            {pageState.kind === "form" ? (
              <form onSubmit={onSubmit} className="grid gap-4">
                <div className="grid gap-1.5">
                  <label htmlFor="participant-name" className="text-sm font-semibold text-[#d7e6df]">
                    Your name
                  </label>
                  <input
                    id="participant-name"
                    className="input"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="e.g. Ade"
                    minLength={2}
                    maxLength={24}
                    required
                    autoComplete="off"
                    autoFocus
                  />
                </div>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? "Requesting…" : "Request to join →"}
                </button>
              </form>
            ) : null}

            {pageState.kind === "waiting" ? (
              <div className="rounded-2xl border border-[rgba(70,236,19,0.3)] bg-[rgba(70,236,19,0.05)] p-5 text-center">
                <p className="text-base font-bold text-[var(--color-primary)]">
                  Request sent ✓
                </p>
                <p className="mt-1 text-sm text-[var(--color-muted)]">
                  Waiting for the host to admit you…
                </p>
                <div className="mx-auto mt-3 h-1 w-24 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full w-1/3 animate-pulse rounded-full bg-[var(--color-primary)]" />
                </div>
              </div>
            ) : null}

            {pageState.kind === "error" ? (
              <div className="flex flex-col gap-4">
                <p className="rounded-2xl border border-[rgba(255,114,114,0.3)] bg-[rgba(255,114,114,0.08)] px-4 py-3 text-sm text-[var(--color-danger)]">
                  {pageState.message}
                </p>
                <button onClick={resetToForm} className="btn-secondary w-fit">
                  Try again
                </button>
              </div>
            ) : null}
          </div>
        </section>

        <HowToPlay />
      </div>
    </main>
  );
}
