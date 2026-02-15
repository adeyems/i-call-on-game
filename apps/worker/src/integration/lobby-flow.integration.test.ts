import { describe, expect, it } from "vitest";
import worker, { type Env } from "../index";
import {
  buildSnapshot,
  cancelGame,
  callNumberForTurn,
  createJoinRequest,
  discardRoundScores,
  endGame,
  endRoundManually,
  initializeRoomState,
  isHostTokenValid,
  updateRoundDraft,
  resolveJoinRequest,
  scoreRoundSubmission,
  publishRoundScores,
  startGame,
  submitRoundAnswers,
  type StoredRoomState
} from "../room";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}

function createMockEnv(): Env {
  const roomStates = new Map<string, StoredRoomState>();

  const namespace = {
    idFromName(roomCode: string) {
      return roomCode;
    },
    get(roomCode: string) {
      return {
        async fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
          const rawUrl =
            typeof input === "string"
              ? input
              : input instanceof URL
                ? input.toString()
                : input.url;
          const url = new URL(rawUrl);
          const method = init?.method ?? "GET";

          if (method === "POST" && url.pathname === "/init") {
            const payload = JSON.parse(String(init?.body ?? "{}")) as {
              roomCode: string;
              hostName: string;
              maxParticipants: number;
              hostToken: string;
            };
            roomStates.set(roomCode, initializeRoomState(payload, "2026-02-08T00:00:00.000Z"));
            return json({ ok: true });
          }

          const currentState = roomStates.get(roomCode);
          if (!currentState) {
            return json({ error: "room not found" }, 404);
          }

          if (method === "GET" && url.pathname === "/state") {
            return json(buildSnapshot(currentState));
          }

          if (method === "POST" && url.pathname === "/join") {
            const payload = JSON.parse(String(init?.body ?? "{}")) as { name?: string };
            const result = createJoinRequest(currentState, payload.name ?? "", "2026-02-08T00:00:01.000Z");
            if (!result.ok) {
              return json({ error: result.error }, result.status);
            }

            roomStates.set(roomCode, result.nextState);
            return json(
              {
                requestId: result.participant.id,
                participant: result.participant,
                status: result.participant.status
              },
              202
            );
          }

          if (method === "POST" && url.pathname === "/admit") {
            const payload = JSON.parse(String(init?.body ?? "{}")) as {
              hostToken?: string;
              requestId?: string;
              approve?: boolean;
            };

            if (!payload.hostToken || !isHostTokenValid(currentState, payload.hostToken)) {
              return json({ error: "invalid host token" }, 401);
            }

            if (!payload.requestId || typeof payload.approve !== "boolean") {
              return json({ error: "invalid payload" }, 400);
            }

            const result = resolveJoinRequest(currentState, payload.requestId, payload.approve, "2026-02-08T00:00:02.000Z");
            if (!result.ok) {
              return json({ error: result.error }, result.status);
            }

            roomStates.set(roomCode, result.nextState);
            return json(buildSnapshot(result.nextState));
          }

          if (method === "POST" && url.pathname === "/start") {
            const payload = JSON.parse(String(init?.body ?? "{}")) as {
              hostToken?: string;
              config?: {
                roundSeconds?: number;
                endRule?: "TIMER" | "FIRST_SUBMISSION" | "WHICHEVER_FIRST";
                manualEndPolicy?: "HOST_OR_CALLER" | "CALLER_ONLY" | "CALLER_OR_TIMER" | "NONE";
                scoringMode?: "FIXED_10" | "SHARED_10";
              };
            };
            if (!payload.hostToken) {
              return json({ error: "hostToken is required" }, 400);
            }

            const result = startGame(currentState, payload.hostToken, payload.config, "2026-02-08T00:00:10.000Z");
            if (!result.ok) {
              return json({ error: result.error }, result.status);
            }

            roomStates.set(roomCode, result.nextState);
            return json(buildSnapshot(result.nextState));
          }

          if (method === "POST" && url.pathname === "/call") {
            const payload = JSON.parse(String(init?.body ?? "{}")) as {
              participantId?: string;
              number?: number;
            };

            if (!payload.participantId) {
              return json({ error: "participantId is required" }, 400);
            }

            const result = callNumberForTurn(currentState, payload.participantId, Number(payload.number), "2026-02-08T00:00:11.000Z");
            if (!result.ok) {
              return json({ error: result.error }, result.status);
            }

            roomStates.set(roomCode, result.nextState);
            return json(buildSnapshot(result.nextState));
          }

          if (method === "POST" && url.pathname === "/submit") {
            const payload = JSON.parse(String(init?.body ?? "{}")) as {
              participantId?: string;
              answers?: {
                name?: string;
                animal?: string;
                place?: string;
                thing?: string;
                food?: string;
              };
            };

            if (!payload.participantId) {
              return json({ error: "participantId is required" }, 400);
            }

            const result = submitRoundAnswers(currentState, payload.participantId, payload.answers ?? {}, "2026-02-08T00:00:15.000Z");
            if (!result.ok) {
              return json({ error: result.error }, result.status);
            }

            roomStates.set(roomCode, result.nextState);
            return json(buildSnapshot(result.nextState));
          }

          if (method === "POST" && url.pathname === "/draft") {
            const payload = JSON.parse(String(init?.body ?? "{}")) as {
              participantId?: string;
              answers?: {
                name?: string;
                animal?: string;
                place?: string;
                thing?: string;
                food?: string;
              };
            };

            if (!payload.participantId) {
              return json({ error: "participantId is required" }, 400);
            }

            const result = updateRoundDraft(currentState, payload.participantId, payload.answers ?? {}, "2026-02-08T00:00:16.000Z");
            if (!result.ok) {
              return json({ error: result.error }, result.status);
            }

            roomStates.set(roomCode, result.nextState);
            return json({ ok: true });
          }

          if (method === "POST" && url.pathname === "/end") {
            const payload = JSON.parse(String(init?.body ?? "{}")) as {
              participantId?: string;
            };

            if (!payload.participantId) {
              return json({ error: "participantId is required" }, 400);
            }

            const result = endRoundManually(currentState, payload.participantId, "2026-02-08T00:00:18.000Z");
            if (!result.ok) {
              return json({ error: result.error }, result.status);
            }

            roomStates.set(roomCode, result.nextState);
            return json(buildSnapshot(result.nextState));
          }

          if (method === "POST" && url.pathname === "/score") {
            const payload = JSON.parse(String(init?.body ?? "{}")) as {
              hostToken?: string;
              roundNumber?: number;
              participantId?: string;
              marks?: {
                name?: boolean;
                animal?: boolean;
                place?: boolean;
                thing?: boolean;
                food?: boolean;
              };
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
              payload.marks ?? {},
              "2026-02-08T00:00:21.000Z"
            );

            if (!result.ok) {
              return json({ error: result.error }, result.status);
            }

            roomStates.set(roomCode, result.nextState);
            return json(buildSnapshot(result.nextState));
          }

          if (method === "POST" && url.pathname === "/publish") {
            const payload = JSON.parse(String(init?.body ?? "{}")) as {
              hostToken?: string;
              roundNumber?: number;
            };

            if (!payload.hostToken) {
              return json({ error: "hostToken is required" }, 400);
            }

            const result = publishRoundScores(currentState, payload.hostToken, Number(payload.roundNumber), "2026-02-08T00:00:22.000Z");
            if (!result.ok) {
              return json({ error: result.error }, result.status);
            }

            roomStates.set(roomCode, result.nextState);
            return json(buildSnapshot(result.nextState));
          }

          if (method === "POST" && url.pathname === "/discard") {
            const payload = JSON.parse(String(init?.body ?? "{}")) as {
              hostToken?: string;
              roundNumber?: number;
            };

            if (!payload.hostToken) {
              return json({ error: "hostToken is required" }, 400);
            }

            const result = discardRoundScores(currentState, payload.hostToken, Number(payload.roundNumber), "2026-02-08T00:00:22.500Z");
            if (!result.ok) {
              return json({ error: result.error }, result.status);
            }

            roomStates.set(roomCode, result.nextState);
            return json(buildSnapshot(result.nextState));
          }

          if (method === "POST" && url.pathname === "/cancel") {
            const payload = JSON.parse(String(init?.body ?? "{}")) as {
              hostToken?: string;
            };

            if (!payload.hostToken) {
              return json({ error: "hostToken is required" }, 400);
            }

            const result = cancelGame(currentState, payload.hostToken, "2026-02-08T00:00:23.000Z");
            if (!result.ok) {
              return json({ error: result.error }, result.status);
            }

            roomStates.set(roomCode, result.nextState);
            return json(buildSnapshot(result.nextState));
          }

          if (method === "POST" && url.pathname === "/finish") {
            const payload = JSON.parse(String(init?.body ?? "{}")) as {
              hostToken?: string;
            };

            if (!payload.hostToken) {
              return json({ error: "hostToken is required" }, 400);
            }

            const result = endGame(currentState, payload.hostToken, "2026-02-08T00:00:30.000Z");
            if (!result.ok) {
              return json({ error: result.error }, result.status);
            }

            roomStates.set(roomCode, result.nextState);
            return json(buildSnapshot(result.nextState));
          }

          return json({ error: "Not found" }, 404);
        }
      };
    }
  };

  return {
    APP_ORIGIN: "http://localhost:5181",
    GAME_ROOM: namespace as unknown as DurableObjectNamespace
  };
}

describe("integration: lobby and round lifecycle routes", () => {
  it("covers steps 1-10 via worker API", async () => {
    const env = createMockEnv();

    const createResponse = await worker.fetch(
      new Request("http://localhost/api/rooms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ hostName: "Qudus", maxParticipants: 4 })
      }),
      env
    );

    expect(createResponse.status).toBe(201);
    const created = (await createResponse.json()) as {
      roomCode: string;
      hostToken: string;
    };

    const joinAdaResponse = await worker.fetch(
      new Request(`http://localhost/api/rooms/${created.roomCode}/join`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ name: "Ada" })
      }),
      env
    );
    expect(joinAdaResponse.status).toBe(202);
    const joinAdaPayload = (await joinAdaResponse.json()) as { requestId: string };

    const admitAdaResponse = await worker.fetch(
      new Request(`http://localhost/api/rooms/${created.roomCode}/admissions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ hostToken: created.hostToken, requestId: joinAdaPayload.requestId, approve: true })
      }),
      env
    );

    expect(admitAdaResponse.status).toBe(200);

    const startResponse = await worker.fetch(
      new Request(`http://localhost/api/rooms/${created.roomCode}/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          hostToken: created.hostToken,
          config: {
            roundSeconds: 15,
            endRule: "WHICHEVER_FIRST"
          }
        })
      }),
      env
    );

    expect(startResponse.status).toBe(200);
    const startedState = (await startResponse.json()) as {
      game: {
        status: string;
        turnOrder: string[];
        currentTurnParticipantId: string | null;
      };
    };
    expect(startedState.game.status).toBe("IN_PROGRESS");
    expect(startedState.game.turnOrder.length).toBe(2);
    expect(startedState.game.currentTurnParticipantId).toBe("host");

    const callResponse = await worker.fetch(
      new Request(`http://localhost/api/rooms/${created.roomCode}/call`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ participantId: "host", number: 3 })
      }),
      env
    );

    expect(callResponse.status).toBe(200);
    const calledState = (await callResponse.json()) as {
      game: {
        activeRound: {
          activeLetter: string;
          calledNumber: number;
          countdownEndsAt: string;
        } | null;
      };
    };
    expect(calledState.game.activeRound?.activeLetter).toBe("C");
    expect(calledState.game.activeRound?.calledNumber).toBe(3);
    expect(calledState.game.activeRound?.countdownEndsAt).toBe("2026-02-08T00:00:14.000Z");

    const submitResponse = await worker.fetch(
      new Request(`http://localhost/api/rooms/${created.roomCode}/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          participantId: joinAdaPayload.requestId,
          answers: {
            name: "Cora",
            animal: "Cat",
            place: "Cairo",
            thing: "Cup",
            food: "Cake"
          }
        })
      }),
      env
    );

    expect(submitResponse.status).toBe(200);
    const afterSubmit = (await submitResponse.json()) as {
      game: {
        activeRound: unknown;
        completedRounds: Array<{
          endReason: string;
          submissions: Array<{ participantName: string }>;
        }>;
      };
    };
    expect(afterSubmit.game.activeRound).toBeNull();
    expect(afterSubmit.game.completedRounds).toHaveLength(1);
    expect(afterSubmit.game.completedRounds[0].endReason).toBe("FIRST_SUBMISSION");
    expect(afterSubmit.game.completedRounds[0].submissions).toHaveLength(2);
  });

  it("supports more than 3 players (host + 3 admitted participants)", async () => {
    const env = createMockEnv();

    const createResponse = await worker.fetch(
      new Request("http://localhost/api/rooms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ hostName: "Qudus", maxParticipants: 10 })
      }),
      env
    );

    expect(createResponse.status).toBe(201);
    const created = (await createResponse.json()) as {
      roomCode: string;
      hostToken: string;
    };

    const playerNames = ["Ada", "Bola", "Chi"];

    for (const playerName of playerNames) {
      const joinResponse = await worker.fetch(
        new Request(`http://localhost/api/rooms/${created.roomCode}/join`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ name: playerName })
        }),
        env
      );
      expect(joinResponse.status).toBe(202);
      const joinPayload = (await joinResponse.json()) as { requestId: string };

      const admitResponse = await worker.fetch(
        new Request(`http://localhost/api/rooms/${created.roomCode}/admissions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ hostToken: created.hostToken, requestId: joinPayload.requestId, approve: true })
        }),
        env
      );
      expect(admitResponse.status).toBe(200);
    }

    const startResponse = await worker.fetch(
      new Request(`http://localhost/api/rooms/${created.roomCode}/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          hostToken: created.hostToken,
          config: {
            roundSeconds: 20,
            endRule: "WHICHEVER_FIRST"
          }
        })
      }),
      env
    );

    expect(startResponse.status).toBe(200);
    const startedState = (await startResponse.json()) as {
      counts: {
        admitted: number;
      };
      game: {
        status: string;
        turnOrder: string[];
        currentTurnParticipantId: string | null;
      };
    };

    expect(startedState.counts.admitted).toBe(4);
    expect(startedState.game.status).toBe("IN_PROGRESS");
    expect(startedState.game.turnOrder).toHaveLength(4);
    expect(new Set(startedState.game.turnOrder).size).toBe(4);
    expect(startedState.game.currentTurnParticipantId).toBe("host");
  });

  it("allows host to end round early and force-submit everyone", async () => {
    const env = createMockEnv();

    const createResponse = await worker.fetch(
      new Request("http://localhost/api/rooms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ hostName: "Qudus", maxParticipants: 4 })
      }),
      env
    );

    const created = (await createResponse.json()) as {
      roomCode: string;
      hostToken: string;
    };

    const joinResponse = await worker.fetch(
      new Request(`http://localhost/api/rooms/${created.roomCode}/join`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ name: "Ada" })
      }),
      env
    );
    const joinPayload = (await joinResponse.json()) as { requestId: string };

    await worker.fetch(
      new Request(`http://localhost/api/rooms/${created.roomCode}/admissions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ hostToken: created.hostToken, requestId: joinPayload.requestId, approve: true })
      }),
      env
    );

    await worker.fetch(
      new Request(`http://localhost/api/rooms/${created.roomCode}/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          hostToken: created.hostToken,
          config: {
            roundSeconds: 12,
            endRule: "TIMER"
          }
        })
      }),
      env
    );

    await worker.fetch(
      new Request(`http://localhost/api/rooms/${created.roomCode}/call`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ participantId: "host", number: 7 })
      }),
      env
    );

    const endResponse = await worker.fetch(
      new Request(`http://localhost/api/rooms/${created.roomCode}/end`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ participantId: "host" })
      }),
      env
    );

    expect(endResponse.status).toBe(200);
    const state = (await endResponse.json()) as {
      game: {
        activeRound: unknown;
        completedRounds: Array<{
          endReason: string;
          submissionsCount: number;
        }>;
      };
    };

    expect(state.game.activeRound).toBeNull();
    expect(state.game.completedRounds).toHaveLength(1);
    expect(state.game.completedRounds[0].endReason).toBe("MANUAL_END");
    expect(state.game.completedRounds[0].submissionsCount).toBe(2);
  });

  it("does not start game while pending requests exist", async () => {
    const env = createMockEnv();

    const createResponse = await worker.fetch(
      new Request("http://localhost/api/rooms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ hostName: "Qudus", maxParticipants: 4 })
      }),
      env
    );

    const created = (await createResponse.json()) as {
      roomCode: string;
      hostToken: string;
    };

    await worker.fetch(
      new Request(`http://localhost/api/rooms/${created.roomCode}/join`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ name: "Ada" })
      }),
      env
    );

    const startResponse = await worker.fetch(
      new Request(`http://localhost/api/rooms/${created.roomCode}/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ hostToken: created.hostToken })
      }),
      env
    );

    expect(startResponse.status).toBe(409);
    await expect(startResponse.json()).resolves.toEqual({
      error: "cannot start game while join requests are pending"
    });
  });

  it("allows host to cancel room and expires join link", async () => {
    const env = createMockEnv();

    const createResponse = await worker.fetch(
      new Request("http://localhost/api/rooms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ hostName: "Qudus", maxParticipants: 4 })
      }),
      env
    );

    expect(createResponse.status).toBe(201);
    const created = (await createResponse.json()) as {
      roomCode: string;
      hostToken: string;
    };

    const cancelResponse = await worker.fetch(
      new Request(`http://localhost/api/rooms/${created.roomCode}/cancel`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ hostToken: created.hostToken })
      }),
      env
    );

    expect(cancelResponse.status).toBe(200);
    const cancelledState = (await cancelResponse.json()) as {
      game: {
        status: string;
        cancelledAt: string | null;
      };
    };
    expect(cancelledState.game.status).toBe("CANCELLED");
    expect(cancelledState.game.cancelledAt).toBe("2026-02-08T00:00:23.000Z");

    const joinResponse = await worker.fetch(
      new Request(`http://localhost/api/rooms/${created.roomCode}/join`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ name: "Ada" })
      }),
      env
    );

    expect(joinResponse.status).toBe(410);
    await expect(joinResponse.json()).resolves.toEqual({
      error: "join link has expired for this room"
    });
  });

  it("lets host end game and returns final published results", async () => {
    const env = createMockEnv();

    const createResponse = await worker.fetch(
      new Request("http://localhost/api/rooms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ hostName: "Qudus", maxParticipants: 3 })
      }),
      env
    );
    const created = (await createResponse.json()) as { roomCode: string; hostToken: string };

    const joinResponse = await worker.fetch(
      new Request(`http://localhost/api/rooms/${created.roomCode}/join`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ name: "Ada" })
      }),
      env
    );
    const joinPayload = (await joinResponse.json()) as { requestId: string };

    await worker.fetch(
      new Request(`http://localhost/api/rooms/${created.roomCode}/admissions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ hostToken: created.hostToken, requestId: joinPayload.requestId, approve: true })
      }),
      env
    );

    await worker.fetch(
      new Request(`http://localhost/api/rooms/${created.roomCode}/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          hostToken: created.hostToken,
          config: {
            roundSeconds: 12,
            endRule: "TIMER"
          }
        })
      }),
      env
    );

    await worker.fetch(
      new Request(`http://localhost/api/rooms/${created.roomCode}/call`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ participantId: "host", number: 1 })
      }),
      env
    );

    await worker.fetch(
      new Request(`http://localhost/api/rooms/${created.roomCode}/draft`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          participantId: joinPayload.requestId,
          answers: { name: "Ada", animal: "Ant", place: "Accra", thing: "Axe", food: "Apple" }
        })
      }),
      env
    );

    await worker.fetch(
      new Request(`http://localhost/api/rooms/${created.roomCode}/end`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ participantId: "host" })
      }),
      env
    );

    await worker.fetch(
      new Request(`http://localhost/api/rooms/${created.roomCode}/score`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          hostToken: created.hostToken,
          roundNumber: 1,
          participantId: "host",
          marks: { name: true, animal: true, place: true, thing: true, food: false }
        })
      }),
      env
    );

    await worker.fetch(
      new Request(`http://localhost/api/rooms/${created.roomCode}/score`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          hostToken: created.hostToken,
          roundNumber: 1,
          participantId: joinPayload.requestId,
          marks: { name: true, animal: false, place: true, thing: false, food: false }
        })
      }),
      env
    );

    const finishResponse = await worker.fetch(
      new Request(`http://localhost/api/rooms/${created.roomCode}/finish`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ hostToken: created.hostToken })
      }),
      env
    );

    expect(finishResponse.status).toBe(200);
    const finishedState = (await finishResponse.json()) as {
      game: {
        status: string;
        scoring: {
          publishedRounds: number;
        };
      };
    };
    expect(finishedState.game.status).toBe("FINISHED");
    expect(finishedState.game.scoring.publishedRounds).toBe(1);

    const joinAfterFinish = await worker.fetch(
      new Request(`http://localhost/api/rooms/${created.roomCode}/join`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ name: "Late" })
      }),
      env
    );
    expect(joinAfterFinish.status).toBe(410);
  });

  it("requires host to publish or discard round before next call", async () => {
    const env = createMockEnv();

    const createResponse = await worker.fetch(
      new Request("http://localhost/api/rooms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ hostName: "Qudus", maxParticipants: 3 })
      }),
      env
    );
    const created = (await createResponse.json()) as { roomCode: string; hostToken: string };

    const joinResponse = await worker.fetch(
      new Request(`http://localhost/api/rooms/${created.roomCode}/join`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ name: "Ada" })
      }),
      env
    );
    const joinPayload = (await joinResponse.json()) as { requestId: string };

    await worker.fetch(
      new Request(`http://localhost/api/rooms/${created.roomCode}/admissions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ hostToken: created.hostToken, requestId: joinPayload.requestId, approve: true })
      }),
      env
    );

    await worker.fetch(
      new Request(`http://localhost/api/rooms/${created.roomCode}/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          hostToken: created.hostToken,
          config: {
            roundSeconds: 12,
            endRule: "TIMER"
          }
        })
      }),
      env
    );

    await worker.fetch(
      new Request(`http://localhost/api/rooms/${created.roomCode}/call`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ participantId: "host", number: 1 })
      }),
      env
    );

    await worker.fetch(
      new Request(`http://localhost/api/rooms/${created.roomCode}/end`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ participantId: "host" })
      }),
      env
    );

    const blockedCall = await worker.fetch(
      new Request(`http://localhost/api/rooms/${created.roomCode}/call`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ participantId: joinPayload.requestId, number: 2 })
      }),
      env
    );
    expect(blockedCall.status).toBe(409);
    await expect(blockedCall.json()).resolves.toEqual({
      error: "submit or discard previous round result before starting next round"
    });

    const discardResponse = await worker.fetch(
      new Request(`http://localhost/api/rooms/${created.roomCode}/discard`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ hostToken: created.hostToken, roundNumber: 1 })
      }),
      env
    );
    expect(discardResponse.status).toBe(200);

    const allowedCall = await worker.fetch(
      new Request(`http://localhost/api/rooms/${created.roomCode}/call`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ participantId: joinPayload.requestId, number: 2 })
      }),
      env
    );
    expect(allowedCall.status).toBe(200);
  });

  it("scores a completed round submission via /score route", async () => {
    const env = createMockEnv();

    const createResponse = await worker.fetch(
      new Request("http://localhost/api/rooms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ hostName: "Qudus", maxParticipants: 4 })
      }),
      env
    );

    const created = (await createResponse.json()) as {
      roomCode: string;
      hostToken: string;
    };

    const joinResponse = await worker.fetch(
      new Request(`http://localhost/api/rooms/${created.roomCode}/join`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ name: "Ada" })
      }),
      env
    );
    const joinPayload = (await joinResponse.json()) as { requestId: string };

    await worker.fetch(
      new Request(`http://localhost/api/rooms/${created.roomCode}/admissions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ hostToken: created.hostToken, requestId: joinPayload.requestId, approve: true })
      }),
      env
    );

    await worker.fetch(
      new Request(`http://localhost/api/rooms/${created.roomCode}/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          hostToken: created.hostToken,
          config: {
            roundSeconds: 12,
            endRule: "TIMER"
          }
        })
      }),
      env
    );

    await worker.fetch(
      new Request(`http://localhost/api/rooms/${created.roomCode}/call`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ participantId: "host", number: 1 })
      }),
      env
    );

    await worker.fetch(
      new Request(`http://localhost/api/rooms/${created.roomCode}/end`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ participantId: "host" })
      }),
      env
    );

    const scoreResponse = await worker.fetch(
      new Request(`http://localhost/api/rooms/${created.roomCode}/score`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          hostToken: created.hostToken,
          roundNumber: 1,
          participantId: "host",
          marks: {
            name: true,
            animal: true,
            place: false,
            thing: false,
            food: true
          }
        })
      }),
      env
    );

    expect(scoreResponse.status).toBe(200);
    const scoredState = (await scoreResponse.json()) as {
      game: {
        completedRounds: Array<{
          submissions: Array<{
            participantId: string;
            review: {
              scores: {
                total: number;
              };
            } | null;
          }>;
        }>;
      };
    };

    const hostSubmission = scoredState.game.completedRounds[0].submissions.find((submission) => submission.participantId === "host");
    expect(hostSubmission?.review?.scores.total).toBe(30);
  });

  it("publishes reviewed round scores via /publish route", async () => {
    const env = createMockEnv();

    const createResponse = await worker.fetch(
      new Request("http://localhost/api/rooms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ hostName: "Qudus", maxParticipants: 3 })
      }),
      env
    );

    const created = (await createResponse.json()) as {
      roomCode: string;
      hostToken: string;
    };

    const joinResponse = await worker.fetch(
      new Request(`http://localhost/api/rooms/${created.roomCode}/join`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ name: "Ada" })
      }),
      env
    );

    const joinPayload = (await joinResponse.json()) as { requestId: string };

    await worker.fetch(
      new Request(`http://localhost/api/rooms/${created.roomCode}/admissions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ hostToken: created.hostToken, requestId: joinPayload.requestId, approve: true })
      }),
      env
    );

    await worker.fetch(
      new Request(`http://localhost/api/rooms/${created.roomCode}/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          hostToken: created.hostToken,
          config: {
            roundSeconds: 12,
            endRule: "TIMER"
          }
        })
      }),
      env
    );

    await worker.fetch(
      new Request(`http://localhost/api/rooms/${created.roomCode}/call`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ participantId: "host", number: 1 })
      }),
      env
    );

    await worker.fetch(
      new Request(`http://localhost/api/rooms/${created.roomCode}/end`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ participantId: "host" })
      }),
      env
    );

    await worker.fetch(
      new Request(`http://localhost/api/rooms/${created.roomCode}/score`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          hostToken: created.hostToken,
          roundNumber: 1,
          participantId: "host",
          marks: {
            name: true,
            animal: true,
            place: true,
            thing: true,
            food: false
          }
        })
      }),
      env
    );

    await worker.fetch(
      new Request(`http://localhost/api/rooms/${created.roomCode}/score`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          hostToken: created.hostToken,
          roundNumber: 1,
          participantId: joinPayload.requestId,
          marks: {
            name: true,
            animal: false,
            place: true,
            thing: false,
            food: false
          }
        })
      }),
      env
    );

    const publishResponse = await worker.fetch(
      new Request(`http://localhost/api/rooms/${created.roomCode}/publish`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          hostToken: created.hostToken,
          roundNumber: 1
        })
      }),
      env
    );

    expect(publishResponse.status).toBe(200);
    const publishPayload = (await publishResponse.json()) as { error?: string };

    const state = publishPayload as {
      game: {
        scoring: {
          pendingPublicationRounds: number[];
          leaderboard: Array<{
            participantId: string;
            totalScore: number;
            history: Array<{ roundNumber: number; activeLetter: string; score: number }>;
          }>;
        };
      };
    };

    expect(state.game.scoring.pendingPublicationRounds).toEqual([]);
    const hostEntry = state.game.scoring.leaderboard.find((entry) => entry.participantId === "host");
    expect(hostEntry?.totalScore).toBe(40);
    expect(hostEntry?.history[0]).toMatchObject({ roundNumber: 1, activeLetter: "A", score: 40 });
  });

  it("rejects caller-or-timer manual policy when end rule has no timer", async () => {
    const env = createMockEnv();

    const createResponse = await worker.fetch(
      new Request("http://localhost/api/rooms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ hostName: "Qudus", maxParticipants: 3 })
      }),
      env
    );
    const created = (await createResponse.json()) as { roomCode: string; hostToken: string };

    const joinResponse = await worker.fetch(
      new Request(`http://localhost/api/rooms/${created.roomCode}/join`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ name: "Ada" })
      }),
      env
    );
    const joinPayload = (await joinResponse.json()) as { requestId: string };

    await worker.fetch(
      new Request(`http://localhost/api/rooms/${created.roomCode}/admissions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ hostToken: created.hostToken, requestId: joinPayload.requestId, approve: true })
      }),
      env
    );

    const startResponse = await worker.fetch(
      new Request(`http://localhost/api/rooms/${created.roomCode}/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          hostToken: created.hostToken,
          config: {
            roundSeconds: 15,
            endRule: "FIRST_SUBMISSION",
            manualEndPolicy: "CALLER_OR_TIMER"
          }
        })
      }),
      env
    );

    expect(startResponse.status).toBe(400);
    await expect(startResponse.json()).resolves.toEqual({
      error: "CALLER_OR_TIMER requires a timer-based endRule"
    });
  });

  it("splits shared scoring points across matching answers", async () => {
    const env = createMockEnv();

    const createResponse = await worker.fetch(
      new Request("http://localhost/api/rooms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ hostName: "Qudus", maxParticipants: 3 })
      }),
      env
    );
    const created = (await createResponse.json()) as { roomCode: string; hostToken: string };

    const joinResponse = await worker.fetch(
      new Request(`http://localhost/api/rooms/${created.roomCode}/join`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ name: "Ada" })
      }),
      env
    );
    const joinPayload = (await joinResponse.json()) as { requestId: string };

    await worker.fetch(
      new Request(`http://localhost/api/rooms/${created.roomCode}/admissions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ hostToken: created.hostToken, requestId: joinPayload.requestId, approve: true })
      }),
      env
    );

    await worker.fetch(
      new Request(`http://localhost/api/rooms/${created.roomCode}/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          hostToken: created.hostToken,
          config: {
            roundSeconds: 15,
            endRule: "TIMER",
            scoringMode: "SHARED_10"
          }
        })
      }),
      env
    );

    await worker.fetch(
      new Request(`http://localhost/api/rooms/${created.roomCode}/call`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ participantId: "host", number: 1 })
      }),
      env
    );

    await worker.fetch(
      new Request(`http://localhost/api/rooms/${created.roomCode}/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          participantId: "host",
          answers: {
            name: "Ada",
            animal: "Ant",
            place: "Accra",
            thing: "Anvil",
            food: "Apple"
          }
        })
      }),
      env
    );

    await worker.fetch(
      new Request(`http://localhost/api/rooms/${created.roomCode}/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          participantId: joinPayload.requestId,
          answers: {
            name: "Ada",
            animal: "Ant",
            place: "Austin",
            thing: "Arrow",
            food: "Apricot"
          }
        })
      }),
      env
    );

    await worker.fetch(
      new Request(`http://localhost/api/rooms/${created.roomCode}/end`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ participantId: "host" })
      }),
      env
    );

    await worker.fetch(
      new Request(`http://localhost/api/rooms/${created.roomCode}/score`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          hostToken: created.hostToken,
          roundNumber: 1,
          participantId: "host",
          marks: { name: true, animal: true, place: true, thing: true, food: true }
        })
      }),
      env
    );

    const scoreAdaResponse = await worker.fetch(
      new Request(`http://localhost/api/rooms/${created.roomCode}/score`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          hostToken: created.hostToken,
          roundNumber: 1,
          participantId: joinPayload.requestId,
          marks: { name: true, animal: true, place: true, thing: true, food: true }
        })
      }),
      env
    );

    expect(scoreAdaResponse.status).toBe(200);
    const state = (await scoreAdaResponse.json()) as {
      game: {
        completedRounds: Array<{
          submissions: Array<{
            participantId: string;
            review: {
              scores: {
                name: number;
                animal: number;
                total: number;
              };
            } | null;
          }>;
        }>;
      };
    };

    const round = state.game.completedRounds[0];
    const hostSubmission = round.submissions.find((submission) => submission.participantId === "host");
    const adaSubmission = round.submissions.find((submission) => submission.participantId === joinPayload.requestId);

    expect(hostSubmission?.review?.scores.name).toBe(5);
    expect(hostSubmission?.review?.scores.animal).toBe(5);
    expect(hostSubmission?.review?.scores.total).toBe(40);
    expect(adaSubmission?.review?.scores.name).toBe(5);
    expect(adaSubmission?.review?.scores.animal).toBe(5);
    expect(adaSubmission?.review?.scores.total).toBe(40);
  });
});
