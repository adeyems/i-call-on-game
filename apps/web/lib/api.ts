import type {
  CreateRoomResponse,
  JoinRoomResponse,
  ManualEndPolicy,
  RoomStateResponse,
  RoundAnswerInput,
  RoundEndRule,
  RoundMarks,
  ScoringMode
} from "@i-call-on/shared";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api.icallon.cardgamelobby.com";

async function parseError(response: Response): Promise<string> {
  const payload = (await response.json().catch(() => null)) as { error?: string } | null;
  return payload?.error ?? "Something went wrong. Please try again.";
}

export function roomWebSocketUrl(roomCode: string, participantId?: string): string {
  const url = new URL(API_BASE_URL);
  const protocol = url.protocol === "https:" ? "wss:" : "ws:";
  const normalized = roomCode.trim().toUpperCase();
  const pid = participantId ? `?pid=${encodeURIComponent(participantId)}` : "";
  return `${protocol}//${url.host}/ws/${normalized}${pid}`;
}

export function connectRoomSocket(roomCode: string, participantId?: string): WebSocket {
  return new WebSocket(roomWebSocketUrl(roomCode, participantId));
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) throw new Error(await parseError(response));
  return (await response.json()) as T;
}

async function get<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`);
  if (!response.ok) throw new Error(await parseError(response));
  return (await response.json()) as T;
}

export const api = {
  createRoom: (hostName: string, maxParticipants: number) =>
    post<CreateRoomResponse>("/api/rooms", { hostName, maxParticipants }),

  getRoomState: (roomCode: string) =>
    get<RoomStateResponse>(`/api/rooms/${roomCode.trim().toUpperCase()}`),

  submitJoinRequest: (roomCode: string, name: string) =>
    post<JoinRoomResponse>(`/api/rooms/${roomCode.trim().toUpperCase()}/join`, { name }),

  reviewJoinRequest: (roomCode: string, hostToken: string, requestId: string, approve: boolean) =>
    post<RoomStateResponse>(`/api/rooms/${roomCode.trim().toUpperCase()}/admissions`, {
      hostToken,
      requestId,
      approve
    }),

  removeParticipant: (roomCode: string, hostToken: string, participantId: string) =>
    post<RoomStateResponse>(`/api/rooms/${roomCode.trim().toUpperCase()}/remove`, {
      hostToken,
      participantId
    }),

  startGame: (
    roomCode: string,
    hostToken: string,
    config: {
      roundSeconds: number;
      endRule: RoundEndRule;
      manualEndPolicy: ManualEndPolicy;
      scoringMode: ScoringMode;
      letterPickSeconds: number | null;
    }
  ) =>
    post<RoomStateResponse>(`/api/rooms/${roomCode.trim().toUpperCase()}/start`, {
      hostToken,
      config
    }),

  callTurnNumber: (roomCode: string, participantId: string, number: number) =>
    post<RoomStateResponse>(`/api/rooms/${roomCode.trim().toUpperCase()}/call`, {
      participantId,
      number
    }),

  submitRoundAnswers: (roomCode: string, participantId: string, answers: RoundAnswerInput) =>
    post<RoomStateResponse>(`/api/rooms/${roomCode.trim().toUpperCase()}/submit`, {
      participantId,
      answers
    }),

  updateRoundDraft: (roomCode: string, participantId: string, answers: Partial<RoundAnswerInput>) =>
    post<{ ok: true }>(`/api/rooms/${roomCode.trim().toUpperCase()}/draft`, {
      participantId,
      answers
    }),

  endRoundNow: (roomCode: string, participantId: string) =>
    post<RoomStateResponse>(`/api/rooms/${roomCode.trim().toUpperCase()}/end`, { participantId }),

  scoreRoundSubmission: (
    roomCode: string,
    hostToken: string,
    roundNumber: number,
    participantId: string,
    marks: RoundMarks
  ) =>
    post<RoomStateResponse>(`/api/rooms/${roomCode.trim().toUpperCase()}/score`, {
      hostToken,
      roundNumber,
      participantId,
      marks
    }),

  publishRoundScores: (roomCode: string, hostToken: string, roundNumber: number) =>
    post<RoomStateResponse>(`/api/rooms/${roomCode.trim().toUpperCase()}/publish`, {
      hostToken,
      roundNumber
    }),

  discardRoundScores: (roomCode: string, hostToken: string, roundNumber: number) =>
    post<RoomStateResponse>(`/api/rooms/${roomCode.trim().toUpperCase()}/discard`, {
      hostToken,
      roundNumber
    }),

  cancelGameRoom: (roomCode: string, hostToken: string) =>
    post<RoomStateResponse>(`/api/rooms/${roomCode.trim().toUpperCase()}/cancel`, { hostToken }),

  endGameRoom: (roomCode: string, hostToken: string) =>
    post<RoomStateResponse>(`/api/rooms/${roomCode.trim().toUpperCase()}/finish`, { hostToken })
};
