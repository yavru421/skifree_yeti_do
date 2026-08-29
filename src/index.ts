import { MountainDO } from "./MountainDO";

export { MountainDO };

export interface Env {
  MOUNTAIN_DO: DurableObjectNamespace<MountainDO>;
  ASSETS: Fetcher;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // WebSocket upgrade routing to Durable Object Room
    if (url.pathname.startsWith("/ws")) {
      const upgradeHeader = request.headers.get("Upgrade");
      if (upgradeHeader && upgradeHeader.toLowerCase() === "websocket") {
        const roomId = url.searchParams.get("room") || "main-alps";
        const doId = env.MOUNTAIN_DO.idFromName(roomId);
        const doStub = env.MOUNTAIN_DO.get(doId);
        return doStub.fetch(request);
      }
    }

    // API Scores endpoint
    if (url.pathname === "/api/scores") {
      const roomId = url.searchParams.get("room") || "main-alps";
      const doId = env.MOUNTAIN_DO.idFromName(roomId);
      const doStub = env.MOUNTAIN_DO.get(doId);
      return doStub.fetch(request);
    }

    // Landing page & Game shortcuts
    if (url.pathname === "/" || url.pathname === "/landing") {
      const landingReq = new Request(new URL("/landing.html", request.url), request);
      return env.ASSETS.fetch(landingReq);
    }
    if (url.pathname === "/play" || url.pathname === "/game") {
      const gameReq = new Request(new URL("/index.html", request.url), request);
      return env.ASSETS.fetch(gameReq);
    }

    // Static Assets from public/
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response("SkiFree 2 Edge Server Active", { status: 200 });
  }
};
