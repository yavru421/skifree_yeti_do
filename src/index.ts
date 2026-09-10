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

    if (url.pathname === "/api/feedback") {
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
          const rawCallsign = typeof body.callsign === "string" ? body.callsign.trim() : "";
          const callsign = rawCallsign.replace(/[^a-zA-Z0-9_\- ]/g, "").slice(0, 16) || "SKIER_BETA";
          
          const allowedCategories = ["bug", "balance", "idea", "audio_visual", "other"];
          const rawCategory = typeof body.category === "string" ? body.category.toLowerCase().trim() : "bug";
          const category = allowedCategories.includes(rawCategory) ? rawCategory : "bug";

          const rawTitle = typeof body.title === "string" ? body.title.trim() : "";
          const title = rawTitle.slice(0, 100) || "Player Feedback";

          const rawDetails = typeof body.details === "string" ? body.details.trim() : "";
          if (!rawDetails) {
            return new Response(JSON.stringify({ error: "Details description is required" }), {
              status: 400,
              headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
              }
            });
          }
          const details = rawDetails.slice(0, 1500);

          let deviceInfo = "";
          if (body.device_info) {
            deviceInfo = typeof body.device_info === "string" 
              ? body.device_info.slice(0, 300) 
              : JSON.stringify(body.device_info).slice(0, 300);
          }

          const now = Date.now();

          const insertRes = await env.DB.prepare(
            `INSERT INTO beta_feedback (callsign, category, title, details, status, device_info, timestamp) VALUES (?, ?, ?, ?, 'open', ?, ?)`
          ).bind(callsign, category, title, details, deviceInfo, now).run();

          return new Response(JSON.stringify({
            success: true,
            id: insertRes.meta?.last_row_id || null,
            callsign,
            category,
            title,
            timestamp: now
          }), {
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

      // GET /api/feedback
      try {
        const { results } = await env.DB.prepare(
          `SELECT id, callsign, category, title, details, status, device_info, timestamp FROM beta_feedback ORDER BY timestamp DESC LIMIT 50`
        ).all();

        return new Response(JSON.stringify(results || []), {
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
