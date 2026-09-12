export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Global CORS Preflight
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

    // API: Global Leaderboard (Stateless D1)
    if (url.pathname === "/api/scores") {
      if (request.method === "POST") {
        try {
          const body: any = await request.json();
          let rawCallsign = typeof body.callsign === "string" ? body.callsign.trim() : "";
          const callsign = rawCallsign.replace(/[^a-zA-Z0-9_\- ]/g, "").slice(0, 16) || "SKIER_PRO";
          const wave = Math.max(1, parseInt(body.wave) || 1);
          const score = Math.max(0, parseInt(body.score) || 0);
          const time_ms = typeof body.time_ms === "number" ? Math.max(0, Math.round(body.time_ms)) : null;
          const now = Date.now();

          if (env.DB) {
            await env.DB.prepare(
              `INSERT INTO global_leaderboard (callsign, wave, score, time_ms, timestamp) VALUES (?, ?, ?, ?, ?)`
            ).bind(callsign, wave, score, time_ms, now).run();
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
        if (env.DB) {
          const { results } = await env.DB.prepare(
            `SELECT callsign, wave, score, time_ms, timestamp FROM global_leaderboard ORDER BY score DESC LIMIT 50`
          ).all();

          return new Response(JSON.stringify(results || []), {
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
              "Cache-Control": "public, max-age=15"
            }
          });
        }
        return new Response(JSON.stringify([]), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    // API: Beta Player Feedback (Stateless D1)
    if (url.pathname === "/api/feedback") {
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
              headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
            });
          }
          const details = rawDetails.slice(0, 1500);
          const deviceInfo = body.device_info ? String(body.device_info).slice(0, 300) : "";
          const now = Date.now();

          if (env.DB) {
            await env.DB.prepare(
              `INSERT INTO beta_feedback (callsign, category, title, details, status, device_info, timestamp) VALUES (?, ?, ?, ?, 'open', ?, ?)`
            ).bind(callsign, category, title, details, deviceInfo, now).run();
          }

          return new Response(JSON.stringify({ success: true, callsign, category, title, timestamp: now }), {
            status: 201,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
          });
        } catch (err: any) {
          return new Response(JSON.stringify({ error: err.message }), {
            status: 400,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
          });
        }
      }

      // GET /api/feedback
      try {
        if (env.DB) {
          const { results } = await env.DB.prepare(
            `SELECT id, callsign, category, title, details, status, device_info, timestamp FROM beta_feedback ORDER BY timestamp DESC LIMIT 50`
          ).all();
          return new Response(JSON.stringify(results || []), {
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
              "Cache-Control": "public, max-age=15"
            }
          });
        }
        return new Response(JSON.stringify([]), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    // Rewrite /dist/bundle.js to /bundle.js
    if (url.pathname === "/dist/bundle.js") {
      url.pathname = "/bundle.js";
      return env.ASSETS.fetch(new Request(url.toString(), request));
    }

    // Default: Serve static PWA assets from /public
    return env.ASSETS.fetch(request);
  }
};