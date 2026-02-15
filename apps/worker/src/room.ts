export interface RoomMeta {
  roomCode: string;
  hostName: string;
  maxParticipants: number;
}

export interface RoomInitPayload extends RoomMeta {
  hostToken: string;
}

export type ParticipantStatus = "PENDING" | "ADMITTED" | "REJECTED";
export type GameStatus = "LOBBY" | "IN_PROGRESS" | "CANCELLED" | "FINISHED";
export type RoundEndRule = "TIMER" | "FIRST_SUBMISSION" | "WHICHEVER_FIRST";
export type RoundEndReason = "TIMER" | "FIRST_SUBMISSION" | "MANUAL_END";
export type ManualEndPolicy = "HOST_OR_CALLER" | "CALLER_ONLY" | "CALLER_OR_TIMER" | "NONE";
export type ScoringMode = "FIXED_10" | "SHARED_10";

export interface Participant {
  id: string;
  name: string;
  status: ParticipantStatus;
  isHost: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RoundAnswers {
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
  answers: RoundAnswers;
  submittedAt: string;
  review: SubmissionReview | null;
}

export interface ActiveRoundState {
  roundNumber: number;
  turnParticipantId: string;
  turnParticipantName: string;
  calledNumber: number;
  activeLetter: string;
  startedAt: string;
  countdownEndsAt: string;
  endsAt: string | null;
  submissions: RoundSubmission[];
  drafts: Record<string, RoundAnswers>;
}

export interface CompletedRoundState extends ActiveRoundState {
  endedAt: string;
  endReason: RoundEndReason;
  scorePublishedAt: string | null;
}

export interface GameConfig {
  roundSeconds: number;
  endRule: RoundEndRule;
  manualEndPolicy: ManualEndPolicy;
  scoringMode: ScoringMode;
}

export interface GameState {
  status: GameStatus;
  startedAt: string | null;
  cancelledAt: string | null;
  finishedAt: string | null;
  config: GameConfig;
  turnOrder: string[];
  currentTurnIndex: number;
  activeRound: ActiveRoundState | null;
  completedRounds: CompletedRoundState[];
}

export interface StoredRoomState {
  meta: RoomMeta;
  hostToken: string;
  participants: Participant[];
  game: GameState;
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

export interface RoomSnapshot {
  meta: RoomMeta;
  participants: Participant[];
  counts: {
    admitted: number;
    pending: number;
    rejected: number;
  };
  game: {
    status: GameStatus;
    startedAt: string | null;
    cancelledAt: string | null;
    finishedAt: string | null;
    config: GameConfig;
    turnOrder: string[];
    currentTurnIndex: number;
    currentTurnParticipantId: string | null;
    activeRound: ActiveRoundSnapshot | null;
    completedRounds: CompletedRoundSnapshot[];
    scoring: ScoringSummary;
  };
}

export interface StartGameInput {
  roundSeconds?: number;
  endRule?: RoundEndRule;
  manualEndPolicy?: ManualEndPolicy;
  scoringMode?: ScoringMode;
}

type RoomMutationFailure = {
  ok: false;
  status: number;
  error: string;
};

type JoinMutationSuccess = {
  ok: true;
  nextState: StoredRoomState;
  participant: Participant;
};

type AdmitMutationSuccess = {
  ok: true;
  nextState: StoredRoomState;
  participant: Participant;
};

type StartMutationSuccess = {
  ok: true;
  nextState: StoredRoomState;
};

type CallNumberSuccess = {
  ok: true;
  nextState: StoredRoomState;
  activeRound: ActiveRoundState;
};

type SubmitSuccess = {
  ok: true;
  nextState: StoredRoomState;
  submission: RoundSubmission;
  roundEnded: boolean;
  completedRound: CompletedRoundState | null;
};

type EndRoundSuccess = {
  ok: true;
  nextState: StoredRoomState;
  completedRound: CompletedRoundState;
};

type ScoreSubmissionSuccess = {
  ok: true;
  nextState: StoredRoomState;
  updatedSubmission: RoundSubmission;
};

type PublishRoundScoresSuccess = {
  ok: true;
  nextState: StoredRoomState;
  round: CompletedRoundState;
};

type DiscardRoundScoresSuccess = {
  ok: true;
  nextState: StoredRoomState;
  round: CompletedRoundState;
};

type CancelGameSuccess = {
  ok: true;
  nextState: StoredRoomState;
};

type DraftUpdateSuccess = {
  ok: true;
  nextState: StoredRoomState;
};

type EndGameSuccess = {
  ok: true;
  nextState: StoredRoomState;
};

export type JoinMutationResult = JoinMutationSuccess | RoomMutationFailure;
export type AdmitMutationResult = AdmitMutationSuccess | RoomMutationFailure;
export type StartMutationResult = StartMutationSuccess | RoomMutationFailure;
export type CallNumberResult = CallNumberSuccess | RoomMutationFailure;
export type SubmitResult = SubmitSuccess | RoomMutationFailure;
export type EndRoundResult = EndRoundSuccess | RoomMutationFailure;
export type ScoreSubmissionResult = ScoreSubmissionSuccess | RoomMutationFailure;
export type PublishRoundScoresResult = PublishRoundScoresSuccess | RoomMutationFailure;
export type DiscardRoundScoresResult = DiscardRoundScoresSuccess | RoomMutationFailure;
export type CancelGameResult = CancelGameSuccess | RoomMutationFailure;
export type DraftUpdateResult = DraftUpdateSuccess | RoomMutationFailure;
export type EndGameResult = EndGameSuccess | RoomMutationFailure;

const ROOM_STORAGE_KEY = "room";
const MIN_NAME_LENGTH = 2;
const MAX_NAME_LENGTH = 24;
const DEFAULT_ROUND_SECONDS = 20;
const MIN_ROUND_SECONDS = 5;
const MAX_ROUND_SECONDS = 120;
const DEFAULT_MANUAL_END_POLICY: ManualEndPolicy = "HOST_OR_CALLER";
const DEFAULT_SCORING_MODE: ScoringMode = "FIXED_10";
const MAX_COMPLETED_ROUNDS = 26;
const ROUND_COUNTDOWN_SECONDS = 3;
const SCORE_PER_CORRECT_FIELD = 10;
const ROUND_FIELDS = ["name", "animal", "place", "thing", "food"] as const;
type RoundFieldKey = (typeof ROUND_FIELDS)[number];

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}

function normalizeName(rawName: string): string {
  return rawName.trim().replace(/\s+/g, " ");
}

function normalizeTextAnswer(raw: unknown): string {
  if (typeof raw !== "string") {
    return "";
  }

  return raw.trim().replace(/\s+/g, " ").slice(0, 48);
}

function emptyAnswers(): RoundAnswers {
  return {
    name: "",
    animal: "",
    place: "",
    thing: "",
    food: ""
  };
}

function countStatuses(participants: Participant[]): RoomSnapshot["counts"] {
  let admitted = 0;
  let pending = 0;
  let rejected = 0;

  for (const participant of participants) {
    if (participant.status === "ADMITTED") {
      admitted += 1;
      continue;
    }

    if (participant.status === "PENDING") {
      pending += 1;
      continue;
    }

    rejected += 1;
  }

  return { admitted, pending, rejected };
}

function participantNameExists(participants: Participant[], rawName: string): boolean {
  const normalized = normalizeName(rawName).toLowerCase();
  return participants.some((participant) => participant.name.toLowerCase() === normalized);
}

function sortParticipantsByJoinOrder(participants: Participant[]): Participant[] {
  return participants
    .slice()
    .sort((left, right) => {
      if (left.createdAt !== right.createdAt) {
        return left.createdAt.localeCompare(right.createdAt);
      }

      return left.id.localeCompare(right.id);
    });
}

function admittedParticipants(state: StoredRoomState): Participant[] {
  return sortParticipantsByJoinOrder(state.participants.filter((participant) => participant.status === "ADMITTED"));
}

function hostParticipant(state: StoredRoomState): Participant | null {
  return state.participants.find((participant) => participant.isHost) ?? null;
}

function isGameCancelled(state: StoredRoomState): boolean {
  return state.game.status === "CANCELLED";
}

function isGameFinished(state: StoredRoomState): boolean {
  return state.game.status === "FINISHED";
}

function participantById(state: StoredRoomState, participantId: string): Participant | null {
  return state.participants.find((participant) => participant.id === participantId) ?? null;
}

function isParticipantAdmitted(state: StoredRoomState, participantId: string): boolean {
  const participant = participantById(state, participantId);
  return !!participant && participant.status === "ADMITTED";
}

function numberToLetter(number: number): string {
  return String.fromCharCode(64 + number);
}

function currentTurnParticipantId(state: StoredRoomState): string | null {
  if (state.game.turnOrder.length === 0) {
    return null;
  }

  const index = state.game.currentTurnIndex % state.game.turnOrder.length;
  return state.game.turnOrder[index] ?? null;
}

function isRoundCountdownOver(round: ActiveRoundState, nowIso = new Date().toISOString()): boolean {
  return new Date(nowIso).getTime() >= new Date(round.countdownEndsAt).getTime();
}

function roundScoreFromReview(review: SubmissionReview | null): number {
  return review?.scores.total ?? 0;
}

function reviewedRoundCount(submission: RoundSubmission): number {
  return submission.review ? 1 : 0;
}

function submissionForParticipant(round: CompletedRoundState, participantId: string): RoundSubmission | null {
  return round.submissions.find((submission) => submission.participantId === participantId) ?? null;
}

function roundIsFullyReviewed(round: CompletedRoundState): boolean {
  return round.submissions.every((submission) => !!submission.review);
}

function usedNumbers(state: StoredRoomState): number[] {
  const used = new Set<number>();

  for (const round of state.game.completedRounds) {
    used.add(round.calledNumber);
  }

  if (state.game.activeRound) {
    used.add(state.game.activeRound.calledNumber);
  }

  return Array.from(used).sort((left, right) => left - right);
}

function scoringLimits(state: StoredRoomState): { admittedCount: number; roundsPerPlayer: number; maxRounds: number } {
  const admittedCount = admittedParticipants(state).length;
  const roundsPerPlayer = admittedCount > 0 ? Math.floor(26 / admittedCount) : 0;
  const maxRounds = roundsPerPlayer * admittedCount;

  return {
    admittedCount,
    roundsPerPlayer,
    maxRounds
  };
}

function buildScoringSummary(state: StoredRoomState): ScoringSummary {
  const limits = scoringLimits(state);
  const used = usedNumbers(state);
  const availableNumbers = Array.from({ length: 26 }, (_, index) => index + 1).filter((number) => !used.includes(number));
  const publishedRounds = state.game.completedRounds.filter((round) => !!round.scorePublishedAt);
  const pendingPublicationRounds = state.game.completedRounds
    .filter((round) => !round.scorePublishedAt)
    .map((round) => round.roundNumber)
    .sort((left, right) => left - right);

  const leaderboard: ParticipantScoreSummary[] = admittedParticipants(state).map((participant) => {
    let runningTotal = 0;
    let reviewedRounds = 0;

    const history: ParticipantHistoryEntry[] = publishedRounds.map((round) => {
      const submission = submissionForParticipant(round, participant.id);
      const score = submission ? roundScoreFromReview(submission.review) : 0;
      const reviewed = !!submission?.review;

      if (reviewed) {
        reviewedRounds += 1;
      }

      runningTotal += score;

      return {
        roundNumber: round.roundNumber,
        calledNumber: round.calledNumber,
        activeLetter: round.activeLetter,
        score,
        cumulativeScore: runningTotal,
        reviewed
      };
    });

    return {
      participantId: participant.id,
      participantName: participant.name,
      totalScore: runningTotal,
      reviewedRounds,
      history
    };
  });

  leaderboard.sort((left, right) => {
    if (left.totalScore !== right.totalScore) {
      return right.totalScore - left.totalScore;
    }

    return left.participantName.localeCompare(right.participantName);
  });

  const roundsPlayed = state.game.completedRounds.length;
  const isComplete = limits.maxRounds > 0 && roundsPlayed >= limits.maxRounds;

  return {
    roundsPerPlayer: limits.roundsPerPlayer,
    maxRounds: limits.maxRounds,
    roundsPlayed,
    publishedRounds: publishedRounds.length,
    pendingPublicationRounds,
    usedNumbers: used,
    availableNumbers,
    isComplete,
    leaderboard
  };
}

function toActiveRoundSnapshot(round: ActiveRoundState): ActiveRoundSnapshot {
  return {
    roundNumber: round.roundNumber,
    turnParticipantId: round.turnParticipantId,
    turnParticipantName: round.turnParticipantName,
    calledNumber: round.calledNumber,
    activeLetter: round.activeLetter,
    startedAt: round.startedAt,
    countdownEndsAt: round.countdownEndsAt,
    endsAt: round.endsAt,
    submissions: round.submissions.map((submission) => ({
      participantId: submission.participantId,
      participantName: submission.participantName,
      submittedAt: submission.submittedAt
    }))
  };
}

function toCompletedRoundSnapshot(round: CompletedRoundState): CompletedRoundSnapshot {
  return {
    roundNumber: round.roundNumber,
    turnParticipantId: round.turnParticipantId,
    turnParticipantName: round.turnParticipantName,
    calledNumber: round.calledNumber,
    activeLetter: round.activeLetter,
    startedAt: round.startedAt,
    countdownEndsAt: round.countdownEndsAt,
    endsAt: round.endsAt,
    endedAt: round.endedAt,
    endReason: round.endReason,
    scorePublishedAt: round.scorePublishedAt,
    submissionsCount: round.submissions.length,
    submissions: round.submissions
  };
}

function normalizeMarks(input: Partial<RoundMarks>): { ok: true; marks: RoundMarks } | RoomMutationFailure {
  const nextMarks = {} as RoundMarks;

  for (const field of ROUND_FIELDS) {
    const value = input[field];
    if (typeof value !== "boolean") {
      return {
        ok: false,
        status: 400,
        error: `marks.${field} must be boolean`
      };
    }

    nextMarks[field] = value;
  }

  return {
    ok: true,
    marks: nextMarks
  };
}

function roundScoreValue(value: number): number {
  return Math.round(value * 100) / 100;
}

function answerKeyForField(submission: RoundSubmission, field: RoundFieldKey): string {
  return normalizeTextAnswer(submission.answers[field]).toLowerCase();
}

function fieldScoreForSubmission(
  submissions: RoundSubmission[],
  submission: RoundSubmission,
  field: RoundFieldKey,
  scoringMode: ScoringMode
): number {
  const review = submission.review;
  if (!review || !review.marks[field]) {
    return 0;
  }

  if (scoringMode === "FIXED_10") {
    return SCORE_PER_CORRECT_FIELD;
  }

  const key = answerKeyForField(submission, field);
  if (!key) {
    return 0;
  }

  const matchingCorrectCount = submissions.reduce((count, current) => {
    if (!current.review?.marks[field]) {
      return count;
    }

    return answerKeyForField(current, field) === key ? count + 1 : count;
  }, 0);

  if (matchingCorrectCount < 1) {
    return 0;
  }

  return roundScoreValue(SCORE_PER_CORRECT_FIELD / matchingCorrectCount);
}

function buildFieldScoresForSubmission(
  submissions: RoundSubmission[],
  submission: RoundSubmission,
  scoringMode: ScoringMode
): RoundFieldScores {
  const scores = {
    name: fieldScoreForSubmission(submissions, submission, "name", scoringMode),
    animal: fieldScoreForSubmission(submissions, submission, "animal", scoringMode),
    place: fieldScoreForSubmission(submissions, submission, "place", scoringMode),
    thing: fieldScoreForSubmission(submissions, submission, "thing", scoringMode),
    food: fieldScoreForSubmission(submissions, submission, "food", scoringMode),
    total: 0
  };

  scores.total = roundScoreValue(scores.name + scores.animal + scores.place + scores.thing + scores.food);
  return scores;
}

function recomputeRoundReviewScores(round: CompletedRoundState, scoringMode: ScoringMode): CompletedRoundState {
  const nextSubmissions = round.submissions.map((submission) => {
    if (!submission.review) {
      return submission;
    }

    return {
      ...submission,
      review: {
        ...submission.review,
        scores: buildFieldScoresForSubmission(round.submissions, submission, scoringMode)
      }
    };
  });

  return {
    ...round,
    submissions: nextSubmissions
  };
}

function blankSubmission(participant: Participant, nowIso: string, answers: RoundAnswers): RoundSubmission {
  return {
    participantId: participant.id,
    participantName: participant.name,
    answers,
    submittedAt: nowIso,
    review: null
  };
}

function withForcedSubmissions(state: StoredRoomState, nowIso = new Date().toISOString()): StoredRoomState | null {
  const activeRound = state.game.activeRound;
  if (!activeRound) {
    return null;
  }

  const seen = new Set(activeRound.submissions.map((submission) => submission.participantId));
  const additions: RoundSubmission[] = [];

  for (const participant of admittedParticipants(state)) {
    if (seen.has(participant.id)) {
      continue;
    }

    const draftAnswers = activeRound.drafts[participant.id] ?? emptyAnswers();
    additions.push(blankSubmission(participant, nowIso, draftAnswers));
  }

  if (additions.length === 0) {
    return state;
  }

  return {
    ...state,
    game: {
      ...state.game,
      activeRound: {
        ...activeRound,
        submissions: [...activeRound.submissions, ...additions]
      }
    }
  };
}

function finalizeRoundWithForcedSubmissions(
  state: StoredRoomState,
  reason: RoundEndReason,
  nowIso = new Date().toISOString()
): EndRoundResult {
  const stateWithForced = withForcedSubmissions(state, nowIso);
  if (!stateWithForced) {
    return {
      ok: false,
      status: 409,
      error: "no active round to end"
    };
  }

  return endActiveRound(stateWithForced, reason, nowIso);
}

export function isHostTokenValid(state: StoredRoomState, hostToken: string): boolean {
  return hostToken.trim().length > 0 && hostToken === state.hostToken;
}

export function buildTurnOrder(state: StoredRoomState): string[] {
  return admittedParticipants(state).map((participant) => participant.id);
}

function normalizeGameConfig(input?: StartGameInput): { ok: true; config: GameConfig } | RoomMutationFailure {
  const endRule = input?.endRule ?? "WHICHEVER_FIRST";
  const manualEndPolicy = input?.manualEndPolicy ?? DEFAULT_MANUAL_END_POLICY;
  const scoringMode = input?.scoringMode ?? DEFAULT_SCORING_MODE;
  const rawSeconds = input?.roundSeconds ?? DEFAULT_ROUND_SECONDS;
  const roundSeconds = Number(rawSeconds);

  if (!Number.isInteger(roundSeconds) || roundSeconds < MIN_ROUND_SECONDS || roundSeconds > MAX_ROUND_SECONDS) {
    return {
      ok: false,
      status: 400,
      error: `roundSeconds must be an integer between ${MIN_ROUND_SECONDS} and ${MAX_ROUND_SECONDS}`
    };
  }

  if (endRule !== "TIMER" && endRule !== "FIRST_SUBMISSION" && endRule !== "WHICHEVER_FIRST") {
    return {
      ok: false,
      status: 400,
      error: "endRule must be TIMER, FIRST_SUBMISSION, or WHICHEVER_FIRST"
    };
  }

  if (
    manualEndPolicy !== "HOST_OR_CALLER" &&
    manualEndPolicy !== "CALLER_ONLY" &&
    manualEndPolicy !== "CALLER_OR_TIMER" &&
    manualEndPolicy !== "NONE"
  ) {
    return {
      ok: false,
      status: 400,
      error: "manualEndPolicy must be HOST_OR_CALLER, CALLER_ONLY, CALLER_OR_TIMER, or NONE"
    };
  }

  if (scoringMode !== "FIXED_10" && scoringMode !== "SHARED_10") {
    return {
      ok: false,
      status: 400,
      error: "scoringMode must be FIXED_10 or SHARED_10"
    };
  }

  if (manualEndPolicy === "CALLER_OR_TIMER" && endRule === "FIRST_SUBMISSION") {
    return {
      ok: false,
      status: 400,
      error: "CALLER_OR_TIMER requires a timer-based endRule"
    };
  }

  return {
    ok: true,
    config: {
      roundSeconds,
      endRule,
      manualEndPolicy,
      scoringMode
    }
  };
}

export function buildSnapshot(state: StoredRoomState): RoomSnapshot {
  const currentTurn = currentTurnParticipantId(state);

  return {
    meta: state.meta,
    participants: state.participants,
    counts: countStatuses(state.participants),
    game: {
      status: state.game.status,
      startedAt: state.game.startedAt,
      cancelledAt: state.game.cancelledAt,
      finishedAt: state.game.finishedAt,
      config: state.game.config,
      turnOrder: state.game.turnOrder,
      currentTurnIndex: state.game.currentTurnIndex,
      currentTurnParticipantId: currentTurn,
      activeRound: state.game.activeRound ? toActiveRoundSnapshot(state.game.activeRound) : null,
      completedRounds: state.game.completedRounds.map(toCompletedRoundSnapshot),
      scoring: buildScoringSummary(state)
    }
  };
}

export function initializeRoomState(payload: RoomInitPayload, nowIso = new Date().toISOString()): StoredRoomState {
  return {
    meta: {
      roomCode: payload.roomCode,
      hostName: normalizeName(payload.hostName),
      maxParticipants: payload.maxParticipants
    },
    hostToken: payload.hostToken,
    participants: [
      {
        id: "host",
        name: normalizeName(payload.hostName),
        status: "ADMITTED",
        isHost: true,
        createdAt: nowIso,
        updatedAt: nowIso
      }
    ],
    game: {
      status: "LOBBY",
      startedAt: null,
      cancelledAt: null,
      finishedAt: null,
      config: {
        roundSeconds: DEFAULT_ROUND_SECONDS,
        endRule: "WHICHEVER_FIRST",
        manualEndPolicy: DEFAULT_MANUAL_END_POLICY,
        scoringMode: DEFAULT_SCORING_MODE
      },
      turnOrder: [],
      currentTurnIndex: 0,
      activeRound: null,
      completedRounds: []
    }
  };
}

export function createJoinRequest(
  state: StoredRoomState,
  rawName: string,
  nowIso = new Date().toISOString()
): JoinMutationResult {
  const name = normalizeName(rawName);

  if (state.game.status !== "LOBBY") {
    return {
      ok: false,
      status: 410,
      error: "join link has expired for this room"
    };
  }

  if (name.length < MIN_NAME_LENGTH || name.length > MAX_NAME_LENGTH) {
    return {
      ok: false,
      status: 400,
      error: `name must be between ${MIN_NAME_LENGTH} and ${MAX_NAME_LENGTH} characters`
    };
  }

  if (participantNameExists(state.participants, name)) {
    return {
      ok: false,
      status: 409,
      error: "name already exists in this room"
    };
  }

  const counts = countStatuses(state.participants);
  if (counts.admitted >= state.meta.maxParticipants) {
    return {
      ok: false,
      status: 409,
      error: "room is full"
    };
  }

  const participant: Participant = {
    id: crypto.randomUUID(),
    name,
    status: "PENDING",
    isHost: false,
    createdAt: nowIso,
    updatedAt: nowIso
  };

  return {
    ok: true,
    participant,
    nextState: {
      ...state,
      participants: [...state.participants, participant]
    }
  };
}

export function resolveJoinRequest(
  state: StoredRoomState,
  requestId: string,
  approve: boolean,
  nowIso = new Date().toISOString()
): AdmitMutationResult {
  if (isGameCancelled(state)) {
    return {
      ok: false,
      status: 409,
      error: "game has been cancelled"
    };
  }

  if (state.game.status !== "LOBBY") {
    return {
      ok: false,
      status: 409,
      error: "cannot change admissions after game has started"
    };
  }

  const participantIndex = state.participants.findIndex((participant) => participant.id === requestId);
  if (participantIndex === -1) {
    return {
      ok: false,
      status: 404,
      error: "join request not found"
    };
  }

  const current = state.participants[participantIndex];
  if (current.status !== "PENDING") {
    return {
      ok: false,
      status: 409,
      error: "join request already resolved"
    };
  }

  if (approve) {
    const counts = countStatuses(state.participants);
    if (counts.admitted >= state.meta.maxParticipants) {
      return {
        ok: false,
        status: 409,
        error: "room is full"
      };
    }
  }

  const nextParticipant: Participant = {
    ...current,
    status: approve ? "ADMITTED" : "REJECTED",
    updatedAt: nowIso
  };

  const nextParticipants = state.participants.map((participant) =>
    participant.id === requestId ? nextParticipant : participant
  );

  return {
    ok: true,
    participant: nextParticipant,
    nextState: {
      ...state,
      participants: nextParticipants
    }
  };
}

export function startGame(
  state: StoredRoomState,
  hostToken: string,
  configInput?: StartGameInput,
  nowIso = new Date().toISOString()
): StartMutationResult {
  if (!isHostTokenValid(state, hostToken)) {
    return {
      ok: false,
      status: 401,
      error: "invalid host token"
    };
  }

  if (isGameCancelled(state)) {
    return {
      ok: false,
      status: 409,
      error: "game has been cancelled"
    };
  }

  if (state.game.status !== "LOBBY") {
    return {
      ok: false,
      status: 409,
      error: "game has already started"
    };
  }

  const counts = countStatuses(state.participants);
  if (counts.pending > 0) {
    return {
      ok: false,
      status: 409,
      error: "cannot start game while join requests are pending"
    };
  }

  const turnOrder = buildTurnOrder(state);
  if (turnOrder.length < 2) {
    return {
      ok: false,
      status: 409,
      error: "at least 2 admitted participants are required to start"
    };
  }

  const limits = scoringLimits({
    ...state,
    game: {
      ...state.game,
      turnOrder
    }
  });
  if (limits.maxRounds < 1) {
    return {
      ok: false,
      status: 409,
      error: "unable to start game for current player count"
    };
  }

  const configResult = normalizeGameConfig(configInput);
  if (!configResult.ok) {
    return configResult;
  }

  const admittedOnly = admittedParticipants(state);

  return {
    ok: true,
    nextState: {
      ...state,
      participants: admittedOnly,
      game: {
        status: "IN_PROGRESS",
        startedAt: nowIso,
        cancelledAt: null,
        finishedAt: null,
        config: configResult.config,
        turnOrder,
        currentTurnIndex: 0,
        activeRound: null,
        completedRounds: []
      }
    }
  };
}

export function callNumberForTurn(
  state: StoredRoomState,
  participantId: string,
  calledNumber: number,
  nowIso = new Date().toISOString()
): CallNumberResult {
  if (isGameCancelled(state)) {
    return {
      ok: false,
      status: 409,
      error: "game has been cancelled"
    };
  }

  if (state.game.status !== "IN_PROGRESS") {
    return {
      ok: false,
      status: 409,
      error: "game has not started"
    };
  }

  if (state.game.activeRound) {
    return {
      ok: false,
      status: 409,
      error: "round already in progress"
    };
  }

  if (state.game.completedRounds.some((round) => !round.scorePublishedAt)) {
    return {
      ok: false,
      status: 409,
      error: "submit or discard previous round result before starting next round"
    };
  }

  const limits = scoringLimits(state);
  if (limits.maxRounds > 0 && state.game.completedRounds.length >= limits.maxRounds) {
    return {
      ok: false,
      status: 409,
      error: "maximum fair rounds reached"
    };
  }

  if (!Number.isInteger(calledNumber) || calledNumber < 1 || calledNumber > 26) {
    return {
      ok: false,
      status: 400,
      error: "number must be an integer between 1 and 26"
    };
  }

  if (usedNumbers(state).includes(calledNumber)) {
    return {
      ok: false,
      status: 409,
      error: "letter has already been used"
    };
  }

  if (!isParticipantAdmitted(state, participantId)) {
    return {
      ok: false,
      status: 403,
      error: "participant is not admitted"
    };
  }

  const expectedParticipantId = currentTurnParticipantId(state);
  if (!expectedParticipantId || expectedParticipantId !== participantId) {
    return {
      ok: false,
      status: 403,
      error: "it is not this participant's turn"
    };
  }

  const participant = participantById(state, participantId);
  if (!participant) {
    return {
      ok: false,
      status: 404,
      error: "participant not found"
    };
  }

  const startedAtEpoch = new Date(nowIso).getTime();
  const countdownEndsAt = new Date(startedAtEpoch + ROUND_COUNTDOWN_SECONDS * 1000).toISOString();
  const hasTimer = state.game.config.endRule !== "FIRST_SUBMISSION";
  const endsAt = hasTimer
    ? new Date(startedAtEpoch + (ROUND_COUNTDOWN_SECONDS + state.game.config.roundSeconds) * 1000).toISOString()
    : null;

  const round: ActiveRoundState = {
    roundNumber: state.game.completedRounds.length + 1,
    turnParticipantId: participant.id,
    turnParticipantName: participant.name,
    calledNumber,
    activeLetter: numberToLetter(calledNumber),
    startedAt: nowIso,
    countdownEndsAt,
    endsAt,
    submissions: [],
    drafts: {}
  };

  return {
    ok: true,
    activeRound: round,
    nextState: {
      ...state,
      game: {
        ...state.game,
        activeRound: round
      }
    }
  };
}

export function endActiveRound(
  state: StoredRoomState,
  reason: RoundEndReason,
  nowIso = new Date().toISOString()
): EndRoundResult {
  if (state.game.status !== "IN_PROGRESS") {
    return {
      ok: false,
      status: 409,
      error: "game has not started"
    };
  }

  const activeRound = state.game.activeRound;
  if (!activeRound) {
    return {
      ok: false,
      status: 409,
      error: "no active round to end"
    };
  }

  const completedRound: CompletedRoundState = {
    ...activeRound,
    endedAt: nowIso,
    endReason: reason,
    scorePublishedAt: null
  };

  const nextTurnIndex =
    state.game.turnOrder.length === 0 ? 0 : (state.game.currentTurnIndex + 1) % state.game.turnOrder.length;
  const nextCompletedRounds = [...state.game.completedRounds, completedRound].slice(-MAX_COMPLETED_ROUNDS);

  return {
    ok: true,
    completedRound,
    nextState: {
      ...state,
      game: {
        ...state.game,
        currentTurnIndex: nextTurnIndex,
        activeRound: null,
        completedRounds: nextCompletedRounds
      }
    }
  };
}

export function endRoundManually(
  state: StoredRoomState,
  participantId: string,
  nowIso = new Date().toISOString()
): EndRoundResult {
  if (isGameCancelled(state)) {
    return {
      ok: false,
      status: 409,
      error: "game has been cancelled"
    };
  }

  if (state.game.status !== "IN_PROGRESS") {
    return {
      ok: false,
      status: 409,
      error: "game has not started"
    };
  }

  const activeRound = state.game.activeRound;
  if (!activeRound) {
    return {
      ok: false,
      status: 409,
      error: "no active round to end"
    };
  }

  if (!isParticipantAdmitted(state, participantId)) {
    return {
      ok: false,
      status: 403,
      error: "participant is not admitted"
    };
  }

  const participant = participantById(state, participantId);
  if (!participant) {
    return {
      ok: false,
      status: 404,
      error: "participant not found"
    };
  }

  const policy = state.game.config.manualEndPolicy;
  const isCaller = participant.id === activeRound.turnParticipantId;
  const canEnd =
    policy === "HOST_OR_CALLER"
      ? participant.isHost || isCaller
      : policy === "CALLER_ONLY" || policy === "CALLER_OR_TIMER"
        ? isCaller
        : policy === "NONE"
          ? false
        : false;

  if (!canEnd) {
    const messageByPolicy: Record<ManualEndPolicy, string> = {
      HOST_OR_CALLER: "only the host or current caller can end the round",
      CALLER_ONLY: "only the current caller can end the round",
      CALLER_OR_TIMER: "only the current caller can end early; timer will also end the round",
      NONE: "manual round end is disabled for this room"
    };
    return {
      ok: false,
      status: 403,
      error: messageByPolicy[policy]
    };
  }

  return finalizeRoundWithForcedSubmissions(state, "MANUAL_END", nowIso);
}

export function submitRoundAnswers(
  state: StoredRoomState,
  participantId: string,
  inputAnswers: Partial<RoundAnswers>,
  nowIso = new Date().toISOString()
): SubmitResult {
  if (isGameCancelled(state)) {
    return {
      ok: false,
      status: 409,
      error: "game has been cancelled"
    };
  }

  if (state.game.status !== "IN_PROGRESS") {
    return {
      ok: false,
      status: 409,
      error: "game has not started"
    };
  }

  const activeRound = state.game.activeRound;
  if (!activeRound) {
    return {
      ok: false,
      status: 409,
      error: "no active round"
    };
  }

  if (!isRoundCountdownOver(activeRound, nowIso)) {
    return {
      ok: false,
      status: 409,
      error: "round countdown in progress"
    };
  }

  if (!isParticipantAdmitted(state, participantId)) {
    return {
      ok: false,
      status: 403,
      error: "participant is not admitted"
    };
  }

  if (activeRound.submissions.some((submission) => submission.participantId === participantId)) {
    return {
      ok: false,
      status: 409,
      error: "participant has already submitted"
    };
  }

  const participant = participantById(state, participantId);
  if (!participant) {
    return {
      ok: false,
      status: 404,
      error: "participant not found"
    };
  }

  const existingDraft = activeRound.drafts[participantId] ?? emptyAnswers();
  const answers: RoundAnswers = {
    name: normalizeTextAnswer(inputAnswers.name ?? existingDraft.name),
    animal: normalizeTextAnswer(inputAnswers.animal ?? existingDraft.animal),
    place: normalizeTextAnswer(inputAnswers.place ?? existingDraft.place),
    thing: normalizeTextAnswer(inputAnswers.thing ?? existingDraft.thing),
    food: normalizeTextAnswer(inputAnswers.food ?? existingDraft.food)
  };

  const submission: RoundSubmission = {
    participantId,
    participantName: participant.name,
    answers,
    submittedAt: nowIso,
    review: null
  };

  const nextDrafts = { ...activeRound.drafts };
  delete nextDrafts[participantId];

  const withSubmission: StoredRoomState = {
    ...state,
    game: {
      ...state.game,
      activeRound: {
        ...activeRound,
        submissions: [...activeRound.submissions, submission],
        drafts: nextDrafts
      }
    }
  };

  const shouldEndImmediately =
    state.game.config.endRule === "FIRST_SUBMISSION" || state.game.config.endRule === "WHICHEVER_FIRST";

  if (!shouldEndImmediately) {
    return {
      ok: true,
      nextState: withSubmission,
      submission,
      roundEnded: false,
      completedRound: null
    };
  }

  const ended = finalizeRoundWithForcedSubmissions(withSubmission, "FIRST_SUBMISSION", nowIso);
  if (!ended.ok) {
    return ended;
  }

  return {
    ok: true,
    nextState: ended.nextState,
    submission,
    roundEnded: true,
    completedRound: ended.completedRound
  };
}

export function updateRoundDraft(
  state: StoredRoomState,
  participantId: string,
  inputAnswers: Partial<RoundAnswers>,
  nowIso = new Date().toISOString()
): DraftUpdateResult {
  if (isGameCancelled(state) || isGameFinished(state)) {
    return {
      ok: false,
      status: 409,
      error: "game is not accepting answers"
    };
  }

  if (state.game.status !== "IN_PROGRESS") {
    return {
      ok: false,
      status: 409,
      error: "game has not started"
    };
  }

  const activeRound = state.game.activeRound;
  if (!activeRound) {
    return {
      ok: false,
      status: 409,
      error: "no active round"
    };
  }

  if (!isRoundCountdownOver(activeRound, nowIso)) {
    return {
      ok: false,
      status: 409,
      error: "round countdown in progress"
    };
  }

  if (!isParticipantAdmitted(state, participantId)) {
    return {
      ok: false,
      status: 403,
      error: "participant is not admitted"
    };
  }

  if (activeRound.submissions.some((submission) => submission.participantId === participantId)) {
    return {
      ok: false,
      status: 409,
      error: "participant has already submitted"
    };
  }

  const previous = activeRound.drafts[participantId] ?? emptyAnswers();
  const draftAnswers: RoundAnswers = {
    name: normalizeTextAnswer(inputAnswers.name ?? previous.name),
    animal: normalizeTextAnswer(inputAnswers.animal ?? previous.animal),
    place: normalizeTextAnswer(inputAnswers.place ?? previous.place),
    thing: normalizeTextAnswer(inputAnswers.thing ?? previous.thing),
    food: normalizeTextAnswer(inputAnswers.food ?? previous.food)
  };

  return {
    ok: true,
    nextState: {
      ...state,
      game: {
        ...state.game,
        activeRound: {
          ...activeRound,
          drafts: {
            ...activeRound.drafts,
            [participantId]: draftAnswers
          }
        }
      }
    }
  };
}

export function scoreRoundSubmission(
  state: StoredRoomState,
  hostToken: string,
  roundNumber: number,
  participantId: string,
  marksInput: Partial<RoundMarks>,
  nowIso = new Date().toISOString()
): ScoreSubmissionResult {
  if (isGameCancelled(state) || isGameFinished(state)) {
    return {
      ok: false,
      status: 409,
      error: "game is not accepting score changes"
    };
  }

  if (!isHostTokenValid(state, hostToken)) {
    return {
      ok: false,
      status: 401,
      error: "invalid host token"
    };
  }

  const host = hostParticipant(state);
  if (!host) {
    return {
      ok: false,
      status: 404,
      error: "host not found"
    };
  }

  if (!Number.isInteger(roundNumber) || roundNumber < 1) {
    return {
      ok: false,
      status: 400,
      error: "roundNumber must be a positive integer"
    };
  }

  const marksResult = normalizeMarks(marksInput);
  if (!marksResult.ok) {
    return marksResult;
  }

  const roundIndex = state.game.completedRounds.findIndex((round) => round.roundNumber === roundNumber);
  if (roundIndex === -1) {
    return {
      ok: false,
      status: 404,
      error: "round not found"
    };
  }

  const round = state.game.completedRounds[roundIndex];
  if (round.scorePublishedAt) {
    return {
      ok: false,
      status: 409,
      error: "round has already been published"
    };
  }

  const submissionIndex = round.submissions.findIndex((submission) => submission.participantId === participantId);
  if (submissionIndex === -1) {
    return {
      ok: false,
      status: 404,
      error: "submission not found"
    };
  }

  const nextReview: SubmissionReview = {
    marks: marksResult.marks,
    scores: {
      name: 0,
      animal: 0,
      place: 0,
      thing: 0,
      food: 0,
      total: 0
    },
    markedByParticipantId: host.id,
    markedByParticipantName: host.name,
    markedAt: nowIso
  };

  const nextSubmission: RoundSubmission = {
    ...round.submissions[submissionIndex],
    review: nextReview
  };

  const nextSubmissions = round.submissions.map((submission, index) => (index === submissionIndex ? nextSubmission : submission));
  const provisionalRound: CompletedRoundState = {
    ...round,
    submissions: nextSubmissions
  };
  const nextRound = recomputeRoundReviewScores(provisionalRound, state.game.config.scoringMode);
  const updatedSubmission = nextRound.submissions[submissionIndex];

  const nextCompletedRounds = state.game.completedRounds.map((completedRound, index) =>
    index === roundIndex ? nextRound : completedRound
  );

  return {
    ok: true,
    updatedSubmission,
    nextState: {
      ...state,
      game: {
        ...state.game,
        completedRounds: nextCompletedRounds
      }
    }
  };
}

export function publishRoundScores(
  state: StoredRoomState,
  hostToken: string,
  roundNumber: number,
  nowIso = new Date().toISOString()
): PublishRoundScoresResult {
  if (isGameCancelled(state) || isGameFinished(state)) {
    return {
      ok: false,
      status: 409,
      error: "game is not accepting score changes"
    };
  }

  if (!isHostTokenValid(state, hostToken)) {
    return {
      ok: false,
      status: 401,
      error: "invalid host token"
    };
  }

  if (!Number.isInteger(roundNumber) || roundNumber < 1) {
    return {
      ok: false,
      status: 400,
      error: "roundNumber must be a positive integer"
    };
  }

  const roundIndex = state.game.completedRounds.findIndex((round) => round.roundNumber === roundNumber);
  if (roundIndex === -1) {
    return {
      ok: false,
      status: 404,
      error: "round not found"
    };
  }

  const round = state.game.completedRounds[roundIndex];
  if (round.scorePublishedAt) {
    return {
      ok: false,
      status: 409,
      error: "round has already been published"
    };
  }

  if (!roundIsFullyReviewed(round)) {
    return {
      ok: false,
      status: 409,
      error: "all submissions must be reviewed before publishing round"
    };
  }

  const nextRound: CompletedRoundState = {
    ...round,
    scorePublishedAt: nowIso
  };

  const nextCompletedRounds = state.game.completedRounds.map((completedRound, index) =>
    index === roundIndex ? nextRound : completedRound
  );

  return {
    ok: true,
    round: nextRound,
    nextState: {
      ...state,
      game: {
        ...state.game,
        completedRounds: nextCompletedRounds
      }
    }
  };
}

export function discardRoundScores(
  state: StoredRoomState,
  hostToken: string,
  roundNumber: number,
  nowIso = new Date().toISOString()
): DiscardRoundScoresResult {
  if (isGameCancelled(state) || isGameFinished(state)) {
    return {
      ok: false,
      status: 409,
      error: "game is not accepting score changes"
    };
  }

  if (!isHostTokenValid(state, hostToken)) {
    return {
      ok: false,
      status: 401,
      error: "invalid host token"
    };
  }

  if (!Number.isInteger(roundNumber) || roundNumber < 1) {
    return {
      ok: false,
      status: 400,
      error: "roundNumber must be a positive integer"
    };
  }

  const roundIndex = state.game.completedRounds.findIndex((round) => round.roundNumber === roundNumber);
  if (roundIndex === -1) {
    return {
      ok: false,
      status: 404,
      error: "round not found"
    };
  }

  const round = state.game.completedRounds[roundIndex];
  if (round.scorePublishedAt) {
    return {
      ok: false,
      status: 409,
      error: "round has already been finalized"
    };
  }

  const discardedSubmissions = round.submissions.map((submission) => ({
    ...submission,
    review: null
  }));

  const nextRound: CompletedRoundState = {
    ...round,
    submissions: discardedSubmissions,
    scorePublishedAt: nowIso
  };

  const nextCompletedRounds = state.game.completedRounds.map((completedRound, index) =>
    index === roundIndex ? nextRound : completedRound
  );

  return {
    ok: true,
    round: nextRound,
    nextState: {
      ...state,
      game: {
        ...state.game,
        completedRounds: nextCompletedRounds
      }
    }
  };
}

export function cancelGame(
  state: StoredRoomState,
  hostToken: string,
  nowIso = new Date().toISOString()
): CancelGameResult {
  if (!isHostTokenValid(state, hostToken)) {
    return {
      ok: false,
      status: 401,
      error: "invalid host token"
    };
  }

  if (isGameCancelled(state)) {
    return {
      ok: false,
      status: 409,
      error: "game is already cancelled"
    };
  }

  if (isGameFinished(state)) {
    return {
      ok: false,
      status: 409,
      error: "game has already ended"
    };
  }

  return {
    ok: true,
    nextState: {
      ...state,
      game: {
        ...state.game,
        status: "CANCELLED",
        cancelledAt: nowIso,
        finishedAt: null,
        activeRound: null
      }
    }
  };
}

export function endGame(
  state: StoredRoomState,
  hostToken: string,
  nowIso = new Date().toISOString()
): EndGameResult {
  if (!isHostTokenValid(state, hostToken)) {
    return {
      ok: false,
      status: 401,
      error: "invalid host token"
    };
  }

  if (isGameCancelled(state)) {
    return {
      ok: false,
      status: 409,
      error: "game has been cancelled"
    };
  }

  if (isGameFinished(state)) {
    return {
      ok: false,
      status: 409,
      error: "game has already ended"
    };
  }

  if (state.game.status !== "IN_PROGRESS") {
    return {
      ok: false,
      status: 409,
      error: "game has not started"
    };
  }

  const nextCompletedRounds = state.game.completedRounds.map((round) => {
    if (round.scorePublishedAt || !roundIsFullyReviewed(round)) {
      return round;
    }

    return {
      ...round,
      scorePublishedAt: nowIso
    };
  });

  return {
    ok: true,
    nextState: {
      ...state,
      game: {
        ...state.game,
        status: "FINISHED",
        finishedAt: nowIso,
        activeRound: null,
        completedRounds: nextCompletedRounds
      }
    }
  };
}

export class GameRoom implements DurableObject {
  private readonly state: DurableObjectState;

  constructor(state: DurableObjectState, _env: unknown) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname.endsWith("/init")) {
      const payload = (await request.json()) as RoomInitPayload;
      const initialState = initializeRoomState(payload);
      await this.state.storage.put(ROOM_STORAGE_KEY, initialState);
      return json({ ok: true });
    }

    if (request.method === "GET" && url.pathname.endsWith("/state")) {
      const currentState = await this.readRoomState();
      if (!currentState) {
        return json({ error: "room not found" }, 404);
      }

      return json(buildSnapshot(currentState));
    }

    if (request.method === "POST" && url.pathname.endsWith("/join")) {
      const currentState = await this.readRoomState();
      if (!currentState) {
        return json({ error: "room not found" }, 404);
      }

      const payload = (await request.json().catch(() => ({}))) as { name?: string };
      const result = createJoinRequest(currentState, payload.name ?? "");
      if (!result.ok) {
        return json({ error: result.error }, result.status);
      }

      await this.state.storage.put(ROOM_STORAGE_KEY, result.nextState);
      const snapshot = buildSnapshot(result.nextState);
      this.broadcast({ type: "join_request", participant: result.participant, snapshot });

      return json(
        {
          requestId: result.participant.id,
          participant: result.participant,
          status: result.participant.status
        },
        202
      );
    }

    if (request.method === "POST" && url.pathname.endsWith("/admit")) {
      const currentState = await this.readRoomState();
      if (!currentState) {
        return json({ error: "room not found" }, 404);
      }

      const payload = (await request.json().catch(() => ({}))) as {
        hostToken?: string;
        requestId?: string;
        approve?: boolean;
      };

      if (!payload.hostToken || !isHostTokenValid(currentState, payload.hostToken)) {
        return json({ error: "invalid host token" }, 401);
      }

      if (!payload.requestId) {
        return json({ error: "requestId is required" }, 400);
      }

      if (typeof payload.approve !== "boolean") {
        return json({ error: "approve must be a boolean" }, 400);
      }

      const result = resolveJoinRequest(currentState, payload.requestId, payload.approve);
      if (!result.ok) {
        return json({ error: result.error }, result.status);
      }

      await this.state.storage.put(ROOM_STORAGE_KEY, result.nextState);
      const snapshot = buildSnapshot(result.nextState);
      this.broadcast({ type: "admission_update", participant: result.participant, snapshot });

      return json(snapshot);
    }

    if (request.method === "POST" && url.pathname.endsWith("/start")) {
      const currentState = await this.readRoomState();
      if (!currentState) {
        return json({ error: "room not found" }, 404);
      }

      const payload = (await request.json().catch(() => ({}))) as {
        hostToken?: string;
        config?: StartGameInput;
      };

      if (!payload.hostToken) {
        return json({ error: "hostToken is required" }, 400);
      }

      const result = startGame(currentState, payload.hostToken, payload.config);
      if (!result.ok) {
        return json({ error: result.error }, result.status);
      }

      await this.state.storage.put(ROOM_STORAGE_KEY, result.nextState);
      const snapshot = buildSnapshot(result.nextState);
      this.broadcast({ type: "game_started", snapshot });
      return json(snapshot);
    }

    if (request.method === "POST" && url.pathname.endsWith("/call")) {
      const currentState = await this.readRoomState();
      if (!currentState) {
        return json({ error: "room not found" }, 404);
      }

      const payload = (await request.json().catch(() => ({}))) as {
        participantId?: string;
        number?: number;
      };

      if (!payload.participantId) {
        return json({ error: "participantId is required" }, 400);
      }

      const result = callNumberForTurn(currentState, payload.participantId, Number(payload.number));
      if (!result.ok) {
        return json({ error: result.error }, result.status);
      }

      await this.state.storage.put(ROOM_STORAGE_KEY, result.nextState);
      if (result.activeRound.endsAt) {
        await this.state.storage.setAlarm(new Date(result.activeRound.endsAt).getTime());
      } else {
        await this.state.storage.deleteAlarm();
      }

      const snapshot = buildSnapshot(result.nextState);
      this.broadcast({ type: "turn_called", snapshot });
      return json(snapshot);
    }

    if (request.method === "POST" && url.pathname.endsWith("/submit")) {
      const currentState = await this.readRoomState();
      if (!currentState) {
        return json({ error: "room not found" }, 404);
      }

      const payload = (await request.json().catch(() => ({}))) as {
        participantId?: string;
        answers?: Partial<RoundAnswers>;
      };

      if (!payload.participantId) {
        return json({ error: "participantId is required" }, 400);
      }

      const result = submitRoundAnswers(currentState, payload.participantId, payload.answers ?? {});
      if (!result.ok) {
        return json({ error: result.error }, result.status);
      }

      await this.state.storage.put(ROOM_STORAGE_KEY, result.nextState);

      if (result.roundEnded) {
        await this.state.storage.deleteAlarm();
        const snapshot = buildSnapshot(result.nextState);
        this.broadcast({
          type: "round_ended",
          reason: result.completedRound?.endReason,
          snapshot,
          completedRound: result.completedRound
        });
        return json(snapshot);
      }

      const snapshot = buildSnapshot(result.nextState);
      this.broadcast({ type: "submission_received", participantId: result.submission.participantId, snapshot });
      return json(snapshot);
    }

    if (request.method === "POST" && url.pathname.endsWith("/draft")) {
      const currentState = await this.readRoomState();
      if (!currentState) {
        return json({ error: "room not found" }, 404);
      }

      const payload = (await request.json().catch(() => ({}))) as {
        participantId?: string;
        answers?: Partial<RoundAnswers>;
      };

      if (!payload.participantId) {
        return json({ error: "participantId is required" }, 400);
      }

      const result = updateRoundDraft(currentState, payload.participantId, payload.answers ?? {});
      if (!result.ok) {
        return json({ error: result.error }, result.status);
      }

      await this.state.storage.put(ROOM_STORAGE_KEY, result.nextState);
      return json({ ok: true });
    }

    if (request.method === "POST" && url.pathname.endsWith("/end")) {
      const currentState = await this.readRoomState();
      if (!currentState) {
        return json({ error: "room not found" }, 404);
      }

      const payload = (await request.json().catch(() => ({}))) as {
        participantId?: string;
      };

      if (!payload.participantId) {
        return json({ error: "participantId is required" }, 400);
      }

      const result = endRoundManually(currentState, payload.participantId);
      if (!result.ok) {
        return json({ error: result.error }, result.status);
      }

      await this.state.storage.put(ROOM_STORAGE_KEY, result.nextState);
      await this.state.storage.deleteAlarm();

      const snapshot = buildSnapshot(result.nextState);
      this.broadcast({ type: "round_ended", reason: result.completedRound.endReason, snapshot, completedRound: result.completedRound });
      return json(snapshot);
    }

    if (request.method === "POST" && url.pathname.endsWith("/score")) {
      const currentState = await this.readRoomState();
      if (!currentState) {
        return json({ error: "room not found" }, 404);
      }

      const payload = (await request.json().catch(() => ({}))) as {
        hostToken?: string;
        roundNumber?: number;
        participantId?: string;
        marks?: Partial<RoundMarks>;
      };

      if (!payload.hostToken) {
        return json({ error: "hostToken is required" }, 400);
      }

      if (!payload.participantId) {
        return json({ error: "participantId is required" }, 400);
      }

      const result = scoreRoundSubmission(
        currentState,
        payload.hostToken,
        Number(payload.roundNumber),
        payload.participantId,
        payload.marks ?? {}
      );
      if (!result.ok) {
        return json({ error: result.error }, result.status);
      }

      await this.state.storage.put(ROOM_STORAGE_KEY, result.nextState);
      const snapshot = buildSnapshot(result.nextState);
      this.broadcast({ type: "submission_scored", participantId: payload.participantId, roundNumber: Number(payload.roundNumber), snapshot });
      return json(snapshot);
    }

    if (request.method === "POST" && url.pathname.endsWith("/publish")) {
      const currentState = await this.readRoomState();
      if (!currentState) {
        return json({ error: "room not found" }, 404);
      }

      const payload = (await request.json().catch(() => ({}))) as {
        hostToken?: string;
        roundNumber?: number;
      };

      if (!payload.hostToken) {
        return json({ error: "hostToken is required" }, 400);
      }

      const result = publishRoundScores(currentState, payload.hostToken, Number(payload.roundNumber));
      if (!result.ok) {
        return json({ error: result.error }, result.status);
      }

      await this.state.storage.put(ROOM_STORAGE_KEY, result.nextState);
      const snapshot = buildSnapshot(result.nextState);
      this.broadcast({ type: "round_scores_published", roundNumber: Number(payload.roundNumber), snapshot });
      return json(snapshot);
    }

    if (request.method === "POST" && url.pathname.endsWith("/discard")) {
      const currentState = await this.readRoomState();
      if (!currentState) {
        return json({ error: "room not found" }, 404);
      }

      const payload = (await request.json().catch(() => ({}))) as {
        hostToken?: string;
        roundNumber?: number;
      };

      if (!payload.hostToken) {
        return json({ error: "hostToken is required" }, 400);
      }

      const result = discardRoundScores(currentState, payload.hostToken, Number(payload.roundNumber));
      if (!result.ok) {
        return json({ error: result.error }, result.status);
      }

      await this.state.storage.put(ROOM_STORAGE_KEY, result.nextState);
      const snapshot = buildSnapshot(result.nextState);
      this.broadcast({ type: "round_scores_discarded", roundNumber: Number(payload.roundNumber), snapshot });
      return json(snapshot);
    }

    if (request.method === "POST" && url.pathname.endsWith("/cancel")) {
      const currentState = await this.readRoomState();
      if (!currentState) {
        return json({ error: "room not found" }, 404);
      }

      const payload = (await request.json().catch(() => ({}))) as {
        hostToken?: string;
      };

      if (!payload.hostToken) {
        return json({ error: "hostToken is required" }, 400);
      }

      const result = cancelGame(currentState, payload.hostToken);
      if (!result.ok) {
        return json({ error: result.error }, result.status);
      }

      await this.state.storage.put(ROOM_STORAGE_KEY, result.nextState);
      await this.state.storage.deleteAlarm();
      const snapshot = buildSnapshot(result.nextState);
      this.broadcast({ type: "game_cancelled", snapshot });
      return json(snapshot);
    }

    if (request.method === "POST" && url.pathname.endsWith("/finish")) {
      const currentState = await this.readRoomState();
      if (!currentState) {
        return json({ error: "room not found" }, 404);
      }

      const payload = (await request.json().catch(() => ({}))) as {
        hostToken?: string;
      };

      if (!payload.hostToken) {
        return json({ error: "hostToken is required" }, 400);
      }

      const result = endGame(currentState, payload.hostToken);
      if (!result.ok) {
        return json({ error: result.error }, result.status);
      }

      await this.state.storage.put(ROOM_STORAGE_KEY, result.nextState);
      await this.state.storage.deleteAlarm();
      const snapshot = buildSnapshot(result.nextState);
      this.broadcast({ type: "game_ended", snapshot });
      return json(snapshot);
    }

    if (request.headers.get("Upgrade")?.toLowerCase() === "websocket") {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      this.state.acceptWebSocket(server);
      server.send(JSON.stringify({ type: "connected" }));
      const currentState = await this.readRoomState();
      if (currentState) {
        server.send(JSON.stringify({ type: "snapshot", snapshot: buildSnapshot(currentState) }));
      }
      this.broadcastPresence();

      return new Response(null, {
        status: 101,
        webSocket: client
      });
    }

    return json({ error: "Not found" }, 404);
  }

  async alarm(): Promise<void> {
    const currentState = await this.readRoomState();
    if (!currentState) {
      return;
    }

    if (currentState.game.status !== "IN_PROGRESS" || !currentState.game.activeRound) {
      return;
    }

    const activeRound = currentState.game.activeRound;
    if (!activeRound.endsAt) {
      return;
    }

    if (Date.now() < new Date(activeRound.endsAt).getTime()) {
      await this.state.storage.setAlarm(new Date(activeRound.endsAt).getTime());
      return;
    }

    const result = finalizeRoundWithForcedSubmissions(currentState, "TIMER");
    if (!result.ok) {
      return;
    }

    await this.state.storage.put(ROOM_STORAGE_KEY, result.nextState);
    await this.state.storage.deleteAlarm();

    const snapshot = buildSnapshot(result.nextState);
    this.broadcast({ type: "round_ended", reason: "TIMER", snapshot, completedRound: result.completedRound });
  }

  webSocketMessage(_ws: WebSocket, message: string | ArrayBuffer): void {
    const messageText = typeof message === "string" ? message : new TextDecoder().decode(message);

    let payload: unknown;
    try {
      payload = JSON.parse(messageText);
    } catch {
      return;
    }

    this.broadcast({ type: "event", payload });
  }

  webSocketClose(_ws: WebSocket): void {
    this.broadcastPresence();
  }

  private async readRoomState(): Promise<StoredRoomState | null> {
    return (await this.state.storage.get<StoredRoomState>(ROOM_STORAGE_KEY)) ?? null;
  }

  private broadcast(payload: unknown): void {
    const websockets = this.state.getWebSockets();
    const message = JSON.stringify(payload);
    for (const socket of websockets) {
      socket.send(message);
    }
  }

  private broadcastPresence(): void {
    const count = this.state.getWebSockets().length;
    this.broadcast({ type: "presence", count });
  }
}
