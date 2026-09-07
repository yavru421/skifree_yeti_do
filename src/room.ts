import { DurableObject } from "cloudflare:workers";

export interface PlayerSession {
  playerId: string;
  name: string;
  harpoonState: "IDLE" | "FIRED" | "TOWED";
  lastActive: number;
  lastSpeedUpdate: number;
  currentTowedTime: number;
  localMaxSpeed: number;
  isDisconnected: boolean;
  towedWhaleSeg?: number;
  beastDamage?: number;
  towedTime?: number;
  aggroScore?: number;
  stylePoints?: number;
  x?: number;
  y?: number;
  z?: number;
  rotX?: number;
  rotY?: number;
  rotZ?: number;
  speed?: number;
  steer?: number;
}

export interface WhaleSegment {
  id: number;
  x: number;
  y: number;
  z: number;
}

export interface LeviathanState {
  x: number;
  y: number;
  z: number;
  hp: number;
  maxHp: number;
  speed: number;
  baseSpeed: number;
  breachState: "SUBMERGED" | "EMERGING" | "CRESTING" | "DIVING" | "STAGGERED";
  diveDepth: number;
  segments: WhaleSegment[];
}

export class GameRoom extends DurableObject {
  sql: SqlStorage;
  private activeHuntId: string | null = "hunt_glacier_alpha";
  private huntStartTime: number = Date.now();
  private isMatchOver: boolean = false;
  private isLevelOne: boolean = true;
  private leviathan: LeviathanState;
  private splineT = 0;
  private lastTick = Date.now();
  private isAlarmScheduled = false;

  // "Pack-of-Dogs" Co-Op State
  private yeti_target_id: string | null = null;
  private active_tethers: Set<string> = new Set();
  private aggro_scores: Map<string, number> = new Map();
  private beast_speed_modifier: number = 1.0;
  private isStaggered: boolean = false;

  constructor(ctx: DurableObjectState, env: any) {
    super(ctx, env);
    this.sql = ctx.storage.sql;

    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS hunters (
        hunter_id TEXT PRIMARY KEY,
        display_name TEXT NOT NULL,
        max_towed_speed REAL DEFAULT 0.0,
        total_damage_dealt INTEGER DEFAULT 0,
        total_hunts_joined INTEGER DEFAULT 1,
        max_style_score INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS hunt_contributions (
        hunt_id TEXT,
        hunter_id TEXT,
        seconds_towed REAL DEFAULT 0.0,
        harpoons_landed INTEGER DEFAULT 0,
        tricks_over_beast INTEGER DEFAULT 0,
        PRIMARY KEY (hunt_id, hunter_id)
      );

      CREATE TABLE IF NOT EXISTS session_logs (
        playerId TEXT PRIMARY KEY,
        beastDamage INTEGER DEFAULT 0,
        towedTime REAL DEFAULT 0.0,
        updated_at INTEGER DEFAULT 0
      );
    `);

    const segments: WhaleSegment[] = [];
    for (let i = 0; i < 8; i++) {
      segments.push({ id: i, x: 0, y: 0, z: 900 - i * 35 });
    }

    // Level 1: 100 HP Yeti. (Normal hunts scale to 15,000 HP)
    const initialHp = this.isLevelOne ? 100 : 15000;

    this.leviathan = {
      x: 0,
      y: 0,
      z: 900,
      hp: initialHp,
      maxHp: initialHp,
      baseSpeed: 65.0,
      speed: 65.0,
      breachState: "CRESTING",
      diveDepth: 0,
      segments
    };

    this.scheduleTick();
  }

  private scheduleTick() {
    if (!this.isAlarmScheduled && !this.isMatchOver) {
      this.isAlarmScheduled = true;
      this.ctx.storage.setAlarm(Date.now() + 100); // 10Hz authoritative edge tick
    }
  }

  private updateBeastSpeedModifier() {
    if (this.isMatchOver) {
      this.beast_speed_modifier = 0.0;
      this.leviathan.speed = 0;
      this.isStaggered = true;
      return;
    }

    const tetherCount = this.active_tethers.size;
    if (tetherCount === 0) {
      this.beast_speed_modifier = 1.0;
      this.isStaggered = false;
    } else if (tetherCount === 1) {
      // Level 1: Even a single tether drags beast forward speed down drastically
      this.beast_speed_modifier = this.isLevelOne ? 0.5 : 1.0;
      this.isStaggered = this.isLevelOne;
    } else if (tetherCount === 2) {
      this.beast_speed_modifier = this.isLevelOne ? 0.2 : 0.8;
      this.isStaggered = true;
    } else {
      // 3+ Players tethered: Pinned / Staggered on snow bed
      this.beast_speed_modifier = 0.0;
      this.isStaggered = true;
    }
    this.leviathan.speed = this.leviathan.baseSpeed * this.beast_speed_modifier;
  }

  private updateAggroTarget() {
    if (this.isMatchOver) return;

    let topId: string | null = null;
    let topScore = -1;

    for (const [id, score] of this.aggro_scores.entries()) {
      if (score > topScore) {
        topScore = score;
        topId = id;
      }
    }

    if (topId !== this.yeti_target_id && topScore > 5) {
      this.yeti_target_id = topId;
      this.broadcastToRoom({
        type: "TARGET_CHANGED",
        targetPlayerId: this.yeti_target_id,
        aggroScore: topScore
      });
    }

    // Decay aggro gradually
    for (const [id, score] of this.aggro_scores.entries()) {
      this.aggro_scores.set(id, Math.max(0, score * 0.985));
    }
  }

  async alarm() {
    this.isAlarmScheduled = false;
    const now = Date.now();

    if (this.isMatchOver) {
      // 15 seconds after victory, complete hunt and allow room recycle
      return;
    }

    const dt = Math.min((now - this.lastTick) / 1000, 0.25);
    this.lastTick = now;

    // Mobile Disconnection Cleanup (7-second grace window)
    const sockets = this.ctx.getWebSockets();
    for (const ws of sockets) {
      const session = ws.deserializeAttachment() as PlayerSession;
      if (session && session.isDisconnected && (now - session.lastActive) >= 7000) {
        this.active_tethers.delete(session.playerId);
        this.aggro_scores.delete(session.playerId);
        this.broadcastToRoom({ type: "HUNTER_DISCONNECTED", playerId: session.playerId });
        try {
          ws.close(1000, "Mobile connection grace period expired");
        } catch (_) {}
      }
    }

    this.updateBeastSpeedModifier();
    this.updateAggroTarget();
    this.updateLeviathan(dt);

    const activeSockets = this.ctx.getWebSockets();
    if (activeSockets.length > 0) {
      const messages: any[] = [
        {
          type: "LEVIATHAN_TICK",
          x: this.leviathan.x,
          y: this.leviathan.y,
          z: this.leviathan.z,
          hp: this.leviathan.hp,
          maxHp: this.leviathan.maxHp,
          speed: this.leviathan.speed,
          speedModifier: this.beast_speed_modifier,
          breachState: this.isStaggered ? "STAGGERED" : this.leviathan.breachState,
          isStaggered: this.isStaggered,
          yeti_target_id: this.yeti_target_id,
          active_tethers: Array.from(this.active_tethers),
          segments: this.leviathan.segments
        }
      ];

      for (const ws of activeSockets) {
        const session = ws.deserializeAttachment() as PlayerSession;
        if (session && session.harpoonState === "TOWED" && !session.isDisconnected) {
          session.towedTime = (session.towedTime || 0) + dt;
          ws.serializeAttachment(session);
        }
      }

      const batchEnvelope = JSON.stringify({
        type: "BATCH_UPDATE",
        timestamp: now,
        messages
      });

      for (const ws of activeSockets) {
        const session = ws.deserializeAttachment() as PlayerSession;
        if (session && !session.isDisconnected) {
          try {
            ws.send(batchEnvelope);
          } catch (e) {}
        }
      }

      this.scheduleTick();
    }
  }

  private updateLeviathan(dt: number) {
    if (this.isStaggered) {
      this.leviathan.y = -2.0;
      this.splineT += dt * 0.05;
    } else {
      this.splineT += dt * 0.45;
      const breachCycle = (this.splineT * 0.6) % (Math.PI * 2);
      if (breachCycle < Math.PI) {
        this.leviathan.y = Math.sin(breachCycle) * 35.0;
        this.leviathan.breachState = breachCycle < Math.PI * 0.5 ? "EMERGING" : "CRESTING";
      } else {
        this.leviathan.y = -Math.sin(breachCycle - Math.PI) * 15.0;
        this.leviathan.breachState = breachCycle > Math.PI * 1.5 ? "DIVING" : "SUBMERGED";
      }
    }

    const zAdv = this.leviathan.speed * 1.467 * dt * 5.0;
    this.leviathan.z += zAdv;
    this.leviathan.x = Math.sin(this.splineT * 0.8) * 140.0;

    for (let i = 0; i < this.leviathan.segments.length; i++) {
      const segLag = (i + 1) * 32.0;
      const segSplineT = this.splineT - (i + 1) * 0.12;
      this.leviathan.segments[i] = {
        id: i,
        x: Math.sin(segSplineT * 0.8) * 140.0,
        y: this.isStaggered ? -2.0 : this.leviathan.y * Math.max(0.2, 1.0 - i * 0.1),
        z: this.leviathan.z - segLag
      };
    }
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Dynamic level configuration support
    if (url.searchParams.get("level") === "1" || url.searchParams.get("onboarding") === "true") {
      this.isLevelOne = true;
      if (this.leviathan.hp > 100) {
        this.leviathan.hp = 100;
        this.leviathan.maxHp = 100;
      }
    }

    if (url.pathname === "/room/status") {
      const activeHunters = this.ctx.getWebSockets().filter((ws) => {
        const s = ws.deserializeAttachment() as PlayerSession;
        return s && !s.isDisconnected;
      }).length;
      return new Response(
        JSON.stringify({
          activePlayers: activeHunters,
          isHuntComplete: this.isMatchOver || this.leviathan.hp <= 0,
          beastHp: this.leviathan.hp,
          isLevelOne: this.isLevelOne,
          beastState: this.isStaggered ? "STAGGERED" : this.leviathan.breachState
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    if (url.pathname === "/api/scores" || url.pathname === "/scores" || url.pathname === "/api/leaderboard") {
      const topHunters = [...this.sql.exec(`
        SELECT hunter_id as playerId, display_name as name, max_towed_speed as maxSpeed, total_damage_dealt as beastDamage, max_style_score as styleScore, total_hunts_joined 
        FROM hunters 
        ORDER BY total_damage_dealt DESC, max_towed_speed DESC 
        LIMIT 25
      `)];
      return new Response(JSON.stringify({ leaderboard: topHunters }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket upgrade", { status: 426 });
    }

    const playerId = url.searchParams.get("playerId") || `hunter_${Math.random().toString(36).substring(2, 8)}`;
    const name = url.searchParams.get("name") || url.searchParams.get("callsign") || `Hunter-${Math.floor(1000 + Math.random() * 9000)}`;

    // Mobile Reconnection Grace Check
    const existingSockets = this.ctx.getWebSockets();
    for (const oldSocket of existingSockets) {
      const session = oldSocket.deserializeAttachment() as PlayerSession;
      if (session && session.playerId === playerId && session.isDisconnected) {
        const [client, server] = Object.values(new WebSocketPair());
        this.ctx.acceptWebSocket(server);

        session.isDisconnected = false;
        session.lastActive = Date.now();
        server.serializeAttachment(session);

        try {
          oldSocket.close(1001, "Replaced by active mobile socket connection");
        } catch (_) {}

        this.broadcastToRoom({ type: "HUNTER_RECONNECTED", playerId });
        this.scheduleTick();
        return new Response(null, { status: 101, webSocket: client });
      }
    }

    // Fresh Connection
    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);
    this.ctx.acceptWebSocket(server);

    const sessionState: PlayerSession = {
      playerId,
      name,
      harpoonState: "IDLE",
      lastActive: Date.now(),
      lastSpeedUpdate: Date.now(),
      currentTowedTime: 0.0,
      localMaxSpeed: 0.0,
      isDisconnected: false,
      beastDamage: 0,
      towedTime: 0.0,
      aggroScore: 10.0,
      stylePoints: 0,
      x: 0,
      y: 0,
      z: 0,
      speed: 25.0
    };
    server.serializeAttachment(sessionState);
    this.aggro_scores.set(playerId, 10.0);

    this.sql.exec(
      `INSERT INTO hunters (hunter_id, display_name, max_towed_speed, total_damage_dealt, total_hunts_joined, max_style_score)
       VALUES (?, ?, 0.0, 0, 1, 0)
       ON CONFLICT(hunter_id) DO UPDATE SET
         total_hunts_joined = total_hunts_joined + 1;`,
      playerId,
      name
    );

    this.scheduleTick();

    server.send(JSON.stringify({
      type: "BATCH_UPDATE",
      timestamp: Date.now(),
      messages: [
        {
          type: "WELCOME",
          playerId,
          name,
          isLevelOne: this.isLevelOne,
          yeti_target_id: this.yeti_target_id,
          active_tethers: Array.from(this.active_tethers),
          beast_speed_modifier: this.beast_speed_modifier,
          roomState: {
            whaleHp: this.leviathan.hp,
            whaleMaxHp: this.leviathan.maxHp,
            breachState: this.leviathan.breachState
          }
        }
      ]
    }));

    return new Response(null, {
      status: 101,
      webSocket: client
    });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    const session = ws.deserializeAttachment() as PlayerSession;
    if (!session || typeof message !== "string") return;

    session.lastActive = Date.now();

    // Invariant: Halt accepting position/movement telemetry when hunt is complete
    if (this.isMatchOver) return;

    try {
      const batch = JSON.parse(message);
      if (batch.type === "BATCH_UPDATE" && Array.isArray(batch.messages)) {
        for (const msg of batch.messages) {
          this.handleGameMessage(ws, session, msg);
        }
      } else if (Array.isArray(batch.messages)) {
        for (const msg of batch.messages) {
          this.handleGameMessage(ws, session, msg);
        }
      } else if (batch.type) {
        this.handleGameMessage(ws, session, batch);
      }
    } catch (err) {
      try {
        ws.send(JSON.stringify({ error: "Malformed payload" }));
      } catch (e) {}
    }
  }

  private handleGameMessage(ws: WebSocket, session: PlayerSession, msg: any) {
    if (this.isMatchOver) return;

    switch (msg.type) {
      case "HARPOON_STATE_CHANGE":
        session.harpoonState = msg.state || "IDLE";
        ws.serializeAttachment(session);
        break;

      case "TOW_ENGAGED":
      case "HARPOON_HIT": {
        const segIndex = typeof msg.targetWhaleSeg === "number" ? msg.targetWhaleSeg : 3;
        session.harpoonState = "TOWED";
        session.towedWhaleSeg = segIndex;
        session.lastSpeedUpdate = Date.now();
        session.currentTowedTime = 0.0;
        ws.serializeAttachment(session);

        this.active_tethers.add(session.playerId);
        this.updateBeastSpeedModifier();

        const curAggro = (this.aggro_scores.get(session.playerId) || 0) + 75;
        this.aggro_scores.set(session.playerId, curAggro);

        if (this.activeHuntId) {
          this.sql.exec(
            `INSERT INTO hunt_contributions (hunt_id, hunter_id, seconds_towed, harpoons_landed)
             VALUES (?, ?, 0.0, 1)
             ON CONFLICT(hunt_id, hunter_id) DO UPDATE SET
               harpoons_landed = harpoons_landed + 1;`,
            this.activeHuntId,
            session.playerId
          );
        }

        this.broadcastToRoom({
          type: "PLAYER_TOWED_START",
          playerId: session.playerId,
          whaleSection: segIndex
        });
        break;
      }

      case "TOW_DISENGAGED":
      case "HARPOON_RELEASED":
      case "HARPOON_RELEASE":
      case "PLAYER_CRASHED":
        this.handleTowedEnd(ws, session);
        break;

      case "POSITION_UPDATED": {
        let px = 0, py = 0, pz = 0;
        let rx = 0, ry = 0, rz = 0;

        if (typeof msg.position === "string") {
          const parts = msg.position.split(",").map(Number);
          px = parts[0] || 0; py = parts[1] || 0; pz = parts[2] || 0;
        }
        if (typeof msg.rotation === "string") {
          const rParts = msg.rotation.split(",").map(Number);
          rx = rParts[0] || 0; ry = rParts[1] || 0; rz = rParts[2] || 0;
        }

        session.x = px;
        session.y = py;
        session.z = pz;
        session.rotX = rx;
        session.rotY = ry;
        session.rotZ = rz;
        ws.serializeAttachment(session);

        this.broadcastToOthers(session.playerId, {
          type: "PLAYER_MOVED",
          playerId: session.playerId,
          name: session.name,
          position: `${px},${py},${pz}`,
          rotation: `${rx},${ry},${rz}`,
          harpoonState: session.harpoonState
        });
        break;
      }

      case "LEVIATHAN_DAMAGE": {
        const dmg = Math.max(1, Number(msg.damage) || 50);
        const isCrit = Boolean(msg.isCrit);
        const actualDmg = this.isStaggered ? Math.round(dmg * 2.5) : dmg;

        this.leviathan.hp = Math.max(0, this.leviathan.hp - actualDmg);
        session.beastDamage = (session.beastDamage || 0) + actualDmg;

        const aggroDelta = isCrit ? actualDmg * 2.2 : actualDmg * 1.5;
        this.aggro_scores.set(session.playerId, (this.aggro_scores.get(session.playerId) || 0) + aggroDelta);

        this.sql.exec(
          `INSERT INTO hunters (hunter_id, display_name, total_damage_dealt)
           VALUES (?, ?, ?)
           ON CONFLICT(hunter_id) DO UPDATE SET
             total_damage_dealt = total_damage_dealt + EXCLUDED.total_damage_dealt;`,
          session.playerId,
          session.name,
          actualDmg
        );

        this.broadcastToRoom({
          type: "BEAST_DAMAGED",
          hp: this.leviathan.hp,
          maxHp: this.leviathan.maxHp,
          damage: actualDmg,
          isCrit,
          staggeredBonus: this.isStaggered,
          attackerId: session.playerId
        });

        // Check Victory Trigger: Yeti HP hit 0!
        if (this.leviathan.hp <= 0 && !this.isMatchOver) {
          this.isMatchOver = true;
          this.leviathan.speed = 0;
          this.beast_speed_modifier = 0;
          this.isStaggered = true;

          // Immediate room-wide GTA V victory broadcast
          this.broadcastToRoom({
            type: "MATCH_OVER",
            outcome: "VICTORY",
            finalHp: 0,
            killerId: session.playerId,
            killerName: session.name,
            durationSeconds: Math.round((Date.now() - this.huntStartTime) / 1000)
          });

          // Schedule room termination alarm in 15 seconds
          this.ctx.storage.setAlarm(Date.now() + 15000);
        }
        break;
      }
    }
  }

  private handleTowedEnd(ws: WebSocket, session: PlayerSession) {
    if (session.harpoonState === "TOWED") {
      session.harpoonState = "IDLE";
      this.active_tethers.delete(session.playerId);
      this.updateBeastSpeedModifier();
      ws.serializeAttachment(session);

      this.broadcastToRoom({
        type: "PLAYER_TOWED_END",
        playerId: session.playerId
      });
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean) {
    const session = ws.deserializeAttachment() as PlayerSession;
    if (session) {
      session.isDisconnected = true;
      session.lastActive = Date.now();
      ws.serializeAttachment(session);

      this.active_tethers.delete(session.playerId);
      this.updateBeastSpeedModifier();

      this.broadcastToRoom({ type: "HUNTER_CONNECTION_LOST", playerId: session.playerId });
      await this.ctx.storage.setAlarm(Date.now() + 7000);
    }
  }

  private broadcastToOthers(excludeId: string, payload: any) {
    const raw = JSON.stringify({
      type: "BATCH_UPDATE",
      timestamp: Date.now(),
      messages: [payload]
    });
    for (const ws of this.ctx.getWebSockets()) {
      const session = ws.deserializeAttachment() as PlayerSession;
      if (session && session.playerId !== excludeId && !session.isDisconnected) {
        try {
          ws.send(raw);
        } catch (e) {}
      }
    }
  }

  private broadcastToRoom(payload: any) {
    const raw = JSON.stringify({
      type: "BATCH_UPDATE",
      timestamp: Date.now(),
      messages: [payload]
    });
    for (const ws of this.ctx.getWebSockets()) {
      const session = ws.deserializeAttachment() as PlayerSession;
      if (session && !session.isDisconnected) {
        try {
          ws.send(raw);
        } catch (e) {}
      }
    }
  }
}
