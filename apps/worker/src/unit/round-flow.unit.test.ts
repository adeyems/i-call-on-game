import { describe, expect, it } from "vitest";
import {
  buildTurnOrder,
  callNumberForTurn,
  discardRoundScores,
  endGame,
  endActiveRound,
  endRoundManually,
  initializeRoomState,
  publishRoundScores,
  scoreRoundSubmission,
  startGame,
  submitRoundAnswers,
  updateRoundDraft,
  type StoredRoomState
} from "../room";

function createStartedState(
  config?: {
    endRule?: "TIMER" | "FIRST_SUBMISSION" | "WHICHEVER_FIRST";
    manualEndPolicy?: "HOST_OR_CALLER" | "CALLER_ONLY" | "CALLER_OR_TIMER" | "NONE";
    scoringMode?: "FIXED_10" | "SHARED_10";
  }
): StoredRoomState {
  const base = initializeRoomState(
    {
      roomCode: "ROUND1",
      hostName: "Host",
      maxParticipants: 6,
      hostToken: "host-token"
    },
    "2026-02-08T00:00:00.000Z"
  );

  const withAdmittedPlayer: StoredRoomState = {
    ...base,
    participants: [
      ...base.participants,
      {
        id: "p-ada",
        name: "Ada",
        status: "ADMITTED",
        isHost: false,
        createdAt: "2026-02-08T00:00:01.000Z",
        updatedAt: "2026-02-08T00:00:01.000Z"
      }
    ]
  };

  const started = startGame(
    withAdmittedPlayer,
    "host-token",
    {
      roundSeconds: 12,
      endRule: config?.endRule ?? "WHICHEVER_FIRST",
      manualEndPolicy: config?.manualEndPolicy,
      scoringMode: config?.scoringMode
    },
    "2026-02-08T00:00:10.000Z"
  );

  if (!started.ok) {
    throw new Error(`unable to create started state: ${started.error}`);
  }

  return started.nextState;
}

function createStateAtFairRoundLimit(): StoredRoomState {
  const base = initializeRoomState(
    {
      roomCode: "ROUNDLIM",
      hostName: "Host",
      maxParticipants: 10,
      hostToken: "host-token"
    },
    "2026-02-08T00:00:00.000Z"
  );

  const extraParticipants = Array.from({ length: 9 }, (_, index) => ({
    id: `p-${index + 1}`,
    name: `Player ${index + 1}`,
    status: "ADMITTED" as const,
    isHost: false,
    createdAt: `2026-02-08T00:00:${String(index + 1).padStart(2, "0")}.000Z`,
    updatedAt: `2026-02-08T00:00:${String(index + 1).padStart(2, "0")}.000Z`
  }));

  const participants = [...base.participants, ...extraParticipants];
  const turnOrder = participants.map((participant) => participant.id);

  const completedRounds = Array.from({ length: 20 }, (_, index) => {
    const number = index + 1;
    return {
      roundNumber: number,
      turnParticipantId: turnOrder[index % turnOrder.length],
      turnParticipantName: participants[index % participants.length].name,
      calledNumber: number,
      activeLetter: String.fromCharCode(64 + number),
      startedAt: "2026-02-08T00:01:00.000Z",
      countdownEndsAt: "2026-02-08T00:01:03.000Z",
      endsAt: "2026-02-08T00:01:20.000Z",
      endedAt: "2026-02-08T00:01:20.000Z",
      endReason: "TIMER" as const,
      scorePublishedAt: "2026-02-08T00:01:25.000Z",
      drafts: {},
      submissions: participants.map((participant) => ({
        participantId: participant.id,
        participantName: participant.name,
        answers: {
          name: "",
          animal: "",
          place: "",
          thing: "",
          food: ""
        },
        submittedAt: "2026-02-08T00:01:18.000Z",
        review: null
      }))
    };
  });

  return {
    ...base,
    participants,
    game: {
      status: "IN_PROGRESS",
      startedAt: "2026-02-08T00:00:10.000Z",
      cancelledAt: null,
      finishedAt: null,
      config: {
        roundSeconds: 12,
        endRule: "TIMER",
        manualEndPolicy: "HOST_OR_CALLER",
        scoringMode: "FIXED_10"
      },
      turnOrder,
      currentTurnIndex: 0,
      activeRound: null,
      completedRounds
    }
  };
}

describe("unit: round flow logic", () => {
  it("builds turn order from admitted participants in join order", () => {
    const state = initializeRoomState(
      {
        roomCode: "TURN01",
        hostName: "Host",
        maxParticipants: 6,
        hostToken: "host-token"
      },
      "2026-02-08T00:00:00.000Z"
    );

    const withPlayers: StoredRoomState = {
      ...state,
      participants: [
        ...state.participants,
        {
          id: "p-pending",
          name: "Pending",
          status: "PENDING",
          isHost: false,
          createdAt: "2026-02-08T00:00:01.000Z",
          updatedAt: "2026-02-08T00:00:01.000Z"
        },
        {
          id: "p-ada",
          name: "Ada",
          status: "ADMITTED",
          isHost: false,
          createdAt: "2026-02-08T00:00:02.000Z",
          updatedAt: "2026-02-08T00:00:02.000Z"
        },
        {
          id: "p-ben",
          name: "Ben",
          status: "ADMITTED",
          isHost: false,
          createdAt: "2026-02-08T00:00:03.000Z",
          updatedAt: "2026-02-08T00:00:03.000Z"
        }
      ]
    };

    expect(buildTurnOrder(withPlayers)).toEqual(["host", "p-ada", "p-ben"]);
  });

  it("starts a round when the active player calls a number", () => {
    const started = createStartedState({ endRule: "TIMER" });
    const call = callNumberForTurn(started, "host", 1, "2026-02-08T00:00:11.000Z");

    expect(call.ok).toBe(true);
    if (call.ok) {
      expect(call.activeRound.activeLetter).toBe("A");
      expect(call.activeRound.calledNumber).toBe(1);
      expect(call.activeRound.turnParticipantId).toBe("host");
      expect(call.activeRound.countdownEndsAt).toBe("2026-02-08T00:00:14.000Z");
      expect(call.activeRound.endsAt).toBe("2026-02-08T00:00:26.000Z");
    }
  });

  it("rejects call attempts from a non-active participant", () => {
    const started = createStartedState({ endRule: "TIMER" });
    const call = callNumberForTurn(started, "p-ada", 4, "2026-02-08T00:00:11.000Z");

    expect(call.ok).toBe(false);
    if (!call.ok) {
      expect(call.status).toBe(403);
      expect(call.error).toContain("not this participant's turn");
    }
  });

  it("blocks submission during the pre-round countdown", () => {
    const started = createStartedState({ endRule: "TIMER" });
    const called = callNumberForTurn(started, "host", 2, "2026-02-08T00:00:11.000Z");
    expect(called.ok).toBe(true);
    if (!called.ok) {
      return;
    }

    const earlySubmit = submitRoundAnswers(
      called.nextState,
      "host",
      {
        name: "Abe",
        animal: "Ant",
        place: "Athens",
        thing: "Arrow",
        food: "Apple"
      },
      "2026-02-08T00:00:12.000Z"
    );

    expect(earlySubmit.ok).toBe(false);
    if (!earlySubmit.ok) {
      expect(earlySubmit.status).toBe(409);
      expect(earlySubmit.error).toBe("round countdown in progress");
    }
  });

  it("ends immediately on first submission and force-submits missing players", () => {
    const started = createStartedState({ endRule: "FIRST_SUBMISSION" });
    const called = callNumberForTurn(started, "host", 2, "2026-02-08T00:00:11.000Z");
    expect(called.ok).toBe(true);
    if (!called.ok) {
      return;
    }

    const submitted = submitRoundAnswers(
      called.nextState,
      "host",
      {
        name: "Abe",
        animal: "Ant",
        place: "Athens",
        thing: "Arrow",
        food: "Apple"
      },
      "2026-02-08T00:00:15.000Z"
    );

    expect(submitted.ok).toBe(true);
    if (submitted.ok) {
      expect(submitted.roundEnded).toBe(true);
      expect(submitted.completedRound?.endReason).toBe("FIRST_SUBMISSION");
      expect(submitted.nextState.game.activeRound).toBeNull();
      expect(submitted.nextState.game.currentTurnIndex).toBe(1);
      expect(submitted.nextState.game.completedRounds).toHaveLength(1);
      expect(submitted.nextState.game.completedRounds[0].submissions).toHaveLength(2);
    }
  });

  it("keeps round open after a submission when rule is TIMER", () => {
    const started = createStartedState({ endRule: "TIMER" });
    const called = callNumberForTurn(started, "host", 5, "2026-02-08T00:00:11.000Z");
    expect(called.ok).toBe(true);
    if (!called.ok) {
      return;
    }

    const submitted = submitRoundAnswers(
      called.nextState,
      "host",
      {
        name: "Eve",
        animal: "Eel",
        place: "Egypt",
        thing: "Engine",
        food: "Egg"
      },
      "2026-02-08T00:00:15.000Z"
    );

    expect(submitted.ok).toBe(true);
    if (submitted.ok) {
      expect(submitted.roundEnded).toBe(false);
      expect(submitted.completedRound).toBeNull();
      expect(submitted.nextState.game.activeRound?.submissions).toHaveLength(1);
    }
  });

  it("prevents duplicate submissions from the same participant", () => {
    const started = createStartedState({ endRule: "TIMER" });
    const called = callNumberForTurn(started, "host", 7, "2026-02-08T00:00:11.000Z");
    expect(called.ok).toBe(true);
    if (!called.ok) {
      return;
    }

    const first = submitRoundAnswers(
      called.nextState,
      "host",
      {
        name: "Gina",
        animal: "Goat",
        place: "Ghana",
        thing: "Glass",
        food: "Grapes"
      },
      "2026-02-08T00:00:15.000Z"
    );

    expect(first.ok).toBe(true);
    if (!first.ok) {
      return;
    }

    const duplicate = submitRoundAnswers(
      first.nextState,
      "host",
      {
        name: "Again",
        animal: "Again",
        place: "Again",
        thing: "Again",
        food: "Again"
      },
      "2026-02-08T00:00:16.000Z"
    );

    expect(duplicate.ok).toBe(false);
    if (!duplicate.ok) {
      expect(duplicate.status).toBe(409);
      expect(duplicate.error).toBe("participant has already submitted");
    }
  });

  it("keeps typed draft answers when host force-ends the round", () => {
    const started = createStartedState({ endRule: "TIMER" });
    const called = callNumberForTurn(started, "host", 11, "2026-02-08T00:00:11.000Z");
    expect(called.ok).toBe(true);
    if (!called.ok) {
      return;
    }

    const hostDraft = updateRoundDraft(
      called.nextState,
      "host",
      {
        name: "Kofi",
        animal: "Koala",
        place: "Kano",
        thing: "Key",
        food: "Kiwi"
      },
      "2026-02-08T00:00:15.000Z"
    );
    expect(hostDraft.ok).toBe(true);
    if (!hostDraft.ok) {
      return;
    }

    const adaDraft = updateRoundDraft(
      hostDraft.nextState,
      "p-ada",
      {
        name: "Kate",
        animal: "Kudu",
        place: "Kigali",
        thing: "Kettle",
        food: "Kebab"
      },
      "2026-02-08T00:00:16.000Z"
    );
    expect(adaDraft.ok).toBe(true);
    if (!adaDraft.ok) {
      return;
    }

    const ended = endRoundManually(adaDraft.nextState, "host", "2026-02-08T00:00:18.000Z");
    expect(ended.ok).toBe(true);
    if (!ended.ok) {
      return;
    }

    const hostSubmission = ended.completedRound.submissions.find((submission) => submission.participantId === "host");
    const adaSubmission = ended.completedRound.submissions.find((submission) => submission.participantId === "p-ada");
    expect(hostSubmission?.answers.name).toBe("Kofi");
    expect(adaSubmission?.answers.food).toBe("Kebab");
  });

  it("allows host to end game and lock room", () => {
    const started = createStartedState({ endRule: "TIMER" });
    const finished = endGame(started, "host-token", "2026-02-08T00:00:40.000Z");
    expect(finished.ok).toBe(true);
    if (!finished.ok) {
      return;
    }

    expect(finished.nextState.game.status).toBe("FINISHED");
    expect(finished.nextState.game.finishedAt).toBe("2026-02-08T00:00:40.000Z");
  });

  it("does not allow new round while previous round is pending publication", () => {
    const started = createStartedState({ endRule: "TIMER" });
    const called = callNumberForTurn(started, "host", 1, "2026-02-08T00:00:11.000Z");
    expect(called.ok).toBe(true);
    if (!called.ok) {
      return;
    }

    const ended = endRoundManually(called.nextState, "host", "2026-02-08T00:00:18.000Z");
    expect(ended.ok).toBe(true);
    if (!ended.ok) {
      return;
    }

    const nextCall = callNumberForTurn(ended.nextState, "p-ada", 2, "2026-02-08T00:00:22.000Z");
    expect(nextCall.ok).toBe(false);
    if (!nextCall.ok) {
      expect(nextCall.status).toBe(409);
      expect(nextCall.error).toBe("submit or discard previous round result before starting next round");
    }
  });

  it("discards round result and clears reviewed scores", () => {
    const started = createStartedState({ endRule: "TIMER" });
    const called = callNumberForTurn(started, "host", 1, "2026-02-08T00:00:11.000Z");
    expect(called.ok).toBe(true);
    if (!called.ok) {
      return;
    }

    const ended = endRoundManually(called.nextState, "host", "2026-02-08T00:00:18.000Z");
    expect(ended.ok).toBe(true);
    if (!ended.ok) {
      return;
    }

    const scored = scoreRoundSubmission(
      ended.nextState,
      "host-token",
      1,
      "host",
      {
        name: true,
        animal: true,
        place: true,
        thing: false,
        food: false
      },
      "2026-02-08T00:00:19.000Z"
    );
    expect(scored.ok).toBe(true);
    if (!scored.ok) {
      return;
    }

    const discarded = discardRoundScores(scored.nextState, "host-token", 1, "2026-02-08T00:00:20.000Z");
    expect(discarded.ok).toBe(true);
    if (!discarded.ok) {
      return;
    }

    expect(discarded.round.scorePublishedAt).toBe("2026-02-08T00:00:20.000Z");
    expect(discarded.round.submissions.every((submission) => submission.review === null)).toBe(true);
  });

  it("ends timer-driven rounds and advances to the next turn", () => {
    const started = createStartedState({ endRule: "TIMER" });
    const called = callNumberForTurn(started, "host", 9, "2026-02-08T00:00:11.000Z");
    expect(called.ok).toBe(true);
    if (!called.ok) {
      return;
    }

    const ended = endActiveRound(called.nextState, "TIMER", "2026-02-08T00:00:26.000Z");

    expect(ended.ok).toBe(true);
    if (ended.ok) {
      expect(ended.completedRound.endReason).toBe("TIMER");
      expect(ended.nextState.game.activeRound).toBeNull();
      expect(ended.nextState.game.currentTurnIndex).toBe(1);
      expect(ended.nextState.game.completedRounds).toHaveLength(1);
    }
  });

  it("allows host to manually end round and force-submit all", () => {
    const started = createStartedState({ endRule: "TIMER" });
    const called = callNumberForTurn(started, "host", 12, "2026-02-08T00:00:11.000Z");
    expect(called.ok).toBe(true);
    if (!called.ok) {
      return;
    }

    const manual = endRoundManually(called.nextState, "host", "2026-02-08T00:00:18.000Z");

    expect(manual.ok).toBe(true);
    if (manual.ok) {
      expect(manual.completedRound.endReason).toBe("MANUAL_END");
      expect(manual.completedRound.submissions).toHaveLength(2);
      expect(manual.nextState.game.activeRound).toBeNull();
    }
  });

  it("blocks non-caller participants from ending early when manual policy is caller-only", () => {
    const started = createStartedState({ endRule: "TIMER", manualEndPolicy: "CALLER_ONLY" });
    const called = callNumberForTurn(started, "host", 12, "2026-02-08T00:00:11.000Z");
    expect(called.ok).toBe(true);
    if (!called.ok) {
      return;
    }

    const denied = endRoundManually(called.nextState, "p-ada", "2026-02-08T00:00:18.000Z");
    expect(denied.ok).toBe(false);
    if (!denied.ok) {
      expect(denied.status).toBe(403);
      expect(denied.error).toBe("only the current caller can end the round");
    }
  });

  it("blocks all manual round ending when policy is none (timer only)", () => {
    const started = createStartedState({ endRule: "TIMER", manualEndPolicy: "NONE" });
    const called = callNumberForTurn(started, "host", 12, "2026-02-08T00:00:11.000Z");
    expect(called.ok).toBe(true);
    if (!called.ok) {
      return;
    }

    const denied = endRoundManually(called.nextState, "host", "2026-02-08T00:00:18.000Z");
    expect(denied.ok).toBe(false);
    if (!denied.ok) {
      expect(denied.status).toBe(403);
      expect(denied.error).toBe("manual round end is disabled for this room");
    }
  });

  it("prevents reusing an already played letter", () => {
    const started = createStartedState({ endRule: "TIMER" });
    const called = callNumberForTurn(started, "host", 1, "2026-02-08T00:00:11.000Z");
    expect(called.ok).toBe(true);
    if (!called.ok) {
      return;
    }

    const ended = endRoundManually(called.nextState, "host", "2026-02-08T00:00:18.000Z");
    expect(ended.ok).toBe(true);
    if (!ended.ok) {
      return;
    }

    const discarded = discardRoundScores(ended.nextState, "host-token", 1, "2026-02-08T00:00:18.500Z");
    expect(discarded.ok).toBe(true);
    if (!discarded.ok) {
      return;
    }

    const duplicateLetter = callNumberForTurn(discarded.nextState, "p-ada", 1, "2026-02-08T00:00:19.000Z");
    expect(duplicateLetter.ok).toBe(false);
    if (!duplicateLetter.ok) {
      expect(duplicateLetter.status).toBe(409);
      expect(duplicateLetter.error).toBe("letter has already been used");
    }
  });

  it("stops new calls after the fair round limit is reached", () => {
    const state = createStateAtFairRoundLimit();
    const result = callNumberForTurn(state, "host", 21, "2026-02-08T00:10:00.000Z");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(409);
      expect(result.error).toBe("maximum fair rounds reached");
    }
  });

  it("allows host to score a submission with 10/0 per field", () => {
    const started = createStartedState({ endRule: "TIMER" });
    const called = callNumberForTurn(started, "host", 3, "2026-02-08T00:00:11.000Z");
    expect(called.ok).toBe(true);
    if (!called.ok) {
      return;
    }

    const ended = endRoundManually(called.nextState, "host", "2026-02-08T00:00:18.000Z");
    expect(ended.ok).toBe(true);
    if (!ended.ok) {
      return;
    }

    const scored = scoreRoundSubmission(
      ended.nextState,
      "host-token",
      1,
      "host",
      {
        name: true,
        animal: true,
        place: false,
        thing: false,
        food: true
      },
      "2026-02-08T00:00:30.000Z"
    );

    expect(scored.ok).toBe(true);
    if (scored.ok) {
      expect(scored.updatedSubmission.review).not.toBeNull();
      expect(scored.updatedSubmission.review?.scores).toEqual({
        name: 10,
        animal: 10,
        place: 0,
        thing: 0,
        food: 10,
        total: 30
      });
    }
  });

  it("applies shared-10 scoring across matching answers when configured", () => {
    const started = createStartedState({ endRule: "TIMER", scoringMode: "SHARED_10" });
    const called = callNumberForTurn(started, "host", 1, "2026-02-08T00:00:11.000Z");
    expect(called.ok).toBe(true);
    if (!called.ok) {
      return;
    }

    const hostSubmitted = submitRoundAnswers(
      called.nextState,
      "host",
      {
        name: "Ada",
        animal: "Ant",
        place: "Accra",
        thing: "Anvil",
        food: "Apple"
      },
      "2026-02-08T00:00:15.000Z"
    );
    expect(hostSubmitted.ok).toBe(true);
    if (!hostSubmitted.ok) {
      return;
    }

    const adaSubmitted = submitRoundAnswers(
      hostSubmitted.nextState,
      "p-ada",
      {
        name: "Ada",
        animal: "Ant",
        place: "Austin",
        thing: "Arrow",
        food: "Apricot"
      },
      "2026-02-08T00:00:16.000Z"
    );
    expect(adaSubmitted.ok).toBe(true);
    if (!adaSubmitted.ok) {
      return;
    }

    const ended = endRoundManually(adaSubmitted.nextState, "host", "2026-02-08T00:00:18.000Z");
    expect(ended.ok).toBe(true);
    if (!ended.ok) {
      return;
    }

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
      "2026-02-08T00:00:30.000Z"
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
      "2026-02-08T00:00:31.000Z"
    );
    expect(scoredAda.ok).toBe(true);
    if (!scoredAda.ok) {
      return;
    }

    const hostReview = scoredAda.nextState.game.completedRounds[0].submissions.find((submission) => submission.participantId === "host")
      ?.review;
    const adaReview = scoredAda.nextState.game.completedRounds[0].submissions.find((submission) => submission.participantId === "p-ada")
      ?.review;

    expect(hostReview?.scores).toEqual({
      name: 5,
      animal: 5,
      place: 10,
      thing: 10,
      food: 10,
      total: 40
    });
    expect(adaReview?.scores).toEqual({
      name: 5,
      animal: 5,
      place: 10,
      thing: 10,
      food: 10,
      total: 40
    });
  });

  it("does not publish a round until every submission is reviewed", () => {
    const started = createStartedState({ endRule: "TIMER" });
    const called = callNumberForTurn(started, "host", 4, "2026-02-08T00:00:11.000Z");
    expect(called.ok).toBe(true);
    if (!called.ok) {
      return;
    }

    const ended = endRoundManually(called.nextState, "host", "2026-02-08T00:00:18.000Z");
    expect(ended.ok).toBe(true);
    if (!ended.ok) {
      return;
    }

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
      "2026-02-08T00:00:30.000Z"
    );

    expect(scoredHost.ok).toBe(true);
    if (!scoredHost.ok) {
      return;
    }

    const published = publishRoundScores(scoredHost.nextState, "host-token", 1, "2026-02-08T00:00:40.000Z");
    expect(published.ok).toBe(false);
    if (!published.ok) {
      expect(published.status).toBe(409);
      expect(published.error).toBe("all submissions must be reviewed before publishing round");
    }
  });

  it("publishes round scores and blocks later edits", () => {
    const started = createStartedState({ endRule: "TIMER" });
    const called = callNumberForTurn(started, "host", 5, "2026-02-08T00:00:11.000Z");
    expect(called.ok).toBe(true);
    if (!called.ok) {
      return;
    }

    const ended = endRoundManually(called.nextState, "host", "2026-02-08T00:00:18.000Z");
    expect(ended.ok).toBe(true);
    if (!ended.ok) {
      return;
    }

    const scoredHost = scoreRoundSubmission(
      ended.nextState,
      "host-token",
      1,
      "host",
      {
        name: true,
        animal: true,
        place: false,
        thing: false,
        food: true
      },
      "2026-02-08T00:00:30.000Z"
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
        name: false,
        animal: false,
        place: false,
        thing: false,
        food: false
      },
      "2026-02-08T00:00:31.000Z"
    );
    expect(scoredAda.ok).toBe(true);
    if (!scoredAda.ok) {
      return;
    }

    const published = publishRoundScores(scoredAda.nextState, "host-token", 1, "2026-02-08T00:00:40.000Z");
    expect(published.ok).toBe(true);
    if (!published.ok) {
      return;
    }

    expect(published.round.scorePublishedAt).toBe("2026-02-08T00:00:40.000Z");

    const rescored = scoreRoundSubmission(
      published.nextState,
      "host-token",
      1,
      "host",
      {
        name: false,
        animal: false,
        place: false,
        thing: false,
        food: false
      },
      "2026-02-08T00:00:50.000Z"
    );

    expect(rescored.ok).toBe(false);
    if (!rescored.ok) {
      expect(rescored.status).toBe(409);
      expect(rescored.error).toBe("round has already been published");
    }
  });

  it("rejects scoring with an invalid host token", () => {
    const started = createStartedState({ endRule: "TIMER" });
    const called = callNumberForTurn(started, "host", 4, "2026-02-08T00:00:11.000Z");
    expect(called.ok).toBe(true);
    if (!called.ok) {
      return;
    }

    const ended = endRoundManually(called.nextState, "host", "2026-02-08T00:00:18.000Z");
    expect(ended.ok).toBe(true);
    if (!ended.ok) {
      return;
    }

    const scored = scoreRoundSubmission(
      ended.nextState,
      "wrong-token",
      1,
      "host",
      {
        name: true,
        animal: false,
        place: false,
        thing: false,
        food: false
      },
      "2026-02-08T00:00:30.000Z"
    );

    expect(scored.ok).toBe(false);
    if (!scored.ok) {
      expect(scored.status).toBe(401);
      expect(scored.error).toBe("invalid host token");
    }
  });
});
