import { describe, expect, it } from "vitest";
import {
  cancelGame,
  createJoinRequest,
  initializeRoomState,
  isHostTokenValid,
  resolveJoinRequest,
  startGame,
  type Participant,
  type StoredRoomState
} from "../room";

function createParticipant(overrides: Partial<Participant>): Participant {
  return {
    id: "p-default",
    name: "Player",
    status: "PENDING",
    isHost: false,
    createdAt: "2026-02-08T00:00:00.000Z",
    updatedAt: "2026-02-08T00:00:00.000Z",
    ...overrides
  };
}

describe("unit: lobby state logic", () => {
  it("initializes room with host admitted and game in LOBBY", () => {
    const state = initializeRoomState(
      {
        roomCode: "ABC123",
        hostName: "Qudus",
        maxParticipants: 6,
        hostToken: "host-token"
      },
      "2026-02-08T00:00:00.000Z"
    );

    expect(state.meta).toEqual({
      roomCode: "ABC123",
      hostName: "Qudus",
      maxParticipants: 6
    });
    expect(state.participants).toHaveLength(1);
    expect(state.participants[0]).toMatchObject({ id: "host", isHost: true, status: "ADMITTED" });
    expect(state.game).toMatchObject({
      status: "LOBBY",
      startedAt: null,
      currentTurnIndex: 0,
      activeRound: null
    });
    expect(state.game.turnOrder).toEqual([]);
    expect(state.game.completedRounds).toEqual([]);
    expect(state.game.config).toEqual({
      roundSeconds: 20,
      endRule: "WHICHEVER_FIRST",
      manualEndPolicy: "HOST_OR_CALLER",
      scoringMode: "FIXED_10"
    });
  });

  it("creates a pending join request", () => {
    const state = initializeRoomState(
      {
        roomCode: "ROOM01",
        hostName: "Host",
        maxParticipants: 5,
        hostToken: "host-token"
      },
      "2026-02-08T00:00:00.000Z"
    );

    const result = createJoinRequest(state, " Ada Lovelace ", "2026-02-08T00:00:01.000Z");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.participant.name).toBe("Ada Lovelace");
      expect(result.participant.status).toBe("PENDING");
      expect(result.nextState.participants).toHaveLength(2);
    }
  });

  it("rejects duplicate names", () => {
    const state = initializeRoomState(
      {
        roomCode: "ROOM02",
        hostName: "Host",
        maxParticipants: 6,
        hostToken: "host-token"
      },
      "2026-02-08T00:00:00.000Z"
    );

    const withPlayer: StoredRoomState = {
      ...state,
      participants: [...state.participants, createParticipant({ id: "p-1", name: "Ada" })]
    };

    const result = createJoinRequest(withPlayer, "ada");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(409);
      expect(result.error).toBe("name already exists in this room");
    }
  });

  it("approves and rejects pending requests", () => {
    const state = initializeRoomState(
      {
        roomCode: "ROOM03",
        hostName: "Host",
        maxParticipants: 5,
        hostToken: "host-token"
      },
      "2026-02-08T00:00:00.000Z"
    );

    const withPending: StoredRoomState = {
      ...state,
      participants: [...state.participants, createParticipant({ id: "req-1", name: "Nina" })]
    };

    const approved = resolveJoinRequest(withPending, "req-1", true, "2026-02-08T00:00:05.000Z");
    expect(approved.ok).toBe(true);
    if (approved.ok) {
      expect(approved.participant.status).toBe("ADMITTED");
    }

    const withPendingReject: StoredRoomState = {
      ...state,
      participants: [...state.participants, createParticipant({ id: "req-2", name: "Ivy" })]
    };

    const rejected = resolveJoinRequest(withPendingReject, "req-2", false, "2026-02-08T00:00:06.000Z");
    expect(rejected.ok).toBe(true);
    if (rejected.ok) {
      expect(rejected.participant.status).toBe("REJECTED");
    }
  });

  it("validates host token before start", () => {
    const state = initializeRoomState(
      {
        roomCode: "ROOM04",
        hostName: "Host",
        maxParticipants: 5,
        hostToken: "host-token"
      },
      "2026-02-08T00:00:00.000Z"
    );

    expect(isHostTokenValid(state, "wrong-token")).toBe(false);
    expect(isHostTokenValid(state, "host-token")).toBe(true);

    const invalidStart = startGame(state, "wrong-token");
    expect(invalidStart.ok).toBe(false);
    if (!invalidStart.ok) {
      expect(invalidStart.status).toBe(401);
    }
  });

  it("prevents start when pending requests exist", () => {
    const state = initializeRoomState(
      {
        roomCode: "ROOM05",
        hostName: "Host",
        maxParticipants: 5,
        hostToken: "host-token"
      },
      "2026-02-08T00:00:00.000Z"
    );

    const withPending: StoredRoomState = {
      ...state,
      participants: [...state.participants, createParticipant({ id: "req-1", name: "Ada" })]
    };

    const startResult = startGame(withPending, "host-token");

    expect(startResult.ok).toBe(false);
    if (!startResult.ok) {
      expect(startResult.status).toBe(409);
      expect(startResult.error).toBe("cannot start game while join requests are pending");
    }
  });

  it("starts game when lobby is ready", () => {
    const state = initializeRoomState(
      {
        roomCode: "ROOM06",
        hostName: "Host",
        maxParticipants: 5,
        hostToken: "host-token"
      },
      "2026-02-08T00:00:00.000Z"
    );

    const withAdmitted: StoredRoomState = {
      ...state,
      participants: [...state.participants, createParticipant({ id: "p-1", name: "Ada", status: "ADMITTED" })]
    };

    const startResult = startGame(
      withAdmitted,
      "host-token",
      {
        roundSeconds: 25,
        endRule: "TIMER"
      },
      "2026-02-08T00:00:30.000Z"
    );

    expect(startResult.ok).toBe(true);
    if (startResult.ok) {
      expect(startResult.nextState.game).toMatchObject({
        status: "IN_PROGRESS",
        startedAt: "2026-02-08T00:00:30.000Z",
        cancelledAt: null,
        finishedAt: null,
        currentTurnIndex: 0,
        activeRound: null,
        config: {
          roundSeconds: 25,
          endRule: "TIMER",
          manualEndPolicy: "HOST_OR_CALLER",
          scoringMode: "FIXED_10"
        }
      });
      expect(startResult.nextState.game.turnOrder).toEqual(["host", "p-1"]);
      expect(startResult.nextState.game.completedRounds).toEqual([]);
      expect(startResult.nextState.participants.map((participant) => participant.id)).toEqual(["host", "p-1"]);
    }
  });

  it("does not start with only one admitted participant", () => {
    const state = initializeRoomState(
      {
        roomCode: "ROOM09",
        hostName: "Host",
        maxParticipants: 5,
        hostToken: "host-token"
      },
      "2026-02-08T00:00:00.000Z"
    );

    const startResult = startGame(state, "host-token");
    expect(startResult.ok).toBe(false);
    if (!startResult.ok) {
      expect(startResult.status).toBe(409);
      expect(startResult.error).toBe("at least 2 admitted participants are required to start");
    }
  });

  it("rejects caller-or-timer manual end when round end rule has no timer", () => {
    const state = initializeRoomState(
      {
        roomCode: "ROOM10",
        hostName: "Host",
        maxParticipants: 5,
        hostToken: "host-token"
      },
      "2026-02-08T00:00:00.000Z"
    );

    const withAdmitted: StoredRoomState = {
      ...state,
      participants: [...state.participants, createParticipant({ id: "p-1", name: "Ada", status: "ADMITTED" })]
    };

    const startResult = startGame(withAdmitted, "host-token", {
      roundSeconds: 25,
      endRule: "FIRST_SUBMISSION",
      manualEndPolicy: "CALLER_OR_TIMER"
    });

    expect(startResult.ok).toBe(false);
    if (!startResult.ok) {
      expect(startResult.status).toBe(400);
      expect(startResult.error).toBe("CALLER_OR_TIMER requires a timer-based endRule");
    }
  });

  it("blocks admission changes after game has started", () => {
    const state = initializeRoomState(
      {
        roomCode: "ROOM07",
        hostName: "Host",
        maxParticipants: 5,
        hostToken: "host-token"
      },
      "2026-02-08T00:00:00.000Z"
    );

    const inProgress: StoredRoomState = {
      ...state,
      participants: [...state.participants, createParticipant({ id: "req-1", name: "Ben" })],
      game: {
        status: "IN_PROGRESS",
        startedAt: "2026-02-08T00:01:00.000Z",
        cancelledAt: null,
        finishedAt: null,
        config: {
          roundSeconds: 20,
          endRule: "WHICHEVER_FIRST",
          manualEndPolicy: "HOST_OR_CALLER",
          scoringMode: "FIXED_10"
        },
        turnOrder: ["host"],
        currentTurnIndex: 0,
        activeRound: null,
        completedRounds: []
      }
    };

    const result = resolveJoinRequest(inProgress, "req-1", true);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(409);
      expect(result.error).toBe("cannot change admissions after game has started");
    }
  });

  it("allows host to cancel and expires the join link", () => {
    const state = initializeRoomState(
      {
        roomCode: "ROOM08",
        hostName: "Host",
        maxParticipants: 5,
        hostToken: "host-token"
      },
      "2026-02-08T00:00:00.000Z"
    );

    const cancelled = cancelGame(state, "host-token", "2026-02-08T00:00:10.000Z");
    expect(cancelled.ok).toBe(true);
    if (!cancelled.ok) {
      return;
    }

    expect(cancelled.nextState.game.status).toBe("CANCELLED");
    expect(cancelled.nextState.game.cancelledAt).toBe("2026-02-08T00:00:10.000Z");

    const joinAfterCancel = createJoinRequest(cancelled.nextState, "Ada");
    expect(joinAfterCancel.ok).toBe(false);
    if (!joinAfterCancel.ok) {
      expect(joinAfterCancel.status).toBe(410);
      expect(joinAfterCancel.error).toBe("join link has expired for this room");
    }
  });
});
