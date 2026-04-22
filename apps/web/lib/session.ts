"use client";

export type RoomSession = {
  participantId: string;
  participantName: string;
  isHost: boolean;
  hostToken?: string;
};

const SESSION_PREFIX = "i-call-on:session:";
const DRAFT_PREFIX = "i-call-on:draft:";

function key(roomCode: string) {
  return `${SESSION_PREFIX}${roomCode.toUpperCase()}`;
}

export function readSession(roomCode: string): RoomSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key(roomCode));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RoomSession>;
    if (!parsed.participantId || !parsed.participantName || typeof parsed.isHost !== "boolean") {
      return null;
    }
    return {
      participantId: parsed.participantId,
      participantName: parsed.participantName,
      isHost: parsed.isHost,
      hostToken: parsed.hostToken
    };
  } catch {
    return null;
  }
}

export function writeSession(roomCode: string, session: RoomSession): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key(roomCode), JSON.stringify(session));
  } catch {
    /* ignore */
  }
}

export function clearSession(roomCode: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key(roomCode));
  } catch {
    /* ignore */
  }
}

function draftKey(roomCode: string, participantId: string, roundNumber: number) {
  return `${DRAFT_PREFIX}${roomCode.toUpperCase()}:${participantId}:${roundNumber}`;
}

export function readDraft(roomCode: string, participantId: string, roundNumber: number) {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(draftKey(roomCode, participantId, roundNumber));
    return raw ? (JSON.parse(raw) as Record<string, string>) : null;
  } catch {
    return null;
  }
}

export function writeDraft(
  roomCode: string,
  participantId: string,
  roundNumber: number,
  answers: Record<string, string>
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(draftKey(roomCode, participantId, roundNumber), JSON.stringify(answers));
  } catch {
    /* ignore */
  }
}

export function clearDraft(roomCode: string, participantId: string, roundNumber: number): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(draftKey(roomCode, participantId, roundNumber));
  } catch {
    /* ignore */
  }
}
