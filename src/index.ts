import { GameRoom } from "./room";
import { MountainDO } from "./MountainDO";

export { GameRoom, MountainDO };

export interface Env {
  GAME_ROOM: DurableObjectNamespace<GameRoom>;
  MOUNTAIN_DO?: DurableObjectNamespace<MountainDO>;
  ASSETS: Fetcher;
}

const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Content-Security-Policy":
    "default-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdnjs.cloudflare.com; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdnjs.cloudflare.com https://yeti.dondlingergc.com; connect-src 'self' ws: wss: https:; media-src 'self' blob:; img-src 'self' data: blob:;"
};

function withSecurityHeaders(response: Response): Response {
  const newHeaders = new Headers(response.headers);
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    if (!newHeaders.has(key)) {
      newHeaders.set(key, value);
    }
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders
  });
}

/**
 * Parallel Shard Matchmaker: Resolves cluster room availability simultaneously
 * in a single network turn without sequential blocking roundtrips.
 */
async function findAvailableRoom(env: Env): Promise<string> {
  const clusterShards = ["glacier-alpha", "glacier-bravo", "glacier-charlie", "glacier-delta"];

  const shardFetches = clusterShards.map(async (shard) => {
    try {
      const stub = env.GAME_ROOM.get(env.GAME_ROOM.idFromName(shard));
      const res = await stub.fetch("http://internal/room/status");
      if (res.ok) {
        const data = (await res.json()) as { activePlayers: number; isHuntComplete: boolean };
        return { shard, activePlayers: data.activePlayers, isHuntComplete: data.isHuntComplete };
      }
    } catch (_) {}
    return { shard, activePlayers: 0, isHuntComplete: false };
  });

  const results = await Promise.all(shardFetches);
  const bestShard = results.find((r) => r.activePlayers < 4 && !r.isHuntComplete);

  return bestShard ? bestShard.shard : `glacier-overflow-${Math.floor(Date.now() / 900000)}`;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // 1. WebSocket Upgrade & Matchmaking Routing
    if (url.pathname.startsWith("/ws") || url.pathname.startsWith("/websocket")) {
      const upgradeHeader = request.headers.get("Upgrade");
      if (!upgradeHeader || upgradeHeader.toLowerCase() !== "websocket") {
        return new Response("Expected WebSocket upgrade", { status: 426 });
      }

      let requestedRoom = url.searchParams.get("room") || url.searchParams.get("roomId");

      // Auto-matchmaking via parallel shard poll
      if (!requestedRoom || requestedRoom === "auto" || requestedRoom === "quickplay" || requestedRoom === "new") {
        requestedRoom = await findAvailableRoom(env);
      }

      // Route alpine hunt rooms to MountainDO
      if (env.MOUNTAIN_DO && (requestedRoom.includes("alps") || requestedRoom.includes("mountain") || url.searchParams.get("mode") === "hunt")) {
        const doId = env.MOUNTAIN_DO.idFromName(requestedRoom);
        const doStub = env.MOUNTAIN_DO.get(doId);
        url.searchParams.set("roomId", requestedRoom);
        const routedRequest = new Request(url.toString(), request);
        return doStub.fetch(routedRequest);
      }

      const doId = env.GAME_ROOM.idFromName(requestedRoom);
      const doStub = env.GAME_ROOM.get(doId);

      url.searchParams.set("roomId", requestedRoom);
      const routedRequest = new Request(url.toString(), request);
      return doStub.fetch(routedRequest);
    }

    // 2. Room Capacity & Matchmaking Directory API
    if (url.pathname === "/api/matchmaking/status") {
      const clusterShards = ["glacier-alpha", "glacier-bravo", "glacier-charlie", "glacier-delta"];
      const statuses = await Promise.all(
        clusterShards.map(async (shard) => {
          try {
            const stub = env.GAME_ROOM.get(env.GAME_ROOM.idFromName(shard));
            const res = await stub.fetch("http://internal/room/status");
            if (res.ok) return { room: shard, ...((await res.json()) as Record<string, unknown>) };
          } catch (_) {}
          return { room: shard, activePlayers: 0, status: "OPEN" };
        })
      );
      return withSecurityHeaders(
        new Response(JSON.stringify({ success: true, rooms: statuses }), {
          headers: { "Content-Type": "application/json" }
        })
      );
    }

    // 3. Embedded SQLite Leaderboards
    if (url.pathname === "/api/leaderboard" || url.pathname === "/api/scores") {
      const targetRoom = url.searchParams.get("room") || "GLOBAL_LEADERBOARD";
      const stub = env.GAME_ROOM.get(env.GAME_ROOM.idFromName(targetRoom));
      const res = await stub.fetch(request);
      return withSecurityHeaders(res);
    }

    // 4. Landing page & Game shortcuts
    if (url.pathname === "/" || url.pathname === "/play" || url.pathname === "/game") {
      const gameReq = new Request(new URL("/index.html", request.url), request);
      const res = await env.ASSETS.fetch(gameReq);
      return withSecurityHeaders(res);
    }
    if (url.pathname === "/landing" || url.pathname === "/teaser") {
      const landingReq = new Request(new URL("/landing.html", request.url), request);
      const res = await env.ASSETS.fetch(landingReq);
      return withSecurityHeaders(res);
    }

    // 4b. WebMCP / MCP Endpoint Protocol Handler
    if (url.pathname === "/mcp" || url.pathname === "/mcp/") {
      if (request.method === "OPTIONS") {
        return withSecurityHeaders(new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization"
          }
        }));
      }

      if (request.method === "POST") {
        try {
          const body = (await request.json()) as { method?: string; id?: string | number };
          if (body.method === "tools/list") {
            return withSecurityHeaders(new Response(JSON.stringify({
              jsonrpc: "2.0",
              id: body.id ?? 1,
              result: {
                tools: [
                  {
                    name: "get_game_status",
                    description: "Retrieve live alpine game status, active tier, and player telemetry",
                    inputSchema: { type: "object", properties: {} }
                  }
                ]
              }
            }), {
              headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
            }));
          }
          return withSecurityHeaders(new Response(JSON.stringify({
            jsonrpc: "2.0",
            id: body.id ?? 1,
            result: {}
          }), {
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
          }));
        } catch (_) {
          return withSecurityHeaders(new Response(JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            result: { tools: [] }
          }), {
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
          }));
        }
      }

      // Fallback GET on /mcp
      return withSecurityHeaders(new Response(JSON.stringify({
        name: "skifree-yeti-do-mcp",
        version: "1.0.0",
        status: "ACTIVE"
      }), {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      }));
    }

    // 5. Static Assets from public/
    if (env.ASSETS) {
      const assetRes = await env.ASSETS.fetch(request);
      return withSecurityHeaders(assetRes);
    }

    return withSecurityHeaders(
      new Response("Frost Leviathan: Harpoon Hunt — Edge Server Active", { status: 200 })
    );
  }
};
