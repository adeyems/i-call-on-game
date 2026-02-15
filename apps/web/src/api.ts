export type ParticipantStatus = "PENDING" | "ADMITTED" | "REJECTED";
export type GameStatus = "LOBBY" | "IN_PROGRESS" | "CANCELLED" | "FINISHED";
export type RoundEndRule = "TIMER" | "FIRST_SUBMISSION" | "WHICHEVER_FIRST";
export type RoundEndReason = "TIMER" | "FIRST_SUBMISSION" | "MANUAL_END";
export type ManualEndPolicy = "HOST_OR_CALLER" | "CALLER_ONLY" | "CALLER_OR_TIMER" | "NONE";
export type ScoringMode = "FIXED_10" | "SHARED_10";

export interface CreateRoomResponse {
  roomCode: string;
  maxParticipants: number;
  hostName: string;
  wsPath: string;
  hostToken: string;
}

export interface RoomParticipant {
  id: string;
  name: string;
  status: ParticipantStatus;
  isHost: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface RoundAnswerInput {
  name: string;
  animal: string;
  place: string;
  thing: string;
  food: string;
}

export interface RoundMarks {
  name: boolean;
  animal: boolean;
  place: boolean;
  thing: boolean;
  food: boolean;
}

export interface RoundFieldScores {
  name: number;
  animal: number;
  place: number;
  thing: number;
  food: number;
  total: number;
}

export interface SubmissionReview {
  marks: RoundMarks;
  scores: RoundFieldScores;
  markedByParticipantId: string;
  markedByParticipantName: string;
  markedAt: string;
}

export interface RoundSubmission {
  participantId: string;
  participantName: string;
  answers: RoundAnswerInput;
  submittedAt: string;
  review: SubmissionReview | null;
}

export interface ActiveRoundSnapshot {
  roundNumber: number;
  turnParticipantId: string;
  turnParticipantName: string;
  calledNumber: number;
  activeLetter: string;
  startedAt: string;
  countdownEndsAt: string;
  endsAt: string | null;
  submissions: Array<{
    participantId: string;
    participantName: string;
    submittedAt: string;
  }>;
}

export interface CompletedRoundSnapshot {
  roundNumber: number;
  turnParticipantId: string;
  turnParticipantName: string;
  calledNumber: number;
  activeLetter: string;
  startedAt: string;
  countdownEndsAt: string;
  endsAt: string | null;
  endedAt: string;
  endReason: RoundEndReason;
  scorePublishedAt: string | null;
  submissionsCount: number;
  submissions: RoundSubmission[];
}

export interface ParticipantHistoryEntry {
  roundNumber: number;
  calledNumber: number;
  activeLetter: string;
  score: number;
  cumulativeScore: number;
  reviewed: boolean;
}

export interface ParticipantScoreSummary {
  participantId: string;
  participantName: string;
  totalScore: number;
  reviewedRounds: number;
  history: ParticipantHistoryEntry[];
}

export interface ScoringSummary {
  roundsPerPlayer: number;
  maxRounds: number;
  roundsPlayed: number;
  publishedRounds: number;
  pendingPublicationRounds: number[];
  usedNumbers: number[];
  availableNumbers: number[];
  isComplete: boolean;
  leaderboard: ParticipantScoreSummary[];
}

export interface RoomStateResponse {
  meta: {
    roomCode: string;
    hostName: string;
    maxParticipants: number;
  };
  participants: RoomParticipant[];
  counts: {
    admitted: number;
    pending: number;
    rejected: number;
  };
  game: {
    status: GameStatus;
    startedAt: string | null;
    cancelledAt?: string | null;
    finishedAt?: string | null;
    config: {
      roundSeconds: number;
      endRule: RoundEndRule;
      manualEndPolicy: ManualEndPolicy;
      scoringMode: ScoringMode;
    };
    turnOrder: string[];
    currentTurnIndex: number;
    currentTurnParticipantId: string | null;
    activeRound: ActiveRoundSnapshot | null;
    completedRounds: CompletedRoundSnapshot[];
    scoring: ScoringSummary;
  };
}

export interface JoinRoomResponse {
  requestId: string;
  status: ParticipantStatus;
  participant: RoomParticipant;
}

export type RoomSocketEvent =
  | {
      type: "connected";
    }
  | {
      type: "presence";
      count: number;
    }
  | {
      type: "snapshot";
      snapshot: RoomStateResponse;
    }
  | {
      type: "join_request";
      participant: RoomParticipant;
      snapshot: RoomStateResponse;
    }
  | {
      type: "admission_update";
      participant: RoomParticipant;
      snapshot: RoomStateResponse;
    }
  | {
      type: "game_started";
      snapshot: RoomStateResponse;
    }
  | {
      type: "turn_called";
      snapshot: RoomStateResponse;
    }
  | {
      type: "submission_received";
      participantId: string;
      snapshot: RoomStateResponse;
    }
  | {
      type: "round_ended";
      reason: RoundEndReason;
      snapshot: RoomStateResponse;
      completedRound: CompletedRoundSnapshot;
    }
  | {
      type: "submission_scored";
      participantId: string;
      roundNumber: number;
      snapshot: RoomStateResponse;
    }
  | {
      type: "round_scores_published";
      roundNumber: number;
      snapshot: RoomStateResponse;
    }
  | {
      type: "round_scores_discarded";
      roundNumber: number;
      snapshot: RoomStateResponse;
    }
  | {
      type: "game_cancelled";
      snapshot: RoomStateResponse;
    }
  | {
      type: "game_ended";
      snapshot: RoomStateResponse;
    }
  | {
      type: "event";
      payload: unknown;
    };

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8787";

async function parseError(response: Response): Promise<string> {
  const payload = (await response.json().catch(() => null)) as { error?: string } | null;
  return payload?.error ?? "Request failed";
}

export function roomWebSocketUrl(roomCode: string): string {
  const url = new URL(API_BASE_URL);
  const protocol = url.protocol === "https:" ? "wss:" : "ws:";
  const normalizedCode = roomCode.trim().toUpperCase();
  return `${protocol}//${url.host}/ws/${normalizedCode}`;
}

export function connectRoomSocket(roomCode: string): WebSocket {
  return new WebSocket(roomWebSocketUrl(roomCode));
}

export async function createRoom(hostName: string, maxParticipants: number): Promise<CreateRoomResponse> {
  const response = await fetch(`${API_BASE_URL}/api/rooms`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ hostName, maxParticipants })
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return (await response.json()) as CreateRoomResponse;
}

export async function getRoomState(roomCode: string): Promise<RoomStateResponse> {
  const normalizedCode = roomCode.trim().toUpperCase();
  const response = await fetch(`${API_BASE_URL}/api/rooms/${normalizedCode}`);
  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return (await response.json()) as RoomStateResponse;
}

export async function submitJoinRequest(roomCode: string, name: string): Promise<JoinRoomResponse> {
  const normalizedCode = roomCode.trim().toUpperCase();
  const response = await fetch(`${API_BASE_URL}/api/rooms/${normalizedCode}/join`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ name })
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return (await response.json()) as JoinRoomResponse;
}

export async function reviewJoinRequest(
  roomCode: string,
  hostToken: string,
  requestId: string,
  approve: boolean
): Promise<RoomStateResponse> {
  const normalizedCode = roomCode.trim().toUpperCase();
  const response = await fetch(`${API_BASE_URL}/api/rooms/${normalizedCode}/admissions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ hostToken, requestId, approve })
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return (await response.json()) as RoomStateResponse;
}

export async function startGame(
  roomCode: string,
  hostToken: string,
  config?: {
    roundSeconds?: number;
    endRule?: RoundEndRule;
    manualEndPolicy?: ManualEndPolicy;
    scoringMode?: ScoringMode;
  }
): Promise<RoomStateResponse> {
  const normalizedCode = roomCode.trim().toUpperCase();
  const response = await fetch(`${API_BASE_URL}/api/rooms/${normalizedCode}/start`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ hostToken, config })
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return (await response.json()) as RoomStateResponse;
}

export async function callTurnNumber(roomCode: string, participantId: string, number: number): Promise<RoomStateResponse> {
  const normalizedCode = roomCode.trim().toUpperCase();
  const response = await fetch(`${API_BASE_URL}/api/rooms/${normalizedCode}/call`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ participantId, number })
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return (await response.json()) as RoomStateResponse;
}

export async function submitRoundAnswers(
  roomCode: string,
  participantId: string,
  answers: RoundAnswerInput
): Promise<RoomStateResponse> {
  const normalizedCode = roomCode.trim().toUpperCase();
  const response = await fetch(`${API_BASE_URL}/api/rooms/${normalizedCode}/submit`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ participantId, answers })
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return (await response.json()) as RoomStateResponse;
}

export async function updateRoundDraft(
  roomCode: string,
  participantId: string,
  answers: Partial<RoundAnswerInput>
): Promise<void> {
  const normalizedCode = roomCode.trim().toUpperCase();
  const response = await fetch(`${API_BASE_URL}/api/rooms/${normalizedCode}/draft`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ participantId, answers })
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }
}

export async function endRoundNow(roomCode: string, participantId: string): Promise<RoomStateResponse> {
  const normalizedCode = roomCode.trim().toUpperCase();
  const response = await fetch(`${API_BASE_URL}/api/rooms/${normalizedCode}/end`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ participantId })
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return (await response.json()) as RoomStateResponse;
}

export async function scoreRoundSubmission(
  roomCode: string,
  hostToken: string,
  roundNumber: number,
  participantId: string,
  marks: RoundMarks
): Promise<RoomStateResponse> {
  const normalizedCode = roomCode.trim().toUpperCase();
  const response = await fetch(`${API_BASE_URL}/api/rooms/${normalizedCode}/score`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ hostToken, roundNumber, participantId, marks })
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return (await response.json()) as RoomStateResponse;
}

export async function publishRoundScores(
  roomCode: string,
  hostToken: string,
  roundNumber: number
): Promise<RoomStateResponse> {
  const normalizedCode = roomCode.trim().toUpperCase();
  const response = await fetch(`${API_BASE_URL}/api/rooms/${normalizedCode}/publish`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ hostToken, roundNumber })
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return (await response.json()) as RoomStateResponse;
}

export async function discardRoundScores(roomCode: string, hostToken: string, roundNumber: number): Promise<RoomStateResponse> {
  const normalizedCode = roomCode.trim().toUpperCase();
  const response = await fetch(`${API_BASE_URL}/api/rooms/${normalizedCode}/discard`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ hostToken, roundNumber })
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return (await response.json()) as RoomStateResponse;
}

export async function cancelGameRoom(roomCode: string, hostToken: string): Promise<RoomStateResponse> {
  const normalizedCode = roomCode.trim().toUpperCase();
  const response = await fetch(`${API_BASE_URL}/api/rooms/${normalizedCode}/cancel`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ hostToken })
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return (await response.json()) as RoomStateResponse;
}

export async function endGameRoom(roomCode: string, hostToken: string): Promise<RoomStateResponse> {
  const normalizedCode = roomCode.trim().toUpperCase();
  const response = await fetch(`${API_BASE_URL}/api/rooms/${normalizedCode}/finish`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ hostToken })
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return (await response.json()) as RoomStateResponse;
}
