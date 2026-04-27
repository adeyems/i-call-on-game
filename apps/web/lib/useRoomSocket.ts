"use client";

import { useEffect, useRef, useState } from "react";
import type { RoomSocketEvent, RoomStateResponse } from "@i-call-on/shared";
import { connectRoomSocket } from "./api";

type ConnectionState = "connecting" | "open" | "reconnecting" | "closed";

export type RoomSocketOptions = {
  roomCode: string;
  participantId?: string;
  initialState?: RoomStateResponse | null;
  /** Called for every parsed event after state is updated. Useful for sounds, navigation, etc. */
  onEvent?: (event: RoomSocketEvent) => void;
};

export type RoomSocketResult = {
  state: RoomStateResponse | null;
  connectionState: ConnectionState;
  connectedClients: number;
  /** Server epoch minus local epoch, captured on each connect. Add to Date.now() to get synced "now". */
  clockOffset: number;
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

const MAX_BACKOFF_MS = 8_000;

export function useRoomSocket({
  roomCode,
  participantId,
  initialState = null,
  onEvent
}: RoomSocketOptions): RoomSocketResult {
  const [state, setState] = useState<RoomStateResponse | null>(initialState);
  const [connectionState, setConnectionState] = useState<ConnectionState>("connecting");
  const [connectedClients, setConnectedClients] = useState(0);
  const [clockOffset, setClockOffset] = useState(0);

  const handlerRef = useRef(onEvent);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<number | null>(null);
  const closedByUsRef = useRef(false);

  useEffect(() => {
    handlerRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    closedByUsRef.current = false;

    const clearReconnectTimer = () => {
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };

    const connect = () => {
      if (closedByUsRef.current) return;
      // Replace any zombie socket reference.
      const existing = socketRef.current;
      socketRef.current = null;
      if (existing && existing.readyState <= WebSocket.OPEN) {
        try {
          existing.close();
        } catch {
          /* noop */
        }
      }

      setConnectionState(reconnectAttemptRef.current > 0 ? "reconnecting" : "connecting");

      let socket: WebSocket;
      try {
        socket = connectRoomSocket(roomCode, participantId);
      } catch {
        scheduleReconnect();
        return;
      }
      socketRef.current = socket;

      socket.onopen = () => {
        setConnectionState("open");
        reconnectAttemptRef.current = 0;
      };

      socket.onclose = () => {
        if (socketRef.current === socket) socketRef.current = null;
        if (closedByUsRef.current) return;
        setConnectionState("reconnecting");
        scheduleReconnect();
      };

      socket.onerror = () => {
        // Browsers fire onclose right after; the handler above schedules the reconnect.
      };

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

        if (parsed.type === "connected" && parsed.serverTime) {
          const serverEpoch = new Date(parsed.serverTime).getTime();
          if (Number.isFinite(serverEpoch)) {
            setClockOffset(serverEpoch - Date.now());
          }
          return;
        }

        const snap = snapshotFromEvent(parsed);
        if (snap) setState(snap);

        handlerRef.current?.(parsed);
      };
    };

    const scheduleReconnect = () => {
      if (closedByUsRef.current) return;
      clearReconnectTimer();
      const attempt = reconnectAttemptRef.current;
      const delay = Math.min(MAX_BACKOFF_MS, 500 * Math.pow(2, attempt));
      reconnectAttemptRef.current = attempt + 1;
      reconnectTimerRef.current = window.setTimeout(connect, delay);
    };

    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      if (!socketRef.current || socketRef.current.readyState >= WebSocket.CLOSING) {
        clearReconnectTimer();
        reconnectAttemptRef.current = 0;
        connect();
      }
    };

    const onOnline = () => {
      if (!socketRef.current || socketRef.current.readyState >= WebSocket.CLOSING) {
        clearReconnectTimer();
        reconnectAttemptRef.current = 0;
        connect();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("online", onOnline);

    connect();

    return () => {
      closedByUsRef.current = true;
      clearReconnectTimer();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("online", onOnline);
      const sock = socketRef.current;
      socketRef.current = null;
      if (sock) {
        try {
          sock.close();
        } catch {
          /* noop */
        }
      }
      setConnectionState("closed");
    };
  }, [roomCode, participantId]);

  return { state, connectionState, connectedClients, clockOffset };
}
