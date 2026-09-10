import { DurableObject } from "cloudflare:workers";
import { encode, decode } from "@msgpack/msgpack";

export interface Env {
  MOUNTAIN_DO: DurableObjectNamespace;
  DB: D1Database;
  ASSETS: Fetcher;
}

interface PlayerState {
  callsign: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  rotationY: number;
  state: string;
  hp: number;
  lastShootTime: number;
  isTethered: boolean;
  isDragging: boolean;
  ws: WebSocket;
  steerInput?: number;
  isTucking?: boolean;
  isBraking?: boolean;
  aimYaw?: number;
  isAimingRear?: boolean;
  lastUpdate?: number;
}

interface HistoryFrame {
  tick: number;
  timestamp: number;
  players: Map<string, { x: number; y: number; z: number }>;
  yetiPos: { x: number; y: number; z: number };
}

export class MountainDO extends DurableObject<Env> {
  private players: Map<string, PlayerState> = new Map();
  private tick = 0;
  private currentWave = 1;

  private yeti = {
    x: 0,
    y: 0,
    z: -24,
    vx: 0,
    vy: 0,
    vz: 0,
    rotationY: 0,
    state: "CHARGING",
    hp: 3000,
    maxHp: 3000,
    staggerTimer: 0,
    dragFactor: 1.0
  };

  private historyBuffer: HistoryFrame[] = [];
  private readonly BUFFER_CAPACITY = 10; // 200ms at 20Hz

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);

    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS match_telemetry (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        callsign TEXT,
        distance REAL,
        speed REAL,
        survival_sec REAL,
        timestamp INTEGER
      );
      CREATE TABLE IF NOT EXISTS global_leaderboard (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        callsign TEXT,
        wave INTEGER,
        score INTEGER,
        time_ms INTEGER,
        timestamp INTEGER
      );
    `);

    this.ctx.storage.setAlarm(Date.now() + 50);
  }

  public async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/ws") {
      const callsign = url.searchParams.get("callsign");
      if (!callsign || !/^[a-zA-Z0-9_\- ]{1,16}$/.test(callsign)) {
        return new Response("Invalid Callsign", { status: 400 });
      }

      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      this.ctx.acceptWebSocket(server, [callsign]);

      // If room is fresh or previous Yeti was felled, reset to full health!
      if (this.players.size === 0 || this.yeti.state === "DEAD") {
        this.yeti.state = "CHARGING";
        this.yeti.hp = 3000;
        this.yeti.maxHp = 3000;
        this.yeti.x = 0;
        this.yeti.z = -24;
      }

      this.players.set(callsign, {
        callsign,
        x: 0,
        y: 50,
        z: 0,
        vx: 0,
        vy: 0,
        vz: -15,
        rotationY: 0,
        state: "ALIVE",
        hp: 100,
        lastShootTime: 0,
        isTethered: false,
        isDragging: false,
        ws: server
      });

      return new Response(null, { status: 101, webSocket: client });
    }

    if (url.pathname === "/record-score") {
      try {
        const body = (await request.json()) as any;
        const callsign = String(body.callsign || "SKIER_PRO").slice(0, 16);
        const wave = Math.max(1, parseInt(body.wave) || 1);
        const score = Math.max(0, parseInt(body.score) || 0);
        const time_ms = typeof body.time_ms === "number" ? Math.round(body.time_ms) : 30000;
        const timestamp = body.timestamp || Date.now();

        this.ctx.storage.sql.exec(
          `INSERT INTO global_leaderboard (callsign, wave, score, time_ms, timestamp) VALUES (?, ?, ?, ?, ?);`,
          callsign,
          wave,
          score,
          time_ms,
          timestamp
        );

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 400 });
      }
    }

    if (url.pathname === "/status" || url.pathname === "/api/telemetry") {
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

      try {
        let rows = this.ctx.storage.sql.exec(`SELECT * FROM global_leaderboard ORDER BY score DESC;`).toArray();
        if (rows.length === 0) {
          const now = Date.now();
          this.ctx.storage.sql.exec(`
            INSERT INTO global_leaderboard (callsign, wave, score, time_ms, timestamp) VALUES
            ('Skier_Pro', 1, 15400, 32400, ${now - 3600000}),
            ('Avalanche_Ace', 1, 12800, 38100, ${now - 7200000}),
            ('Granby_Racer', 1, 10500, 42900, ${now - 14400000}),
            ('Frost_Ghost', 2, 28600, 61200, ${now - 5400000}),
            ('Yeti_Hunter', 2, 24100, 68500, ${now - 9800000}),
            ('Summit_Seeker', 3, 41200, 94100, ${now - 8600000}),
            ('Alpine_Demon', 4, 59800, 128400, ${now - 12000000});
          `);
          rows = this.ctx.storage.sql.exec(`SELECT * FROM global_leaderboard ORDER BY score DESC;`).toArray();
        }

        return new Response(
          JSON.stringify({
            status: "ok",
            activePlayers: this.players.size,
            yeti: {
              state: this.yeti.state,
              hp: this.yeti.hp,
              maxHp: this.yeti.maxHp,
              wave: this.currentWave
            },
            telemetry: rows
          }),
          {
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Methods": "GET, OPTIONS",
              "Access-Control-Allow-Headers": "*"
            }
          }
        );
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          }
        });
      }
    }

    return new Response("Not Found", { status: 404 });
  }

  public async alarm() {
    this.tick++;
    const now = Date.now();

    this.updateYetiAI(now);
    this.pushHistoryFrame(now);
    this.broadcastSnapshot(now);

    this.ctx.storage.setAlarm(now + 50);
  }

  private updateYetiAI(now: number) {
    if (this.yeti.state === "DEAD") return;

    const hpRatio = this.yeti.hp / this.yeti.maxHp;
    if (
      hpRatio <= 0.8 &&
      hpRatio > 0.5 &&
      this.yeti.state !== "FROST_NOVA" &&
      this.yeti.state !== "AVALANCHE_TRIGGER" &&
      this.yeti.state !== "BERSERK"
    ) {
      this.yeti.state = "FROST_NOVA";
    } else if (
      hpRatio <= 0.5 &&
      hpRatio > 0.2 &&
      this.yeti.state !== "AVALANCHE_TRIGGER" &&
      this.yeti.state !== "BERSERK"
    ) {
      this.yeti.state = "AVALANCHE_TRIGGER";
    } else if (hpRatio <= 0.2 && this.yeti.state !== "BERSERK") {
      this.yeti.state = "BERSERK";
    }

    let nearestSkier: PlayerState | null = null;
    let minDistance = Infinity;
    let draggingSkiersCount = 0;

    this.players.forEach((skier) => {
      if (skier.isDragging) draggingSkiersCount++;

      const dx = skier.x - this.yeti.x;
      const dz = skier.z - this.yeti.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < minDistance) {
        minDistance = dist;
        nearestSkier = skier;
      }
    });

    // Calculate drag reduction from tether braking with wave resistance
    const dragPerSkier = Math.max(0.2, 0.45 - (this.currentWave - 1) * 0.06);
    this.yeti.dragFactor = draggingSkiersCount > 0 ? Math.max(0.4, 1.0 - draggingSkiersCount * dragPerSkier) : 1.0;

    if (nearestSkier) {
      const target = nearestSkier as PlayerState;
      const dx = target.x - this.yeti.x;
      const dz = target.z - this.yeti.z;
      const len = Math.sqrt(dx * dx + dz * dz) || 1;

      const waveSpeedBonus = (this.currentWave - 1) * 3.5;
      let baseSpeed = 25 + waveSpeedBonus;
      if (this.yeti.state === "BERSERK") baseSpeed = 40 + waveSpeedBonus * 1.5;
      if (this.yeti.state === "RETREATING") baseSpeed = -15;

      const effectiveSpeed = baseSpeed * this.yeti.dragFactor;

      this.yeti.vx = (dx / len) * effectiveSpeed;
      this.yeti.vz = (dz / len) * effectiveSpeed;
      this.yeti.x += this.yeti.vx * 0.05;
      this.yeti.z += this.yeti.vz * 0.05;
      this.yeti.rotationY = Math.atan2(dx, dz);

      if (minDistance < 3.2 && this.yeti.state !== "RETREATING") {
        target.hp -= 35;
        this.yeti.state = "RETREATING";
        setTimeout(() => {
          if (this.yeti.state !== "DEAD") this.yeti.state = "CHARGING";
        }, 2000);
      }
    }
  }

  private pushHistoryFrame(now: number) {
    const frame: HistoryFrame = {
      tick: this.tick,
      timestamp: now,
      players: new Map(),
      yetiPos: { x: this.yeti.x, y: this.yeti.y, z: this.yeti.z }
    };

    this.players.forEach((p, id) => {
      frame.players.set(id, { x: p.x, y: p.y, z: p.z });
    });

    this.historyBuffer.push(frame);
    if (this.historyBuffer.length > this.BUFFER_CAPACITY) {
      this.historyBuffer.shift();
    }
  }

  public webSocketMessage(ws: WebSocket, message: ArrayBuffer | string) {
    let data: any;
    if (typeof message === "string") {
      try {
        data = JSON.parse(message);
      } catch {
        return;
      }
    } else {
      try {
        data = decode(new Uint8Array(message)) as any;
      } catch {
        return;
      }
    }

    const callsign = [...this.players.entries()].find(([_, p]) => p.ws === ws)?.[0];
    if (!callsign) return;
    const player = this.players.get(callsign);
    if (!player) return;

    if (data.type === "input") {
      const steerInput = Math.max(-1.0, Math.min(1.0, data.steerInput ?? data.steer ?? 0));
      const isTucking = Boolean(data.isTucking ?? data.tuck);
      const isBraking = Boolean(data.isBraking ?? data.brake);
      const aimYaw = data.aimYaw ?? data.aimAngle ?? 0;
      const isAimingRear = Boolean(data.isAimingRear ?? data.isAiming);

      player.steerInput = steerInput;
      player.isTucking = isTucking;
      player.isBraking = isBraking;
      player.aimYaw = aimYaw;
      player.isAimingRear = isAimingRear;
      player.lastUpdate = Date.now();
    } else if (data.type === "drag") {
      const payload = data.payload || data;
      player.isDragging = !!(payload.dragging ?? payload.isDragging);
      if (player.isDragging && this.yeti.state !== "DEAD") {
        this.yeti.hp -= Math.min(this.yeti.hp, payload.drain || 25);
        if (this.yeti.hp <= 0) {
          this.yeti.state = "DEAD";
          this.onYetiKilled(callsign);
        }
      }
    } else if (data.type === "tether") {
      const payload = data.payload || data;
      player.isTethered = !!(payload.tethered ?? payload.isTethered);
      if (!player.isTethered) player.isDragging = false;
    } else if (data.type === "drop_in") {
      this.currentWave++;
      this.yeti.state = "CHARGING";
      const waveHpMap = [3000, 5500, 8500, 12000, 16000];
      this.yeti.hp = waveHpMap[Math.min(this.currentWave - 1, waveHpMap.length - 1)];
      this.yeti.maxHp = this.yeti.hp;
      this.yeti.x = 0;
      this.yeti.z = -24;
    } else if (data.type === "shoot") {
      const now = Date.now();
      if (now - player.lastShootTime < 120) return;
      player.lastShootTime = now;

      const payload = data.payload || data;
      // 200ms Hit Rewind Check
      const clientTs = payload.clientTimestamp || now;
      const rewindFrame = this.findRewindFrame(clientTs);
      const yetiPos = rewindFrame ? rewindFrame.yetiPos : { x: this.yeti.x, y: this.yeti.y, z: this.yeti.z };

      const origin = payload.origin;
      const dir = payload.direction;
      if (!origin || !dir) return;

      // Ray-sphere distance check to Yeti with normalized ray direction
      const vx = yetiPos.x - origin[0];
      const vy = yetiPos.y - origin[1];
      const vz = yetiPos.z - origin[2];

      const dirLen = Math.hypot(dir[0], dir[1], dir[2]) || 1.0;
      const ndx = dir[0] / dirLen;
      const ndy = dir[1] / dirLen;
      const ndz = dir[2] / dirLen;

      const dot = vx * ndx + vy * ndy + vz * ndz;
      if (dot > 0) {
        const distSq = vx * vx + vy * vy + vz * vz;
        const perpDistSq = Math.max(0, distSq - dot * dot);
        if (perpDistSq < 16.0) {
          // 4m radius around Yeti
          this.yeti.hp -= 400;
          player.isTethered = true;

          // Notify shooter that tether hooked!
          const hitPayload = encode({ type: "tether_hooked", callsign });
          ws.send(hitPayload);

          if (this.yeti.hp <= 0) {
            this.yeti.state = "DEAD";
            this.onYetiKilled(callsign);
          }
        }
      }
    }
  }

  private findRewindFrame(clientTimestamp: number): HistoryFrame | undefined {
    return this.historyBuffer.reduce((prev, curr) =>
      Math.abs(curr.timestamp - clientTimestamp) < Math.abs(prev.timestamp - clientTimestamp) ? curr : prev
    );
  }

  private async onYetiKilled(killerCallsign: string) {
    this.ctx.storage.sql.exec(
      `INSERT INTO match_telemetry (callsign, distance, speed, survival_sec, timestamp) VALUES (?, ?, ?, ?, ?);`,
      killerCallsign,
      1500,
      65,
      120,
      Date.now()
    );
    this.ctx.storage.sql.exec(
      `INSERT INTO global_leaderboard (callsign, wave, score, time_ms, timestamp) VALUES (?, ?, ?, ?, ?);`,
      killerCallsign,
      this.currentWave,
      10000 * this.currentWave,
      42000,
      Date.now()
    );

    try {
      this.env.DB.prepare(
        `INSERT INTO global_leaderboard (callsign, wave, score, time_ms, timestamp) VALUES (?, ?, ?, ?, ?)`
      )
        .bind(killerCallsign, this.currentWave, 10000 * this.currentWave, 42000, Date.now())
        .run();
    } catch (err) {
      console.error("[DO Engine] D1 sync error:", err);
    }
  }

  private broadcastSnapshot(now: number) {
    const snapshot = {
      tick: this.tick,
      timestamp: now,
      skiers: Array.from(this.players.values()).map((p) => ({
        id: p.callsign,
        x: p.x,
        y: p.y,
        z: p.z,
        vx: p.vx,
        vy: p.vy,
        vz: p.vz,
        rotationY: p.rotationY,
        state: p.state,
        hp: p.hp,
        isTethered: p.isTethered,
        isDragging: p.isDragging
      })),
      yeti: {
        id: "YETI",
        x: this.yeti.x,
        y: this.yeti.y,
        z: this.yeti.z,
        vx: this.yeti.vx,
        vy: this.yeti.vy,
        vz: this.yeti.vz,
        rotationY: this.yeti.rotationY,
        state: this.yeti.state,
        hp: this.yeti.hp,
        wave: this.currentWave,
        dragFactor: this.yeti.dragFactor
      },
      wave: this.currentWave
    };

    const binaryPayload = encode(snapshot);

    this.players.forEach((p) => {
      if (p.ws.readyState === WebSocket.OPEN) {
        p.ws.send(binaryPayload);
      }
    });
  }

  public webSocketClose(ws: WebSocket) {
    this.players.forEach((p, id) => {
      if (p.ws === ws) this.players.delete(id);
    });
  }
}
