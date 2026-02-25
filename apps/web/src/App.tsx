import { FormEvent, type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import {
  cancelGameRoom,
  callTurnNumber,
  connectRoomSocket,
  createRoom,
  discardRoundScores,
  endRoundNow,
  endGameRoom,
  getRoomState,
  reviewJoinRequest,
  scoreRoundSubmission,
  publishRoundScores,
  startGame,
  submitJoinRequest,
  submitRoundAnswers,
  updateRoundDraft,
  type CreateRoomResponse,
  type JoinRoomResponse,
  type ManualEndPolicy,
  type RoundAnswerInput,
  type RoundMarks,
  type ScoringMode,
  type RoomSocketEvent,
  type RoomStateResponse,
  type RoundSubmission
} from "./api";
import {
  playNotificationSound,
  playRoundEndSound,
  playSubmissionSound,
  playTurnStartSound,
  startRoundTimerSong,
  stopRoundTimerSong
} from "./sound";

const SESSION_KEY_PREFIX = "i-call-on:session:";
const DRAFT_KEY_PREFIX = "i-call-on:draft:";
const LETTERS = Array.from({ length: 26 }, (_, index) => ({ number: index + 1, letter: String.fromCharCode(65 + index) }));
const ROUND_FIELDS: Array<{ key: keyof RoundAnswerInput; label: string }> = [
  { key: "name", label: "Name" },
  { key: "animal", label: "Animal" },
  { key: "thing", label: "Thing" },
  { key: "food", label: "Food" },
  { key: "place", label: "Place" }
];

type RoomParticipantSession = {
  participantId: string;
  participantName: string;
  isHost: boolean;
  hostToken?: string;
};

type StoredRoundDraft = {
  roomCode: string;
  participantId: string;
  roundNumber: number;
  answers: RoundAnswerInput;
  updatedAt: string;
};

type RoundEndPreset = "HOST_OR_TIMER" | "CALLER_OR_TIMER" | "TIMER_ONLY";
type MobileGamePanel = "PLAY" | "SCORES" | "DETAILS";

function parseJoinRoomCode(pathname: string): string | null {
  const match = pathname.match(/^\/join\/([A-Za-z0-9]+)\/?$/);
  if (!match) {
    return null;
  }

  return match[1].toUpperCase();
}

function parseGameRoomCode(pathname: string): string | null {
  const match = pathname.match(/^\/game\/([A-Za-z0-9]+)\/?$/);
  if (!match) {
    return null;
  }

  return match[1].toUpperCase();
}

function parseSocketEvent(message: MessageEvent<string>): RoomSocketEvent | null {
  try {
    return JSON.parse(message.data) as RoomSocketEvent;
  } catch {
    return null;
  }
}

function navigate(nextPath: string, setPathname: (value: string) => void): void {
  window.history.pushState({}, "", nextPath);
  setPathname(window.location.pathname);
}

function roomSessionKey(roomCode: string): string {
  return `${SESSION_KEY_PREFIX}${roomCode.toUpperCase()}`;
}

function saveRoomSession(roomCode: string, session: RoomParticipantSession): void {
  try {
    window.localStorage.setItem(roomSessionKey(roomCode), JSON.stringify(session));
  } catch {
    // Ignore localStorage failures.
  }
}

function readRoomSession(roomCode: string): RoomParticipantSession | null {
  try {
    const raw = window.localStorage.getItem(roomSessionKey(roomCode));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<RoomParticipantSession>;
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

function clearRoomSession(roomCode: string): void {
  try {
    window.localStorage.removeItem(roomSessionKey(roomCode));
  } catch {
    // Ignore localStorage failures.
  }
}

function roundDraftKey(roomCode: string, participantId: string, roundNumber: number): string {
  return `${DRAFT_KEY_PREFIX}${roomCode.toUpperCase()}:${participantId}:${roundNumber}`;
}

function saveRoundDraft(roomCode: string, participantId: string, roundNumber: number, answers: RoundAnswerInput): void {
  try {
    const payload: StoredRoundDraft = {
      roomCode: roomCode.toUpperCase(),
      participantId,
      roundNumber,
      answers,
      updatedAt: new Date().toISOString()
    };

    window.localStorage.setItem(roundDraftKey(roomCode, participantId, roundNumber), JSON.stringify(payload));
  } catch {
    // Ignore localStorage failures.
  }
}

function readRoundDraft(roomCode: string, participantId: string, roundNumber: number): RoundAnswerInput | null {
  try {
    const raw = window.localStorage.getItem(roundDraftKey(roomCode, participantId, roundNumber));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<StoredRoundDraft>;
    const answers = parsed.answers;
    if (!answers || typeof answers !== "object") {
      return null;
    }

    if (
      typeof answers.name !== "string" ||
      typeof answers.animal !== "string" ||
      typeof answers.place !== "string" ||
      typeof answers.thing !== "string" ||
      typeof answers.food !== "string"
    ) {
      return null;
    }

    return {
      name: answers.name,
      animal: answers.animal,
      place: answers.place,
      thing: answers.thing,
      food: answers.food
    };
  } catch {
    return null;
  }
}

function clearRoundDraft(roomCode: string, participantId: string, roundNumber: number): void {
  try {
    window.localStorage.removeItem(roundDraftKey(roomCode, participantId, roundNumber));
  } catch {
    // Ignore localStorage failures.
  }
}

function clearAllRoundDraftsForParticipant(roomCode: string, participantId: string): void {
  try {
    const prefix = `${DRAFT_KEY_PREFIX}${roomCode.toUpperCase()}:${participantId}:`;
    const keysToDelete: string[] = [];

    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (key && key.startsWith(prefix)) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      window.localStorage.removeItem(key);
    }
  } catch {
    // Ignore localStorage failures.
  }
}

function emptyRoundAnswers(): RoundAnswerInput {
  return {
    name: "",
    animal: "",
    place: "",
    thing: "",
    food: ""
  };
}

function roundAnswersSignature(answers: RoundAnswerInput): string {
  return JSON.stringify(answers);
}

function defaultMarks(): RoundMarks {
  return {
    name: false,
    animal: false,
    place: false,
    thing: false,
    food: false
  };
}

function CopyIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function marksFromSubmission(submission: RoundSubmission): RoundMarks {
  return submission.review?.marks ?? defaultMarks();
}

function lettersFromNumbers(numbers: number[]): string {
  if (numbers.length === 0) {
    return "None";
  }

  return numbers.map((number) => String.fromCharCode(64 + number)).join(", ");
}

function formatTimerDisplay(seconds: number | null): string {
  if (seconds === null || Number.isNaN(seconds)) {
    return "--:--";
  }

  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60)
    .toString()
    .padStart(2, "0");
  const remainder = (safe % 60).toString().padStart(2, "0");
  return `${minutes}:${remainder}`;
}

function manualPolicyFromPreset(preset: RoundEndPreset): ManualEndPolicy {
  if (preset === "CALLER_OR_TIMER") {
    return "CALLER_OR_TIMER";
  }

  if (preset === "TIMER_ONLY") {
    return "NONE";
  }

  return "HOST_OR_CALLER";
}

function roundEndRuleLabel(config: RoomStateResponse["game"]["config"]): string {
  if (config.endRule === "TIMER") {
    if (config.manualEndPolicy === "CALLER_OR_TIMER" || config.manualEndPolicy === "CALLER_ONLY") {
      return "Current caller or timer";
    }

    if (config.manualEndPolicy === "NONE") {
      return "Timer only";
    }

    return "Host or timer";
  }

  if (config.endRule === "FIRST_SUBMISSION") {
    return "First submission only (legacy)";
  }

  return "Whichever comes first (legacy)";
}

function scoringModeLabel(mode: ScoringMode): string {
  return mode === "SHARED_10" ? "Shared 10 by matching answers" : "Fixed 10/0";
}

function wasSubmissionRecorded(
  snapshot: RoomStateResponse,
  participantId: string,
  roundNumber: number | null
): boolean {
  if (roundNumber === null) {
    return false;
  }

  if (
    snapshot.game.activeRound &&
    snapshot.game.activeRound.roundNumber === roundNumber &&
    snapshot.game.activeRound.submissions.some((entry) => entry.participantId === participantId)
  ) {
    return true;
  }

  const completed = snapshot.game.completedRounds.find((entry) => entry.roundNumber === roundNumber);
  if (!completed) {
    return false;
  }

  return completed.submissions.some((entry) => entry.participantId === participantId);
}

function snapshotFromEvent(event: RoomSocketEvent): RoomStateResponse | null {
  if (
    event.type === "snapshot" ||
    event.type === "join_request" ||
    event.type === "admission_update" ||
    event.type === "game_started" ||
    event.type === "turn_called" ||
    event.type === "submission_received" ||
    event.type === "round_ended" ||
    event.type === "submission_scored" ||
    event.type === "round_scores_published" ||
    event.type === "round_scores_discarded" ||
    event.type === "game_cancelled" ||
    event.type === "game_ended"
  ) {
    return event.snapshot;
  }

  return null;
}

function HostCreateCard({ onNavigate }: { onNavigate: (path: string) => void }) {
  const [hostName, setHostName] = useState("");
  const [maxParticipants, setMaxParticipants] = useState(10);
  const [roundSeconds, setRoundSeconds] = useState(20);
  const [roundEndPreset, setRoundEndPreset] = useState<RoundEndPreset>("HOST_OR_TIMER");
  const [scoringMode, setScoringMode] = useState<ScoringMode>("FIXED_10");
  const [creating, setCreating] = useState(false);
  const [actionLoadingKey, setActionLoadingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [room, setRoom] = useState<CreateRoomResponse | null>(null);
  const [roomState, setRoomState] = useState<RoomStateResponse | null>(null);
  const [connectedClients, setConnectedClients] = useState(0);
  const [copiedJoinLink, setCopiedJoinLink] = useState(false);

  const joinUrl = useMemo(() => {
    if (!room) {
      return "";
    }

    return `${window.location.origin}/join/${room.roomCode}`;
  }, [room]);

  const pendingParticipants = useMemo(
    () => roomState?.participants.filter((participant) => participant.status === "PENDING") ?? [],
    [roomState]
  );

  const canStartGame =
    !!roomState && roomState.game.status === "LOBBY" && pendingParticipants.length === 0 && roomState.counts.admitted >= 2;
  const canCancelGame = !!roomState && roomState.game.status === "LOBBY";

  useEffect(() => {
    if (!room) {
      return;
    }

    const socket = connectRoomSocket(room.roomCode);

    socket.onmessage = (message) => {
      const payload = parseSocketEvent(message as MessageEvent<string>);
      if (!payload) {
        return;
      }

      if (payload.type === "presence") {
        setConnectedClients(payload.count);
        return;
      }

      const snapshot = snapshotFromEvent(payload);
      if (snapshot) {
        setRoomState(snapshot);
      }

      if (payload.type === "join_request") {
        playNotificationSound();
      }
    };

    return () => {
      socket.close();
    };
  }, [room]);

  const onCreateRoom = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setCreating(true);

    try {
      const created = await createRoom(hostName.trim(), maxParticipants);
      setRoom(created);
      saveRoomSession(created.roomCode, {
        participantId: "host",
        participantName: created.hostName,
        isHost: true,
        hostToken: created.hostToken
      });
      const initialState = await getRoomState(created.roomCode);
      setRoomState(initialState);
    } catch (submitError) {
      setRoom(null);
      setRoomState(null);
      setError(submitError instanceof Error ? submitError.message : "Unknown error");
    } finally {
      setCreating(false);
    }
  };

  const onReview = async (requestId: string, approve: boolean) => {
    if (!room) {
      return;
    }

    const actionKey = `${requestId}:${approve ? "approve" : "reject"}`;
    setActionLoadingKey(actionKey);
    setError(null);

    try {
      const nextState = await reviewJoinRequest(room.roomCode, room.hostToken, requestId, approve);
      setRoomState(nextState);
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "Unable to process admission action");
    } finally {
      setActionLoadingKey(null);
    }
  };

  const onStartGame = async () => {
    if (!room) {
      return;
    }

    setActionLoadingKey("start-game");
    setError(null);

    try {
      await startGame(room.roomCode, room.hostToken, {
        roundSeconds,
        endRule: "TIMER",
        manualEndPolicy: manualPolicyFromPreset(roundEndPreset),
        scoringMode
      });
      onNavigate(`/game/${room.roomCode}`);
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : "Unable to start game");
    } finally {
      setActionLoadingKey(null);
    }
  };

  const onCancelGame = async () => {
    if (!room) {
      return;
    }

    setActionLoadingKey("cancel-game");
    setError(null);

    try {
      const nextState = await cancelGameRoom(room.roomCode, room.hostToken);
      setRoomState(nextState);
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : "Unable to cancel game");
    } finally {
      setActionLoadingKey(null);
    }
  };

  const onCopyJoinLink = async () => {
    if (!joinUrl) {
      return;
    }

    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopiedJoinLink(true);
      window.setTimeout(() => setCopiedJoinLink(false), 1200);
    } catch {
      setError("Unable to copy link");
    }
  };

  const onCreateAnotherRoom = () => {
    setRoom(null);
    setRoomState(null);
    setConnectedClients(0);
    setCopiedJoinLink(false);
    setActionLoadingKey(null);
    setError(null);
  };

  return (
    <section className="card">
      <h1>I Call On</h1>
      <p className="subtitle">Host a room, admit players, and launch a real-time letter round.</p>

      {!room ? (
        <form onSubmit={onCreateRoom} className="form" aria-label="create-room-form">
          <label htmlFor="hostName">Host name</label>
          <input
            id="hostName"
            value={hostName}
            onChange={(event) => setHostName(event.target.value)}
            placeholder="e.g. Qudus"
            required
            minLength={2}
            maxLength={24}
          />

          <label htmlFor="maxParticipants">Max participants (including host): {maxParticipants}</label>
          <input
            id="maxParticipants"
            type="range"
            min={1}
            max={10}
            value={maxParticipants}
            onChange={(event) => setMaxParticipants(Number(event.target.value))}
          />

          <button type="submit" disabled={creating}>
            {creating ? "Creating room..." : "Create room"}
          </button>
        </form>
      ) : null}

      {error ? <p className="error">{error}</p> : null}

      {room ? (
        <div className="result">
          <h2>Room created</h2>
          <p>
            Room code: <strong>{room.roomCode}</strong>
          </p>
          <p>
            Share link: <code>{joinUrl}</code>
          </p>
          <div className="row-actions">
            <button type="button" className="icon-btn" onClick={onCopyJoinLink} aria-label="copy-join-link">
              <CopyIcon />
              <span>{copiedJoinLink ? "Copied" : "Copy link"}</span>
            </button>
            <button type="button" className="secondary-btn" onClick={onCreateAnotherRoom} aria-label="create-another-room">
              Create another room
            </button>
          </div>

          <h3>Round settings</h3>
          <div className="form">
            <label htmlFor="roundSeconds">Round seconds</label>
            <input
              id="roundSeconds"
              type="number"
              min={5}
              max={120}
              value={roundSeconds}
              onChange={(event) => setRoundSeconds(Number(event.target.value))}
            />

            <label htmlFor="endRule">Round end rule</label>
            <select id="endRule" value={roundEndPreset} onChange={(event) => setRoundEndPreset(event.target.value as RoundEndPreset)}>
              <option value="HOST_OR_TIMER">Host or timer</option>
              <option value="CALLER_OR_TIMER">Current caller or timer</option>
              <option value="TIMER_ONLY">Timer only</option>
            </select>

            <label htmlFor="scoringMode">Scoring mode</label>
            <select id="scoringMode" value={scoringMode} onChange={(event) => setScoringMode(event.target.value as ScoringMode)}>
              <option value="FIXED_10">Fixed 10/0 per field</option>
              <option value="SHARED_10">Shared 10 by matching answers</option>
            </select>
          </div>

          <h3>Host controls</h3>
          <p>
            Connected clients: <strong>{connectedClients}</strong>
          </p>

          {roomState ? (
            <>
              <p>
                Game status: <strong>{roomState.game.status}</strong>
              </p>
              <p>
                Admitted players: <strong>{roomState.counts.admitted}</strong> / {roomState.meta.maxParticipants}
              </p>
              <p>
                Pending requests: <strong>{roomState.counts.pending}</strong>
              </p>
              {roomState.game.status !== "LOBBY" ? <p className="hint">Join link is expired for this room.</p> : null}

              {pendingParticipants.length > 0 ? (
                <ul className="pending-list">
                  {pendingParticipants.map((participant) => {
                    const approveKey = `${participant.id}:approve`;
                    const rejectKey = `${participant.id}:reject`;
                    return (
                      <li key={participant.id} className="pending-item">
                        <span>{participant.name}</span>
                        <div className="row-actions">
                          <button
                            type="button"
                            onClick={() => onReview(participant.id, true)}
                            disabled={!!actionLoadingKey || roomState.game.status !== "LOBBY"}
                          >
                            {actionLoadingKey === approveKey ? "Approving..." : "Approve"}
                          </button>
                          <button
                            type="button"
                            onClick={() => onReview(participant.id, false)}
                            disabled={!!actionLoadingKey || roomState.game.status !== "LOBBY"}
                          >
                            {actionLoadingKey === rejectKey ? "Rejecting..." : "Reject"}
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="hint">No pending join requests.</p>
              )}

              <button type="button" onClick={onStartGame} disabled={!canStartGame || !!actionLoadingKey}>
                {actionLoadingKey === "start-game" ? "Starting..." : "Start game"}
              </button>
              {roomState.counts.admitted < 2 ? <p className="hint">At least 2 admitted players are required to start.</p> : null}
              <button type="button" onClick={onCancelGame} disabled={!canCancelGame || !!actionLoadingKey}>
                {actionLoadingKey === "cancel-game" ? "Expiring..." : "Expire link"}
              </button>
              {roomState.game.status === "CANCELLED" ? (
                <p className="error">Game cancelled. Join link has expired and no new players can enter.</p>
              ) : null}
            </>
          ) : (
            <p className="hint">Connecting to live lobby updates...</p>
          )}
        </div>
      ) : null}
    </section>
  );
}

function JoinRoomCard({ roomCode, onNavigate }: { roomCode: string; onNavigate: (path: string) => void }) {
  const [loadingRoom, setLoadingRoom] = useState(true);
  const [roomState, setRoomState] = useState<RoomStateResponse | null>(null);
  const [participantName, setParticipantName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [joinResult, setJoinResult] = useState<JoinRoomResponse | null>(null);
  const [connectedClients, setConnectedClients] = useState(0);
  const requestIdRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoadingRoom(true);
      setError(null);

      try {
        const state = await getRoomState(roomCode);
        if (!cancelled) {
          setRoomState(state);
        }
      } catch (loadError) {
        if (!cancelled) {
          setRoomState(null);
          setError(loadError instanceof Error ? loadError.message : "Unable to load room");
        }
      } finally {
        if (!cancelled) {
          setLoadingRoom(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [roomCode]);

  useEffect(() => {
    const socket = connectRoomSocket(roomCode);

    socket.onmessage = (message) => {
      const payload = parseSocketEvent(message as MessageEvent<string>);
      if (!payload) {
        return;
      }

      if (payload.type === "presence") {
        setConnectedClients(payload.count);
        return;
      }

      const snapshot = snapshotFromEvent(payload);
      if (snapshot) {
        setRoomState(snapshot);
      }

      if (payload.type === "admission_update" && requestIdRef.current && payload.participant.id === requestIdRef.current) {
        if (payload.participant.status === "ADMITTED") {
          saveRoomSession(roomCode, {
            participantId: payload.participant.id,
            participantName: payload.participant.name,
            isHost: false
          });
          playNotificationSound();
          onNavigate(`/game/${roomCode}`);
          return;
        }

        if (payload.participant.status === "REJECTED") {
          setError("Join request was rejected by host.");
        }
      }

      if (payload.type === "game_cancelled") {
        setError("This room has been cancelled by the host. Join link has expired.");
      }

      if (payload.type === "game_ended") {
        setError("Game has ended. Join link is expired.");
      }

      if (payload.type === "turn_called") {
        playTurnStartSound();
      }

      if (payload.type === "submission_received") {
        playSubmissionSound();
      }

      if (payload.type === "round_ended") {
        playRoundEndSound();
      }
    };

    return () => {
      socket.close();
    };
  }, [onNavigate, roomCode]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (roomState?.game.status !== "LOBBY") {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await submitJoinRequest(roomCode, participantName.trim());
      requestIdRef.current = response.requestId;
      setJoinResult(response);
    } catch (submitError) {
      setJoinResult(null);
      requestIdRef.current = null;
      setError(submitError instanceof Error ? submitError.message : "Unable to submit request");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="card">
      <h1>Join Room</h1>
      <p className="subtitle">
        Room code: <strong>{roomCode}</strong>
      </p>

      {loadingRoom ? <p>Loading room...</p> : null}

      {roomState ? (
        <div className="result">
          <p>
            Host: <strong>{roomState.meta.hostName}</strong>
          </p>
          <p>
            Game status: <strong>{roomState.game.status}</strong>
          </p>
          <p>
            Admitted players: <strong>{roomState.counts.admitted}</strong> / {roomState.meta.maxParticipants}
          </p>
          <p>
            Pending requests: <strong>{roomState.counts.pending}</strong>
          </p>
          <p>
            Connected clients: <strong>{connectedClients}</strong>
          </p>
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="form" aria-label="join-room-form">
        <label htmlFor="participantName">Your name</label>
        <input
          id="participantName"
          value={participantName}
          onChange={(event) => setParticipantName(event.target.value)}
          placeholder="e.g. Ada"
          required
          minLength={2}
          maxLength={24}
        />

        <button type="submit" disabled={submitting || loadingRoom || !roomState || roomState.game.status !== "LOBBY"}>
          {submitting ? "Submitting..." : "Request to join"}
        </button>
      </form>

      {roomState && roomState.game.status !== "LOBBY" ? (
        <p className="error">Join link has expired for this room.</p>
      ) : null}

      {joinResult ? (
        <p className="success">
          Join request submitted. Status: <strong>{joinResult.status}</strong>. Waiting for host approval.
        </p>
      ) : null}

      {error ? <p className="error">{error}</p> : null}
    </section>
  );
}

function GameBoardCard({ roomCode, onNavigate }: { roomCode: string; onNavigate: (path: string) => void }) {
  const [loadingRoom, setLoadingRoom] = useState(true);
  const [roomState, setRoomState] = useState<RoomStateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connectedClients, setConnectedClients] = useState(0);
  const [calling, setCalling] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [endingRound, setEndingRound] = useState(false);
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [roundAnswers, setRoundAnswers] = useState<RoundAnswerInput>(emptyRoundAnswers());
  const [nowEpoch, setNowEpoch] = useState(() => Date.now());
  const [isCompactLayout, setIsCompactLayout] = useState(() => {
    if (typeof window.matchMedia === "function") {
      return window.matchMedia("(max-width: 980px)").matches;
    }

    return window.innerWidth <= 980;
  });
  const [mobilePanel, setMobilePanel] = useState<MobileGamePanel>("PLAY");
  const [participantSession, setParticipantSession] = useState<RoomParticipantSession | null>(() => readRoomSession(roomCode));
  const activeCallerIdRef = useRef<string | null>(null);
  const previousRoundNumberRef = useRef<number | null>(null);
  const draftSyncTimeoutRef = useRef<number | null>(null);
  const lastDraftSignatureRef = useRef<string>(roundAnswersSignature(emptyRoundAnswers()));

  useEffect(() => {
    setParticipantSession(readRoomSession(roomCode));
  }, [roomCode]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoadingRoom(true);
      setError(null);

      try {
        const state = await getRoomState(roomCode);
        if (!cancelled) {
          setRoomState(state);
        }
      } catch (loadError) {
        if (!cancelled) {
          setRoomState(null);
          setError(loadError instanceof Error ? loadError.message : "Unable to load game state");
        }
      } finally {
        if (!cancelled) {
          setLoadingRoom(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [roomCode]);

  useEffect(() => {
    const socket = connectRoomSocket(roomCode);

    socket.onmessage = (message) => {
      const payload = parseSocketEvent(message as MessageEvent<string>);
      if (!payload) {
        return;
      }

      if (payload.type === "presence") {
        setConnectedClients(payload.count);
        return;
      }

      const snapshot = snapshotFromEvent(payload);
      if (snapshot) {
        setRoomState(snapshot);
      }

      if (payload.type === "turn_called") {
        setRoundAnswers(emptyRoundAnswers());
        lastDraftSignatureRef.current = "";
        playTurnStartSound();
      }

      if (payload.type === "submission_received") {
        playSubmissionSound();
        if (payload.participantId === activeCallerIdRef.current) {
          stopRoundTimerSong();
        }
      }

      if (payload.type === "round_ended") {
        stopRoundTimerSong();
        playRoundEndSound();
        setRoundAnswers(emptyRoundAnswers());
        lastDraftSignatureRef.current = "";
      }

      if (payload.type === "round_scores_published") {
        playNotificationSound();
      }

      if (payload.type === "round_scores_discarded") {
        playNotificationSound();
      }

      if (payload.type === "game_started") {
        playNotificationSound();
      }

      if (payload.type === "game_cancelled") {
        stopRoundTimerSong();
        playNotificationSound();
        setError("Game cancelled by host. This room is now closed.");
      }

      if (payload.type === "game_ended") {
        stopRoundTimerSong();
        playNotificationSound();
        setError("Game ended by host. Final results are now available.");
      }
    };

    return () => {
      if (draftSyncTimeoutRef.current !== null) {
        window.clearTimeout(draftSyncTimeoutRef.current);
        draftSyncTimeoutRef.current = null;
      }
      socket.close();
      stopRoundTimerSong();
    };
  }, [roomCode]);

  useEffect(() => {
    if (!roomState?.game.activeRound) {
      return;
    }

    const timer = window.setInterval(() => {
      setNowEpoch(Date.now());
    }, 500);

    return () => {
      window.clearInterval(timer);
    };
  }, [roomState?.game.activeRound]);

  useEffect(() => {
    if (typeof window.matchMedia === "function") {
      const mediaQuery = window.matchMedia("(max-width: 980px)");
      const syncLayout = () => {
        setIsCompactLayout(mediaQuery.matches);
      };

      syncLayout();

      if (typeof mediaQuery.addEventListener === "function") {
        mediaQuery.addEventListener("change", syncLayout);
        return () => {
          mediaQuery.removeEventListener("change", syncLayout);
        };
      }

      mediaQuery.addListener(syncLayout);
      return () => {
        mediaQuery.removeListener(syncLayout);
      };
    }

    const onResize = () => {
      setIsCompactLayout(window.innerWidth <= 980);
    };

    onResize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
    };
  }, []);

  useEffect(() => {
    if (!isCompactLayout) {
      setMobilePanel("PLAY");
      return;
    }

    if (roomState?.game.status === "FINISHED") {
      setMobilePanel("SCORES");
    }
  }, [isCompactLayout, roomState?.game.status]);

  const participantsById = useMemo(() => {
    const map = new Map<string, { name: string; status: string; isHost: boolean }>();
    for (const participant of roomState?.participants ?? []) {
      map.set(participant.id, { name: participant.name, status: participant.status, isHost: participant.isHost });
    }
    return map;
  }, [roomState?.participants]);

  const participantId = participantSession?.participantId ?? null;
  const me = participantId ? roomState?.participants.find((participant) => participant.id === participantId) ?? null : null;
  const isAdmitted = me?.status === "ADMITTED";
  const isHost = !!me?.isHost;
  const hostToken = participantSession?.hostToken ?? null;

  const scoring = roomState?.game.scoring;
  const usedNumberSet = useMemo(() => new Set(scoring?.usedNumbers ?? []), [scoring?.usedNumbers]);
  const showLeaderboard = !!scoring && roomState?.game.status !== "LOBBY";
  const topLeaderboardEntry = scoring?.leaderboard[0] ?? null;

  const activeRound = roomState?.game.activeRound ?? null;
  const completedRounds = roomState?.game.completedRounds ?? [];
  const unpublishedRounds = useMemo(
    () => completedRounds.filter((round) => !round.scorePublishedAt),
    [completedRounds]
  );

  const currentTurnParticipantId = roomState?.game.currentTurnParticipantId ?? null;
  const isMyTurn = !!participantId && participantId === currentTurnParticipantId;
  const alreadySubmitted = !!participantId && !!activeRound?.submissions.some((entry) => entry.participantId === participantId);
  const activeRoundNumber = activeRound?.roundNumber ?? null;

  const countdownEndsAtEpoch = activeRound ? new Date(activeRound.countdownEndsAt).getTime() : null;
  const endsAtEpoch = activeRound?.endsAt ? new Date(activeRound.endsAt).getTime() : null;
  const countdownSecondsLeft = countdownEndsAtEpoch ? Math.max(0, Math.ceil((countdownEndsAtEpoch - nowEpoch) / 1000)) : null;
  const showLetterModal = !!activeRound && !!countdownEndsAtEpoch && nowEpoch < countdownEndsAtEpoch;
  const isRoundOpen = !!activeRound && !!countdownEndsAtEpoch && nowEpoch >= countdownEndsAtEpoch;
  const timerSecondsLeft =
    isRoundOpen && endsAtEpoch
      ? Math.max(0, Math.ceil((endsAtEpoch - nowEpoch) / 1000))
      : activeRound?.endsAt
        ? roomState?.game.config.roundSeconds ?? null
        : null;

  const sidebarTimer = useMemo(() => {
    if (!activeRound) {
      return {
        label: "Round Timer",
        value: "--:--",
        hint: "Waiting for next letter"
      };
    }

    if (showLetterModal) {
      return {
        label: "Starting In",
        value: formatTimerDisplay(countdownSecondsLeft),
        hint: `R${activeRound.roundNumber} · Letter ${activeRound.activeLetter}`
      };
    }

    if (activeRound.endsAt) {
      return {
        label: "Time Left",
        value: formatTimerDisplay(timerSecondsLeft),
        hint: `R${activeRound.roundNumber} · Letter ${activeRound.activeLetter}`
      };
    }

    return {
      label: "No Timer",
      value: "∞",
      hint: `R${activeRound.roundNumber} · Letter ${activeRound.activeLetter}`
    };
  }, [activeRound, countdownSecondsLeft, showLetterModal, timerSecondsLeft]);

  const shouldPlayTimerSong = !!activeRound && !!activeRound.endsAt && isRoundOpen;

  useEffect(() => {
    activeCallerIdRef.current = activeRound?.turnParticipantId ?? null;
  }, [activeRound?.turnParticipantId]);

  useEffect(() => {
    if (!participantId || !isAdmitted || activeRoundNumber === null) {
      setRoundAnswers(emptyRoundAnswers());
      lastDraftSignatureRef.current = roundAnswersSignature(emptyRoundAnswers());
      return;
    }

    if (alreadySubmitted) {
      setRoundAnswers(emptyRoundAnswers());
      lastDraftSignatureRef.current = roundAnswersSignature(emptyRoundAnswers());
      clearRoundDraft(roomCode, participantId, activeRoundNumber);
      return;
    }

    const restored = readRoundDraft(roomCode, participantId, activeRoundNumber);
    if (restored) {
      setRoundAnswers(restored);
      // Force a background sync for locally restored drafts.
      lastDraftSignatureRef.current = "";
      return;
    }

    setRoundAnswers(emptyRoundAnswers());
    lastDraftSignatureRef.current = roundAnswersSignature(emptyRoundAnswers());
  }, [activeRoundNumber, alreadySubmitted, isAdmitted, participantId, roomCode]);

  useEffect(() => {
    if (!participantId) {
      previousRoundNumberRef.current = null;
      return;
    }

    const previousRound = previousRoundNumberRef.current;
    if (previousRound !== null && previousRound !== activeRoundNumber) {
      clearRoundDraft(roomCode, participantId, previousRound);
    }

    if (alreadySubmitted && activeRoundNumber !== null) {
      clearRoundDraft(roomCode, participantId, activeRoundNumber);
    }

    previousRoundNumberRef.current = activeRoundNumber;
  }, [activeRoundNumber, alreadySubmitted, participantId, roomCode]);

  useEffect(() => {
    if (shouldPlayTimerSong) {
      startRoundTimerSong();
      return;
    }

    stopRoundTimerSong();
  }, [shouldPlayTimerSong]);

  useEffect(() => {
    return () => {
      stopRoundTimerSong();
    };
  }, []);

  const canCallLetter =
    !!roomState &&
    roomState.game.status === "IN_PROGRESS" &&
    !activeRound &&
    unpublishedRounds.length === 0 &&
    isMyTurn &&
    isAdmitted &&
    !calling &&
    !(scoring?.isComplete ?? false);

  const canSubmitAnswers =
    !!roomState && roomState.game.status === "IN_PROGRESS" && !!activeRound && isAdmitted && isRoundOpen && !alreadySubmitted && !submitting;

  const canEndRoundEarly =
    !!activeRound &&
    !!participantId &&
    isAdmitted &&
    !endingRound &&
    (() => {
      const policy = roomState?.game.config.manualEndPolicy ?? "HOST_OR_CALLER";
      const isCaller = participantId === activeRound.turnParticipantId;

      if (policy === "HOST_OR_CALLER") {
        return isHost || isCaller;
      }

      if (policy === "CALLER_ONLY" || policy === "CALLER_OR_TIMER") {
        return isCaller;
      }

      return false;
    })();

  const canScoreSubmissions = isHost && !!hostToken;
  const canEndGame = !!roomState && roomState.game.status === "IN_PROGRESS" && isHost && !!hostToken;
  const canAutosaveDraft =
    !!roomState &&
    roomState.game.status === "IN_PROGRESS" &&
    !!activeRound &&
    !!participantId &&
    isAdmitted &&
    isRoundOpen &&
    !alreadySubmitted &&
    !submitting;

  const showPlayPanel = !isCompactLayout || mobilePanel === "PLAY";
  const showScoresPanel = !isCompactLayout || mobilePanel === "SCORES";
  const showDetailsPanel = !isCompactLayout || mobilePanel === "DETAILS";

  useEffect(() => {
    if (!canAutosaveDraft || !participantId || activeRoundNumber === null) {
      return;
    }

    saveRoundDraft(roomCode, participantId, activeRoundNumber, roundAnswers);

    const signature = roundAnswersSignature(roundAnswers);
    if (signature === lastDraftSignatureRef.current) {
      return;
    }

    if (draftSyncTimeoutRef.current !== null) {
      window.clearTimeout(draftSyncTimeoutRef.current);
      draftSyncTimeoutRef.current = null;
    }

    draftSyncTimeoutRef.current = window.setTimeout(() => {
      void updateRoundDraft(roomCode, participantId, roundAnswers)
        .then(() => {
          lastDraftSignatureRef.current = signature;
        })
        .catch(() => {
          // Ignore transient autosave errors; submit call remains authoritative.
        })
        .finally(() => {
          draftSyncTimeoutRef.current = null;
        });
    }, 420);

    return () => {
      if (draftSyncTimeoutRef.current !== null) {
        window.clearTimeout(draftSyncTimeoutRef.current);
        draftSyncTimeoutRef.current = null;
      }
    };
  }, [activeRoundNumber, canAutosaveDraft, participantId, roomCode, roundAnswers]);

  const isRoundFullyReviewed = (round: RoomStateResponse["game"]["completedRounds"][number]): boolean => {
    return round.submissions.every((submission) => !!submission.review);
  };

  const onCallLetter = async (number: number) => {
    if (!participantId || !canCallLetter) {
      return;
    }

    setError(null);
    setCalling(true);

    try {
      const nextState = await callTurnNumber(roomCode, participantId, number);
      setRoomState(nextState);
      setRoundAnswers(emptyRoundAnswers());
    } catch (callError) {
      setError(callError instanceof Error ? callError.message : "Unable to call letter");
    } finally {
      setCalling(false);
    }
  };

  const onSubmitRound = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!participantId || !canSubmitAnswers) {
      return;
    }

    const isCallerSubmission = participantId === activeRound?.turnParticipantId;
    const roundNumberAtSubmit = activeRoundNumber;
    if (roundNumberAtSubmit !== null) {
      saveRoundDraft(roomCode, participantId, roundNumberAtSubmit, roundAnswers);
    }
    setError(null);
    setSubmitting(true);

    try {
      if (draftSyncTimeoutRef.current !== null) {
        window.clearTimeout(draftSyncTimeoutRef.current);
        draftSyncTimeoutRef.current = null;
      }

      const submitSignature = roundAnswersSignature(roundAnswers);
      if (roundNumberAtSubmit !== null && submitSignature !== lastDraftSignatureRef.current) {
        try {
          await updateRoundDraft(roomCode, participantId, roundAnswers);
          lastDraftSignatureRef.current = submitSignature;
        } catch {
          // Ignore draft-flush failures; submission request is still authoritative.
        }
      }

      const nextState = await submitRoundAnswers(roomCode, participantId, roundAnswers);
      setRoomState(nextState);
      if (roundNumberAtSubmit !== null) {
        clearRoundDraft(roomCode, participantId, roundNumberAtSubmit);
      }
      lastDraftSignatureRef.current = roundAnswersSignature(emptyRoundAnswers());
      if (isCallerSubmission) {
        stopRoundTimerSong();
      }
    } catch (submitError) {
      const fallbackMessage = submitError instanceof Error ? submitError.message : "Unable to submit round answers";
      let recovered = false;

      try {
        const refreshed = await getRoomState(roomCode);
        setRoomState(refreshed);
        if (wasSubmissionRecorded(refreshed, participantId, roundNumberAtSubmit)) {
          recovered = true;
          setError(null);
          if (roundNumberAtSubmit !== null) {
            clearRoundDraft(roomCode, participantId, roundNumberAtSubmit);
          }
          lastDraftSignatureRef.current = roundAnswersSignature(emptyRoundAnswers());
        }
      } catch {
        // Ignore fallback fetch failures and show original submit error.
      }

      if (!recovered) {
        setError(fallbackMessage);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const onEndRound = async () => {
    if (!participantId || !canEndRoundEarly) {
      return;
    }

    setError(null);
    setEndingRound(true);

    try {
      const nextState = await endRoundNow(roomCode, participantId);
      setRoomState(nextState);
      lastDraftSignatureRef.current = roundAnswersSignature(emptyRoundAnswers());
      stopRoundTimerSong();
    } catch (endError) {
      setError(endError instanceof Error ? endError.message : "Unable to end round");
    } finally {
      setEndingRound(false);
    }
  };

  const onMarkField = async (
    roundNumber: number,
    submission: RoundSubmission,
    field: keyof RoundMarks,
    markAsCorrect: boolean
  ) => {
    if (!canScoreSubmissions || !hostToken) {
      return;
    }

    const current = marksFromSubmission(submission);
    const marks: RoundMarks = {
      ...current,
      [field]: markAsCorrect
    };

    const key = `score:${roundNumber}:${submission.participantId}:${field}`;
    setActionKey(key);
    setError(null);

    try {
      const nextState = await scoreRoundSubmission(roomCode, hostToken, roundNumber, submission.participantId, marks);
      setRoomState(nextState);
    } catch (scoreError) {
      setError(scoreError instanceof Error ? scoreError.message : "Unable to score submission");
    } finally {
      setActionKey(null);
    }
  };

  const onPublishRound = async (roundNumber: number) => {
    if (!canScoreSubmissions || !hostToken) {
      return;
    }

    const key = `publish:${roundNumber}`;
    setActionKey(key);
    setError(null);

    try {
      const nextState = await publishRoundScores(roomCode, hostToken, roundNumber);
      setRoomState(nextState);
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : "Unable to publish round scores");
    } finally {
      setActionKey(null);
    }
  };

  const onDiscardRound = async (roundNumber: number) => {
    if (!canScoreSubmissions || !hostToken) {
      return;
    }

    const key = `discard:${roundNumber}`;
    setActionKey(key);
    setError(null);

    try {
      const nextState = await discardRoundScores(roomCode, hostToken, roundNumber);
      setRoomState(nextState);
    } catch (discardError) {
      setError(discardError instanceof Error ? discardError.message : "Unable to discard round result");
    } finally {
      setActionKey(null);
    }
  };

  const onEndGame = async () => {
    if (!canEndGame || !hostToken) {
      return;
    }

    setActionKey("finish-game");
    setError(null);

    try {
      const nextState = await endGameRoom(roomCode, hostToken);
      setRoomState(nextState);
      stopRoundTimerSong();
    } catch (finishError) {
      setError(finishError instanceof Error ? finishError.message : "Unable to end game");
    } finally {
      setActionKey(null);
    }
  };

  const onCreateAnotherGame = () => {
    stopRoundTimerSong();
    if (participantId) {
      clearAllRoundDraftsForParticipant(roomCode, participantId);
    }
    clearRoomSession(roomCode);
    onNavigate("/");
  };

  return (
    <section className="card game-card">
      <h1>Game Board</h1>
      <p className="subtitle">
        Room code: <strong>{roomCode}</strong>
      </p>

      {loadingRoom ? <p>Loading game state...</p> : null}
      {error ? <p className="error">{error}</p> : null}

      {roomState ? (
        <>
          {isCompactLayout ? (
            <div className="mobile-panel-nav" role="tablist" aria-label="mobile game sections">
              <button
                type="button"
                className={`mobile-panel-tab${mobilePanel === "PLAY" ? " mobile-panel-tab-active" : ""}`}
                onClick={() => setMobilePanel("PLAY")}
                aria-pressed={mobilePanel === "PLAY"}
              >
                Play
              </button>
              <button
                type="button"
                className={`mobile-panel-tab${mobilePanel === "SCORES" ? " mobile-panel-tab-active" : ""}`}
                onClick={() => setMobilePanel("SCORES")}
                aria-pressed={mobilePanel === "SCORES"}
              >
                {roomState.game.status === "FINISHED" ? "Results" : "Scores"}
              </button>
              <button
                type="button"
                className={`mobile-panel-tab${mobilePanel === "DETAILS" ? " mobile-panel-tab-active" : ""}`}
                onClick={() => setMobilePanel("DETAILS")}
                aria-pressed={mobilePanel === "DETAILS"}
              >
                Details
              </button>
            </div>
          ) : null}

          <div className="result game-layout">
          <div className="game-main">
            {showPlayPanel ? (
              <div className="game-primary">
              {roomState.game.status === "LOBBY" ? (
                <div className="board-placeholder waiting-panel" role="status" aria-label="lobby-waiting-state">
                  <h3>Waiting for host to start</h3>
                  {isAdmitted ? (
                    <p>
                      You are admitted as <strong>{me?.name ?? participantSession?.participantName ?? "Player"}</strong>.
                    </p>
                  ) : (
                    <p>
                      You are connected as <strong>{participantSession?.participantName ?? "Spectator"}</strong>.
                    </p>
                  )}
                  <p>
                    Host <strong>{roomState.meta.hostName}</strong> has not started the game yet.
                  </p>
                  <p className="hint">Stay on this page. You will automatically move into round play when game starts.</p>
                </div>
              ) : null}

              {roomState.game.status === "IN_PROGRESS" ? (
                <>
                  {unpublishedRounds.length > 0 ? (
                    <p className="hint">Submit or discard the current round result before calling the next letter.</p>
                  ) : null}

                  {showLeaderboard && scoring ? (
                    <div className="mobile-status-strip" aria-label="mobile-score-summary">
                      <div className="mobile-status-timer">
                        <p className="mobile-status-label">{sidebarTimer.label}</p>
                        <p
                          className={`mobile-status-value${
                            activeRound?.endsAt && !showLetterModal && (timerSecondsLeft ?? 999) <= 5
                              ? " mobile-status-value-danger"
                              : ""
                          }`}
                        >
                          {sidebarTimer.value}
                        </p>
                        <p className="mobile-status-hint">{sidebarTimer.hint}</p>
                      </div>
                      <div className="mobile-status-meta">
                        <span>Published {scoring.publishedRounds}</span>
                        <span>Pending {scoring.pendingPublicationRounds.length}</span>
                        <span className="mobile-status-leader">
                          <span className="mobile-status-leader-label">Leader</span>
                          {topLeaderboardEntry ? (
                            <>
                              <span className="mobile-status-leader-name" title={topLeaderboardEntry.participantName}>
                                {topLeaderboardEntry.participantName}
                              </span>
                              <span className="mobile-status-leader-score">{topLeaderboardEntry.totalScore}</span>
                            </>
                          ) : (
                            <span className="mobile-status-leader-name">No scores yet</span>
                          )}
                        </span>
                      </div>
                    </div>
                  ) : null}

                  {!activeRound ? (
                    <>
                      <h3>Letters A-Z</h3>
                      <div className="letters-row" role="region" aria-label="letters-row">
                        {LETTERS.map((entry) => {
                          const isUsed = usedNumberSet.has(entry.number);
                          return (
                            <button
                              key={entry.number}
                              type="button"
                              className={`letter-chip${isUsed ? " letter-chip-used" : ""}`}
                              onClick={() => onCallLetter(entry.number)}
                              disabled={!canCallLetter || isUsed}
                              aria-label={`letter-${entry.letter}`}
                            >
                              {entry.letter}
                            </button>
                          );
                        })}
                      </div>

                      <h3>Turn order</h3>
                      <ul className="pending-list">
                        {roomState.game.turnOrder.map((id) => {
                          const participant = participantsById.get(id);
                          const isCurrent = id === currentTurnParticipantId;
                          return (
                            <li key={id} className="pending-item">
                              <span>
                                {participant?.name ?? id}
                                {isCurrent ? " (current turn)" : ""}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </>
                  ) : null}

                {!activeRound ? (
                  <>
                    <p className="hint">
                      Waiting for <strong>{participantsById.get(currentTurnParticipantId ?? "")?.name ?? "active caller"}</strong> to
                      pick a letter.
                    </p>

                    <h3>Answer columns</h3>
                    <form onSubmit={onSubmitRound} className="answers-form" aria-label="round-submit-form">
                      <div className="answers-grid answers-grid-head" role="row">
                        {ROUND_FIELDS.map((field) => (
                          <span key={field.key} className="answers-head-cell">
                            {field.label}
                          </span>
                        ))}
                      </div>

                      <div className="answers-grid answers-grid-body" role="row">
                        {ROUND_FIELDS.map((field) => (
                          <label key={field.key} className="answers-cell" htmlFor={`answer-${field.key}`} data-field-label={field.label}>
                            <span className="sr-only">{field.label}</span>
                            <input
                              id={`answer-${field.key}`}
                              value={roundAnswers[field.key]}
                              onChange={(event) =>
                                setRoundAnswers((prev) => ({
                                  ...prev,
                                  [field.key]: event.target.value
                                }))
                              }
                              maxLength={48}
                              readOnly
                              disabled
                            />
                          </label>
                        ))}
                      </div>

                      <button type="submit" disabled>
                        Submit answers
                      </button>
                    </form>

                    <p className="hint">Fields are read-only until a letter is picked and countdown ends.</p>
                  </>
                ) : (
                  <>
                    <div className="board-placeholder" role="region" aria-label="active-round-status">
                      <p>
                        Round <strong>{activeRound.roundNumber}</strong> | Caller: <strong>{activeRound.turnParticipantName}</strong>
                      </p>
                      <p>
                        Active letter: <strong>{activeRound.activeLetter}</strong> ({activeRound.calledNumber})
                      </p>
                      <p>
                        Countdown: <strong>{showLetterModal ? `${countdownSecondsLeft}s` : "Started"}</strong>
                      </p>
                      <p>
                        Timer: <strong>{timerSecondsLeft !== null ? `${timerSecondsLeft}s` : "No timer"}</strong>
                      </p>
                      <p>
                        Submissions: <strong>{activeRound.submissions.length}</strong> / {roomState.counts.admitted}
                      </p>

                      {canEndRoundEarly ? (
                        <button type="button" onClick={onEndRound} disabled={!canEndRoundEarly}>
                          {endingRound ? "Ending round..." : "End round and submit all"}
                        </button>
                      ) : null}
                    </div>

                    <h3>Answer columns</h3>
                    <form onSubmit={onSubmitRound} className="answers-form" aria-label="round-submit-form">
                      <div className="answers-grid answers-grid-head" role="row">
                        {ROUND_FIELDS.map((field) => (
                          <span key={field.key} className="answers-head-cell">
                            {field.label}
                          </span>
                        ))}
                      </div>

                      <div className="answers-grid answers-grid-body" role="row">
                        {ROUND_FIELDS.map((field) => (
                          <label key={field.key} className="answers-cell" htmlFor={`answer-${field.key}`} data-field-label={field.label}>
                            <span className="sr-only">{field.label}</span>
                            <input
                              id={`answer-${field.key}`}
                              value={roundAnswers[field.key]}
                              onChange={(event) =>
                                setRoundAnswers((prev) => ({
                                  ...prev,
                                  [field.key]: event.target.value
                                }))
                              }
                              maxLength={48}
                              readOnly={!isRoundOpen || alreadySubmitted}
                              disabled={!isRoundOpen || alreadySubmitted}
                            />
                          </label>
                        ))}
                      </div>

                      <button type="submit" disabled={!canSubmitAnswers}>
                        {submitting ? "Submitting..." : alreadySubmitted ? "Already submitted" : "Submit answers"}
                      </button>
                    </form>

                    {!isRoundOpen ? <p className="hint">Fields are read-only until countdown ends.</p> : null}
                    {isRoundOpen && !alreadySubmitted ? <p className="hint">Draft auto-saves locally while you type.</p> : null}
                    {alreadySubmitted ? <p className="success">Your submission has been recorded for this round.</p> : null}
                  </>
                )}

                <h3>Round Scoring Queue</h3>
                {unpublishedRounds.length > 0 ? (
                  <div className="results-stack" aria-label="submission-page">
                    {unpublishedRounds.map((round) => {
                      const roundReadyToPublish = isRoundFullyReviewed(round);
                      const publishKey = `publish:${round.roundNumber}`;
                      const discardKey = `discard:${round.roundNumber}`;
                      return (
                        <div key={round.roundNumber} className="results-panel">
                          <p>
                            Round {round.roundNumber} ({round.activeLetter}) ended by <strong>{round.endReason}</strong>
                          </p>
                          <table className="results-table">
                            <thead>
                              <tr>
                                <th>Player</th>
                                {ROUND_FIELDS.map((field) => (
                                  <th key={field.key}>{field.label}</th>
                                ))}
                                <th>Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {round.submissions.map((submission) => {
                                const reviewedMarks = submission.review?.marks ?? null;
                                return (
                                  <tr key={submission.participantId}>
                                    <td data-label="Player">{submission.participantName}</td>
                                    {ROUND_FIELDS.map((field) => {
                                      const isReviewed = !!reviewedMarks;
                                      const isCorrect = reviewedMarks ? reviewedMarks[field.key as keyof RoundMarks] : false;
                                      const cellScore = submission.review ? submission.review.scores[field.key] : "-";
                                      return (
                                        <td key={`${submission.participantId}:${field.key}`} data-label={field.label}>
                                          <div className="mark-cell">
                                            <span className="answer-value">{submission.answers[field.key] || "(empty)"}</span>
                                            {canScoreSubmissions ? (
                                              <div className="mark-actions">
                                                <button
                                                  type="button"
                                                  className={`mark-btn${isReviewed && isCorrect ? " mark-btn-active mark-btn-correct" : ""}`}
                                                  onClick={() =>
                                                    onMarkField(round.roundNumber, submission, field.key as keyof RoundMarks, true)
                                                  }
                                                  disabled={!!actionKey}
                                                  aria-label={`mark-${field.key}-correct-${submission.participantId}-round-${round.roundNumber}`}
                                                >
                                                  ✓
                                                </button>
                                                <button
                                                  type="button"
                                                  className={`mark-btn${isReviewed && !isCorrect ? " mark-btn-active mark-btn-wrong" : ""}`}
                                                  onClick={() =>
                                                    onMarkField(round.roundNumber, submission, field.key as keyof RoundMarks, false)
                                                  }
                                                  disabled={!!actionKey}
                                                  aria-label={`mark-${field.key}-wrong-${submission.participantId}-round-${round.roundNumber}`}
                                                >
                                                  ✕
                                                </button>
                                              </div>
                                            ) : (
                                              <span className="mark-readonly">{isReviewed ? (isCorrect ? "✓" : "✕") : "-"}</span>
                                            )}
                                            <span className="mark-score">{cellScore}</span>
                                          </div>
                                        </td>
                                      );
                                    })}
                                    <td data-label="Total">{submission.review ? submission.review.scores.total : "-"}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>

                          {canScoreSubmissions ? (
                            <div className="row-actions">
                              <button
                                type="button"
                                className="publish-btn"
                                disabled={!roundReadyToPublish || !!actionKey}
                                onClick={() => onPublishRound(round.roundNumber)}
                                aria-label={`publish-round-${round.roundNumber}`}
                              >
                                {actionKey === publishKey ? "Publishing..." : `Submit Round ${round.roundNumber} To Board`}
                              </button>
                              <button
                                type="button"
                                className="secondary-btn"
                                disabled={!!actionKey}
                                onClick={() => onDiscardRound(round.roundNumber)}
                                aria-label={`discard-round-${round.roundNumber}`}
                              >
                                {actionKey === discardKey ? "Discarding..." : `Discard Round ${round.roundNumber}`}
                              </button>
                            </div>
                          ) : null}

                          {!roundReadyToPublish ? (
                            <p className="hint">Mark every field for every player before submitting this round to the board.</p>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="hint">No pending round scoring pages. Published rounds are already on the leaderboard.</p>
                )}
                </>
              ) : null}
              </div>
            ) : null}

            {showDetailsPanel ? (
              <div className="game-details">
              <div className="game-details-head">
                <h3>Game Details</h3>
                <span className="status-chip">{roomState.game.status}</span>
              </div>

              <div className="game-details-grid">
                <div className="detail-item">
                  <span className="detail-label">Host</span>
                  <strong className="detail-value">{roomState.meta.hostName}</strong>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Round End Rule</span>
                  <strong className="detail-value">{roundEndRuleLabel(roomState.game.config)}</strong>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Scoring Mode</span>
                  <strong className="detail-value">{scoringModeLabel(roomState.game.config.scoringMode)}</strong>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Round Seconds</span>
                  <strong className="detail-value">{roomState.game.config.roundSeconds}</strong>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Admitted Players</span>
                  <strong className="detail-value">
                    {roomState.counts.admitted} / {roomState.meta.maxParticipants}
                  </strong>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Connected Clients</span>
                  <strong className="detail-value">{connectedClients}</strong>
                </div>
                <div className="detail-item">
                  <span className="detail-label">You Are</span>
                  <strong className="detail-value">{me ? me.name : participantSession?.participantName ?? "Spectator"}</strong>
                </div>
                {scoring ? (
                  <>
                    <div className="detail-item">
                      <span className="detail-label">Fair Rounds</span>
                      <strong className="detail-value">
                        {scoring.maxRounds} ({scoring.roundsPerPlayer} each)
                      </strong>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Rounds Played</span>
                      <strong className="detail-value">
                        {scoring.roundsPlayed} / {scoring.maxRounds}
                      </strong>
                    </div>
                    <div className="detail-item detail-item-wide">
                      <span className="detail-label">Used Letters</span>
                      <strong className="detail-value">{lettersFromNumbers(scoring.usedNumbers)}</strong>
                    </div>
                  </>
                ) : null}
              </div>

              {scoring?.isComplete ? <p className="success">Fair round limit reached. No more letters can be played.</p> : null}

              {roomState.game.status === "LOBBY" ? <p className="hint">Waiting for host to start the game.</p> : null}
              {roomState.game.status === "CANCELLED" ? (
                <p className="error">Game cancelled by host. This room is closed and the join link is expired.</p>
              ) : null}
              {roomState.game.status === "FINISHED" ? (
                <p className="success">Game ended. Final leaderboard is locked.</p>
              ) : null}
              {isHost && (roomState.game.status === "CANCELLED" || roomState.game.status === "FINISHED") ? (
                <button type="button" className="secondary-btn" onClick={onCreateAnotherGame}>
                  Create another game
                </button>
              ) : null}
              {canEndGame ? (
                <button type="button" className="secondary-btn details-action-btn" onClick={onEndGame} disabled={!!actionKey}>
                  {actionKey === "finish-game" ? "Ending game..." : "End game and show results"}
                </button>
              ) : null}
              </div>
            ) : null}

            {showScoresPanel && roomState.game.status === "FINISHED" ? (
              <div className="results-panel" aria-label="final-results-panel">
                <h3>Final Results</h3>
                {scoring && scoring.publishedRounds > 0 ? (
                  <table className="results-table">
                    <thead>
                      <tr>
                        <th>Rank</th>
                        <th>Player</th>
                        <th>Total</th>
                        <th>History</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scoring.leaderboard.map((entry, index) => (
                        <tr key={entry.participantId}>
                          <td data-label="Rank">{index + 1}</td>
                          <td data-label="Player">{entry.participantName}</td>
                          <td data-label="Total">{entry.totalScore}</td>
                          <td data-label="History">
                            {entry.history.length > 0
                              ? entry.history.map((item) => `R${item.roundNumber} ${item.activeLetter}:${item.score}`).join(" | ")
                              : "No rounds"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="hint">No published round scores yet.</p>
                )}
              </div>
            ) : null}
          </div>

          {showScoresPanel && showLeaderboard && scoring ? (
            <aside className="score-sidebar" aria-label="score-sidebar">
              <div className="sidebar-timer-card" aria-label="sidebar-timer">
                <p className="sidebar-timer-label">{sidebarTimer.label}</p>
                <p
                  className={`sidebar-timer-value${
                    activeRound?.endsAt && !showLetterModal && (timerSecondsLeft ?? 999) <= 5 ? " sidebar-timer-value-danger" : ""
                  }`}
                >
                  {sidebarTimer.value}
                </p>
                <p className="sidebar-timer-hint">{sidebarTimer.hint}</p>
              </div>

              <div className="score-sidebar-head">
                <h3>Leaderboard</h3>
                <p className="score-sidebar-meta">
                  <span>Published {scoring.publishedRounds}</span>
                  <span>Pending {scoring.pendingPublicationRounds.length}</span>
                </p>
              </div>
              <div className="score-sidebar-list">
                {scoring.leaderboard.map((entry, index) => (
                  <div key={entry.participantId} className="score-player">
                    <div className="score-player-head">
                      <div className="score-player-identity">
                        <span className="score-player-rank">#{index + 1}</span>
                        <span className="score-player-name" title={entry.participantName}>
                          {entry.participantName}
                        </span>
                      </div>
                      <strong className="score-player-total">{entry.totalScore}</strong>
                    </div>
                    <p className="score-player-history">
                      {entry.history.length > 0
                        ? entry.history.map((item) => `R${item.roundNumber} ${item.activeLetter}:${item.score}`).join(" | ")
                        : "No published rounds"}
                    </p>
                  </div>
                ))}
              </div>
            </aside>
          ) : null}
          </div>
        </>
      ) : null}

      {showLetterModal && activeRound ? (
        <div className="letter-modal" role="dialog" aria-modal="true" aria-label="letter-countdown-modal">
          <div className="letter-modal-card">
            <p className="letter-modal-title">Letter Selected</p>
            <p className="letter-modal-letter">{activeRound.activeLetter}</p>
            <p className="letter-modal-count">{countdownSecondsLeft}</p>
          </div>
        </div>
      ) : null}
    </section>
  );
}


export default function App() {
  const [pathname, setPathname] = useState(window.location.pathname);
  const bubbleSeeds = useMemo(() => Array.from({ length: 12 }, (_, index) => index), []);

  useEffect(() => {
    const onPopState = () => {
      setPathname(window.location.pathname);
    };

    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  const joinRoomCode = parseJoinRoomCode(pathname);
  const gameRoomCode = parseGameRoomCode(pathname);

  const onNavigate = (path: string) => navigate(path, setPathname);

  return (
    <main className="page">
      <div className="bubble-layer" aria-hidden="true">
        {bubbleSeeds.map((seed) => (
          <span
            key={seed}
            className="bubble"
            style={
              {
                "--bubble-left": `${(seed * 17) % 100}%`,
                "--bubble-size": `${24 + ((seed * 13) % 68)}px`,
                "--bubble-delay": `${(seed * 0.45).toFixed(2)}s`,
                "--bubble-duration": `${8 + ((seed * 7) % 11)}s`,
                "--bubble-drift": `${-24 + ((seed * 9) % 48)}px`,
                "--bubble-opacity": `${0.14 + ((seed * 5) % 10) / 100}`
              } as CSSProperties
            }
          />
        ))}
      </div>
      {gameRoomCode ? <GameBoardCard roomCode={gameRoomCode} onNavigate={onNavigate} /> : null}
      {!gameRoomCode && joinRoomCode ? <JoinRoomCard roomCode={joinRoomCode} onNavigate={onNavigate} /> : null}
      {!gameRoomCode && !joinRoomCode ? <HostCreateCard onNavigate={onNavigate} /> : null}
    </main>
  );
}
