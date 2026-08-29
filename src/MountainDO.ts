import { DurableObject } from "cloudflare:workers";

interface SkierState {
  id: string;
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
  lastActive: number;
}

interface LeaderboardEntry {
  callsign: string;
  max_distance: number;
  max_speed: number;
  survival_time: number;
  score: number;
  created_at: number;
}

function sanitizeCallsign(raw: string | null | undefined): string {
  if (!raw) return "Hunter";
  const cleaned = raw.replace(/[^a-zA-Z0-9_\- ]/g, '').trim().slice(0, 12);
  return cleaned.length > 0 ? cleaned : "Hunter";
}

export class MountainDO extends DurableObject {
  private players = new Map<string, SkierState & { lastShotTime?: number }>();
  
  // Yeti Boss State
  private yetiZ = 120;
  private yetiX = 0;
  private yetiSpeed = 38;
  private yetiActive = true;
  private yetiMaxHp = 8000;
  private yetiHp = 8000;
  private yetiState: "CHARGING" | "STAGGERED" | "RETREATING" | "DEAD" = "CHARGING";
  private stateTimer = 0;
  private currentWave = 1;
  private yetiKillCount = 0;
  private yetiTargetId: string | null = null;
  
  private matchStatus: "active" | "ended" = "active";
  private matchStartTime = 0;
  private tickIntervalMs = 50; // 20Hz tick

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.initDatabase();
  }

  private initDatabase() {
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS global_leaderboard (
        id TEXT PRIMARY KEY,
        callsign TEXT NOT NULL,
        max_distance INTEGER NOT NULL,
        max_speed REAL NOT NULL,
        survival_time REAL NOT NULL,
        score INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS yeti_kills (
        kill_id INTEGER PRIMARY KEY AUTOINCREMENT,
        killer_callsign TEXT NOT NULL,
        wave INTEGER NOT NULL,
        total_lobby_damage INTEGER NOT NULL,
        clear_time_sec REAL NOT NULL,
        created_at INTEGER NOT NULL
      );
    `);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/ws") {
      const upgradeHeader = request.headers.get("Upgrade");
      if (!upgradeHeader || upgradeHeader.toLowerCase() !== "websocket") {
        return new Response("Expected WebSocket Upgrade", { status: 426 });
      }

      const webSocketPair = new WebSocketPair();
      const [client, server] = Object.values(webSocketPair);

      const playerId = crypto.randomUUID().slice(0, 8);
      const rawCallsign = url.searchParams.get("callsign");
      const callsign = sanitizeCallsign(rawCallsign);

      this.ctx.acceptWebSocket(server, [playerId]);
      server.serializeAttachment({ playerId, callsign });

      this.players.set(playerId, {
        id: playerId,
        callsign,
        x: (Math.random() - 0.5) * 30,
        z: 0,
        speed: 35,
        steer: 0,
        state: 0,
        pitch: 0,
        score: 0,
        damageDealt: 0,
        shotsFired: 0,
        isDead: false,
        lastActive: Date.now(),
        lastShotTime: 0
      });

      if (this.players.size === 1) {
        this.matchStartTime = Date.now();
        this.yetiZ = 120;
        this.yetiHp = this.yetiMaxHp;
        this.yetiState = "CHARGING";
        this.yetiActive = true;
        this.currentWave = 1;
        this.ctx.storage.setAlarm(Date.now() + this.tickIntervalMs);
      }

      server.send(JSON.stringify({
        type: "WELCOME",
        playerId,
        callsign,
        wave: this.currentWave,
        yetiMaxHp: this.yetiMaxHp,
        yetiHp: this.yetiHp
      }));

      return new Response(null, { status: 101, webSocket: client });
    }

    if (url.pathname === "/scores" || url.pathname === "/api/scores") {
      const limitParam = parseInt(url.searchParams.get("limit") || "20", 10);
      const limit = Math.min(50, Math.max(1, isNaN(limitParam) ? 20 : limitParam));
      const topScores = this.getLeaderboard(limit);
      const recentKills = this.getRecentKills(10);
      return Response.json({
        success: true,
        leaderboard: topScores,
        recentKills,
        currentWave: this.currentWave
      }, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "public, max-age=5"
        }
      });
    }

    return new Response("MountainDO Active", { status: 200 });
  }

  async webSocketMessage(ws: WebSocket, message: ArrayBuffer | string) {
    try {
      const attachment = ws.deserializeAttachment() as { playerId: string; callsign: string };
      if (!attachment || !attachment.playerId) return;

      const player = this.players.get(attachment.playerId);
      if (!player || player.isDead) return;

      const data = typeof message === "string" ? JSON.parse(message) : null;
      if (!data || typeof data !== "object") return;

      if (data.type === "INPUT") {
        const rawSteer = Number(data.steer);
        player.steer = Math.max(-2.0, Math.min(2.0, isNaN(rawSteer) ? 0 : rawSteer));
        const isTuck = Boolean(data.tuck);
        const isJump = Boolean(data.jump);
        const rawPitch = Number(data.pitch);
        player.pitch = Math.max(-1.5, Math.min(1.5, isNaN(rawPitch) ? 0 : rawPitch));

        if (isJump) player.state = 2;
        else if (isTuck) player.state = 1;
        else player.state = 0;

        player.lastActive = Date.now();
      } else if (data.type === "PLAYER_DIED") {
        if (!player.isDead) {
          player.isDead = true;
          this.commitScore(player);
        }
      } else if (data.type === "SHOOT") {
        const now = Date.now();
        // Strict anti-cheat: rate limit shooting to minimum 120ms interval
        if (player.lastShotTime && now - player.lastShotTime < 120) {
          return;
        }
        player.lastShotTime = now;
        player.shotsFired++;
        
        if (this.yetiActive && this.yetiState !== "DEAD" && Boolean(data.hit)) {
          const isCrit = Boolean(data.crit);
          // Server calculates and enforces authoritative damage
          const damage = isCrit ? Math.floor(750 + Math.random() * 250) : Math.floor(400 + Math.random() * 150);
          
          player.damageDealt += damage;
          player.score += damage * 2;
          this.yetiHp = Math.max(0, this.yetiHp - damage);

          if (isCrit || Math.random() < 0.3) {
            this.yetiState = "STAGGERED";
            this.stateTimer = 1.0;
          }

          this.broadcast({
            type: "YETI_HIT",
            shooterId: player.id,
            shooterCallsign: player.callsign,
            damage,
            isCrit,
            yetiHp: this.yetiHp,
            yetiMaxHp: this.yetiMaxHp
          });

          if (this.yetiHp <= 0) {
            this.yetiState = "DEAD";
            this.yetiKillCount++;
            const clearTime = Math.max(1, (Date.now() - this.matchStartTime) / 1000);
            
            this.ctx.storage.sql.exec(`
              INSERT INTO yeti_kills (killer_callsign, wave, total_lobby_damage, clear_time_sec, created_at)
              VALUES (?, ?, ?, ?, ?);
            `, player.callsign, this.currentWave, player.damageDealt, clearTime, Date.now());

            this.broadcast({
              type: "YETI_DEFEATED",
              killerCallsign: player.callsign,
              wave: this.currentWave,
              clearTimeSec: clearTime,
              bonusScore: 10000 * this.currentWave
            });

            setTimeout(() => {
              this.currentWave++;
              this.yetiMaxHp = Math.floor(8000 * Math.pow(1.35, this.currentWave - 1));
              this.yetiHp = this.yetiMaxHp;
              this.yetiZ = (furthestZ || 0) + 160;
              this.yetiState = "CHARGING";
              this.broadcast({
                type: "NEXT_WAVE",
                wave: this.currentWave,
                yetiMaxHp: this.yetiMaxHp
              });
            }, 4000);
          }
        }
      }
    } catch (e) {
      console.error("DO WS Message error:", e);
    }
  }

  async webSocketClose(ws: WebSocket) {
    const attachment = ws.deserializeAttachment() as { playerId: string } | null;
    if (attachment && attachment.playerId) {
      this.players.delete(attachment.playerId);
    }
  }

  async alarm() {
    const now = Date.now();
    let anyAlive = false;
    let furthestSkierZ = 0;

    for (const [id, p] of this.players.entries()) {
      if (p.isDead) continue;
      anyAlive = true;

      let targetSpeed = 36;
      if (p.state === 1) targetSpeed = 75;

      p.speed += (targetSpeed - p.speed) * 0.06;
      p.z += p.speed * (this.tickIntervalMs / 1000);
      
      const lateralSpeed = p.steer * 48;
      p.x += lateralSpeed * (this.tickIntervalMs / 1000);
      p.x = Math.max(-120, Math.min(120, p.x));

      p.score += Math.floor(p.speed * 0.2);
      if (p.z > furthestSkierZ) furthestSkierZ = p.z;
    }

    furthestZ = furthestSkierZ;

    // Yeti Charging & Biting AI
    if (this.yetiActive && this.yetiState !== "DEAD") {
      let targetPlayer: SkierState | null = null;
      let minDistance = Infinity;

      for (const p of this.players.values()) {
        if (p.isDead) continue;
        const dist = Math.abs(p.z - this.yetiZ);
        if (dist < minDistance) {
          minDistance = dist;
          targetPlayer = p;
        }
      }

      if (targetPlayer) {
        this.yetiTargetId = targetPlayer.id;
        this.yetiX += (targetPlayer.x - this.yetiX) * 0.14;

        if (this.yetiState === "STAGGERED") {
          this.stateTimer -= this.tickIntervalMs / 1000;
          this.yetiSpeed = 10;
          if (this.stateTimer <= 0) {
            this.yetiState = Math.random() < 0.4 ? "RETREATING" : "CHARGING";
            this.stateTimer = 2.0;
          }
        } else if (this.yetiState === "RETREATING") {
          this.stateTimer -= this.tickIntervalMs / 1000;
          this.yetiSpeed = 55;
          this.yetiZ += this.yetiSpeed * (this.tickIntervalMs / 1000);
          if (this.stateTimer <= 0 || (this.yetiZ - targetPlayer.z) > 100) {
            this.yetiState = "CHARGING";
          }
        } else if (this.yetiState === "CHARGING") {
          const relativeSpeed = targetPlayer.z > this.yetiZ ? 58 : -25;
          this.yetiSpeed = targetPlayer.speed + (targetPlayer.z > this.yetiZ ? 12 : -18);
          this.yetiZ += this.yetiSpeed * (this.tickIntervalMs / 1000);

          // Yeti Attack Bite: Dispatches bite attack, takes limb/heart, pushes Yeti back so player keeps skiing!
          if (minDistance < 3.2 && Math.abs(targetPlayer.x - this.yetiX) < 4.5) {
            this.broadcast({
              type: "YETI_BITE_ATTACK",
              victimId: targetPlayer.id,
              victimCallsign: targetPlayer.callsign
            });
            // Yeti bites and bounds away!
            this.yetiState = "RETREATING";
            this.stateTimer = 3.0;
            this.yetiZ -= 30; // Push Yeti back 30m
          }
        }
      }
    }

    const framePayload = {
      type: "FRAME",
      timestamp: now,
      wave: this.currentWave,
      yeti: {
        active: this.yetiActive,
        state: this.yetiState,
        hp: this.yetiHp,
        maxHp: this.yetiMaxHp,
        x: Math.round(this.yetiX * 10) / 10,
        z: Math.round(this.yetiZ * 10) / 10,
        targetId: this.yetiTargetId
      },
      skiers: Array.from(this.players.values()).map(p => ({
        id: p.id,
        callsign: p.callsign,
        x: Math.round(p.x * 10) / 10,
        z: Math.round(p.z * 10) / 10,
        speedMph: Math.floor(p.speed * 2.237),
        steer: p.steer,
        state: p.state,
        score: p.score,
        damageDealt: p.damageDealt,
        isDead: p.isDead
      }))
    };

    this.broadcast(framePayload);

    if (this.players.size > 0) {
      this.ctx.storage.setAlarm(Date.now() + this.tickIntervalMs);
    }
  }

  private broadcast(data: any) {
    const json = JSON.stringify(data);
    for (const ws of this.ctx.getWebSockets()) {
      try { ws.send(json); } catch (e) {}
    }
  }

  private commitScore(p: SkierState) {
    try {
      const maxSpeedMph = Math.round(p.speed * 2.237 * 10) / 10;
      this.ctx.storage.sql.exec(`
        INSERT INTO global_leaderboard (id, callsign, max_distance, max_speed, survival_time, score, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          score = MAX(score, excluded.score),
          max_distance = MAX(max_distance, excluded.max_distance);
      `, p.id, p.callsign, Math.floor(p.z), maxSpeedMph, p.damageDealt, p.score, Date.now());
    } catch (e) {}
  }

  private getLeaderboard(limit = 20): LeaderboardEntry[] {
    try {
      const cursor = this.ctx.storage.sql.exec<LeaderboardEntry>(`
        SELECT callsign, max_distance, max_speed, survival_time, score, created_at
        FROM global_leaderboard
        ORDER BY score DESC
        LIMIT ?;
      `, limit);
      return cursor.toArray();
    } catch (e) {
      return [];
    }
  }

  private getRecentKills(limit = 10): any[] {
    try {
      const cursor = this.ctx.storage.sql.exec(`
        SELECT killer_callsign, wave, total_lobby_damage, clear_time_sec, created_at
        FROM yeti_kills
        ORDER BY created_at DESC
        LIMIT ?;
      `, limit);
      return cursor.toArray();
    } catch (e) {
      return [];
    }
  }
}

let furthestZ = 0;
