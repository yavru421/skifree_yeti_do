import { MountainDO } from "./MountainDO";

export { MountainDO };

export interface Env {
  MOUNTAIN_DO: DurableObjectNamespace<MountainDO>;
  ASSETS: Fetcher;
  MEDIA_BUCKET: R2Bucket;
}

const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Content-Security-Policy": "default-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://*.googlesyndication.com https://*.google.com https://*.doubleclick.net; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://pagead2.googlesyndication.com https://*.googlesyndication.com https://*.google.com; connect-src 'self' ws: wss: https://*.googlesyndication.com https://*.google.com; media-src 'self' blob: https:; img-src 'self' data: blob: https://*.google.com https://*.googlesyndication.com https://*.doubleclick.net; frame-src 'self' https://*.google.com https://*.googlesyndication.com https://*.doubleclick.net;"
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

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // 1. High-Performance R2 Video Streaming with native Range slicing
    if (url.pathname.includes("teaser_trailer.mp4") || url.pathname.includes("intro.mp4")) {
      if (env.MEDIA_BUCKET) {
        const object = await env.MEDIA_BUCKET.get("teaser_trailer.mp4", {
          range: request.headers,
          onlyIf: request.headers,
        });

        if (object) {
          const headers = new Headers();
          object.writeHttpMetadata(headers);
          headers.set("etag", object.httpEtag);
          headers.set("Content-Type", "video/mp4");
          headers.set("Accept-Ranges", "bytes");
          headers.set("Cache-Control", "public, max-age=31536000, immutable");

          const status = object.range ? 206 : 200;
          return new Response(object.body, {
            headers,
            status
          });
        }
      }
    }

    // 2. WebSocket upgrade routing to Durable Object Room
    if (url.pathname.startsWith("/ws")) {
      const upgradeHeader = request.headers.get("Upgrade");
      if (upgradeHeader && upgradeHeader.toLowerCase() === "websocket") {
        const roomId = url.searchParams.get("room") || "main-alps";
        const doId = env.MOUNTAIN_DO.idFromName(roomId);
        const doStub = env.MOUNTAIN_DO.get(doId);
        return doStub.fetch(request);
      }
    }

    // 3. API Scores / Leaderboard endpoint
    if (url.pathname === "/api/scores" || url.pathname === "/scores" || url.pathname === "/api/leaderboard") {
      const roomId = url.searchParams.get("room") || "main-alps";
      const doId = env.MOUNTAIN_DO.idFromName(roomId);
      const doStub = env.MOUNTAIN_DO.get(doId);
      const res = await doStub.fetch(request);
      return withSecurityHeaders(res);
    }

    // 4. Landing page & Game shortcuts
    if (url.pathname === "/" || url.pathname === "/landing") {
      const landingReq = new Request(new URL("/landing.html", request.url), request);
      const res = await env.ASSETS.fetch(landingReq);
      return withSecurityHeaders(res);
    }
    if (url.pathname === "/play" || url.pathname === "/game") {
      const gameReq = new Request(new URL("/index.html", request.url), request);
      const res = await env.ASSETS.fetch(gameReq);
      return withSecurityHeaders(res);
    }

    // 5. Static Assets from public/
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return withSecurityHeaders(new Response("SkiFree 2 Edge Server Active", { status: 200 }));
  }
};
