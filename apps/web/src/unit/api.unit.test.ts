import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  callTurnNumber,
  cancelGameRoom,
  connectRoomSocket,
  createRoom,
  discardRoundScores,
  endGameRoom,
  endRoundNow,
  getRoomState,
  publishRoundScores,
  reviewJoinRequest,
  roomWebSocketUrl,
  scoreRoundSubmission,
  startGame,
  submitJoinRequest,
  submitRoundAnswers,
  updateRoundDraft
} from "../api";

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}

describe("unit: api client", () => {
  const fetchMock = vi.spyOn(globalThis, "fetch");

  beforeEach(() => {
    fetchMock.mockReset();
  });

  afterEach(() => {
    fetchMock.mockReset();
  });

  it("builds websocket URL and opens a socket", () => {
    const originalWebSocket = globalThis.WebSocket;
    const socketUrls: string[] = [];

    class FakeWebSocket {
      constructor(url: string | URL) {
        socketUrls.push(String(url));
      }
    }

    Object.defineProperty(globalThis, "WebSocket", {
      value: FakeWebSocket,
      configurable: true
    });

    try {
      expect(roomWebSocketUrl("room77")).toBe("ws://127.0.0.1:8787/ws/ROOM77");
      connectRoomSocket("room77");
      expect(socketUrls).toEqual(["ws://127.0.0.1:8787/ws/ROOM77"]);
    } finally {
      Object.defineProperty(globalThis, "WebSocket", {
        value: originalWebSocket,
        configurable: true
      });
    }
  });

  it("calls room creation and state endpoints", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({ roomCode: "ROOM55", maxParticipants: 6, hostName: "Host", wsPath: "/ws/ROOM55", hostToken: "token" }, 201)
      )
      .mockResolvedValueOnce(jsonResponse({ meta: { roomCode: "ROOM55" } }));

    await expect(createRoom("Host", 6)).resolves.toMatchObject({ roomCode: "ROOM55" });
    await expect(getRoomState("room55")).resolves.toMatchObject({ meta: { roomCode: "ROOM55" } });

    expect(String(fetchMock.mock.calls[0][0])).toContain("/api/rooms");
    expect(String(fetchMock.mock.calls[1][0])).toContain("/api/rooms/ROOM55");
  });

  it("calls join and admission endpoints", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ requestId: "req-1", status: "PENDING", participant: { id: "p1", name: "Ada" } }, 202))
      .mockResolvedValueOnce(jsonResponse({ meta: { roomCode: "ROOM55" } }));

    await expect(submitJoinRequest("room55", "Ada")).resolves.toMatchObject({ requestId: "req-1" });
    await expect(reviewJoinRequest("room55", "host-token", "req-1", true)).resolves.toMatchObject({ meta: { roomCode: "ROOM55" } });

    expect(String(fetchMock.mock.calls[0][0])).toContain("/api/rooms/ROOM55/join");
    expect(String(fetchMock.mock.calls[1][0])).toContain("/api/rooms/ROOM55/admissions");
  });

  it("calls start, call, submit, draft and manual end endpoints", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ meta: { roomCode: "ROOM55" } }))
      .mockResolvedValueOnce(jsonResponse({ meta: { roomCode: "ROOM55" } }))
      .mockResolvedValueOnce(jsonResponse({ meta: { roomCode: "ROOM55" } }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }))
      .mockResolvedValueOnce(jsonResponse({ meta: { roomCode: "ROOM55" } }));

    await startGame("room55", "host-token", { roundSeconds: 20, endRule: "TIMER" });
    await callTurnNumber("room55", "p1", 2);
    await submitRoundAnswers("room55", "p1", {
      name: "Bola",
      animal: "Bear",
      place: "Berlin",
      thing: "Bottle",
      food: "Bread"
    });
    await updateRoundDraft("room55", "p1", { food: "Burger" });
    await endRoundNow("room55", "p1");

    const endpoints = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(endpoints.some((endpoint) => endpoint.includes("/start"))).toBe(true);
    expect(endpoints.some((endpoint) => endpoint.includes("/call"))).toBe(true);
    expect(endpoints.some((endpoint) => endpoint.includes("/submit"))).toBe(true);
    expect(endpoints.some((endpoint) => endpoint.includes("/draft"))).toBe(true);
    expect(endpoints.some((endpoint) => endpoint.includes("/end"))).toBe(true);
  });

  it("calls score, publish, discard, cancel and finish endpoints", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ meta: { roomCode: "ROOM55" } }))
      .mockResolvedValueOnce(jsonResponse({ meta: { roomCode: "ROOM55" } }))
      .mockResolvedValueOnce(jsonResponse({ meta: { roomCode: "ROOM55" } }))
      .mockResolvedValueOnce(jsonResponse({ meta: { roomCode: "ROOM55" } }))
      .mockResolvedValueOnce(jsonResponse({ meta: { roomCode: "ROOM55" } }));

    await scoreRoundSubmission("room55", "host-token", 1, "p1", {
      name: true,
      animal: false,
      place: true,
      thing: false,
      food: true
    });
    await publishRoundScores("room55", "host-token", 1);
    await discardRoundScores("room55", "host-token", 2);
    await cancelGameRoom("room55", "host-token");
    await endGameRoom("room55", "host-token");

    const endpoints = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(endpoints.some((endpoint) => endpoint.includes("/score"))).toBe(true);
    expect(endpoints.some((endpoint) => endpoint.includes("/publish"))).toBe(true);
    expect(endpoints.some((endpoint) => endpoint.includes("/discard"))).toBe(true);
    expect(endpoints.some((endpoint) => endpoint.includes("/cancel"))).toBe(true);
    expect(endpoints.some((endpoint) => endpoint.includes("/finish"))).toBe(true);
  });

  it("surfaces backend error messages and fallback parse errors", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ error: "room is full" }, 409))
      .mockResolvedValueOnce(new Response("internal error", { status: 500 }));

    await expect(createRoom("Host", 10)).rejects.toThrow("room is full");
    await expect(getRoomState("ROOM55")).rejects.toThrow("Request failed");
  });
});
