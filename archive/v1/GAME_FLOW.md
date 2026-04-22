# I Call On - Game Flow

## Current truth
Steps 1-5 are implemented with real-time event updates.
Core gameplay turns and scoring are not implemented yet.

## Implemented flow (steps 1-5)
1. Host creates room and sets max players (1-10, host included).
2. Host shares `/join/{ROOM_CODE}`.
3. Players request to join with name.
4. Host approves/rejects each request (real-time updates, no host refresh required).
5. Host starts game when ready.

## Real-time behavior
- Host lobby auto-updates when join requests arrive.
- Host sees live admitted/pending/rejected counts.
- Notification sound plays when a join request is received.
- Approved participant is moved to `/game/{ROOM_CODE}` automatically.
- `/game/{ROOM_CODE}` is currently an empty placeholder board with live status updates.

## Planned full game flow (steps 6+)
6. System sets turn order.
7. Active player calls a number `1-26` (mapped to `A-Z`).
8. Chosen letter becomes active and timer starts (with sound).
9. Everyone fills 5 boxes: `Name, Animal, Place, Thing, Food`.
10. Round ends by configured rule:
   1. timer expires, or
   2. first submission, or
   3. whichever comes first (if enabled).
11. Inputs lock; scoring runs.
12. Leaderboard updates.
13. Next turn starts until end condition (fixed rounds or host ends game).

## Next recommended build step
Implement turn lifecycle (`A-Z`, timer, active turn) and then submission + scoring.
