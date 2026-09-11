# SkiFree 2: Phase II — Comprehensive Architecture & Technical Specifications

Architectural review and system design specification for **SkiFree 2: The Hunt for the Yeti** (`yavru421/skifree_yeti_do`).

---

## 1. Executive Summary & Core Paradigm
**SkiFree 2: The Hunt for the Yeti** transforms the classic 1991 2D game into a high-octane **3D First-Person View (FPV) WebGL experience** powered by Cloudflare's serverless edge infrastructure.

The defining architectural decision is using an **authoritative serverless model** where the Cloudflare Worker (`index.ts`) acts as a smart router, and a dedicated **Cloudflare Durable Object (`MountainDO.ts`)** runs a single-threaded, strongly consistent 20Hz physics and game state loop. The system is deployed live at `yeti.dondlingergc.com`.

```
                        ┌────────────────────────────────────────────────────────┐
                        │              Cloudflare Edge Network                   │
                        │                                                        │
┌──────────────┐        │   ┌────────────────────────────────────────────────┐   │
│ Client (FPV) │◄───────┼──►│             Worker Router (index.ts)           │   │
│ Three.js     │        │   │  • / (landing.html)  • /play (index.html)      │   │
│ Audio Engine │        │   │  • /api/scores       • Security CSP Headers    │   │
└──────────────┘        │   └───────────────────────┬────────────────────────┘   │
      ▲                 │                           │                            │
      │ WebSocket (20Hz)│                           ▼                            │
      │ WSS /ws?callsign│   ┌────────────────────────────────────────────────┐   │
      └─────────────────┼──►│          MountainDO (Durable Object)           │   │
                        │   │  • Authoritative 20Hz Tick Physics Engine      │   │
                        │   │  • Yeti State Machine (Charge/Stagger/Bite)    │   │
                        │   │  • Multi-Wave Health & Difficulty Scaling      │   │
                        │   │  • Anti-Cheat Shoot Throttle & Sanitize        │   │
                        │   │  • Embedded SQLite (storage.sql) Ledger        │   │
                        │   └────────────────────────────────────────────────┘   │
                        └────────────────────────────────────────────────────────┘
```

---

## 2. Deep Dive: Edge Engine Architecture (`MountainDO.ts`)

### **Authoritative 20Hz Tick Physics Loop**
* **Alarm Scheduling**: The match lobby loop drives physics state updates by setting recurring alarms via `storage.setAlarm(Date.now() + 50)`.
* **Skier Physics**: Calculates downhill forward velocity, 90° lateral carving vectors, and tuck/brake states on each tick.
* **State Broadcast**: Every 50ms (20Hz), compressed JSON state frames—containing active skier positions, Yeti coordinates, health ratios, and militia status—are broadcast across connected WebSockets.

### **Yeti Boss AI State Machine**
The Yeti AI is governed by an explicit four-stage finite state machine:
1. **`CHARGING`**: Stalks and accelerates towards the nearest player at `targetSpeed + 12 MPH`.
2. **`STAGGERED`**: Triggered when receiving critical rifle headshots, inducing a 1.0-second recovery slowdown window.
3. **`RETREATING`**: Backs off and repositions 30 meters up the slope after inflicting damage.
4. **`DEAD`**: Triggers lobby victory fanfare, logs telemetry, and initiates the next boss wave.

### **Mechanic Highlight: Limb Dissociation**
When the Yeti comes within **< 3.2 meters** of a skier, it executes a bite attack that inflicts progressive limb loss (**Left Arm → Right Arm → Skeletonized**). Rather than causing an immediate game-over, the bite knocks the Yeti back 30 meters, enabling the player to continue skiing downhill in a damaged state.

---

## 3. Networking, Protocol & Security

* **WebSocket Hibernation API**: By accepting connections with `ctx.acceptWebSocket(server, [playerId])`, idle lobbies consume **0 active CPU cycles**. On incoming frames, connection attachments are deserialized (`deserializeAttachment()`) without maintaining expensive in-memory state.
* **Telemetry Protocol**: Uses the **Dynamic State-Matrix Telemetry (DSMT)** specification outlined in `METROPOLIS_DSMT_PROTOCOL.md`.
* **Server-Authoritative Combat & Anti-Cheat**:
  * **Rate Limiting**: Fire input is strictly throttle-capped at a **120ms cooldown**.
  * **Damage Validation**: Clients send raycast hit notifications, but damage calculations (**400–1,000 HP per hit**) are computed authoritatively on `MountainDO.ts`.
  * **Input Sanitization**: Callsigns are validated against `^[a-zA-Z0-9_\- ]{1,12}$`, blocking script injection into SQLite ledgers and DOM elements.

---

## 4. Embedded Persistence & Data Layer (`storage.sql`)

The Durable Object utilizes zero-latency **embedded SQLite storage** (`storage.sql` / `schema.sql`) directly inside the instance:
* **`global_leaderboard`**: Stores `callsign`, `max_distance`, `max_speed`, `survival_time`, `score`, and monotonic timestamps.
* **`yeti_kills`**: Records `killer_callsign`, `wave`, `total_lobby_damage`, `clear_time_sec`, and kill timestamps.

---

## 5. Client Rendering & Quality of Life Features

* **3D FPV Graphics**: Rendered using **Three.js** with retro 90s CRT scanline overlays (toggled via `C`).
* **Tactical Aiming**: Features a 180° rearview rifle aim (Hold `Shift` or Right-Click) and manual magazine reloading (`R`, 8-round magazine).
* **Preset Velocities**:
  * **1 (Easy)**: 20–45 MPH.
  * **2 (Medium)**: 28–60 MPH.
  * **3 (Pro)**: 38–85 MPH.
* **Recent QoL Polish**: Recent commits introduce 350ms drop-in key debouncing, socket queue buffering, fog visibility calibration, and Havok Physics asset resolution fixes.

---

## 6. Infrastructure Economics & Operational Profile

* **$0 Bandwidth Egress**: Three.js bundles, MP3 sound streams, and static media are bound via Cloudflare Static Assets (`ASSETS`), avoiding bandwidth egress fees.
* **Micro-Compute Costs**: Running a match lobby continuously for 1 hour consumes ≈ 460.8 GB-s, resulting in an operational cost of less than **$0.00006 per hour**.
