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

interface LeaderboardEntry {
  callsign: string;
  max_distance: number;
  max_speed: number;
  survival_time: number;
  score: number;
  created_at: number;
}

interface RaceLeaderboardEntry {
  callsign: string;
  clear_time_sec: number;
  max_speed: number;
  gates_hit: number;
  score: number;
  created_at: number;
}

function sanitizeCallsign(raw: string | null | undefined): string {
  if (!raw) return "Hunter";
  const cleaned = raw.replace(/[^a-zA-Z0-9_\- ]/g, '').trim().slice(0, 12);
  return cleaned.length > 0 ? cleaned : "Hunter";
}

interface HitboxSnapshot {
  timestamp: number;
  x: number;
  z: number;
  state: string;
}

export class MountainDO extends DurableObject {
  private players = new Map<string, SkierState>();
  
  // Match Lifecycle States
  private matchState: "LOBBY_WAITING" | "COUNTDOWN_DROP" | "ACTIVE_HUNT" | "GONDOLA_REST" | "WIPEOUT" = "LOBBY_WAITING";
  private countdownTimer = 0;
  private restTimer = 0;
  private boulderSpawnTimer = 0;
  private boulders: Boulder[] = [];
  private recentHits: Array<{ timestamp: number; shooterId: string }> = [];

  // Yeti Boss State
  private yetiZ = 65;
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
  private hitboxHistory: HitboxSnapshot[] = [];
  
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

      CREATE TABLE IF NOT EXISTS race_leaderboard (
        id TEXT PRIMARY KEY,
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
      const modeParam = (url.searchParams.get("mode") === "slalom") ? "slalom" : "hunt";

      this.ctx.acceptWebSocket(server, [playerId]);
      server.serializeAttachment({ playerId, callsign, gameMode: modeParam });

      const initialX = (Math.random() - 0.5) * 25;
      this.players.set(playerId, {
        id: playerId,
        callsign,
        x: initialX,
        z: 0,
        speed: 0,
        steer: 0,
        state: 0,
        pitch: 0,
        score: 0,
        damageDealt: 0,
        shotsFired: 0,
        isDead: false,
        isReady: false,
        loadout: "rifle",
        gameMode: modeParam,
        lastActive: Date.now(),
        lastShotTime: 0
      });

      if (this.matchState === "ACTIVE_HUNT") {
        const p = this.players.get(playerId)!;
        p.speed = 32;
        p.z = furthestZ;
        p.isReady = true;
      }

      if (this.players.size === 1 && this.matchState === "LOBBY_WAITING") {
        this.ctx.storage.setAlarm(Date.now() + this.tickIntervalMs);
      }

      server.send(JSON.stringify({
        type: "WELCOME",
        playerId,
        callsign,
        gameMode: modeParam,
        matchState: this.matchState,
        wave: this.currentWave,
        yetiMaxHp: this.yetiMaxHp,
        yetiHp: this.yetiHp
      }));

      this.broadcastLobbyState();
      return new Response(null, { status: 101, webSocket: client });
    }

    if (url.pathname === "/scores" || url.pathname === "/api/scores") {
      const limitParam = parseInt(url.searchParams.get("limit") || "20", 10);
      const limit = Math.min(50, Math.max(1, isNaN(limitParam) ? 20 : limitParam));
      const topScores = this.getLeaderboard(limit);
      const topRaceScores = this.getRaceLeaderboard(limit);
      const recentKills = this.getRecentKills(10);
      return Response.json({
        success: true,
        leaderboard: topScores,
        raceLeaderboard: topRaceScores,
        recentKills,
        currentWave: this.currentWave,
        matchState: this.matchState
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
      const attachment = ws.deserializeAttachment() as { playerId: string; callsign: string; gameMode?: string };
      if (!attachment || !attachment.playerId) return;

      const player = this.players.get(attachment.playerId);
      if (!player) return;

      const data = typeof message === "string" ? JSON.parse(message) : null;
      if (!data || typeof data !== "object") return;

      // Handle Ready-Up in Chalet Staging Lobby
      if (data.type === "READY") {
        player.isReady = Boolean(data.ready);
        if (data.loadout) player.loadout = String(data.loadout);
        if (data.mode === "slalom" || data.mode === "hunt") player.gameMode = data.mode;
        this.broadcastLobbyState();
        this.checkAllReadyToLaunch();
        return;
      }

      // Handle Force Launch
      if (data.type === "FORCE_LAUNCH") {
        if (data.mode === "slalom" || data.mode === "hunt") player.gameMode = data.mode;
        this.startMatchCountdown();
        return;
      }

      // Handle Slalom Race Finish
      if (data.type === "RACE_FINISH") {
        const clearTimeSec = Math.max(1, Number(data.clearTimeSec) || 0);
        const maxSpeed = Math.max(1, Number(data.maxSpeed) || 0);
        const gatesHit = Math.max(0, Number(data.gatesHit) || 0);
        const raceScore = Math.max(0, Number(data.score) || 0);
        this.commitRaceScore(player, clearTimeSec, maxSpeed, gatesHit, raceScore);
        return;
      }

      if (player.isDead) return;

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
          this.checkTeamWipeout();
        }
      } else if (data.type === "REVIVE_TEAMMATE") {
        const targetId = String(data.targetId);
        const targetSkier = this.players.get(targetId);
        if (targetSkier && targetSkier.isDead) {
          targetSkier.isDead = false;
          targetSkier.z = player.z;
          targetSkier.x = player.x + (Math.random() - 0.5) * 4;
          targetSkier.speed = 25;
          player.score += 3000;
          this.broadcast({
            type: "TEAMMATE_REVIVED",
            reviverCallsign: player.callsign,
            revivedCallsign: targetSkier.callsign
          });
        }
      } else if (data.type === "SHOOT") {
        const now = Date.now();
        if (player.lastShotTime && now - player.lastShotTime < 110) {
          return;
        }
        player.lastShotTime = now;
        player.shotsFired++;
        
        if (this.yetiActive && this.yetiState !== "DEAD" && Boolean(data.hit)) {
          const isCrit = Boolean(data.crit);
          
          // Crossfire Combo Tracking
          this.recentHits.push({ timestamp: now, shooterId: player.id });
          this.recentHits = this.recentHits.filter(h => now - h.timestamp <= 1000);
          const distinctShooters = new Set(this.recentHits.map(h => h.shooterId)).size;
          const isCrossfire = distinctShooters >= 2;
          const crossfireMultiplier = isCrossfire ? 2.5 : 1.0;

          const baseDamage = isCrit ? Math.floor(750 + Math.random() * 250) : Math.floor(400 + Math.random() * 150);
          const damage = Math.floor(baseDamage * crossfireMultiplier);
          
          player.damageDealt += damage;
          player.score += damage * 2;
          this.yetiHp = Math.max(0, this.yetiHp - damage);

          if (isCrit || isCrossfire || Math.random() < 0.35) {
            this.yetiState = "STAGGERED";
            this.stateTimer = isCrossfire ? 1.5 : 0.9;
          }

          this.broadcast({
            type: "YETI_HIT",
            shooterId: player.id,
            shooterCallsign: player.callsign,
            damage,
            isCrit,
            isCrossfire,
            yetiHp: this.yetiHp,
            yetiMaxHp: this.yetiMaxHp
          });

          if (this.yetiHp <= 0) {
            this.handleYetiDefeated(player);
          }
        }
      }
    } catch (e) {
      console.error("DO WS Message error:", e);
    }
  }

  private handleYetiDefeated(killer: SkierState) {
    this.yetiState = "DEAD";
    this.yetiKillCount++;
    const clearTime = Math.max(1, (Date.now() - this.matchStartTime) / 1000);
    
    this.ctx.storage.sql.exec(`
      INSERT INTO yeti_kills (killer_callsign, wave, total_lobby_damage, clear_time_sec, created_at)
      VALUES (?, ?, ?, ?, ?);
    `, killer.callsign, this.currentWave, killer.damageDealt, clearTime, Date.now());

    this.matchState = "GONDOLA_REST";
    this.restTimer = 5.0;
    this.boulders = [];

    for (const p of this.players.values()) {
      p.isDead = false;
      p.score += 10000 * this.currentWave;
    }

    this.broadcast({
      type: "YETI_DEFEATED",
      killerCallsign: killer.callsign,
      wave: this.currentWave,
      clearTimeSec: clearTime,
      bonusScore: 10000 * this.currentWave,
      restDurationSec: 5.0
    });
  }

  private startMatchCountdown() {
    if (this.matchState === "COUNTDOWN_DROP" || this.matchState === "ACTIVE_HUNT") return;
    this.matchState = "COUNTDOWN_DROP";
    this.countdownTimer = 3.5;
    this.broadcast({
      type: "COUNTDOWN_START",
      countdownSeconds: 3
    });
  }

  private checkAllReadyToLaunch() {
    if (this.matchState !== "LOBBY_WAITING") return;
    const allPlayers = Array.from(this.players.values());
    if (allPlayers.length > 0 && allPlayers.every(p => p.isReady)) {
      this.startMatchCountdown();
    }
  }

  private checkTeamWipeout() {
    const allDead = Array.from(this.players.values()).every(p => p.isDead);
    if (allDead && this.players.size > 0 && this.matchState === "ACTIVE_HUNT") {
      this.matchState = "WIPEOUT";
      this.broadcast({
        type: "TEAM_WIPEOUT",
        waveReached: this.currentWave
      });
    }
  }

  private broadcastLobbyState() {
    this.broadcast({
      type: "LOBBY_STATE",
      matchState: this.matchState,
      countdownTimer: Math.ceil(this.countdownTimer),
      wave: this.currentWave,
      players: Array.from(this.players.values()).map(p => ({
        id: p.id,
        callsign: p.callsign,
        isReady: p.isReady,
        loadout: p.loadout,
        gameMode: p.gameMode,
        score: p.score
      }))
    });
  }

  async webSocketClose(ws: WebSocket) {
    const attachment = ws.deserializeAttachment() as { playerId: string } | null;
    if (attachment && attachment.playerId) {
      this.players.delete(attachment.playerId);
      this.broadcastLobbyState();
    }
  }

  async alarm() {
    const now = Date.now();
    const dt = this.tickIntervalMs / 1000;

    // 1. Handle Drop Countdown
    if (this.matchState === "COUNTDOWN_DROP") {
      this.countdownTimer -= dt;
      if (this.countdownTimer <= 0) {
        this.matchState = "ACTIVE_HUNT";
        this.matchStartTime = Date.now();
        this.currentWave = 1;
        
        const livingCount = Math.max(1, this.players.size);
        this.yetiMaxHp = Math.floor(8000 * Math.sqrt(livingCount));
        this.yetiHp = this.yetiMaxHp;
        this.yetiZ = 65;
        this.yetiX = 0;
        this.yetiState = "CHARGING";
        this.yetiActive = true;
        this.boulders = [];

        let idx = 0;
        for (const p of this.players.values()) {
          p.z = 0;
          p.x = (idx - (this.players.size - 1) / 2) * 6;
          p.speed = 35;
          p.isDead = false;
          p.damageDealt = 0;
          p.shotsFired = 0;
          idx++;
        }

        this.broadcast({
          type: "MATCH_LAUNCH",
          wave: this.currentWave,
          yetiMaxHp: this.yetiMaxHp
        });
      }
    }

    // 2. Handle Gondola Rest
    if (this.matchState === "GONDOLA_REST") {
      this.restTimer -= dt;
      if (this.restTimer <= 0) {
        this.currentWave++;
        this.matchState = "ACTIVE_HUNT";

        const livingCount = Math.max(1, Array.from(this.players.values()).filter(p => !p.isDead).length);
        this.yetiMaxHp = Math.floor(8000 * Math.pow(1.35, this.currentWave - 1) * Math.sqrt(livingCount));
        this.yetiHp = this.yetiMaxHp;
        this.yetiZ = (furthestZ || 0) + 65;
        this.yetiX = 0;
        this.yetiState = "CHARGING";
        this.boulders = [];

        this.broadcast({
          type: "NEXT_WAVE",
          wave: this.currentWave,
          yetiMaxHp: this.yetiMaxHp
        });
      }
    }

    let furthestSkierZ = 0;

    // 3. Skier Physics Loop
    if (this.matchState === "ACTIVE_HUNT" || this.matchState === "GONDOLA_REST") {
      for (const p of this.players.values()) {
        if (p.isDead) continue;

        let targetSpeed = 36;
        if (p.state === 1) targetSpeed = 75;

        p.speed += (targetSpeed - p.speed) * 0.06;
        p.z += p.speed * dt;
        
        const lateralSpeed = p.steer * 48;
        p.x += lateralSpeed * dt;
        p.x = Math.max(-120, Math.min(120, p.x));

        p.score += Math.floor(p.speed * 0.2);
        if (p.z > furthestSkierZ) furthestSkierZ = p.z;
      }
    }

    furthestZ = furthestSkierZ;

    // 4. Wave 2+ Boulder Spawning & Physics
    if (this.matchState === "ACTIVE_HUNT" && this.currentWave >= 2 && this.yetiActive && this.yetiState !== "DEAD") {
      this.boulderSpawnTimer += dt;
      const spawnInterval = Math.max(1.8, 3.2 - (this.currentWave * 0.3));
      if (this.boulderSpawnTimer >= spawnInterval) {
        this.boulderSpawnTimer = 0;
        this.boulders.push({
          id: `bld_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          x: this.yetiX + (Math.random() - 0.5) * 12,
          z: this.yetiZ - 4,
          vx: (Math.random() - 0.5) * 10,
          vz: -65 - (this.currentWave * 8),
          radius: 2.2 + Math.random() * 0.8
        });
      }

      for (let i = this.boulders.length - 1; i >= 0; i--) {
        const b = this.boulders[i];
        b.z += b.vz * dt;
        b.x += b.vx * dt;

        for (const p of this.players.values()) {
          if (p.isDead) continue;
          if (Math.abs(p.z - b.z) < 2.5 && Math.abs(p.x - b.x) < b.radius + 1.2) {
            this.broadcast({
              type: "BOULDER_HIT",
              victimId: p.id,
              victimCallsign: p.callsign,
              boulderId: b.id
            });
            this.boulders.splice(i, 1);
            break;
          }
        }

        if (b.z < -100 || (furthestSkierZ - b.z) > 120) {
          this.boulders.splice(i, 1);
        }
      }
    }

    // 5. Yeti Boss AI
    if (this.matchState === "ACTIVE_HUNT" && this.yetiActive && this.yetiState !== "DEAD") {
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
        this.yetiX += (targetPlayer.x - this.yetiX) * (0.12 + Math.min(0.08, this.currentWave * 0.02));

        if (this.yetiState === "STAGGERED") {
          this.stateTimer -= dt;
          this.yetiSpeed = 10;
          if (Math.abs(this.yetiZ - targetPlayer.z) > 65) {
            this.yetiZ = targetPlayer.z + (this.yetiZ > targetPlayer.z ? 65 : -65);
          }
          if (this.stateTimer <= 0) {
            this.yetiState = Math.random() < 0.4 ? "RETREATING" : "CHARGING";
            this.stateTimer = 2.0;
          }
        } else if (this.yetiState === "RETREATING") {
          this.stateTimer -= dt;
          this.yetiSpeed = 55;
          this.yetiZ += this.yetiSpeed * dt;
          const dist = this.yetiZ - targetPlayer.z;
          if (this.stateTimer <= 0 || Math.abs(dist) >= 65) {
            this.yetiState = "CHARGING";
            if (dist > 65) this.yetiZ = targetPlayer.z + 65;
            if (dist < -65) this.yetiZ = targetPlayer.z - 65;
          }
        } else if (this.yetiState === "CHARGING") {
          const waveSpeedBonus = (this.currentWave - 1) * 6;
          this.yetiSpeed = targetPlayer.speed + (targetPlayer.z > this.yetiZ ? (12 + waveSpeedBonus) : -18);
          this.yetiZ += this.yetiSpeed * dt;

          if (minDistance < 3.2 && Math.abs(targetPlayer.x - this.yetiX) < 4.5) {
            this.broadcast({
              type: "YETI_BITE_ATTACK",
              victimId: targetPlayer.id,
              victimCallsign: targetPlayer.callsign
            });
            this.yetiState = "RETREATING";
            this.stateTimer = 3.0;
            this.yetiZ = targetPlayer.z - 30;
          }
        }
      }
    }

    // 6. Broadcast 20Hz Frame
    const framePayload = {
      type: "FRAME",
      timestamp: now,
      matchState: this.matchState,
      countdownTimer: Math.max(0, Math.ceil(this.countdownTimer)),
      restTimer: Math.max(0, Math.ceil(this.restTimer)),
      wave: this.currentWave,
      boulders: this.boulders.map(b => ({
        id: b.id,
        x: Math.round(b.x * 10) / 10,
        z: Math.round(b.z * 10) / 10,
        radius: b.radius
      })),
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
        isDead: p.isDead,
        isReady: p.isReady,
        loadout: p.loadout,
        gameMode: p.gameMode
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

  private commitRaceScore(p: SkierState, clearTimeSec: number, maxSpeed: number, gatesHit: number, score: number) {
    try {
      this.ctx.storage.sql.exec(`
        INSERT INTO race_leaderboard (id, callsign, clear_time_sec, max_speed, gates_hit, score, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          clear_time_sec = MIN(clear_time_sec, excluded.clear_time_sec),
          gates_hit = MAX(gates_hit, excluded.gates_hit),
          score = MAX(score, excluded.score);
      `, p.id, p.callsign, clearTimeSec, maxSpeed, gatesHit, score, Date.now());
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

  private getRaceLeaderboard(limit = 20): RaceLeaderboardEntry[] {
    try {
      const cursor = this.ctx.storage.sql.exec<RaceLeaderboardEntry>(`
        SELECT callsign, clear_time_sec, max_speed, gates_hit, score, created_at
        FROM race_leaderboard
        ORDER BY clear_time_sec ASC, score DESC
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
