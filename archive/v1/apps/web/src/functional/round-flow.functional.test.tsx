import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import { MockWebSocket, installMockWebSocket } from "../test/mockSocket";
import {
  playNotificationSound,
  playRoundEndSound,
  playSubmissionSound,
  playTurnStartSound,
  startRoundTimerSong,
  stopRoundTimerSong
} from "../sound";

vi.mock("../sound", () => ({
  playNotificationSound: vi.fn(),
  playTurnStartSound: vi.fn(),
  playSubmissionSound: vi.fn(),
  playRoundEndSound: vi.fn(),
  startRoundTimerSong: vi.fn(),
  stopRoundTimerSong: vi.fn()
}));

type CompletedRound = {
  roundNumber: number;
  turnParticipantId: string;
  turnParticipantName: string;
  calledNumber: number;
  activeLetter: string;
  startedAt: string;
  countdownEndsAt: string;
  endsAt: string | null;
  endedAt: string;
  endReason: "TIMER" | "FIRST_SUBMISSION" | "MANUAL_END";
  scorePublishedAt: string | null;
  submissionsCount: number;
  submissions: Array<{
    participantId: string;
    participantName: string;
    submittedAt: string;
    answers: {
      name: string;
      animal: string;
      thing: string;
      food: string;
      place: string;
    };
    review: {
      marks: {
        name: boolean;
        animal: boolean;
        thing: boolean;
        food: boolean;
        place: boolean;
      };
      scores: {
        name: number;
        animal: number;
        thing: number;
        food: number;
        place: number;
        total: number;
      };
      markedByParticipantId: string;
      markedByParticipantName: string;
      markedAt: string;
    } | null;
  }>;
};

type StateOverrides = {
  currentTurnParticipantId?: string | null;
  activeRound?: {
    roundNumber: number;
    turnParticipantId: string;
    turnParticipantName: string;
    calledNumber: number;
    activeLetter: string;
    startedAt: string;
    countdownEndsAt: string;
    endsAt: string | null;
    submissions: Array<{ participantId: string; participantName: string; submittedAt: string }>;
  } | null;
  completedRounds?: CompletedRound[];
  scoring?: {
    roundsPerPlayer: number;
    maxRounds: number;
    roundsPlayed: number;
    publishedRounds: number;
    pendingPublicationRounds: number[];
    usedNumbers: number[];
    availableNumbers: number[];
    isComplete: boolean;
    leaderboard: Array<{
      participantId: string;
      participantName: string;
      totalScore: number;
      reviewedRounds: number;
      history: Array<{
        roundNumber: number;
        calledNumber: number;
        activeLetter: string;
        score: number;
        cumulativeScore: number;
        reviewed: boolean;
      }>;
    }>;
  };
};

function baseLeaderboard() {
  return [
    {
      participantId: "host",
      participantName: "Host",
      totalScore: 0,
      reviewedRounds: 0,
      history: []
    },
    {
      participantId: "p-ada",
      participantName: "Ada",
      totalScore: 0,
      reviewedRounds: 0,
      history: []
    }
  ];
}

function defaultScoring(overrides?: Partial<StateOverrides["scoring"]>) {
  return {
    roundsPerPlayer: 13,
    maxRounds: 26,
    roundsPlayed: 0,
    publishedRounds: 0,
    pendingPublicationRounds: [],
    usedNumbers: [],
    availableNumbers: Array.from({ length: 26 }, (_, index) => index + 1),
    isComplete: false,
    leaderboard: baseLeaderboard(),
    ...overrides
  };
}

function makeInProgressState(overrides?: StateOverrides) {
  return {
    meta: {
      roomCode: "ROOM55",
      hostName: "Host",
      maxParticipants: 4
    },
    participants: [
      {
        id: "host",
        name: "Host",
        status: "ADMITTED",
        isHost: true
      },
      {
        id: "p-ada",
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
      startedAt: "2026-02-08T00:00:10.000Z",
      config: {
        roundSeconds: 12,
        endRule: "TIMER",
        manualEndPolicy: "HOST_OR_CALLER",
        scoringMode: "FIXED_10"
      },
      turnOrder: ["host", "p-ada"],
      currentTurnIndex: 0,
      currentTurnParticipantId: overrides?.currentTurnParticipantId ?? "host",
      activeRound: overrides?.activeRound ?? null,
      completedRounds: overrides?.completedRounds ?? [],
      scoring: overrides?.scoring ?? defaultScoring()
    }
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  window.history.pushState({}, "", "/");
  window.localStorage.clear();
});

describe("functional: phase 2 round flow", () => {
  it("shows A-Z board, countdown lock, and scoring queue page", async () => {
    const restoreSocket = installMockWebSocket();

    try {
      const now = Date.now();
      const countdownFuture = new Date(now + 3000).toISOString();
      const countdownPast = new Date(now - 1000).toISOString();
      const timerEnds = new Date(now + 12000).toISOString();

      window.history.pushState({}, "", "/game/ROOM55");
      window.localStorage.setItem(
        "i-call-on:session:ROOM55",
        JSON.stringify({ participantId: "host", participantName: "Host", isHost: true, hostToken: "host-token" })
      );

      const callStateLocked = makeInProgressState({
        activeRound: {
          roundNumber: 1,
          turnParticipantId: "host",
          turnParticipantName: "Host",
          calledNumber: 2,
          activeLetter: "B",
          startedAt: new Date(now).toISOString(),
          countdownEndsAt: countdownFuture,
          endsAt: timerEnds,
          submissions: []
        },
        scoring: defaultScoring({
          usedNumbers: [2],
          availableNumbers: Array.from({ length: 26 }, (_, index) => index + 1).filter((number) => number !== 2)
        })
      });

      const submitState = makeInProgressState({
        activeRound: {
          roundNumber: 1,
          turnParticipantId: "host",
          turnParticipantName: "Host",
          calledNumber: 2,
          activeLetter: "B",
          startedAt: new Date(now).toISOString(),
          countdownEndsAt: countdownPast,
          endsAt: timerEnds,
          submissions: [
            {
              participantId: "host",
              participantName: "Host",
              submittedAt: new Date(now + 4000).toISOString()
            }
          ]
        },
        scoring: defaultScoring({
          usedNumbers: [2],
          availableNumbers: Array.from({ length: 26 }, (_, index) => index + 1).filter((number) => number !== 2)
        })
      });

      const roundEndedSnapshot = makeInProgressState({
        currentTurnParticipantId: "p-ada",
        activeRound: null,
        completedRounds: [
          {
            roundNumber: 1,
            turnParticipantId: "host",
            turnParticipantName: "Host",
            calledNumber: 2,
            activeLetter: "B",
            startedAt: new Date(now).toISOString(),
            countdownEndsAt: countdownPast,
            endsAt: timerEnds,
            endedAt: new Date(now + 12000).toISOString(),
            endReason: "TIMER",
            scorePublishedAt: null,
            submissionsCount: 2,
            submissions: [
              {
                participantId: "host",
                participantName: "Host",
                submittedAt: new Date(now + 4000).toISOString(),
                answers: {
                  name: "Bola",
                  animal: "Bear",
                  thing: "Bottle",
                  food: "Bread",
                  place: "Berlin"
                },
                review: null
              },
              {
                participantId: "p-ada",
                participantName: "Ada",
                submittedAt: new Date(now + 12000).toISOString(),
                answers: {
                  name: "",
                  animal: "",
                  thing: "",
                  food: "",
                  place: ""
                },
                review: null
              }
            ]
          }
        ],
        scoring: defaultScoring({
          roundsPlayed: 1,
          usedNumbers: [2],
          pendingPublicationRounds: [1],
          availableNumbers: Array.from({ length: 26 }, (_, index) => index + 1).filter((number) => number !== 2)
        })
      });

      const openSnapshot = makeInProgressState({
        activeRound: {
          roundNumber: 1,
          turnParticipantId: "host",
          turnParticipantName: "Host",
          calledNumber: 2,
          activeLetter: "B",
          startedAt: new Date(now).toISOString(),
          countdownEndsAt: countdownPast,
          endsAt: timerEnds,
          submissions: []
        },
        scoring: defaultScoring({
          usedNumbers: [2],
          availableNumbers: Array.from({ length: 26 }, (_, index) => index + 1).filter((number) => number !== 2)
        })
      });

      const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
        const url = String(input);
        const method = init?.method ?? "GET";

        if (url.endsWith("/api/rooms/ROOM55") && method === "GET") {
          return new Response(JSON.stringify(makeInProgressState()), {
            status: 200,
            headers: {
              "Content-Type": "application/json"
            }
          });
        }

        if (url.endsWith("/api/rooms/ROOM55/call") && method === "POST") {
          return new Response(JSON.stringify(callStateLocked), {
            status: 200,
            headers: {
              "Content-Type": "application/json"
            }
          });
        }

        if (url.endsWith("/api/rooms/ROOM55/draft") && method === "POST") {
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: {
              "Content-Type": "application/json"
            }
          });
        }

        if (url.endsWith("/api/rooms/ROOM55/submit") && method === "POST") {
          return new Response(JSON.stringify(submitState), {
            status: 200,
            headers: {
              "Content-Type": "application/json"
            }
          });
        }

        return new Response(JSON.stringify({ error: "room not found" }), {
          status: 404,
          headers: {
            "Content-Type": "application/json"
          }
        });
      });

      render(<App />);

      await waitFor(() => {
        expect(screen.getByRole("heading", { name: /Game Board/i })).toBeInTheDocument();
      });

      const user = userEvent.setup();

      await user.click(screen.getByRole("button", { name: "letter-B" }));

      await waitFor(() => {
        expect(screen.getByRole("dialog", { name: /letter-countdown-modal/i })).toBeInTheDocument();
      });

      expect(screen.getByLabelText(/^Name$/i)).toBeDisabled();

      act(() => {
        MockWebSocket.instances[0].emit({
          type: "turn_called",
          snapshot: openSnapshot
        });
      });

      await waitFor(() => {
        expect(screen.getByLabelText(/^Name$/i)).not.toBeDisabled();
      });

      await user.type(screen.getByLabelText(/^Name$/i), "Bola");
      await user.type(screen.getByLabelText(/^Animal$/i), "Bear");
      await user.type(screen.getByLabelText(/^Thing$/i), "Bottle");
      await user.type(screen.getByLabelText(/^Food$/i), "Bread");
      await user.type(screen.getByLabelText(/^Place$/i), "Berlin");

      await user.click(screen.getByRole("button", { name: /Submit answers/i }));

      await waitFor(() => {
        expect(screen.getByText(/Your submission has been recorded/i)).toBeInTheDocument();
      });

      expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(3);
      expect(fetchMock.mock.calls.some((call) => String(call[0]).includes("/api/rooms/ROOM55"))).toBe(true);
      expect(fetchMock.mock.calls.some((call) => String(call[0]).includes("/api/rooms/ROOM55/call"))).toBe(true);
      expect(fetchMock.mock.calls.some((call) => String(call[0]).includes("/api/rooms/ROOM55/submit"))).toBe(true);

      act(() => {
        MockWebSocket.instances[0].emit({
          type: "round_ended",
          reason: "TIMER",
          snapshot: roundEndedSnapshot,
          completedRound: roundEndedSnapshot.game.completedRounds[0]
        });
      });

      await waitFor(() => {
        expect(screen.getByLabelText(/submission-page/i)).toBeInTheDocument();
      });

      expect(screen.getByText("Bola")).toBeInTheDocument();
      expect(screen.getByLabelText(/score-sidebar/i)).toBeInTheDocument();
      expect(playTurnStartSound).toHaveBeenCalledTimes(1);
      expect(playRoundEndSound).toHaveBeenCalledTimes(1);
      expect(playNotificationSound).not.toHaveBeenCalled();
      expect(playSubmissionSound).not.toHaveBeenCalled();
      expect(startRoundTimerSong).toHaveBeenCalled();
      expect(stopRoundTimerSong).toHaveBeenCalled();
    } finally {
      restoreSocket();
    }
  });

  it("recovers from submit response failure when server already recorded the submission", async () => {
    const restoreSocket = installMockWebSocket();

    try {
      const now = Date.now();
      const roundOpenState = makeInProgressState({
        activeRound: {
          roundNumber: 1,
          turnParticipantId: "host",
          turnParticipantName: "Host",
          calledNumber: 2,
          activeLetter: "B",
          startedAt: new Date(now).toISOString(),
          countdownEndsAt: new Date(now - 1000).toISOString(),
          endsAt: new Date(now + 12000).toISOString(),
          submissions: []
        }
      });

      const recoveredState = makeInProgressState({
        activeRound: {
          roundNumber: 1,
          turnParticipantId: "host",
          turnParticipantName: "Host",
          calledNumber: 2,
          activeLetter: "B",
          startedAt: new Date(now).toISOString(),
          countdownEndsAt: new Date(now - 1000).toISOString(),
          endsAt: new Date(now + 12000).toISOString(),
          submissions: [
            {
              participantId: "host",
              participantName: "Host",
              submittedAt: new Date(now + 4000).toISOString()
            }
          ]
        }
      });

      window.history.pushState({}, "", "/game/ROOM55");
      window.localStorage.setItem(
        "i-call-on:session:ROOM55",
        JSON.stringify({ participantId: "host", participantName: "Host", isHost: true, hostToken: "host-token" })
      );

      let stateReads = 0;
      const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
        const url = String(input);
        const method = init?.method ?? "GET";

        if (url.endsWith("/api/rooms/ROOM55") && method === "GET") {
          stateReads += 1;
          const payload = stateReads === 1 ? roundOpenState : recoveredState;
          return new Response(JSON.stringify(payload), {
            status: 200,
            headers: {
              "Content-Type": "application/json"
            }
          });
        }

        if (url.endsWith("/api/rooms/ROOM55/submit") && method === "POST") {
          return new Response(JSON.stringify({ error: "participant has already submitted" }), {
            status: 409,
            headers: {
              "Content-Type": "application/json"
            }
          });
        }

        if (url.endsWith("/api/rooms/ROOM55/draft") && method === "POST") {
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: {
              "Content-Type": "application/json"
            }
          });
        }

        return new Response(JSON.stringify({ error: "unexpected request" }), {
          status: 500,
          headers: {
            "Content-Type": "application/json"
          }
        });
      });

      render(<App />);

      await waitFor(() => {
        expect(screen.getByLabelText(/^Name$/i)).not.toBeDisabled();
      });

      const user = userEvent.setup();
      await user.type(screen.getByLabelText(/^Name$/i), "Bola");
      await user.click(screen.getByRole("button", { name: /Submit answers/i }));

      await waitFor(() => {
        expect(screen.getByText(/Your submission has been recorded/i)).toBeInTheDocument();
      });

      expect(screen.queryByText(/Unable to submit round answers/i)).not.toBeInTheDocument();
      expect(fetchMock.mock.calls.some((call) => String(call[0]).includes("/api/rooms/ROOM55/submit"))).toBe(true);
      expect(window.localStorage.getItem("i-call-on:draft:ROOM55:host:1")).toBeNull();
    } finally {
      restoreSocket();
    }
  });

  it("lets host mark then publish a round to the left leaderboard", async () => {
    const restoreSocket = installMockWebSocket();

    try {
      const now = Date.now();
      const finishedRound = makeInProgressState({
        activeRound: null,
        currentTurnParticipantId: "p-ada",
        completedRounds: [
          {
            roundNumber: 1,
            turnParticipantId: "host",
            turnParticipantName: "Host",
            calledNumber: 1,
            activeLetter: "A",
            startedAt: new Date(now).toISOString(),
            countdownEndsAt: new Date(now + 3000).toISOString(),
            endsAt: new Date(now + 15000).toISOString(),
            endedAt: new Date(now + 15000).toISOString(),
            endReason: "TIMER",
            scorePublishedAt: null,
            submissionsCount: 2,
            submissions: [
              {
                participantId: "host",
                participantName: "Host",
                submittedAt: new Date(now + 8000).toISOString(),
                answers: {
                  name: "Ayo",
                  animal: "Ant",
                  thing: "Arrow",
                  food: "Apple",
                  place: "Accra"
                },
                review: null
              },
              {
                participantId: "p-ada",
                participantName: "Ada",
                submittedAt: new Date(now + 9000).toISOString(),
                answers: {
                  name: "Ada",
                  animal: "Ape",
                  thing: "Anvil",
                  food: "Apricot",
                  place: "Athens"
                },
                review: null
              }
            ]
          }
        ],
        scoring: defaultScoring({
          roundsPlayed: 1,
          usedNumbers: [1],
          pendingPublicationRounds: [1],
          availableNumbers: Array.from({ length: 26 }, (_, index) => index + 1).filter((number) => number !== 1)
        })
      });

      const afterScore = makeInProgressState({
        activeRound: null,
        currentTurnParticipantId: "p-ada",
        completedRounds: [
          {
            roundNumber: 1,
            turnParticipantId: "host",
            turnParticipantName: "Host",
            calledNumber: 1,
            activeLetter: "A",
            startedAt: new Date(now).toISOString(),
            countdownEndsAt: new Date(now + 3000).toISOString(),
            endsAt: new Date(now + 15000).toISOString(),
            endedAt: new Date(now + 15000).toISOString(),
            endReason: "TIMER",
            scorePublishedAt: null,
            submissionsCount: 2,
            submissions: [
              {
                participantId: "host",
                participantName: "Host",
                submittedAt: new Date(now + 8000).toISOString(),
                answers: {
                  name: "Ayo",
                  animal: "Ant",
                  thing: "Arrow",
                  food: "Apple",
                  place: "Accra"
                },
                review: {
                  marks: {
                    name: true,
                    animal: true,
                    thing: true,
                    food: true,
                    place: true
                  },
                  scores: {
                    name: 10,
                    animal: 10,
                    thing: 10,
                    food: 10,
                    place: 10,
                    total: 50
                  },
                  markedByParticipantId: "host",
                  markedByParticipantName: "Host",
                  markedAt: new Date(now + 20000).toISOString()
                }
              },
              {
                participantId: "p-ada",
                participantName: "Ada",
                submittedAt: new Date(now + 9000).toISOString(),
                answers: {
                  name: "Ada",
                  animal: "Ape",
                  thing: "Anvil",
                  food: "Apricot",
                  place: "Athens"
                },
                review: {
                  marks: {
                    name: true,
                    animal: false,
                    thing: true,
                    food: false,
                    place: true
                  },
                  scores: {
                    name: 10,
                    animal: 0,
                    thing: 10,
                    food: 0,
                    place: 10,
                    total: 30
                  },
                  markedByParticipantId: "host",
                  markedByParticipantName: "Host",
                  markedAt: new Date(now + 20000).toISOString()
                }
              }
            ]
          }
        ],
        scoring: defaultScoring({
          roundsPlayed: 1,
          usedNumbers: [1],
          pendingPublicationRounds: [1],
          availableNumbers: Array.from({ length: 26 }, (_, index) => index + 1).filter((number) => number !== 1)
        })
      });

      const afterPublish = makeInProgressState({
        activeRound: null,
        currentTurnParticipantId: "p-ada",
        completedRounds: [
          {
            roundNumber: 1,
            turnParticipantId: "host",
            turnParticipantName: "Host",
            calledNumber: 1,
            activeLetter: "A",
            startedAt: new Date(now).toISOString(),
            countdownEndsAt: new Date(now + 3000).toISOString(),
            endsAt: new Date(now + 15000).toISOString(),
            endedAt: new Date(now + 15000).toISOString(),
            endReason: "TIMER",
            scorePublishedAt: new Date(now + 23000).toISOString(),
            submissionsCount: 2,
            submissions: afterScore.game.completedRounds[0].submissions
          }
        ],
        scoring: {
          roundsPerPlayer: 13,
          maxRounds: 26,
          roundsPlayed: 1,
          publishedRounds: 1,
          pendingPublicationRounds: [],
          usedNumbers: [1],
          availableNumbers: Array.from({ length: 26 }, (_, index) => index + 1).filter((number) => number !== 1),
          isComplete: false,
          leaderboard: [
            {
              participantId: "host",
              participantName: "Host",
              totalScore: 50,
              reviewedRounds: 1,
              history: [
                {
                  roundNumber: 1,
                  calledNumber: 1,
                  activeLetter: "A",
                  score: 50,
                  cumulativeScore: 50,
                  reviewed: true
                }
              ]
            },
            {
              participantId: "p-ada",
              participantName: "Ada",
              totalScore: 30,
              reviewedRounds: 1,
              history: [
                {
                  roundNumber: 1,
                  calledNumber: 1,
                  activeLetter: "A",
                  score: 30,
                  cumulativeScore: 30,
                  reviewed: true
                }
              ]
            }
          ]
        }
      });

      window.history.pushState({}, "", "/game/ROOM55");
      window.localStorage.setItem(
        "i-call-on:session:ROOM55",
        JSON.stringify({ participantId: "host", participantName: "Host", isHost: true, hostToken: "host-token" })
      );

      const fetchMock = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(
          new Response(JSON.stringify(finishedRound), {
            status: 200,
            headers: {
              "Content-Type": "application/json"
            }
          })
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify(afterScore), {
            status: 200,
            headers: {
              "Content-Type": "application/json"
            }
          })
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify(afterPublish), {
            status: 200,
            headers: {
              "Content-Type": "application/json"
            }
          })
        );

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/Round Scoring Queue/i)).toBeInTheDocument();
      });

      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: "mark-name-correct-host-round-1" }));

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledTimes(2);
      });

      expect(String(fetchMock.mock.calls[1][0])).toContain("/api/rooms/ROOM55/score");

      await user.click(screen.getByRole("button", { name: "publish-round-1" }));

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledTimes(3);
      });

      expect(String(fetchMock.mock.calls[2][0])).toContain("/api/rooms/ROOM55/publish");
      const publishPayload = JSON.parse(String(fetchMock.mock.calls[2][1]?.body)) as {
        hostToken: string;
        roundNumber: number;
      };
      expect(publishPayload).toEqual({
        hostToken: "host-token",
        roundNumber: 1
      });

      expect(screen.getByText(/R1 A:50/)).toBeInTheDocument();
      expect(screen.getByText(/No pending round scoring pages/i)).toBeInTheDocument();
    } finally {
      restoreSocket();
    }
  });

  it("lets host create another game after the room is finished", async () => {
    const restoreSocket = installMockWebSocket();

    try {
      const finishedSnapshot = makeInProgressState({
        currentTurnParticipantId: null,
        activeRound: null,
        completedRounds: [],
        scoring: defaultScoring({
          roundsPerPlayer: 13,
          maxRounds: 26,
          roundsPlayed: 0,
          publishedRounds: 0,
          pendingPublicationRounds: [],
          usedNumbers: [],
          availableNumbers: Array.from({ length: 26 }, (_, index) => index + 1),
          isComplete: false
        })
      });

      const finishedState = {
        ...finishedSnapshot,
        game: {
          ...finishedSnapshot.game,
          status: "FINISHED",
          finishedAt: "2026-02-09T00:00:00.000Z"
        }
      };

      window.history.pushState({}, "", "/game/ROOM55");
      window.localStorage.setItem(
        "i-call-on:session:ROOM55",
        JSON.stringify({ participantId: "host", participantName: "Host", isHost: true, hostToken: "host-token" })
      );

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify(finishedState), {
          status: 200,
          headers: {
            "Content-Type": "application/json"
          }
        })
      );

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/Game ended. Final leaderboard is locked./i)).toBeInTheDocument();
      });

      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: /Create another game/i }));

      await waitFor(() => {
        expect(screen.getByRole("heading", { name: /I Call On/i })).toBeInTheDocument();
      });

      expect(window.location.pathname).toBe("/");
      expect(window.localStorage.getItem("i-call-on:session:ROOM55")).toBeNull();
    } finally {
      restoreSocket();
    }
  });

  it("restores typed round answers after refresh from local draft storage", async () => {
    const restoreSocket = installMockWebSocket();

    try {
      const now = Date.now();
      const openRoundState = makeInProgressState({
        activeRound: {
          roundNumber: 1,
          turnParticipantId: "host",
          turnParticipantName: "Host",
          calledNumber: 1,
          activeLetter: "A",
          startedAt: new Date(now).toISOString(),
          countdownEndsAt: new Date(now - 1000).toISOString(),
          endsAt: new Date(now + 15000).toISOString(),
          submissions: []
        }
      });

      window.history.pushState({}, "", "/game/ROOM55");
      window.localStorage.setItem(
        "i-call-on:session:ROOM55",
        JSON.stringify({ participantId: "host", participantName: "Host", isHost: true, hostToken: "host-token" })
      );

      vi.spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(
          new Response(JSON.stringify(openRoundState), {
            status: 200,
            headers: {
              "Content-Type": "application/json"
            }
          })
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify(openRoundState), {
            status: 200,
            headers: {
              "Content-Type": "application/json"
            }
          })
        );

      const firstRender = render(<App />);

      await waitFor(() => {
        expect(screen.getByLabelText(/^Name$/i)).not.toBeDisabled();
      });

      const user = userEvent.setup();
      await user.type(screen.getByLabelText(/^Name$/i), "Ayo");

      const draftRaw = window.localStorage.getItem("i-call-on:draft:ROOM55:host:1");
      expect(draftRaw).not.toBeNull();

      firstRender.unmount();
      render(<App />);

      await waitFor(() => {
        expect(screen.getByLabelText(/^Name$/i)).toHaveValue("Ayo");
      });
    } finally {
      restoreSocket();
    }
  });
});
