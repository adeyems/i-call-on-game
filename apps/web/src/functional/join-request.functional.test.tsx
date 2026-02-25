import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import { MockWebSocket, installMockWebSocket } from "../test/mockSocket";
import { playNotificationSound, playRoundEndSound, playSubmissionSound, playTurnStartSound } from "../sound";

vi.mock("../sound", () => ({
  playNotificationSound: vi.fn(),
  playTurnStartSound: vi.fn(),
  playSubmissionSound: vi.fn(),
  playRoundEndSound: vi.fn(),
  startRoundTimerSong: vi.fn(),
  stopRoundTimerSong: vi.fn()
}));

function makeState(overrides?: {
  participants?: Array<{ id: string; name: string; status: "PENDING" | "ADMITTED" | "REJECTED"; isHost: boolean }>;
  counts?: { admitted: number; pending: number; rejected: number };
  game?: {
    status?: "LOBBY" | "IN_PROGRESS" | "CANCELLED";
    startedAt?: string | null;
    cancelledAt?: string | null;
    turnOrder?: string[];
    currentTurnParticipantId?: string | null;
  };
}) {
  return {
    meta: {
      roomCode: "ROOM99",
      hostName: "Qudus",
      maxParticipants: 10
    },
    participants:
      overrides?.participants ?? [
        {
          id: "host",
          name: "Qudus",
          status: "ADMITTED",
          isHost: true
        }
      ],
    counts:
      overrides?.counts ?? {
        admitted: 1,
        pending: 0,
        rejected: 0
      },
    game: {
      status: overrides?.game?.status ?? "LOBBY",
      startedAt: overrides?.game?.startedAt ?? null,
      cancelledAt: overrides?.game?.cancelledAt ?? null,
      config: {
        roundSeconds: 20,
        endRule: "WHICHEVER_FIRST",
        manualEndPolicy: "HOST_OR_CALLER",
        scoringMode: "FIXED_10"
      },
      turnOrder: overrides?.game?.turnOrder ?? [],
      currentTurnIndex: 0,
      currentTurnParticipantId: overrides?.game?.currentTurnParticipantId ?? null,
      activeRound: null,
      completedRounds: []
    }
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  window.history.pushState({}, "", "/");
  window.localStorage.clear();
});

describe("functional: participant join request", () => {
  it("covers step 3 and real-time approval handoff to game board", async () => {
    const restoreSocket = installMockWebSocket();

    try {
      window.history.pushState({}, "", "/join/room99");

      const fetchMock = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(
          new Response(JSON.stringify(makeState()), {
            status: 200,
            headers: {
              "Content-Type": "application/json"
            }
          })
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              requestId: "join-1",
              status: "PENDING",
              participant: {
                id: "join-1",
                name: "Ada",
                status: "PENDING",
                isHost: false
              }
            }),
            {
              status: 202,
              headers: {
                "Content-Type": "application/json"
              }
            }
          )
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify(
              makeState({
                participants: [
                  {
                    id: "host",
                    name: "Qudus",
                    status: "ADMITTED",
                    isHost: true
                  },
                  {
                    id: "join-1",
                    name: "Ada",
                    status: "ADMITTED",
                    isHost: false
                  }
                ],
                counts: {
                  admitted: 2,
                  pending: 0,
                  rejected: 0
                }
              })
            ),
            {
              status: 200,
              headers: {
                "Content-Type": "application/json"
              }
            }
          )
        );

      render(<App />);

      await waitFor(() => {
        expect(screen.getByRole("heading", { name: /Join Room/i })).toBeInTheDocument();
      });

      expect(MockWebSocket.instances).toHaveLength(1);
      const socket = MockWebSocket.instances[0];
      expect(socket.url).toContain("/ws/ROOM99");

      const user = userEvent.setup();
      await user.type(screen.getByLabelText(/Your name/i), "Ada");
      await user.click(screen.getByRole("button", { name: /Request to join/i }));

      await waitFor(() => {
        expect(screen.getByText(/Join request submitted/i)).toBeInTheDocument();
      });

      act(() => {
        socket.emit({
          type: "admission_update",
          participant: {
            id: "join-1",
            name: "Ada",
            status: "ADMITTED",
            isHost: false
          },
          snapshot: makeState({
            participants: [
              {
                id: "host",
                name: "Qudus",
                status: "ADMITTED",
                isHost: true
              },
              {
                id: "join-1",
                name: "Ada",
                status: "ADMITTED",
                isHost: false
              }
            ],
            counts: {
              admitted: 2,
              pending: 0,
              rejected: 0
            }
          })
        });
      });

      await waitFor(() => {
        expect(screen.getByRole("heading", { name: /Game Board/i })).toBeInTheDocument();
      });

      expect(screen.getByLabelText(/lobby-waiting-state/i)).toBeInTheDocument();
      expect(screen.getByText(/has not started the game yet/i)).toBeInTheDocument();
      expect(window.location.pathname).toBe("/game/ROOM99");
      expect(playNotificationSound).toHaveBeenCalledTimes(1);
      expect(playTurnStartSound).not.toHaveBeenCalled();
      expect(playSubmissionSound).not.toHaveBeenCalled();
      expect(playRoundEndSound).not.toHaveBeenCalled();

      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(String(fetchMock.mock.calls[0][0])).toContain("/api/rooms/ROOM99");
      expect(String(fetchMock.mock.calls[1][0])).toContain("/api/rooms/ROOM99/join");
      expect(String(fetchMock.mock.calls[2][0])).toContain("/api/rooms/ROOM99");

      const joinPayload = JSON.parse(String(fetchMock.mock.calls[1][1]?.body)) as { name: string };
      expect(joinPayload).toEqual({ name: "Ada" });

      const stored = window.localStorage.getItem("i-call-on:session:ROOM99");
      expect(stored).toContain("join-1");
    } finally {
      restoreSocket();
    }
  });

  it("shows expired-link state when host cancelled the room", async () => {
    const restoreSocket = installMockWebSocket();

    try {
      window.history.pushState({}, "", "/join/room99");

      const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify(
            makeState({
              game: {
                status: "CANCELLED",
                startedAt: null,
                cancelledAt: "2026-02-08T00:00:10.000Z",
                turnOrder: [],
                currentTurnParticipantId: null
              }
            })
          ),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json"
            }
          }
        )
      );

      render(<App />);

      await waitFor(() => {
        expect(screen.getByRole("heading", { name: /Join Room/i })).toBeInTheDocument();
      });

      expect(screen.getByText(/Join link has expired/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Request to join/i })).toBeDisabled();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      restoreSocket();
    }
  });
});
