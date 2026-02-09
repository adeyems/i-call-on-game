import { GameRoom, type RoomInitPayload } from "./room";

export { GameRoom };

export interface Env {
  APP_ORIGIN?: string;
  DB?: D1Database;
  GAME_ROOM: DurableObjectNamespace;
}

type CreateRoomPayload = {
  hostName?: string;
  maxParticipants?: number;
};

type RoomRoute =
  | {
      type: "state";
      roomCode: string;
    }
  | {
      type: "join";
      roomCode: string;
    }
  | {
      type: "admissions";
      roomCode: string;
    }
  | {
      type: "start";
      roomCode: string;
    }
  | {
      type: "call";
      roomCode: string;
    }
  | {
      type: "submit";
      roomCode: string;
    }
  | {
      type: "draft";
      roomCode: string;
    }
  | {
      type: "end";
      roomCode: string;
    }
  | {
      type: "score";
      roomCode: string;
    }
  | {
      type: "publish";
      roomCode: string;
    }
  | {
      type: "discard";
      roomCode: string;
    }
  | {
      type: "cancel";
      roomCode: string;
    }
  | {
      type: "finish";
      roomCode: string;
    };

function json(data: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...headers
    }
  });
}

function corsHeaders(origin = "*"): HeadersInit {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
  };
}

export function normalizeRoomCode(raw: string): string {
  return raw.trim().toUpperCase();
}

export function isValidRoomCode(roomCode: string): boolean {
  return /^[A-Z0-9]{4,10}$/.test(roomCode);
}

export function parseRoomRoute(pathname: string): RoomRoute | null {
  const segments = pathname.split("/").filter(Boolean);
  if (segments[0] !== "api" || segments[1] !== "rooms") {
    return null;
  }

  if (segments.length < 3) {
    return null;
  }

  const roomCode = normalizeRoomCode(segments[2]);
  if (!isValidRoomCode(roomCode)) {
    return null;
  }

  if (segments.length === 3) {
    return {
      type: "state",
      roomCode
    };
  }

  if (segments.length === 4 && segments[3] === "join") {
    return {
      type: "join",
      roomCode
    };
  }

  if (segments.length === 4 && segments[3] === "admissions") {
    return {
      type: "admissions",
      roomCode
    };
  }

  if (segments.length === 4 && segments[3] === "start") {
    return {
      type: "start",
      roomCode
    };
  }

  if (segments.length === 4 && segments[3] === "call") {
    return {
      type: "call",
      roomCode
    };
  }

  if (segments.length === 4 && segments[3] === "submit") {
    return {
      type: "submit",
      roomCode
    };
  }

  if (segments.length === 4 && segments[3] === "draft") {
    return {
      type: "draft",
      roomCode
    };
  }

  if (segments.length === 4 && segments[3] === "end") {
    return {
      type: "end",
      roomCode
    };
  }

  if (segments.length === 4 && segments[3] === "score") {
    return {
      type: "score",
      roomCode
    };
  }

  if (segments.length === 4 && segments[3] === "publish") {
    return {
      type: "publish",
      roomCode
    };
  }

  if (segments.length === 4 && segments[3] === "discard") {
    return {
      type: "discard",
      roomCode
    };
  }

  if (segments.length === 4 && segments[3] === "cancel") {
    return {
      type: "cancel",
      roomCode
    };
  }

  if (segments.length === 4 && segments[3] === "finish") {
    return {
      type: "finish",
      roomCode
    };
  }

  return null;
}

function createRoomCode(length = 6): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < length; i += 1) {
    const idx = Math.floor(Math.random() * alphabet.length);
    code += alphabet[idx];
  }
  return code;
}

function roomStub(env: Env, roomCode: string): DurableObjectStub {
  const roomId = env.GAME_ROOM.idFromName(roomCode);
  return env.GAME_ROOM.get(roomId);
}

async function persistRoomInD1(env: Env, payload: RoomInitPayload): Promise<void> {
  if (!env.DB) {
    return;
  }

  try {
    await env.DB.prepare(
      "INSERT INTO rooms (code, host_name, max_participants, status, created_at) VALUES (?1, ?2, ?3, 'LOBBY', ?4)"
    )
      .bind(payload.roomCode, payload.hostName, payload.maxParticipants, new Date().toISOString())
      .run();
  } catch {
    // Local bootstrap can run without D1 migrations.
  }
}

async function proxyJsonRequest(
  stub: DurableObjectStub,
  method: "GET" | "POST",
  path:
    | "/init"
    | "/state"
    | "/join"
    | "/admit"
    | "/start"
    | "/call"
    | "/submit"
    | "/draft"
    | "/end"
    | "/score"
    | "/publish"
    | "/discard"
    | "/cancel"
    | "/finish",
  body?: unknown
): Promise<Response> {
  const init: RequestInit = {
    method
  };

  if (body !== undefined) {
    init.body = JSON.stringify(body);
    init.headers = {
      "Content-Type": "application/json"
    };
  }

  return stub.fetch(`https://room${path}`, init);
}

export function createWorkerHandler() {
  return {
    async fetch(request: Request, env: Env): Promise<Response> {
      const url = new URL(request.url);
      const requestOrigin = request.headers.get("Origin");
      const allowOrigin = requestOrigin ?? env.APP_ORIGIN ?? "*";
      const headers = corsHeaders(allowOrigin);

      if (request.method === "OPTIONS") {
        return new Response(null, {
          status: 204,
          headers
        });
      }

      if (request.method === "GET" && url.pathname === "/health") {
        return json({ ok: true, service: "i-call-on-worker" }, 200, headers);
      }

      if (request.method === "POST" && url.pathname === "/api/rooms") {
        const body = (await request.json().catch(() => ({}))) as CreateRoomPayload;

        const hostName = (body.hostName ?? "").trim();
        const maxParticipants = Number(body.maxParticipants ?? 10);

        if (!hostName || hostName.length < 2) {
          return json({ error: "hostName must be at least 2 characters" }, 400, headers);
        }

        if (!Number.isInteger(maxParticipants) || maxParticipants < 1 || maxParticipants > 10) {
          return json({ error: "maxParticipants must be an integer between 1 and 10" }, 400, headers);
        }

        const roomCode = createRoomCode();
        const hostToken = crypto.randomUUID();
        const initPayload: RoomInitPayload = {
          roomCode,
          hostName,
          maxParticipants,
          hostToken
        };

        await proxyJsonRequest(roomStub(env, roomCode), "POST", "/init", initPayload);
        await persistRoomInD1(env, initPayload);

        return json(
          {
            roomCode,
            hostName,
            maxParticipants,
            wsPath: `/ws/${roomCode}`,
            hostToken
          },
          201,
          headers
        );
      }

      const roomRoute = parseRoomRoute(url.pathname);
      if (roomRoute) {
        const stub = roomStub(env, roomRoute.roomCode);

        if (roomRoute.type === "state" && request.method === "GET") {
          const upstream = await proxyJsonRequest(stub, "GET", "/state");
          return new Response(upstream.body, {
            status: upstream.status,
            headers: {
              ...headers,
              "Content-Type": "application/json"
            }
          });
        }

        if (roomRoute.type === "join" && request.method === "POST") {
          const payload = (await request.json().catch(() => ({}))) as { name?: string };
          const upstream = await proxyJsonRequest(stub, "POST", "/join", payload);
          return new Response(upstream.body, {
            status: upstream.status,
            headers: {
              ...headers,
              "Content-Type": "application/json"
            }
          });
        }

        if (roomRoute.type === "admissions" && request.method === "POST") {
          const payload = (await request.json().catch(() => ({}))) as {
            hostToken?: string;
            requestId?: string;
            approve?: boolean;
          };
          const upstream = await proxyJsonRequest(stub, "POST", "/admit", payload);
          return new Response(upstream.body, {
            status: upstream.status,
            headers: {
              ...headers,
              "Content-Type": "application/json"
            }
          });
        }

        if (roomRoute.type === "start" && request.method === "POST") {
          const payload = (await request.json().catch(() => ({}))) as {
            hostToken?: string;
            config?: {
              roundSeconds?: number;
              endRule?: "TIMER" | "FIRST_SUBMISSION" | "WHICHEVER_FIRST";
            };
          };
          const upstream = await proxyJsonRequest(stub, "POST", "/start", payload);
          return new Response(upstream.body, {
            status: upstream.status,
            headers: {
              ...headers,
              "Content-Type": "application/json"
            }
          });
        }

        if (roomRoute.type === "call" && request.method === "POST") {
          const payload = (await request.json().catch(() => ({}))) as {
            participantId?: string;
            number?: number;
          };
          const upstream = await proxyJsonRequest(stub, "POST", "/call", payload);
          return new Response(upstream.body, {
            status: upstream.status,
            headers: {
              ...headers,
              "Content-Type": "application/json"
            }
          });
        }

        if (roomRoute.type === "submit" && request.method === "POST") {
          const payload = (await request.json().catch(() => ({}))) as {
            participantId?: string;
            answers?: {
              name?: string;
              animal?: string;
              place?: string;
              thing?: string;
              food?: string;
            };
          };
          const upstream = await proxyJsonRequest(stub, "POST", "/submit", payload);
          return new Response(upstream.body, {
            status: upstream.status,
            headers: {
              ...headers,
              "Content-Type": "application/json"
            }
          });
        }

        if (roomRoute.type === "draft" && request.method === "POST") {
          const payload = (await request.json().catch(() => ({}))) as {
            participantId?: string;
            answers?: {
              name?: string;
              animal?: string;
              place?: string;
              thing?: string;
              food?: string;
            };
          };
          const upstream = await proxyJsonRequest(stub, "POST", "/draft", payload);
          return new Response(upstream.body, {
            status: upstream.status,
            headers: {
              ...headers,
              "Content-Type": "application/json"
            }
          });
        }

        if (roomRoute.type === "end" && request.method === "POST") {
          const payload = (await request.json().catch(() => ({}))) as {
            participantId?: string;
          };
          const upstream = await proxyJsonRequest(stub, "POST", "/end", payload);
          return new Response(upstream.body, {
            status: upstream.status,
            headers: {
              ...headers,
              "Content-Type": "application/json"
            }
          });
        }

        if (roomRoute.type === "score" && request.method === "POST") {
          const payload = (await request.json().catch(() => ({}))) as {
            hostToken?: string;
            roundNumber?: number;
            participantId?: string;
            marks?: {
              name?: boolean;
              animal?: boolean;
              place?: boolean;
              thing?: boolean;
              food?: boolean;
            };
          };
          const upstream = await proxyJsonRequest(stub, "POST", "/score", payload);
          return new Response(upstream.body, {
            status: upstream.status,
            headers: {
              ...headers,
              "Content-Type": "application/json"
            }
          });
        }

        if (roomRoute.type === "publish" && request.method === "POST") {
          const payload = (await request.json().catch(() => ({}))) as {
            hostToken?: string;
            roundNumber?: number;
          };
          const upstream = await proxyJsonRequest(stub, "POST", "/publish", payload);
          return new Response(upstream.body, {
            status: upstream.status,
            headers: {
              ...headers,
              "Content-Type": "application/json"
            }
          });
        }

        if (roomRoute.type === "discard" && request.method === "POST") {
          const payload = (await request.json().catch(() => ({}))) as {
            hostToken?: string;
            roundNumber?: number;
          };
          const upstream = await proxyJsonRequest(stub, "POST", "/discard", payload);
          return new Response(upstream.body, {
            status: upstream.status,
            headers: {
              ...headers,
              "Content-Type": "application/json"
            }
          });
        }

        if (roomRoute.type === "cancel" && request.method === "POST") {
          const payload = (await request.json().catch(() => ({}))) as {
            hostToken?: string;
          };
          const upstream = await proxyJsonRequest(stub, "POST", "/cancel", payload);
          return new Response(upstream.body, {
            status: upstream.status,
            headers: {
              ...headers,
              "Content-Type": "application/json"
            }
          });
        }

        if (roomRoute.type === "finish" && request.method === "POST") {
          const payload = (await request.json().catch(() => ({}))) as {
            hostToken?: string;
          };
          const upstream = await proxyJsonRequest(stub, "POST", "/finish", payload);
          return new Response(upstream.body, {
            status: upstream.status,
            headers: {
              ...headers,
              "Content-Type": "application/json"
            }
          });
        }
      }

      if (url.pathname.startsWith("/ws/")) {
        const roomCode = normalizeRoomCode(url.pathname.split("/").filter(Boolean)[1] ?? "");
        if (!isValidRoomCode(roomCode)) {
          return json({ error: "Invalid room code" }, 400, headers);
        }

        return roomStub(env, roomCode).fetch(request);
      }

      return json({ error: "Not found" }, 404, headers);
    }
  };
}

export default createWorkerHandler();
