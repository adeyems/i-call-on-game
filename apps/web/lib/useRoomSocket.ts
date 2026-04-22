"use client";

import { useEffect, useRef, useState } from "react";
import type { RoomSocketEvent, RoomStateResponse } from "@i-call-on/shared";
import { connectRoomSocket } from "./api";

type ConnectionState = "connecting" | "open" | "closed";

export type RoomSocketOptions = {
  roomCode: string;
  participantId?: string;
  initialState?: RoomStateResponse | null;
  /** Called for every parsed event after state is updated. Useful for side effects (sounds, navigation). */
  onEvent?: (event: RoomSocketEvent) => void;
};

export type RoomSocketResult = {
  state: RoomStateResponse | null;
  connectionState: ConnectionState;
  connectedClients: number;
};

function snapshotFromEvent(event: RoomSocketEvent): RoomStateResponse | null {
  if (
    event.type === "snapshot" ||
    event.type === "join_request" ||
    event.type === "admission_update" ||
    event.type === "participant_removed" ||
    event.type === "game_started" ||
    event.type === "turn_called" ||
    event.type === "submission_received" ||
    event.type === "round_ended" ||
    event.type === "submission_scored" ||
    event.type === "round_scores_published" ||
    event.type === "round_scores_discarded" ||
    event.type === "game_cancelled" ||
    event.type === "game_ended" ||
    (event.type === "host_transferred" && event.snapshot)
  ) {
    return (event as { snapshot?: RoomStateResponse }).snapshot ?? null;
  }
  return null;
}

export function useRoomSocket({
  roomCode,
  participantId,
  initialState = null,
  onEvent
}: RoomSocketOptions): RoomSocketResult {
  const [state, setState] = useState<RoomStateResponse | null>(initialState);
  const [connectionState, setConnectionState] = useState<ConnectionState>("connecting");
  const [connectedClients, setConnectedClients] = useState(0);
  const handlerRef = useRef(onEvent);

  useEffect(() => {
    handlerRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    const socket = connectRoomSocket(roomCode, participantId);

    socket.onopen = () => setConnectionState("open");
    socket.onclose = () => setConnectionState("closed");

    socket.onmessage = (message: MessageEvent<string>) => {
      let parsed: RoomSocketEvent | null = null;
      try {
        parsed = JSON.parse(message.data) as RoomSocketEvent;
      } catch {
        return;
      }

      if (parsed.type === "presence") {
        setConnectedClients(parsed.count);
        return;
      }

      const snap = snapshotFromEvent(parsed);
      if (snap) {
        setState(snap);
      }

      handlerRef.current?.(parsed);
    };

    return () => {
      socket.close();
    };
  }, [roomCode, participantId]);

  return { state, connectionState, connectedClients };
}
