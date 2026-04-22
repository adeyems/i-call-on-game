"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api } from "@/lib/api";
import { writeSession } from "@/lib/session";

export function CreateRoomCard() {
  const router = useRouter();
  const [hostName, setHostName] = useState("");
  const [maxParticipants, setMaxParticipants] = useState(10);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = hostName.trim();
    if (trimmed.length < 2) {
      setError("Please enter a name (at least 2 characters).");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const room = await api.createRoom(trimmed, maxParticipants);
      writeSession(room.roomCode, {
        participantId: "host",
        participantName: room.hostName,
        isHost: true,
        hostToken: room.hostToken
      });
      router.push(`/lobby?code=${room.roomCode}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create room. Please try again.");
      setSubmitting(false);
    }
  };

  return (
    <section className="card-glow p-6 sm:p-8">
      <h2 className="text-2xl font-bold sm:text-3xl">Create a room</h2>
      <p className="mt-1 text-sm text-[var(--color-muted)]">
        Host a new game and share the link with your friends.
      </p>

      <form onSubmit={onSubmit} className="mt-6 grid gap-4">
        <div className="grid gap-1.5">
          <label htmlFor="hostName" className="text-sm font-semibold text-[#d7e6df]">
            Your name
          </label>
          <input
            id="hostName"
            className="input"
            value={hostName}
            onChange={(event) => setHostName(event.target.value)}
            placeholder="e.g. Qudus"
            minLength={2}
            maxLength={24}
            required
            autoComplete="off"
          />
        </div>

        <div className="grid gap-1.5">
          <label htmlFor="maxParticipants" className="text-sm font-semibold text-[#d7e6df]">
            Max players (including host):{" "}
            <span className="font-bold text-[var(--color-primary)]">{maxParticipants}</span>
          </label>
          <input
            id="maxParticipants"
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

        {error ? (
          <p className="rounded-xl border border-[rgba(255,114,114,0.3)] bg-[rgba(255,114,114,0.08)] px-3 py-2 text-sm text-[var(--color-danger)]">
            {error}
          </p>
        ) : null}

        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? "Creating room…" : "Create room →"}
        </button>
      </form>
    </section>
  );
}
