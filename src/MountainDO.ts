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

interface NPCState {
  id: string;
  x: number;
  z: number;
  speed: number;
  steer: number;
  color: string;
  type: "skier" | "snowboarder" | "speedster";
  isEaten: boolean;
  isRescued: boolean;
  eatTimer?: number;
}

interface Boulder {
  id: string;
  x: number;
  z: number;
  vx: number;
  vz: number;
  radius: number;
}

interface BaitItem {
  id: string;
  dropperId: string;
  x: number;
  z: number;
  createdAt: number;
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

const NPC_COLORS = [
  "#ff0055", // Neon Magenta
  "#00f0ff", // Alpine Cyan
  "#39ff14", // Acid Green
  "#ffff00", // Retro Yellow
  "#ff7700", // Blaze Orange
  "#aa00ff", // Electric Purple
  "#0088ff"  // Royal Blue
];

export class MountainDO extends DurableObject {
  private players = new Map<string, SkierState>();
  
  // Match Lifecycle States
  private matchState: "LOBBY_WAITING" | "COUNTDOWN_DROP" | "ACTIVE_HUNT" | "GONDOLA_REST" | "WIPEOUT" = "LOBBY_WAITING";
  private countdownTimer = 0;
  private restTimer = 0;
  private boulders: Boulder[] = [];
  private activeBaitItems: BaitItem[] = [];
  private npcs: NPCState[] = [];

  // Yeti Boss State
  private yetiZ = 35;
  private yetiX = 0;
  private yetiActive = true;
  private yetiMaxHp = 8000;
  private yetiHp = 8000;
  private yetiState: "STALKING_NPCS" | "EATING_NPC" | "CHARGING" | "STAGGERED" | "RETREATING" | "DISTRACTED" | "DEAD" = "STALKING_NPCS";
  private currentWave = 1;
  private yetiKillCount = 0;
  private yetiDistractedTimer = 0;
  private yetiEatingTimer = 0;
  private yetiStaggerTimer = 0;
  private currentTargetNpcId: string | null = null;
  private currentTargetPlayerId: string | null = null;
  
  private matchStartTime = 0;
  private tickIntervalMs = 50; // 20Hz tick

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.initDatabase();
  }

  private initDatabase() {
    try {
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
          created_at INTEGER NOT NULL
        );
      `);

      try {
        this.ctx.storage.sql.exec(`
          CREATE INDEX IF NOT EXISTS idx_global_score ON global_leaderboard(score DESC);
          CREATE INDEX IF NOT EXISTS idx_race_time ON race_leaderboard(clear_time_sec ASC, score DESC);
          CREATE INDEX IF NOT EXISTS idx_hunter_callsign ON hunter_profiles(callsign);
        `);
      } catch (e) {}
    } catch (e) {
      console.warn("SQLite init warning:", e);
    }
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
          this.ctx.storage.sql.exec(
            "INSERT INTO hunter_profiles (callsign, pin_hash, hunter_id, created_at) VALUES (?, ?, ?, ?)",
            callsign, pinH, hunterId, Date.now()
          );
        }

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

      if (data.type === "PING") {
        try {
          ws.send(JSON.stringify({ type: "PONG", timestamp: Date.now() }));
        } catch (e) {}
        return;
      }

      if (data.type === "INPUT") {
        player.steer = data.steer || 0;
        player.pitch = data.pitch || 0;
        if (typeof data.z === "number") player.z = data.z;
        if (typeof data.x === "number") player.x = data.x;
        if (typeof data.speed === "number") player.speed = data.speed;
      } else if (data.type === "READY") {
        player.isReady = !!data.ready;
        player.gameMode = data.mode === "slalom" ? "slalom" : "hunt";
        this.broadcastLobbyState();
        this.checkAllReady();
      } else if (data.type === "FORCE_LAUNCH") {
        player.gameMode = data.mode === "slalom" ? "slalom" : "hunt";
        this.startMatchCountdown();
      } else if (data.type === "DROP_BAIT") {
        const bait: BaitItem = {
          id: crypto.randomUUID(),
          dropperId: playerId,
          x: player.x,
          z: player.z,
          createdAt: Date.now()
        };
        this.activeBaitItems.push(bait);
        this.broadcast({
          type: "BAIT_DROPPED",
          dropper: player.callsign,
          x: bait.x,
          z: bait.z
        });
      } else if (data.type === "SHOOT") {
        player.shotsFired++;
        if (data.hit && this.matchState === "ACTIVE_HUNT" && this.yetiHp > 0) {
          const dmg = data.crit ? 300 : 120;
          this.yetiHp = Math.max(0, this.yetiHp - dmg);
          player.damageDealt += dmg;
          player.score += dmg;

          // Kinetic Stagger & Knockback on Yeti
          const knockbackDist = data.crit ? 6.0 : 3.5;
          this.yetiZ += knockbackDist; // Knocks yeti further downhill away from player
          this.yetiStaggerTimer = 0.8;
          this.yetiState = "STAGGERED";

          // Hunter Rescue Check: If Yeti was hunting or eating an NPC
          if (this.currentTargetNpcId) {
            const targetedNpc = this.npcs.find(n => n.id === this.currentTargetNpcId);
            if (targetedNpc && !targetedNpc.isRescued) {
              targetedNpc.isRescued = true;
              targetedNpc.isEaten = false;
              player.score += 1500;
              this.broadcast({
                type: "SKIER_RESCUED",
                rescuerId: playerId,
                rescuerCallsign: player.callsign,
                npcId: targetedNpc.id,
                bonusScore: 1500
              });
            }
          }

          this.broadcast({
            type: "YETI_HIT",
            shooterId: playerId,
            damage: dmg,
            isCrit: !!data.crit,
            yetiHp: this.yetiHp,
            yetiZ: this.yetiZ,
            yetiX: this.yetiX
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

  private spawnProceduralNPCs(leadZ: number) {
    this.npcs = [];
    const npcTypes: ("skier" | "snowboarder" | "speedster")[] = ["skier", "snowboarder", "speedster"];
    for (let i = 0; i < 22; i++) {
      const type = npcTypes[i % 3];
      const baseSpeed = type === "speedster" ? 36 : (type === "snowboarder" ? 28 : 22);
      this.npcs.push({
        id: `npc_${i}_${Date.now()}`,
        x: (Math.random() - 0.5) * 70,
        z: leadZ + 15 + (i * 8) + (Math.random() * 6),
        speed: baseSpeed + (Math.random() * 6),
        steer: (Math.random() - 0.5) * 0.4,
        color: NPC_COLORS[i % NPC_COLORS.length],
        type,
        isEaten: false,
        isRescued: false
      });
    }
  }

  private launchMatch() {
    this.matchState = "ACTIVE_HUNT";
    this.matchStartTime = Date.now();
    this.yetiHp = 8000 * this.currentWave;
    this.yetiMaxHp = this.yetiHp;
    this.yetiZ = 30;
    this.yetiX = 0;
    this.boulders = [];
    this.activeBaitItems = [];
    this.yetiDistractedTimer = 0;
    this.yetiEatingTimer = 0;
    this.yetiStaggerTimer = 0;
    this.currentTargetNpcId = null;
    this.currentTargetPlayerId = null;

    this.players.forEach(p => {
      p.z = 0;
      p.x = (Math.random() - 0.5) * 8;
      p.isDead = false;
      p.damageDealt = 0;
      p.score = 0;
    });

    this.spawnProceduralNPCs(0);

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
    this.yetiState = "DEAD";

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
      this.yetiZ = 35;
      this.players.forEach(p => p.isDead = false);
      const leadZ = Math.max(0, ...Array.from(this.players.values()).map(p => p.z));
      this.spawnProceduralNPCs(leadZ);

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
        const dt = this.tickIntervalMs / 1000;
        const alivePlayers = Array.from(this.players.values()).filter(p => !p.isDead);
        
        if (alivePlayers.length > 0) {
          const leadSkierZ = Math.max(...alivePlayers.map(p => p.z));
          const avgSkierX = alivePlayers.reduce((acc, p) => acc + p.x, 0) / alivePlayers.length;

          // 1. Update NPC Downhill Movement & Recycle Swarm
          this.npcs.forEach(npc => {
            if (!npc.isEaten) {
              // Carving motion
              npc.steer += (Math.random() - 0.5) * 0.1;
              npc.steer = Math.max(-0.6, Math.min(0.6, npc.steer));
              npc.x += Math.sin(npc.steer) * (npc.speed * 0.038);
              npc.z += Math.cos(npc.steer) * (npc.speed * 0.038);
              npc.x = Math.max(-60, Math.min(60, npc.x));
            } else if (npc.eatTimer) {
              npc.eatTimer -= dt;
            }

            // Recycle NPCs that fall behind or go too far
            if (leadSkierZ - npc.z > 35) {
              npc.z = leadSkierZ + 60 + Math.random() * 80;
              npc.x = (Math.random() - 0.5) * 70;
              npc.isEaten = false;
              npc.isRescued = false;
              npc.eatTimer = undefined;
            }
          });

          // 2. Yeti State Machine & Predator AI
          if (this.yetiStaggerTimer > 0) {
            this.yetiStaggerTimer -= dt;
            this.yetiState = "STAGGERED";
          } else if (this.yetiDistractedTimer > 0) {
            this.yetiDistractedTimer -= dt;
            this.yetiState = "DISTRACTED";
          } else if (this.activeBaitItems.length > 0) {
            const nearestBait = this.activeBaitItems[0];
            const distToBait = Math.hypot(this.yetiX - nearestBait.x, this.yetiZ - nearestBait.z);
            if (distToBait < 35) {
              this.yetiDistractedTimer = 3.5;
              this.yetiState = "DISTRACTED";
              this.activeBaitItems.shift();
              this.broadcast({ type: "YETI_EATING_BAIT" });
            }
          } else if (this.yetiEatingTimer > 0) {
            this.yetiEatingTimer -= dt;
            this.yetiState = "EATING_NPC";
            if (this.yetiEatingTimer <= 0) {
              this.currentTargetNpcId = null;
              this.yetiState = "STALKING_NPCS";
            }
          } else {
            // Predator Loop: Target closest NPC downhill in view
            const aliveNPCs = this.npcs.filter(n => !n.isEaten);
            let closestNpc: NPCState | null = null;
            let minNpcDist = 9999;

            aliveNPCs.forEach(n => {
              const dist = Math.hypot(this.yetiX - n.x, this.yetiZ - n.z);
              if (dist < minNpcDist) {
                minNpcDist = dist;
                closestNpc = n;
              }
            });

            // Check if player is aggressively close (< 8m) or provoking
            let closestPlayer: SkierState | null = null;
            let minPlayerDist = 9999;
            alivePlayers.forEach(p => {
              const pDist = Math.hypot(p.x - this.yetiX, p.z - this.yetiZ);
              if (pDist < minPlayerDist) {
                minPlayerDist = pDist;
                closestPlayer = p;
              }
            });

            if (minPlayerDist < 8.0 && closestPlayer) {
              // Switch to charging player
              this.yetiState = "CHARGING";
              this.currentTargetPlayerId = (closestPlayer as SkierState).id;
              const dx = (closestPlayer as SkierState).x - this.yetiX;
              const dz = (closestPlayer as SkierState).z - this.yetiZ;
              this.yetiX += Math.sign(dx) * Math.min(Math.abs(dx), 0.35);
              this.yetiZ += Math.sign(dz) * Math.min(Math.abs(dz), 0.45);

              if (minPlayerDist < 3.2) {
                this.broadcast({ type: "YETI_BITE_ATTACK", victimId: (closestPlayer as SkierState).id });
              }
            } else if (closestNpc && minNpcDist < 60) {
              // Hunt NPC in front view
              this.yetiState = "STALKING_NPCS";
              this.currentTargetNpcId = (closestNpc as NPCState).id;
              const target = closestNpc as NPCState;
              const dx = target.x - this.yetiX;
              const dz = target.z - this.yetiZ;
              this.yetiX += Math.sign(dx) * Math.min(Math.abs(dx) * 0.08, 0.4);
              this.yetiZ += Math.sign(dz) * Math.min(Math.abs(dz) * 0.08, 0.5);

              if (minNpcDist < 3.5) {
                target.isEaten = true;
                target.eatTimer = 1.4;
                this.yetiEatingTimer = 1.2;
                this.yetiState = "EATING_NPC";
                this.broadcast({
                  type: "YETI_MAUL_NPC",
                  npcId: target.id,
                  x: target.x,
                  z: target.z
                });
              }
            } else {
              // Default Prowl in front of lead skier (18m-35m ahead)
              this.yetiState = "STALKING_NPCS";
              const targetZ = leadSkierZ + 25;
              this.yetiZ += (targetZ - this.yetiZ) * 0.06;
              this.yetiX += (avgSkierX - this.yetiX) * 0.05 + Math.sin(Date.now() * 0.003) * 0.4;
            }

            // Keep Yeti in active forward zone (between leadSkierZ - 5 and leadSkierZ + 55)
            if (this.yetiZ < leadSkierZ - 10) {
              this.yetiZ = leadSkierZ + 25;
              this.yetiX = avgSkierX + (Math.random() - 0.5) * 14;
              this.broadcast({
                type: "YETI_AMBUSH",
                x: this.yetiX,
                z: this.yetiZ
              });
            } else if (this.yetiZ > leadSkierZ + 65) {
              this.yetiZ = leadSkierZ + 40;
            }
          }
        }

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
            active: this.yetiActive,
            targetNpcId: this.currentTargetNpcId
          },
          npcs: this.npcs,
          skiers,
          boulders: this.boulders,
          baitItems: this.activeBaitItems
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
