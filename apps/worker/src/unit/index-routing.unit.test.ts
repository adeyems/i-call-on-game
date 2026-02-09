import { describe, expect, it } from "vitest";
import { isValidRoomCode, normalizeRoomCode, parseRoomRoute } from "../index";

describe("unit: room route parsing", () => {
  it("normalizes and validates room codes", () => {
    expect(normalizeRoomCode(" room99 ")).toBe("ROOM99");
    expect(isValidRoomCode("ROOM99")).toBe(true);
    expect(isValidRoomCode("room99")).toBe(false);
    expect(isValidRoomCode("***")).toBe(false);
  });

  it("parses supported room routes", () => {
    expect(parseRoomRoute("/api/rooms/room99")).toEqual({ type: "state", roomCode: "ROOM99" });
    expect(parseRoomRoute("/api/rooms/room99/join")).toEqual({ type: "join", roomCode: "ROOM99" });
    expect(parseRoomRoute("/api/rooms/room99/admissions")).toEqual({ type: "admissions", roomCode: "ROOM99" });
    expect(parseRoomRoute("/api/rooms/room99/start")).toEqual({ type: "start", roomCode: "ROOM99" });
    expect(parseRoomRoute("/api/rooms/room99/call")).toEqual({ type: "call", roomCode: "ROOM99" });
    expect(parseRoomRoute("/api/rooms/room99/submit")).toEqual({ type: "submit", roomCode: "ROOM99" });
    expect(parseRoomRoute("/api/rooms/room99/draft")).toEqual({ type: "draft", roomCode: "ROOM99" });
    expect(parseRoomRoute("/api/rooms/room99/end")).toEqual({ type: "end", roomCode: "ROOM99" });
    expect(parseRoomRoute("/api/rooms/room99/score")).toEqual({ type: "score", roomCode: "ROOM99" });
    expect(parseRoomRoute("/api/rooms/room99/publish")).toEqual({ type: "publish", roomCode: "ROOM99" });
    expect(parseRoomRoute("/api/rooms/room99/discard")).toEqual({ type: "discard", roomCode: "ROOM99" });
    expect(parseRoomRoute("/api/rooms/room99/cancel")).toEqual({ type: "cancel", roomCode: "ROOM99" });
    expect(parseRoomRoute("/api/rooms/room99/finish")).toEqual({ type: "finish", roomCode: "ROOM99" });
  });

  it("rejects unsupported routes", () => {
    expect(parseRoomRoute("/api/rooms")).toBeNull();
    expect(parseRoomRoute("/api/rooms/invalid-###/join")).toBeNull();
    expect(parseRoomRoute("/api/rooms/room99/unknown")).toBeNull();
  });
});
