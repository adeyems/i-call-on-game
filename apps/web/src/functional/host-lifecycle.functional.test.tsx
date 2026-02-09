import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
      roomCode: "ROOM01",
      hostName: "Qudus",
      maxParticipants: 8
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
        endRule: "WHICHEVER_FIRST"
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

describe("functional: host lifecycle", () => {
  it("covers steps 1, 2, 4, and 5 with real-time lobby updates", async () => {
    const restoreSocket = installMockWebSocket();

    try {
      window.history.pushState({}, "", "/");

      const fetchMock = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              roomCode: "ROOM01",
              hostName: "Qudus",
              maxParticipants: 8,
              wsPath: "/ws/ROOM01",
              hostToken: "host-token-1"
            }),
            {
              status: 201,
              headers: {
                "Content-Type": "application/json"
              }
            }
          )
        )
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
                    id: "req-1",
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
                    id: "req-1",
                    name: "Ada",
                    status: "ADMITTED",
                    isHost: false
                  }
                ],
                counts: {
                  admitted: 2,
                  pending: 0,
                  rejected: 0
                },
                game: {
                  status: "IN_PROGRESS",
                  startedAt: "2026-02-08T00:10:00.000Z",
                  turnOrder: ["host", "req-1"],
                  currentTurnParticipantId: "host"
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
                    id: "req-1",
                    name: "Ada",
                    status: "ADMITTED",
                    isHost: false
                  }
                ],
                counts: {
                  admitted: 2,
                  pending: 0,
                  rejected: 0
                },
                game: {
                  status: "IN_PROGRESS",
                  startedAt: "2026-02-08T00:10:00.000Z",
                  turnOrder: ["host", "req-1"],
                  currentTurnParticipantId: "host"
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

      const user = userEvent.setup();
      await user.type(screen.getByLabelText(/Host name/i), "Qudus");
      fireEvent.change(screen.getByLabelText(/Max participants/i), {
        target: { value: "8" }
      });

      await user.click(screen.getByRole("button", { name: /Create room/i }));

      await waitFor(() => {
        expect(screen.getByText(/Room created/i)).toBeInTheDocument();
      });

      expect(screen.getByText("ROOM01", { selector: "strong" })).toBeInTheDocument();
      expect(screen.getByText((content) => content.includes("/join/ROOM01"))).toBeInTheDocument();

      expect(MockWebSocket.instances).toHaveLength(1);
      const socket = MockWebSocket.instances[0];
      expect(socket.url).toContain("/ws/ROOM01");

      act(() => {
        socket.emit({
          type: "join_request",
          participant: {
            id: "req-1",
            name: "Ada",
            status: "PENDING",
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
                id: "req-1",
                name: "Ada",
                status: "PENDING",
                isHost: false
              }
            ],
            counts: {
              admitted: 1,
              pending: 1,
              rejected: 0
            }
          })
        });
      });

      await waitFor(() => {
        expect(screen.getByText("Ada")).toBeInTheDocument();
      });
      expect(screen.getByText(/Pending requests:/i)).toHaveTextContent("1");
      expect(playNotificationSound).toHaveBeenCalledTimes(1);

      await user.click(screen.getByRole("button", { name: "Approve" }));

      await waitFor(() => {
        expect(screen.getByText(/Pending requests:/i)).toHaveTextContent("0");
      });

      await user.click(screen.getByRole("button", { name: /Start game/i }));

      await waitFor(() => {
        expect(screen.getByRole("heading", { name: /Game Board/i })).toBeInTheDocument();
      });

      expect(window.location.pathname).toBe("/game/ROOM01");

      expect(fetchMock).toHaveBeenCalledTimes(5);
      expect(String(fetchMock.mock.calls[0][0])).toContain("/api/rooms");
      expect(String(fetchMock.mock.calls[1][0])).toContain("/api/rooms/ROOM01");
      expect(String(fetchMock.mock.calls[2][0])).toContain("/api/rooms/ROOM01/admissions");
      expect(String(fetchMock.mock.calls[3][0])).toContain("/api/rooms/ROOM01/start");
      expect(String(fetchMock.mock.calls[4][0])).toContain("/api/rooms/ROOM01");

      const createPayload = JSON.parse(String(fetchMock.mock.calls[0][1]?.body)) as {
        hostName: string;
        maxParticipants: number;
      };
      expect(createPayload).toEqual({ hostName: "Qudus", maxParticipants: 8 });

      const approvePayload = JSON.parse(String(fetchMock.mock.calls[2][1]?.body)) as {
        hostToken: string;
        requestId: string;
        approve: boolean;
      };
      expect(approvePayload).toEqual({
        hostToken: "host-token-1",
        requestId: "req-1",
        approve: true
      });

      const startPayload = JSON.parse(String(fetchMock.mock.calls[3][1]?.body)) as {
        hostToken: string;
        config: { roundSeconds: number; endRule: string };
      };
      expect(startPayload).toEqual({
        hostToken: "host-token-1",
        config: {
          roundSeconds: 20,
          endRule: "WHICHEVER_FIRST"
        }
      });

      expect(playTurnStartSound).not.toHaveBeenCalled();
      expect(playSubmissionSound).not.toHaveBeenCalled();
      expect(playRoundEndSound).not.toHaveBeenCalled();
    } finally {
      restoreSocket();
    }
  });

  it("allows host to cancel room and expire the join link", async () => {
    const restoreSocket = installMockWebSocket();

    try {
      window.history.pushState({}, "", "/");

      const fetchMock = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              roomCode: "ROOM01",
              hostName: "Qudus",
              maxParticipants: 8,
              wsPath: "/ws/ROOM01",
              hostToken: "host-token-1"
            }),
            {
              status: 201,
              headers: {
                "Content-Type": "application/json"
              }
            }
          )
        )
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

      const user = userEvent.setup();
      await user.type(screen.getByLabelText(/Host name/i), "Qudus");
      await user.click(screen.getByRole("button", { name: /Create room/i }));

      await waitFor(() => {
        expect(screen.getByText(/Room created/i)).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: /Expire link/i }));

      await waitFor(() => {
        expect(screen.getByText(/Game cancelled. Join link has expired/i)).toBeInTheDocument();
      });

      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(String(fetchMock.mock.calls[2][0])).toContain("/api/rooms/ROOM01/cancel");

      const cancelPayload = JSON.parse(String(fetchMock.mock.calls[2][1]?.body)) as { hostToken: string };
      expect(cancelPayload).toEqual({ hostToken: "host-token-1" });
    } finally {
      restoreSocket();
    }
  });
});
