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
      letterPickSeconds: number | null;
    };
    turnOrder: string[];
    currentTurnIndex: number;
    currentTurnParticipantId: string | null;
    activeRound: ActiveRoundSnapshot | null;
    completedRounds: CompletedRoundSnapshot[];
    scoring: ScoringSummary;
    letterPickDeadline: string | null;
  };
}

export interface JoinRoomResponse {
  requestId: string;
  status: ParticipantStatus;
  participant: RoomParticipant;
}

export type RoomSocketEvent =
  | { type: "connected" }
  | { type: "presence"; count: number }
  | { type: "snapshot"; snapshot: RoomStateResponse }
  | { type: "join_request"; participant: RoomParticipant; snapshot: RoomStateResponse }
  | { type: "admission_update"; participant: RoomParticipant; snapshot: RoomStateResponse }
  | { type: "game_started"; snapshot: RoomStateResponse }
  | { type: "turn_called"; snapshot: RoomStateResponse }
  | { type: "submission_received"; participantId: string; snapshot: RoomStateResponse }
  | { type: "round_ended"; reason: RoundEndReason; snapshot: RoomStateResponse; completedRound: CompletedRoundSnapshot }
  | { type: "submission_scored"; participantId: string; roundNumber: number; snapshot: RoomStateResponse }
  | { type: "round_scores_published"; roundNumber: number; snapshot: RoomStateResponse }
  | { type: "round_scores_discarded"; roundNumber: number; snapshot: RoomStateResponse }
  | { type: "game_cancelled"; snapshot: RoomStateResponse }
  | { type: "game_ended"; snapshot: RoomStateResponse }
  | { type: "participant_removed"; participant: RoomParticipant; snapshot: RoomStateResponse }
  | { type: "host_transferred"; snapshot?: RoomStateResponse; hostToken?: string }
  | { type: "event"; payload: unknown };

export const ROUND_FIELDS = ["name", "animal", "place", "thing", "food"] as const;
export type RoundField = (typeof ROUND_FIELDS)[number];

export const LETTERS = Array.from({ length: 26 }, (_, i) => ({
  number: i + 1,
  letter: String.fromCharCode(65 + i)
}));

export function emptyAnswers(): RoundAnswerInput {
  return { name: "", animal: "", place: "", thing: "", food: "" };
}
