import { afterEach, describe, expect, it, vi } from "vitest";
import {
  GameRoom,
  callNumberForTurn,
  cancelGame,
  createJoinRequest,
  discardRoundScores,
  endGame,
  endRoundManually,
  initializeRoomState,
  publishRoundScores,
  resolveJoinRequest,
  scoreRoundSubmission,
  startGame,
  submitRoundAnswers,
  updateRoundDraft,
  type RoomInitPayload,
  type StoredRoomState
} from "../room";

const ROOM_STORAGE_KEY = "room";

function createLobbyState(maxParticipants = 6): StoredRoomState {
  return initializeRoomState(
    {
      roomCode: "EDGE01",
      hostName: "Host",
      maxParticipants,
      hostToken: "host-token"
    },
    "2026-02-08T00:00:00.000Z"
  );
}

function withAdmittedPlayer(state: StoredRoomState, id = "p-ada", name = "Ada"): StoredRoomState {
  return {
    ...state,
    participants: [
      ...state.participants,
      {
        id,
        name,
        status: "ADMITTED",
        isHost: false,
        createdAt: "2026-02-08T00:00:01.000Z",
        updatedAt: "2026-02-08T00:00:01.000Z"
      }
    ]
  };
}

function createStartedState(
  config?: {
    endRule?: "TIMER" | "FIRST_SUBMISSION" | "WHICHEVER_FIRST";
    manualEndPolicy?: "HOST_OR_CALLER" | "CALLER_ONLY" | "CALLER_OR_TIMER" | "NONE";
    scoringMode?: "FIXED_10" | "SHARED_10";
  }
): StoredRoomState {
  const started = startGame(
    withAdmittedPlayer(createLobbyState()),
    "host-token",
    {
      roundSeconds: 10,
      endRule: config?.endRule ?? "TIMER",
      manualEndPolicy: config?.manualEndPolicy,
      scoringMode: config?.scoringMode
    },
    "2026-02-08T00:00:10.000Z"
  );

  if (!started.ok) {
    throw new Error(`failed to build started state: ${started.error}`);
  }

  return started.nextState;
}

function forceCountdownOver(state: StoredRoomState): StoredRoomState {
  if (!state.game.activeRound) {
    return state;
  }

  return {
    ...state,
    game: {
      ...state.game,
      activeRound: {
        ...state.game.activeRound,
        countdownEndsAt: "2026-02-08T00:00:00.000Z"
      }
    }
  };
}

function expectError(
  result:
    | { ok: false; status: number; error: string }
    | { ok: true; nextState: StoredRoomState },
  status: number,
  messagePart: string
): void {
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.status).toBe(status);
    expect(result.error).toContain(messagePart);
  }
}

class MockSocket {
  sent: string[] = [];

  send(message: string): void {
    this.sent.push(message);
  }
}

class MockStorage {
  readonly values = new Map<string, unknown>();
  readonly setAlarmCalls: number[] = [];
  deleteAlarmCalls = 0;

  async put(key: string, value: unknown): Promise<void> {
    this.values.set(key, structuredClone(value));
  }

  async get<T>(key: string): Promise<T | null> {
    return ((this.values.get(key) as T | undefined) ?? null) as T | null;
  }

  async setAlarm(time: number): Promise<void> {
    this.setAlarmCalls.push(time);
  }

  async deleteAlarm(): Promise<void> {
    this.deleteAlarmCalls += 1;
  }
}

class MockDurableState {
  readonly storage = new MockStorage();
  readonly sockets: MockSocket[] = [];

  acceptWebSocket(socket: WebSocket): void {
    this.sockets.push(socket as unknown as MockSocket);
  }

  getWebSockets(): WebSocket[] {
    return this.sockets as unknown as WebSocket[];
  }
}

function makeRequest(path: string, method = "GET", body?: unknown, extraHeaders?: Record<string, string>): Request {
  const headers: Record<string, string> = { ...(extraHeaders ?? {}) };
  const init: RequestInit = { method, headers };

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }

  return new Request(`https://room${path}`, init);
}

function createRoomHarness(): { room: GameRoom; state: MockDurableState } {
  const state = new MockDurableState();
  const room = new GameRoom(state as unknown as DurableObjectState, {});
  return { room, state };
}

async function initRoom(room: GameRoom, payload?: Partial<RoomInitPayload>): Promise<void> {
  await room.fetch(
    makeRequest("/init", "POST", {
      roomCode: "EDGE01",
      hostName: "Host",
      maxParticipants: 6,
      hostToken: "host-token",
      ...(payload ?? {})
    })
  );
}

describe("unit: room edge behavior", () => {
  it("covers create/join/resolve/start guards", () => {
    const shortName = createJoinRequest(createLobbyState(), "A");
    expectError(shortName, 400, "name must be between");

    const fullLobby = createJoinRequest(createLobbyState(1), "Ben");
    expectError(fullLobby, 409, "room is full");

    const started = createStartedState();
    const joinExpired = createJoinRequest(started, "Kai");
    expectError(joinExpired, 410, "join link has expired");

    const pendingState: StoredRoomState = {
      ...createLobbyState(),
      participants: [
        ...createLobbyState().participants,
        {
          id: "req-1",
          name: "Pending",
          status: "PENDING",
          isHost: false,
          createdAt: "2026-02-08T00:00:01.000Z",
          updatedAt: "2026-02-08T00:00:01.000Z"
        }
      ]
    };

    expectError(resolveJoinRequest(pendingState, "missing", true), 404, "join request not found");
    expectError(resolveJoinRequest({ ...pendingState, participants: [{ ...pendingState.participants[0], status: "ADMITTED" }] }, "host", true), 409, "already resolved");

    const cancelled = cancelGame(createLobbyState(), "host-token", "2026-02-08T00:00:20.000Z");
    if (!cancelled.ok) {
      throw new Error("expected cancel to succeed");
    }
    expectError(resolveJoinRequest(cancelled.nextState, "req-1", true), 409, "cancelled");

    const fullApprovalState: StoredRoomState = {
      ...createLobbyState(1),
      participants: [
        ...createLobbyState(1).participants,
        {
          id: "req-full",
          name: "Req",
          status: "PENDING",
          isHost: false,
          createdAt: "2026-02-08T00:00:02.000Z",
          updatedAt: "2026-02-08T00:00:02.000Z"
        }
      ]
    };
    expectError(resolveJoinRequest(fullApprovalState, "req-full", true), 409, "room is full");

    const ready = withAdmittedPlayer(createLobbyState());
    expectError(startGame(ready, "host-token", { roundSeconds: 4 }), 400, "roundSeconds");
    expectError(startGame(ready, "host-token", { endRule: "BAD" as never }), 400, "endRule");
    expectError(startGame(ready, "host-token", { manualEndPolicy: "BAD" as never }), 400, "manualEndPolicy");
    expectError(startGame(ready, "host-token", { scoringMode: "BAD" as never }), 400, "scoringMode");
    expectError(
      startGame(ready, "host-token", { endRule: "FIRST_SUBMISSION", manualEndPolicy: "CALLER_OR_TIMER" }),
      400,
      "requires a timer-based endRule"
    );
  });

  it("covers round call/submit/draft/manual-end guard branches", () => {
    expectError(callNumberForTurn(createLobbyState(), "host", 1), 409, "not started");

    const started = createStartedState();
    const call = callNumberForTurn(started, "host", 1, "2026-02-08T00:00:11.000Z");
    expect(call.ok).toBe(true);
    if (!call.ok) {
      return;
    }

    const secondCall = callNumberForTurn(call.nextState, "host", 2, "2026-02-08T00:00:12.000Z");
    expectError(secondCall, 409, "round already in progress");
    expectError(callNumberForTurn(started, "host", 0), 400, "between 1 and 26");
    expectError(callNumberForTurn(started, "missing", 2), 403, "not admitted");

    const startedNoTimer = createStartedState({ endRule: "FIRST_SUBMISSION" });
    const callNoTimer = callNumberForTurn(startedNoTimer, "host", 5, "2026-02-08T00:00:11.000Z");
    expect(callNoTimer.ok).toBe(true);
    if (callNoTimer.ok) {
      expect(callNoTimer.activeRound.endsAt).toBeNull();
    }

    expectError(submitRoundAnswers(createStartedState(), "host", {}), 409, "no active round");
    expectError(updateRoundDraft(createStartedState(), "host", {}), 409, "no active round");

    const finished = endGame(started, "host-token", "2026-02-08T00:02:00.000Z");
    if (!finished.ok) {
      throw new Error("expected endGame to succeed");
    }
    expectError(updateRoundDraft(finished.nextState, "host", {}), 409, "not accepting answers");

    const calledForManual = callNumberForTurn(createStartedState({ manualEndPolicy: "CALLER_OR_TIMER" }), "host", 3);
    expect(calledForManual.ok).toBe(true);
    if (!calledForManual.ok) {
      return;
    }

    expectError(endRoundManually(calledForManual.nextState, "p-ada"), 403, "only the current caller can end early");
    expectError(endRoundManually(calledForManual.nextState, "ghost"), 403, "not admitted");
  });

  it("covers scoring/publish/discard and game end guard branches", () => {
    const started = createStartedState({ scoringMode: "SHARED_10" });
    const called = callNumberForTurn(started, "host", 6, "2026-02-08T00:00:11.000Z");
    expect(called.ok).toBe(true);
    if (!called.ok) {
      return;
    }

    const afterCountdown = forceCountdownOver(called.nextState);
    const hostSubmit = submitRoundAnswers(
      afterCountdown,
      "host",
      {
        name: "Ada",
        animal: "Ant",
        place: "Accra",
        thing: "Arrow",
        food: "Apple"
      },
      "2026-02-08T00:00:20.000Z"
    );
    expect(hostSubmit.ok).toBe(true);
    if (!hostSubmit.ok) {
      return;
    }

    const adaSubmit = submitRoundAnswers(
      hostSubmit.nextState,
      "p-ada",
      {
        name: "Ada",
        animal: "Ant",
        place: "Athens",
        thing: "Arrow",
        food: "Apricot"
      },
      "2026-02-08T00:00:21.000Z"
    );
    expect(adaSubmit.ok).toBe(true);
    if (!adaSubmit.ok) {
      return;
    }

    const ended = endRoundManually(adaSubmit.nextState, "host", "2026-02-08T00:00:22.000Z");
    expect(ended.ok).toBe(true);
    if (!ended.ok) {
      return;
    }

    expectError(scoreRoundSubmission(ended.nextState, "host-token", 0, "host", {}), 400, "positive integer");
    expectError(scoreRoundSubmission(ended.nextState, "host-token", 1, "host", { name: true }), 400, "marks.animal");
    expectError(scoreRoundSubmission(ended.nextState, "host-token", 99, "host", { name: true, animal: true, place: true, thing: true, food: true }), 404, "round not found");
    expectError(scoreRoundSubmission(ended.nextState, "host-token", 1, "missing", { name: true, animal: true, place: true, thing: true, food: true }), 404, "submission not found");

    const withoutHost: StoredRoomState = {
      ...ended.nextState,
      participants: ended.nextState.participants.filter((participant) => !participant.isHost)
    };
    expectError(
      scoreRoundSubmission(withoutHost, "host-token", 1, "p-ada", { name: true, animal: true, place: true, thing: true, food: true }),
      404,
      "host not found"
    );

    const scoredHost = scoreRoundSubmission(
      ended.nextState,
      "host-token",
      1,
      "host",
      {
        name: true,
        animal: true,
        place: true,
        thing: true,
        food: true
      },
      "2026-02-08T00:00:23.000Z"
    );
    expect(scoredHost.ok).toBe(true);
    if (!scoredHost.ok) {
      return;
    }

    const scoredAda = scoreRoundSubmission(
      scoredHost.nextState,
      "host-token",
      1,
      "p-ada",
      {
        name: true,
        animal: true,
        place: true,
        thing: true,
        food: true
      },
      "2026-02-08T00:00:24.000Z"
    );
    expect(scoredAda.ok).toBe(true);
    if (!scoredAda.ok) {
      return;
    }

    const hostScores = scoredAda.nextState.game.completedRounds[0].submissions.find((entry) => entry.participantId === "host")?.review?.scores;
    expect(hostScores).toEqual({
      name: 5,
      animal: 5,
      place: 10,
      thing: 5,
      food: 10,
      total: 35
    });

    expectError(publishRoundScores(scoredAda.nextState, "host-token", 0), 400, "positive integer");

    const published = publishRoundScores(scoredAda.nextState, "host-token", 1, "2026-02-08T00:00:25.000Z");
    expect(published.ok).toBe(true);
    if (!published.ok) {
      return;
    }
    expectError(publishRoundScores(published.nextState, "host-token", 1), 409, "already been published");
    expectError(discardRoundScores(published.nextState, "host-token", 1), 409, "already been finalized");

    const cancelled = cancelGame(createLobbyState(), "host-token", "2026-02-08T00:00:26.000Z");
    expect(cancelled.ok).toBe(true);
    if (cancelled.ok) {
      expectError(scoreRoundSubmission(cancelled.nextState, "host-token", 1, "host", { name: true, animal: true, place: true, thing: true, food: true }), 409, "not accepting score changes");
      expectError(publishRoundScores(cancelled.nextState, "host-token", 1), 409, "not accepting score changes");
      expectError(discardRoundScores(cancelled.nextState, "host-token", 1), 409, "not accepting score changes");
    }

    expectError(cancelGame(createLobbyState(), "bad-token"), 401, "invalid host token");
    if (cancelled.ok) {
      expectError(cancelGame(cancelled.nextState, "host-token"), 409, "already cancelled");
      expectError(endGame(cancelled.nextState, "host-token"), 409, "has been cancelled");
    }

    const endedGame = endGame(createStartedState(), "host-token", "2026-02-08T00:02:00.000Z");
    expect(endedGame.ok).toBe(true);
    if (endedGame.ok) {
      expectError(cancelGame(endedGame.nextState, "host-token"), 409, "already ended");
      expectError(endGame(endedGame.nextState, "host-token"), 409, "already ended");
    }

    expectError(endGame(createLobbyState(), "host-token"), 409, "not started");
  });

  it("covers remaining state-machine guard branches", () => {
    const cancelled = cancelGame(createLobbyState(), "host-token", "2026-02-08T00:00:20.000Z");
    if (!cancelled.ok) {
      throw new Error("expected cancel to succeed");
    }

    expectError(startGame(cancelled.nextState, "host-token"), 409, "cancelled");

    const started = createStartedState();
    expectError(startGame(started, "host-token"), 409, "already started");

    expectError(callNumberForTurn(cancelled.nextState, "host", 1), 409, "cancelled");

    expectError(endRoundManually(cancelled.nextState, "host"), 409, "cancelled");
    expectError(endRoundManually(createStartedState(), "host"), 409, "no active round");
    expectError(endRoundManually(createLobbyState(), "host"), 409, "not started");

    expectError(submitRoundAnswers(cancelled.nextState, "host", {}), 409, "cancelled");
    expectError(submitRoundAnswers(createLobbyState(), "host", {}), 409, "not started");
    expectError(submitRoundAnswers(createStartedState(), "ghost", {}), 409, "no active round");

    const called = callNumberForTurn(createStartedState(), "host", 8, "2026-02-08T00:00:11.000Z");
    if (!called.ok) {
      throw new Error("expected call to succeed");
    }
    expectError(submitRoundAnswers(called.nextState, "ghost", {}, "2026-02-08T00:00:20.000Z"), 403, "not admitted");

    expectError(updateRoundDraft(createLobbyState(), "host", {}), 409, "not started");
    expectError(updateRoundDraft(called.nextState, "host", {}, "2026-02-08T00:00:12.000Z"), 409, "countdown");
    expectError(updateRoundDraft(called.nextState, "ghost", {}, "2026-02-08T00:00:20.000Z"), 403, "not admitted");

    const submitted = submitRoundAnswers(called.nextState, "host", {}, "2026-02-08T00:00:20.000Z");
    if (!submitted.ok) {
      throw new Error("expected submit to succeed");
    }
    expectError(updateRoundDraft(submitted.nextState, "host", {}, "2026-02-08T00:00:21.000Z"), 409, "already submitted");

    expectError(publishRoundScores(createStartedState(), "bad-token", 1), 401, "invalid host token");
    expectError(publishRoundScores(createStartedState(), "host-token", 1), 404, "round not found");

    expectError(discardRoundScores(createStartedState(), "bad-token", 1), 401, "invalid host token");
    expectError(discardRoundScores(createStartedState(), "host-token", 0), 400, "positive integer");
    expectError(discardRoundScores(createStartedState(), "host-token", 1), 404, "round not found");

    expectError(endGame(createStartedState(), "bad-token"), 401, "invalid host token");
  });
});

describe("unit: game room durable object", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("handles init and base read routes", async () => {
    const { room } = createRoomHarness();

    const missing = await room.fetch(makeRequest("/state"));
    expect(missing.status).toBe(404);

    await initRoom(room);

    const stateRes = await room.fetch(makeRequest("/state"));
    expect(stateRes.status).toBe(200);
    const stateJson = (await stateRes.json()) as { meta: { roomCode: string } };
    expect(stateJson.meta.roomCode).toBe("EDGE01");

    const notFound = await room.fetch(makeRequest("/unknown"));
    expect(notFound.status).toBe(404);
  });

  it("covers route payload guards and success flow", async () => {
    const { room, state } = createRoomHarness();
    await initRoom(room);

    const joinRes = await room.fetch(makeRequest("/join", "POST", { name: "Ada" }));
    expect(joinRes.status).toBe(202);
    const joinBody = (await joinRes.json()) as { requestId: string };
    expect(joinBody.requestId).toBeTruthy();

    expect((await room.fetch(makeRequest("/admit", "POST", { requestId: joinBody.requestId, approve: true }))).status).toBe(401);
    expect((await room.fetch(makeRequest("/admit", "POST", { hostToken: "host-token", approve: true }))).status).toBe(400);
    expect((await room.fetch(makeRequest("/admit", "POST", { hostToken: "host-token", requestId: joinBody.requestId }))).status).toBe(400);
    expect((await room.fetch(makeRequest("/admit", "POST", { hostToken: "host-token", requestId: joinBody.requestId, approve: true }))).status).toBe(200);

    expect((await room.fetch(makeRequest("/start", "POST", {}))).status).toBe(400);
    const startRes = await room.fetch(
      makeRequest("/start", "POST", { hostToken: "host-token", config: { endRule: "TIMER", roundSeconds: 8 } })
    );
    expect(startRes.status).toBe(200);
    const startSnapshot = (await startRes.json()) as {
      game: { currentTurnParticipantId: string | null };
    };
    const callerId = startSnapshot.game.currentTurnParticipantId ?? "host";

    expect((await room.fetch(makeRequest("/call", "POST", {}))).status).toBe(400);
    const callRes = await room.fetch(makeRequest("/call", "POST", { participantId: callerId, number: 1 }));
    expect(callRes.status).toBe(200);
    expect(state.storage.setAlarmCalls.length).toBeGreaterThan(0);

    const storedAfterCall = (await state.storage.get<StoredRoomState>(ROOM_STORAGE_KEY))!;
    if (storedAfterCall.game.activeRound) {
      storedAfterCall.game.activeRound.countdownEndsAt = "2026-02-08T00:00:00.000Z";
      await state.storage.put(ROOM_STORAGE_KEY, storedAfterCall);
    }

    expect((await room.fetch(makeRequest("/draft", "POST", {}))).status).toBe(400);
    expect((await room.fetch(makeRequest("/draft", "POST", { participantId: "host", answers: { name: "Ava" } }))).status).toBe(200);

    expect((await room.fetch(makeRequest("/submit", "POST", {}))).status).toBe(400);
    expect((await room.fetch(makeRequest("/submit", "POST", { participantId: "host", answers: { name: "Ava", animal: "Ant", place: "Accra", thing: "Arrow", food: "Apple" } }))).status).toBe(200);

    expect((await room.fetch(makeRequest("/end", "POST", {}))).status).toBe(400);
    expect((await room.fetch(makeRequest("/end", "POST", { participantId: "host" }))).status).toBe(200);
    expect(state.storage.deleteAlarmCalls).toBeGreaterThan(0);

    expect((await room.fetch(makeRequest("/score", "POST", {}))).status).toBe(400);
    expect((await room.fetch(makeRequest("/score", "POST", { hostToken: "host-token", roundNumber: 1 }))).status).toBe(400);
    expect(
      (
        await room.fetch(
          makeRequest("/score", "POST", {
            hostToken: "host-token",
            roundNumber: 1,
            participantId: "host",
            marks: { name: true, animal: true, place: true, thing: true, food: true }
          })
        )
      ).status
    ).toBe(200);

    expect(
      (
        await room.fetch(
          makeRequest("/score", "POST", {
            hostToken: "host-token",
            roundNumber: 1,
            participantId: joinBody.requestId,
            marks: { name: true, animal: true, place: true, thing: true, food: true }
          })
        )
      ).status
    ).toBe(200);

    expect((await room.fetch(makeRequest("/publish", "POST", {}))).status).toBe(400);
    expect((await room.fetch(makeRequest("/publish", "POST", { hostToken: "host-token", roundNumber: 1 }))).status).toBe(200);

    expect((await room.fetch(makeRequest("/discard", "POST", {}))).status).toBe(400);
    expect((await room.fetch(makeRequest("/discard", "POST", { hostToken: "host-token", roundNumber: 1 }))).status).toBe(409);

    expect((await room.fetch(makeRequest("/finish", "POST", {}))).status).toBe(400);
    expect((await room.fetch(makeRequest("/finish", "POST", { hostToken: "host-token" }))).status).toBe(200);

    expect((await room.fetch(makeRequest("/cancel", "POST", {}))).status).toBe(400);
    expect((await room.fetch(makeRequest("/cancel", "POST", { hostToken: "host-token" }))).status).toBe(409);
  });

  it("returns room-not-found for room routes before init", async () => {
    const { room } = createRoomHarness();

    const checks: Array<{ path: string; body?: unknown }> = [
      { path: "/join", body: { name: "Ada" } },
      { path: "/admit", body: { hostToken: "host-token", requestId: "x", approve: true } },
      { path: "/start", body: { hostToken: "host-token" } },
      { path: "/call", body: { participantId: "host", number: 1 } },
      { path: "/submit", body: { participantId: "host", answers: {} } },
      { path: "/draft", body: { participantId: "host", answers: {} } },
      { path: "/end", body: { participantId: "host" } },
      { path: "/score", body: { hostToken: "host-token", roundNumber: 1, participantId: "host", marks: {} } },
      { path: "/publish", body: { hostToken: "host-token", roundNumber: 1 } },
      { path: "/discard", body: { hostToken: "host-token", roundNumber: 1 } },
      { path: "/cancel", body: { hostToken: "host-token" } },
      { path: "/finish", body: { hostToken: "host-token" } }
    ];

    for (const check of checks) {
      const res = await room.fetch(makeRequest(check.path, "POST", check.body));
      expect(res.status).toBe(404);
    }
  });

  it("covers error results for each mutation route and cancel success", async () => {
    const { room, state } = createRoomHarness();
    await initRoom(room);

    // /join mutation error (invalid name)
    expect((await room.fetch(makeRequest("/join", "POST", { name: "A" }))).status).toBe(400);

    // Build a pending request for later route checks.
    const joinRes = await room.fetch(makeRequest("/join", "POST", { name: "Ada" }));
    const joinBody = (await joinRes.json()) as { requestId: string };

    // /admit mutation error (unknown request id).
    expect((await room.fetch(makeRequest("/admit", "POST", { hostToken: "host-token", requestId: "missing", approve: true }))).status).toBe(404);

    // /start mutation error (pending request exists).
    expect((await room.fetch(makeRequest("/start", "POST", { hostToken: "host-token" }))).status).toBe(409);

    // Approve and start.
    await room.fetch(makeRequest("/admit", "POST", { hostToken: "host-token", requestId: joinBody.requestId, approve: true }));
    await room.fetch(makeRequest("/start", "POST", { hostToken: "host-token", config: { endRule: "TIMER", roundSeconds: 8 } }));

    const stateRes = await room.fetch(makeRequest("/state"));
    const stateJson = (await stateRes.json()) as { game: { currentTurnParticipantId: string | null } };
    const callerId = stateJson.game.currentTurnParticipantId ?? "host";

    // /call mutation error (invalid number)
    expect((await room.fetch(makeRequest("/call", "POST", { participantId: callerId, number: 0 }))).status).toBe(400);

    // Valid call for follow-up errors.
    await room.fetch(makeRequest("/call", "POST", { participantId: callerId, number: 1 }));

    // /submit and /draft mutation errors while countdown is active.
    expect((await room.fetch(makeRequest("/submit", "POST", { participantId: "host", answers: {} }))).status).toBe(409);
    expect((await room.fetch(makeRequest("/draft", "POST", { participantId: "host", answers: {} }))).status).toBe(409);

    // /end mutation error (non-admitted participant).
    expect((await room.fetch(makeRequest("/end", "POST", { participantId: "ghost" }))).status).toBe(403);

    // Force round completion and cover score/publish/discard mutation errors.
    const stored = await state.storage.get<StoredRoomState>(ROOM_STORAGE_KEY);
    if (stored?.game.activeRound) {
      stored.game.activeRound.countdownEndsAt = "2026-02-08T00:00:00.000Z";
      await state.storage.put(ROOM_STORAGE_KEY, stored);
    }

    await room.fetch(makeRequest("/submit", "POST", { participantId: "host", answers: {} }));
    await room.fetch(makeRequest("/end", "POST", { participantId: "host" }));

    expect((await room.fetch(makeRequest("/score", "POST", { hostToken: "host-token", roundNumber: 1, participantId: "host", marks: { name: true } }))).status).toBe(400);
    expect((await room.fetch(makeRequest("/publish", "POST", { hostToken: "host-token", roundNumber: 1 }))).status).toBe(409);
    expect((await room.fetch(makeRequest("/discard", "POST", { hostToken: "host-token", roundNumber: 999 }))).status).toBe(404);

    // /finish mutation error while game has not been ended normally.
    expect((await room.fetch(makeRequest("/finish", "POST", { hostToken: "bad-token" }))).status).toBe(401);

    // /cancel success path.
    const cancelRes = await room.fetch(makeRequest("/cancel", "POST", { hostToken: "host-token" }));
    expect(cancelRes.status).toBe(200);
  });

  it("covers call route alarm delete branch and discard success path", async () => {
    const { room, state } = createRoomHarness();
    await initRoom(room);

    const joinRes = await room.fetch(makeRequest("/join", "POST", { name: "Ada" }));
    const joinBody = (await joinRes.json()) as { requestId: string };
    await room.fetch(makeRequest("/admit", "POST", { hostToken: "host-token", requestId: joinBody.requestId, approve: true }));

    const startRes = await room.fetch(
      makeRequest("/start", "POST", {
        hostToken: "host-token",
        config: { endRule: "FIRST_SUBMISSION", roundSeconds: 8, manualEndPolicy: "HOST_OR_CALLER" }
      })
    );
    expect(startRes.status).toBe(200);
    const startSnapshot = (await startRes.json()) as {
      game: { currentTurnParticipantId: string | null };
    };
    const callerId = startSnapshot.game.currentTurnParticipantId ?? "host";

    const callRes = await room.fetch(makeRequest("/call", "POST", { participantId: callerId, number: 2 }));
    expect(callRes.status).toBe(200);
    expect(state.storage.deleteAlarmCalls).toBeGreaterThan(0);

    const storedAfterCall = (await state.storage.get<StoredRoomState>(ROOM_STORAGE_KEY))!;
    if (storedAfterCall.game.activeRound) {
      storedAfterCall.game.activeRound.countdownEndsAt = "2026-02-08T00:00:00.000Z";
      await state.storage.put(ROOM_STORAGE_KEY, storedAfterCall);
    }

    await room.fetch(makeRequest("/submit", "POST", { participantId: "host", answers: { name: "Ben", animal: "Bear", place: "Berlin", thing: "Bag", food: "Bread" } }));
    await room.fetch(
      makeRequest("/score", "POST", {
        hostToken: "host-token",
        roundNumber: 1,
        participantId: "host",
        marks: { name: true, animal: true, place: true, thing: true, food: true }
      })
    );
    await room.fetch(
      makeRequest("/score", "POST", {
        hostToken: "host-token",
        roundNumber: 1,
        participantId: joinBody.requestId,
        marks: { name: false, animal: false, place: false, thing: false, food: false }
      })
    );

    const discard = await room.fetch(makeRequest("/discard", "POST", { hostToken: "host-token", roundNumber: 1 }));
    expect(discard.status).toBe(200);
  });

  it("covers websocket upgrade, message fanout, and close presence", async () => {
    const { room, state } = createRoomHarness();
    await initRoom(room);

    const OriginalResponse = globalThis.Response;
    const OriginalPair = (globalThis as { WebSocketPair?: unknown }).WebSocketPair;

    class ResponseWith101 extends OriginalResponse {
      constructor(body?: BodyInit | null, init?: (ResponseInit & { webSocket?: unknown }) | undefined) {
        if (init?.status === 101) {
          super(null, { status: 200, headers: init.headers });
          Object.defineProperty(this, "status", { value: 101, configurable: true });
          Object.defineProperty(this, "webSocket", { value: init.webSocket, configurable: true });
          return;
        }

        super(body, init);
      }
    }

    class TestWebSocketPair {
      constructor() {
        const client = new MockSocket();
        const server = new MockSocket();
        return { 0: client, 1: server };
      }
    }

    (globalThis as { Response: typeof Response }).Response = ResponseWith101 as unknown as typeof Response;
    ((globalThis as unknown) as { WebSocketPair?: unknown }).WebSocketPair = TestWebSocketPair;

    try {
      const wsRes = await room.fetch(makeRequest("/ws", "GET", undefined, { Upgrade: "websocket" }));
      expect(wsRes.status).toBe(101);
      expect(state.sockets).toHaveLength(1);
      expect(state.sockets[0].sent.some((message) => message.includes('"type":"connected"'))).toBe(true);
      expect(state.sockets[0].sent.some((message) => message.includes('"type":"snapshot"'))).toBe(true);
      expect(state.sockets[0].sent.some((message) => message.includes('"type":"presence"'))).toBe(true);
    } finally {
      (globalThis as { Response: typeof Response }).Response = OriginalResponse;
      (globalThis as { WebSocketPair?: unknown }).WebSocketPair = OriginalPair;
    }

    const extraSocket = new MockSocket();
    state.sockets.push(extraSocket);

    room.webSocketMessage({} as WebSocket, '{"ping":"pong"}');
    expect(extraSocket.sent.some((message) => message.includes('"type":"event"'))).toBe(true);
    const bufferedPayload = new TextEncoder().encode('{"from":"buffer"}').buffer as ArrayBuffer;
    room.webSocketMessage({} as WebSocket, bufferedPayload);
    room.webSocketMessage({} as WebSocket, "not-json");
    room.webSocketClose({} as WebSocket);
    expect(extraSocket.sent.some((message) => message.includes('"type":"presence"'))).toBe(true);
  });

  it("covers alarm early-return and finalize branches", async () => {
    const { room, state } = createRoomHarness();

    // No room state.
    await room.alarm();

    // IN_PROGRESS but no active round.
    await state.storage.put(ROOM_STORAGE_KEY, createStartedState());
    await room.alarm();

    // Active round without timer end.
    const noTimerCall = callNumberForTurn(createStartedState({ endRule: "FIRST_SUBMISSION" }), "host", 1, "2026-02-08T00:00:11.000Z");
    if (!noTimerCall.ok) {
      throw new Error("expected first-submission call to succeed");
    }
    await state.storage.put(ROOM_STORAGE_KEY, noTimerCall.nextState);
    await room.alarm();

    // Active round with future timer should reschedule.
    const timerCall = callNumberForTurn(createStartedState({ endRule: "TIMER" }), "host", 1, "2026-02-08T00:00:11.000Z");
    if (!timerCall.ok) {
      throw new Error("expected timer call to succeed");
    }
    await state.storage.put(ROOM_STORAGE_KEY, timerCall.nextState);

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-08T00:00:15.000Z"));
    await room.alarm();
    expect(state.storage.setAlarmCalls.length).toBeGreaterThan(0);

    // Timer elapsed should finalize and clear alarm.
    vi.setSystemTime(new Date("2026-02-08T00:00:25.000Z"));
    await room.alarm();
    const finalized = (await state.storage.get<StoredRoomState>(ROOM_STORAGE_KEY))!;
    expect(finalized.game.completedRounds.length).toBe(1);
    expect(finalized.game.activeRound).toBeNull();
    expect(state.storage.deleteAlarmCalls).toBeGreaterThan(0);
  });
});
