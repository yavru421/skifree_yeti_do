import { DurableObject } from "cloudflare:workers";

interface SkierState {
  id: string;
  hunterId: string;
  callsign: string;
  x: number;
  z: number;
  speed: number;
  steer: number;
  state: number;
  pitch: number;
  score: number;
  damageDealt: number;
  shotsFired: number;
  isDead: boolean;
  isReady: boolean;
  loadout: string;
  gameMode: "hunt" | "slalom";
  lastActive: number;
  lastShotTime?: number;
}

interface Boulder {
  id: string;
  x: number;
  z: number;
  vx: number;
  vz: number;
  radius: number;
}

function sanitizeCallsign(raw: string | null | undefined): string {
  if (!raw) return "Hunter";
  const cleaned = raw.replace(/[^a-zA-Z0-9_\- ]/g, '').trim().slice(0, 12);
  return cleaned.length > 0 ? cleaned : "Hunter";
}

async function hashPin(pin: string): Promise<string> {
  const enc = new TextEncoder().encode("skifree_salt_" + (pin || "0000"));
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export class MountainDO extends DurableObject {
  private players = new Map<string, SkierState>();
  
  // Match Lifecycle States
  private matchState: "LOBBY_WAITING" | "COUNTDOWN_DROP" | "ACTIVE_HUNT" | "GONDOLA_REST" | "WIPEOUT" = "LOBBY_WAITING";
  private countdownTimer = 0;
  private restTimer = 0;
  private boulders: Boulder[] = [];

  // Yeti Boss State
  private yetiZ = 65;
  private yetiX = 0;
  private yetiActive = true;
  private yetiMaxHp = 8000;
  private yetiHp = 8000;
  private yetiState: "CHARGING" | "STAGGERED" | "RETREATING" | "DEAD" = "CHARGING";
  private currentWave = 1;
  private yetiKillCount = 0;
  
  private matchStartTime = 0;
  private tickIntervalMs = 50; // 20Hz tick

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.initDatabase();
  }

  private initDatabase() {
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS hunter_profiles (
        callsign TEXT PRIMARY KEY,
        pin_hash TEXT NOT NULL,
        hunter_id TEXT,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS global_leaderboard (
        id TEXT PRIMARY KEY,
        hunter_id TEXT,
        callsign TEXT NOT NULL,
        max_distance INTEGER NOT NULL,
        max_speed REAL NOT NULL,
        survival_time REAL NOT NULL,
        score INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS race_leaderboard (
        id TEXT PRIMARY KEY,
        hunter_id TEXT,
        callsign TEXT NOT NULL,
        clear_time_sec REAL NOT NULL,
        max_speed REAL NOT NULL,
        gates_hit INTEGER NOT NULL,
        score INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS yeti_kills (
        kill_id INTEGER PRIMARY KEY AUTOINCREMENT,
        killer_callsign TEXT NOT NULL,
        wave_number INTEGER NOT NULL,
        killer_score INTEGER NOT NULL,
        squad_size INTEGER NOT NULL,
        timestamp INTEGER NOT NULL
      );
    `);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // 1. Leaderboard Scores API endpoint
    if (url.pathname === "/api/scores" || url.pathname === "/scores" || url.pathname === "/api/leaderboard") {
      const huntBoard = [...this.ctx.storage.sql.exec(
        "SELECT callsign, score, max_speed, created_at FROM global_leaderboard ORDER BY score DESC LIMIT 10"
      )];
      const raceBoard = [...this.ctx.storage.sql.exec(
        "SELECT callsign, clear_time_sec, gates_hit, max_speed, score, created_at FROM race_leaderboard ORDER BY clear_time_sec ASC, score DESC LIMIT 10"
      )];

      return new Response(JSON.stringify({
        leaderboard: huntBoard,
        raceLeaderboard: raceBoard
      }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // 2. PIN-Protected Score Publishing Endpoint
    if (url.pathname === "/api/publish-score" && request.method === "POST") {
      try {
        const body = await request.json() as any;
        const callsign = sanitizeCallsign(body.callsign);
        const pin = String(body.pin || "0000").trim();
        const pinH = await hashPin(pin);
        const hunterId = String(body.hunterId || crypto.randomUUID());
        const mode = body.mode || "hunt";
        const score = Number(body.score) || 0;
        const maxSpeed = Number(body.maxSpeed) || 0;

        // Check if callsign profile exists
        const existing = [...this.ctx.storage.sql.exec(
          "SELECT callsign, pin_hash FROM hunter_profiles WHERE callsign = ?",
          callsign
        )];

        if (existing.length > 0) {
          const profile = existing[0] as { callsign: string; pin_hash: string };
          if (profile.pin_hash !== pinH) {
            return new Response(JSON.stringify({
              success: false,
              error: `❌ Callsign "${callsign}" is claimed! Enter the correct PIN or pick a new name.`
            }), { status: 403, headers: { "Content-Type": "application/json" } });
          }
        } else {
          // Register new hunter callsign with their chosen PIN
          this.ctx.storage.sql.exec(
            "INSERT INTO hunter_profiles (callsign, pin_hash, hunter_id, created_at) VALUES (?, ?, ?, ?)",
            callsign, pinH, hunterId, Date.now()
          );
        }

        // Record verified score
        const recordId = crypto.randomUUID();
        if (mode === "slalom") {
          const clearTimeSec = Number(body.clearTimeSec) || 0;
          const gatesHit = Number(body.gatesHit) || 0;
          this.ctx.storage.sql.exec(
            "INSERT INTO race_leaderboard (id, hunter_id, callsign, clear_time_sec, max_speed, gates_hit, score, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            recordId, hunterId, callsign, clearTimeSec, maxSpeed, gatesHit, score, Date.now()
          );
        } else {
          const maxDist = Number(body.maxDistance) || 0;
          const survivalTime = Number(body.survivalTime) || 0;
          this.ctx.storage.sql.exec(
            "INSERT INTO global_leaderboard (id, hunter_id, callsign, max_distance, max_speed, survival_time, score, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            recordId, hunterId, callsign, maxDist, maxSpeed, survivalTime, score, Date.now()
          );
        }

        return new Response(JSON.stringify({
          success: true,
          callsign,
          message: `🏆 Verified! Score published under "${callsign}".`
        }), { status: 200, headers: { "Content-Type": "application/json" } });

      } catch (e: any) {
        return new Response(JSON.stringify({ success: false, error: e.message }), { status: 500 });
      }
    }

    // 3. WebSocket Upgrade Routing
    if (request.headers.get("Upgrade") === "websocket") {
      const pair = new WebSocketPair();
      const clientWs = pair[0];
      const serverWs = pair[1];

      const rawCallsign = url.searchParams.get("callsign");
      const hunterId = url.searchParams.get("hunterId") || crypto.randomUUID();
      const validatedCallsign = sanitizeCallsign(rawCallsign);
      const mode = (url.searchParams.get("mode") || "hunt") as "hunt" | "slalom";

      const playerId = crypto.randomUUID();
      this.ctx.acceptWebSocket(serverWs, [playerId]);

      const newSkier: SkierState = {
        id: playerId,
        hunterId,
        callsign: validatedCallsign,
        x: (Math.random() - 0.5) * 10,
        z: 0,
        speed: 24,
        steer: 0,
        state: 0,
        pitch: 0,
        score: 0,
        damageDealt: 0,
        shotsFired: 0,
        isDead: false,
        isReady: false,
        loadout: "rifle",
        gameMode: mode,
        lastActive: Date.now()
      };

      this.players.set(playerId, newSkier);

      serverWs.send(JSON.stringify({
        type: "WELCOME",
        playerId,
        callsign: validatedCallsign,
        matchState: this.matchState,
        wave: this.currentWave,
        yetiHp: this.yetiHp,
        yetiMaxHp: this.yetiMaxHp
      }));

      this.broadcastLobbyState();
      this.ensureGameLoop();

      return new Response(null, { status: 101, webSocket: clientWs });
    }

    return new Response("MountainDO Active", { status: 200 });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    if (typeof message !== "string") return;
    try {
      const data = JSON.parse(message);
      const tags = this.ctx.getTags(ws);
      const playerId = tags[0];
      const player = this.players.get(playerId);
      if (!player) return;

      player.lastActive = Date.now();

      if (data.type === "INPUT") {
        player.steer = data.steer || 0;
        player.pitch = data.pitch || 0;
      } else if (data.type === "READY") {
        player.isReady = !!data.ready;
        player.gameMode = data.mode === "slalom" ? "slalom" : "hunt";
        this.broadcastLobbyState();
        this.checkAllReady();
      } else if (data.type === "FORCE_LAUNCH") {
        player.gameMode = data.mode === "slalom" ? "slalom" : "hunt";
        this.startMatchCountdown();
      } else if (data.type === "SHOOT") {
        player.shotsFired++;
        if (data.hit && this.matchState === "ACTIVE_HUNT" && this.yetiHp > 0) {
          const dmg = data.crit ? 250 : 100;
          this.yetiHp = Math.max(0, this.yetiHp - dmg);
          player.damageDealt += dmg;
          player.score += dmg;

          this.broadcast({
            type: "YETI_HIT",
            shooterId: playerId,
            damage: dmg,
            isCrit: !!data.crit,
            yetiHp: this.yetiHp
          });

          if (this.yetiHp <= 0) {
            this.handleYetiDefeated(player);
          }
        }
      } else if (data.type === "PLAYER_DIED") {
        player.isDead = true;
      }
    } catch (e) {}
  }

  async webSocketClose(ws: WebSocket) {
    const tags = this.ctx.getTags(ws);
    const playerId = tags[0];
    if (playerId) {
      this.players.delete(playerId);
      this.broadcastLobbyState();
    }
  }

  private broadcastLobbyState() {
    const skierList = Array.from(this.players.values()).map(p => ({
      id: p.id,
      callsign: p.callsign,
      isReady: p.isReady,
      gameMode: p.gameMode
    }));

    this.broadcast({
      type: "LOBBY_STATE",
      players: skierList
    });
  }

  private checkAllReady() {
    if (this.players.size === 0) return;
    const allReady = Array.from(this.players.values()).every(p => p.isReady);
    if (allReady && this.matchState === "LOBBY_WAITING") {
      this.startMatchCountdown();
    }
  }

  private startMatchCountdown() {
    this.matchState = "COUNTDOWN_DROP";
    this.countdownTimer = 3;
    this.broadcast({ type: "COUNTDOWN_START", countdownSeconds: 3 });

    const countdownInterval = setInterval(() => {
      this.countdownTimer--;
      if (this.countdownTimer <= 0) {
        clearInterval(countdownInterval);
        this.launchMatch();
      }
    }, 1000);
  }

  private launchMatch() {
    this.matchState = "ACTIVE_HUNT";
    this.matchStartTime = Date.now();
    this.yetiHp = 8000 * this.currentWave;
    this.yetiMaxHp = this.yetiHp;
    this.yetiZ = 65;
    this.yetiX = 0;
    this.boulders = [];

    this.players.forEach(p => {
      p.z = 0;
      p.x = (Math.random() - 0.5) * 8;
      p.isDead = false;
      p.damageDealt = 0;
      p.score = 0;
    });

    this.broadcast({
      type: "MATCH_LAUNCH",
      wave: this.currentWave,
      yetiHp: this.yetiHp,
      yetiMaxHp: this.yetiMaxHp
    });
  }

  private handleYetiDefeated(killer: SkierState) {
    this.yetiKillCount++;
    this.matchState = "GONDOLA_REST";
    this.restTimer = 5;

    this.ctx.storage.sql.exec(
      "INSERT INTO yeti_kills (killer_callsign, wave_number, killer_score, squad_size, timestamp) VALUES (?, ?, ?, ?, ?)",
      killer.callsign, this.currentWave, killer.score, this.players.size, Date.now()
    );

    this.broadcast({
      type: "YETI_DEFEATED",
      wave: this.currentWave,
      killer: killer.callsign
    });

    setTimeout(() => {
      this.currentWave++;
      this.matchState = "ACTIVE_HUNT";
      this.yetiHp = 8000 * this.currentWave;
      this.yetiMaxHp = this.yetiHp;
      this.yetiZ = 70;
      this.players.forEach(p => p.isDead = false);

      this.broadcast({
        type: "NEXT_WAVE",
        wave: this.currentWave,
        yetiHp: this.yetiHp,
        yetiMaxHp: this.yetiMaxHp
      });
    }, 5000);
  }

  private ensureGameLoop() {
    if ((this as any)._loopRunning) return;
    (this as any)._loopRunning = true;

    const tick = () => {
      if (this.players.size === 0) {
        (this as any)._loopRunning = false;
        return;
      }

      if (this.matchState === "ACTIVE_HUNT") {
        this.yetiZ = Math.max(-20, this.yetiZ - 0.08);

        const skiers = Array.from(this.players.values()).map(p => ({
          id: p.id,
          callsign: p.callsign,
          x: p.x,
          z: p.z,
          steer: p.steer,
          isDead: p.isDead,
          damageDealt: p.damageDealt,
          score: p.score
        }));

        this.broadcast({
          type: "FRAME",
          wave: this.currentWave,
          yeti: {
            x: this.yetiX,
            z: this.yetiZ,
            hp: this.yetiHp,
            maxHp: this.yetiMaxHp,
            state: this.yetiState,
            active: this.yetiActive
          },
          skiers,
          boulders: this.boulders
        });
      }

      setTimeout(tick, this.tickIntervalMs);
    };

    tick();
  }

  private broadcast(msg: any) {
    const payload = JSON.stringify(msg);
    this.ctx.getWebSockets().forEach(ws => {
      try { ws.send(payload); } catch (e) {}
    });
  }
}
