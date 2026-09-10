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

      if (request.method === "POST") {
        try {
          const body: any = await request.json();
          let rawCallsign = typeof body.callsign === "string" ? body.callsign.trim() : "";
          const callsign = rawCallsign.replace(/[^a-zA-Z0-9_\- ]/g, "").slice(0, 16) || "SKIER_PRO";
          const wave = Math.max(1, parseInt(body.wave) || 1);
          const score = Math.max(0, parseInt(body.score) || 0);
          const time_ms = typeof body.time_ms === "number" ? Math.max(0, Math.round(body.time_ms)) : null;
          const now = Date.now();

          // Insert into D1
          await env.DB.prepare(
            `INSERT INTO global_leaderboard (callsign, wave, score, time_ms, timestamp) VALUES (?, ?, ?, ?, ?)`
          ).bind(callsign, wave, score, time_ms, now).run();

          // Sync into MountainDO storage & lobby
          try {
            const id = env.MOUNTAIN_DO.idFromName("global-mountain-lobby");
            const stub = env.MOUNTAIN_DO.get(id);
            await stub.fetch(new Request("https://internal/record-score", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ callsign, wave, score, time_ms, timestamp: now })
            }));
          } catch (doErr) {
            console.warn("[Index] DO sync error:", doErr);
          }

          return new Response(JSON.stringify({ success: true, callsign, score, wave }), {
            status: 201,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*"
            }
          });
        } catch (err: any) {
          return new Response(JSON.stringify({ error: err.message }), {
            status: 400,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*"
            }
          });
        }
      }

      // GET /api/scores
      try {
        const { results } = await env.DB.prepare(
          `SELECT callsign, wave, score, time_ms, timestamp FROM global_leaderboard ORDER BY score DESC LIMIT 50`
        ).all();

        return new Response(JSON.stringify(results), {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "public, max-age=5"
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
