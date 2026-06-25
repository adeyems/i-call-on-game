import { afterEach, describe, expect, it, vi } from "vitest";
import { GameRoom, initializeRoomState, setLookingForPlayers, type StoredRoomState } from "../room";

/**
 * Builds a GameRoom backed by an in-memory mock of DurableObjectState so we can
 * drive alarm() directly and assert the Card Game Lobby heartbeat behaviour.
 */
function makeRoom(roomState: StoredRoomState, connections: number, secret = "test-secret") {
  const store = new Map<string, unknown>([["room", roomState]]);
  const setAlarm = vi.fn(async (_t: number) => {});
  const deleteAlarm = vi.fn(async () => {});
  const getAlarm = vi.fn(async () => null as number | null);
  const sockets = Array.from({ length: connections }, (_, i) => ({ id: i }));

  const state = {
    storage: {
      get: async (key: string) => store.get(key) ?? null,
      put: async (key: string, value: unknown) => void store.set(key, value),
      getAlarm,
      setAlarm,
      deleteAlarm
    },
    getWebSockets: () => sockets
  };

  const room = new GameRoom(state as unknown as DurableObjectState, { BROADCAST_SECRET: secret });
  return { room, setAlarm, store };
}

function lookingLobby(roomCode = "HB0001"): StoredRoomState {
  const base = initializeRoomState(
    { roomCode, hostName: "Host", maxParticipants: 6, hostToken: "t" },
    "2026-02-08T00:00:00.000Z"
  );
  const enabled = setLookingForPlayers(base, "t", true);
  if (!enabled.ok) throw new Error("setup failed");
  return enabled.nextState;
}

describe("unit: Card Game Lobby heartbeat (DO alarm)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("pings /v1/lobbies and reschedules while looking with a live connection", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const { room, setAlarm } = makeRoom(lookingLobby(), 1);
    await room.alarm();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(String(url)).toBe("https://api.cardgamelobby.com/v1/lobbies");
    expect(JSON.parse(String(init.body))).toMatchObject({
      game: "icallon",
      roomCode: "HB0001",
      hostName: "Host",
      playerCount: 1
    });
    // Re-armed for the next ~60s heartbeat.
    expect(setAlarm).toHaveBeenCalledTimes(1);
  });

  it("lapses (no ping, no reschedule) when the room is abandoned — zero connections", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const { room, setAlarm } = makeRoom(lookingLobby(), 0);
    await room.alarm();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(setAlarm).not.toHaveBeenCalled();
  });

  it("does not heartbeat when the room is not looking", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const base = initializeRoomState(
      { roomCode: "HB0002", hostName: "Host", maxParticipants: 6, hostToken: "t" },
      "2026-02-08T00:00:00.000Z"
    );
    const { room, setAlarm } = makeRoom(base, 1);
    await room.alarm();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(setAlarm).not.toHaveBeenCalled();
  });

  it("is a silent no-op when BROADCAST_SECRET is unset but still reschedules", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const { room, setAlarm } = makeRoom(lookingLobby("HB0003"), 1, "");
    await room.alarm();

    // No secret → no platform call, but the heartbeat keeps itself alive.
    expect(fetchMock).not.toHaveBeenCalled();
    expect(setAlarm).toHaveBeenCalledTimes(1);
  });
});
