"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api } from "@/lib/api";
import { writeSession } from "@/lib/session";

type Mode = "create" | "join";

export function EntryCard() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("create");
  const [name, setName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [maxParticipants, setMaxParticipants] = useState(10);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (trimmedName.length < 2) {
      setError("Please enter a name (at least 2 characters).");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      if (mode === "create") {
        const room = await api.createRoom(trimmedName, maxParticipants);
        writeSession(room.roomCode, {
          participantId: "host",
          participantName: room.hostName,
          isHost: true,
          hostToken: room.hostToken
        });
        router.push(`/lobby?code=${room.roomCode}`);
      } else {
        const trimmedCode = roomCode.trim().toUpperCase();
        if (trimmedCode.length < 4) {
          setError("Enter the room code your host shared with you.");
          setSubmitting(false);
          return;
        }
        router.push(`/join?code=${trimmedCode}&name=${encodeURIComponent(trimmedName)}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setSubmitting(false);
    }
  };

  const switchMode = (next: Mode) => {
    if (next === mode) return;
    setMode(next);
    setError(null);
  };

  return (
    <section className="card-glow p-6 sm:p-7">
      <div
        role="tablist"
        aria-label="Create or join a room"
        className="mb-5 flex rounded-xl border border-white/10 bg-white/[0.03] p-1"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mode === "create"}
          onClick={() => switchMode("create")}
          className={[
            "flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-all",
            mode === "create"
              ? "bg-[linear-gradient(140deg,var(--color-primary),var(--color-primary-dark))] text-[#0d170d] shadow-[0_0_16px_rgba(70,236,19,0.2)]"
              : "text-[#9fb3a7] hover:text-[#deebe5]"
          ].join(" ")}
        >
          Create room
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "join"}
          onClick={() => switchMode("join")}
          className={[
            "flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-all",
            mode === "join"
              ? "bg-[linear-gradient(140deg,var(--color-primary),var(--color-primary-dark))] text-[#0d170d] shadow-[0_0_16px_rgba(70,236,19,0.2)]"
              : "text-[#9fb3a7] hover:text-[#deebe5]"
          ].join(" ")}
        >
          Join room
        </button>
      </div>

      <form onSubmit={onSubmit} className="grid gap-4">
        <div className="grid gap-1.5">
          <label htmlFor="entry-name" className="text-sm font-semibold text-[#d7e6df]">
            Your name
          </label>
          <input
            id="entry-name"
            className="input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Ade"
            minLength={2}
            maxLength={24}
            required
            autoComplete="off"
          />
        </div>

        {mode === "join" ? (
          <div className="grid gap-1.5">
            <label htmlFor="entry-code" className="text-sm font-semibold text-[#d7e6df]">
              Room code
            </label>
            <input
              id="entry-code"
              className="input text-center font-mono text-xl uppercase tracking-[0.3em]"
              value={roomCode}
              onChange={(event) => setRoomCode(event.target.value.toUpperCase().replace(/\s+/g, ""))}
              placeholder="ABC123"
              maxLength={10}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
            />
            <p className="text-xs text-[var(--color-muted)]">
              Paste the code your host shared with you.
            </p>
          </div>
        ) : (
          <div className="grid gap-1.5">
            <label htmlFor="entry-max" className="text-sm font-semibold text-[#d7e6df]">
              Max players:{" "}
              <span className="font-bold text-[var(--color-primary)]">{maxParticipants}</span>
            </label>
            <input
              id="entry-max"
              type="range"
              min={2}
              max={10}
              value={maxParticipants}
              onChange={(event) => setMaxParticipants(Number(event.target.value))}
              className="accent-[var(--color-primary)]"
            />
            <div className="flex justify-between text-xs text-[var(--color-muted)]">
              <span>2</span>
              <span>10</span>
            </div>
          </div>
        )}

        {error ? (
          <p className="rounded-xl border border-[rgba(255,114,114,0.3)] bg-[rgba(255,114,114,0.08)] px-3 py-2 text-sm text-[var(--color-danger)]">
            {error}
          </p>
        ) : null}

        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting
            ? mode === "create"
              ? "Creating room…"
              : "Joining…"
            : mode === "create"
            ? "Create room →"
            : "Join room →"}
        </button>
      </form>
    </section>
  );
}
