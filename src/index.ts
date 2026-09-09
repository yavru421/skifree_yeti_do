import { MountainDO } from "./MountainDO";

export { MountainDO };

export interface Env {
  MOUNTAIN_DO: DurableObjectNamespace<MountainDO>;
  ASSETS: Fetcher;
}

const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Content-Security-Policy":
    "default-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' https://cdnjs.cloudflare.com; script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' https://cdnjs.cloudflare.com https://yeti.dondlingergc.com https://static.cloudflareinsights.com; connect-src 'self' ws: wss: https:; media-src 'self' blob:; img-src 'self' data: blob:;"
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

    // 1. WebSocket Upgrade & Matchmaking Routing to MountainDO
    if (url.pathname.startsWith("/ws") || url.pathname.startsWith("/websocket")) {
      const upgradeHeader = request.headers.get("Upgrade");
      if (!upgradeHeader || upgradeHeader.toLowerCase() !== "websocket") {
        return new Response("Expected WebSocket upgrade", { status: 426 });
      }

      const requestedRoom = url.searchParams.get("room") || url.searchParams.get("roomId") || "alpine-lodge-1";
      const doId = env.MOUNTAIN_DO.idFromName(requestedRoom);
      const doStub = env.MOUNTAIN_DO.get(doId);

      url.searchParams.set("roomId", requestedRoom);
      const routedRequest = new Request(url.toString(), request);
      return doStub.fetch(routedRequest);
    }

    // 2. Leaderboard Scores Routing
    if (url.pathname === "/api/leaderboard" || url.pathname === "/api/scores") {
      const targetRoom = url.searchParams.get("room") || "GLOBAL_LEADERBOARD";
      const stub = env.MOUNTAIN_DO.get(env.MOUNTAIN_DO.idFromName(targetRoom));
      const res = await stub.fetch(request);
      return withSecurityHeaders(res);
    }

    // 3. Landing page & Game shortcuts
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

    // 4. Static Assets from public/
    if (env.ASSETS) {
      const assetRes = await env.ASSETS.fetch(request);
      return withSecurityHeaders(assetRes);
    }

    return withSecurityHeaders(
      new Response("SkiFree 2: Mountain Hunt — Edge Server Active", { status: 200 })
    );
  }
};
