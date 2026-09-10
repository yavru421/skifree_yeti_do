import { MountainDO, Env } from "./MountainDO";

export { MountainDO };

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // WebMCP Interceptor / Bridge.js endpoint handler
    if (url.pathname === "/mcp" || url.pathname === "/mcp/") {
      if (request.method === "OPTIONS") {
        return new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "*"
          }
        });
      }
      return new Response(JSON.stringify({
        jsonrpc: "2.0",
        result: {
          tools: []
        }
      }), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }

    if (url.pathname === "/ws" || url.pathname === "/status" || url.pathname === "/api/telemetry") {
      if (request.method === "OPTIONS") {
        return new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "*"
          }
        });
      }
      const id = env.MOUNTAIN_DO.idFromName("global-mountain-lobby");
      const stub = env.MOUNTAIN_DO.get(id);
      return stub.fetch(request);
    }

    if (url.pathname === "/api/scores") {
      try {
        const { results } = await env.DB.prepare(
          `SELECT callsign, wave, score, timestamp FROM global_leaderboard ORDER BY score DESC LIMIT 50`
        ).all();

        return new Response(JSON.stringify(results), {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "public, max-age=10"
          }
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    // Stale path alias fallback: rewrite /dist/bundle.js to /bundle.js
    if (url.pathname === "/dist/bundle.js") {
      url.pathname = "/bundle.js";
      return env.ASSETS.fetch(new Request(url.toString(), request));
    }

    return env.ASSETS.fetch(request);
  }
};
