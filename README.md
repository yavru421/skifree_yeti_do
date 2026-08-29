# 🎿 SkiFree 2: The Hunt for the Yeti — Architecture & Durable Object Engine

[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Durable_Objects-F38020?logo=cloudflare)](https://developers.cloudflare.com/durable-objects/)
[![Three.js](https://img.shields.io/badge/Render-Three.js_WebGL-000000?logo=three.js)](https://threejs.org/)
[![License](https://img.shields.io/badge/License-MIT-00f0ff)](LICENSE)

A high-octane 3D First-Person View (FPV) multiplayer WebGL sequel to the 1991 classic **SkiFree**, engineered with authoritative 20Hz edge physics powered by **Cloudflare Durable Objects**, zero-latency WebSockets, in-memory SQLite storage, and retro 90s audio-visual CRT synthesis.

🌐 **Production Deployment**: [`https://yeti.dondlingergc.com`](https://yeti.dondlingergc.com)

---

## 🏗️ System Architecture Overview

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
                        │                                                        │
                        │   ┌────────────────────────────────────────────────┐   │
                        │   │          Static Assets Binding (ASSETS)        │   │
                        │   │  • 3D Sprites, Audio MP3, Video MP4, Canvas    │   │
                        │   │  • $0 Bandwidth Egress Immunity                │   │
                        │   └────────────────────────────────────────────────┘   │
                        └────────────────────────────────────────────────────────┘
```

---

## ⚡ The Durable Object Engine (`MountainDO.ts`)

The central multiplayer physics and boss combat loop runs inside a Cloudflare Durable Object named **`MountainDO`**. Unlike stateless serverless functions, Durable Objects maintain persistent state in memory at the edge with single-coordinator consistency.

### 1. Authoritative 20Hz Physics Loop (`alarm()`)
Every match lobby runs an authoritative 20Hz loop via Cloudflare's `storage.setAlarm(Date.now() + 50)`:
- **Player State Integration**: Calculates downhill forward velocity, 90° lateral carving vectors, and tuck/brake states.
- **Yeti Boss AI State Machine**:
  - **`CHARGING`**: Stalks and accelerates towards closest target player ($targetSpeed + 12\text{ MPH}$).
  - **`STAGGERED`**: Triggered by critical rifle headshots ($1.0\text{s}$ slow recover window).
  - **`RETREATING`**: Backs off and repositions up the slope after inflicting limb damage.
  - **`DEAD`**: Triggers lobby victory fanfare, records kill telemetry, and spawns the next wave.
- **Yeti Bite Attack & Limb Dissociation**: When the Yeti reaches $<3.2\text{m}$ of a skier, it executes a bite attack, inflicts limb loss (left arm $\to$ right arm $\to$ skeletonized), pushes the Yeti back $30\text{m}$, and allows the player to continue skiing.
- **20Hz Delta Broadcast**: Serializes active skiers, Yeti world coordinates, HP ratios, and militia status into compressed JSON frames dispatched over active WebSockets.

### 2. WebSocket Hibernation API
`MountainDO` utilizes Cloudflare's **WebSocket Hibernation API** (`ctx.acceptWebSocket(server, [playerId])`):
- Idle connections consume **0 active CPU cycles**.
- WebSockets deserialize attached player credentials (`deserializeAttachment()`) upon receiving input packets without holding costly worker memory.

### 3. Server-Authoritative Combat & Anti-Cheat
- **Rate-Limited Fire**: Players cannot fire faster than the $120\text{ms}$ cooldown rate limit.
- **Authoritative Damage**: The client only dispatches raycast hit notifications; all damage calculations ($400\text{--}1,000\text{ HP}$ per hit) are computed server-side in `MountainDO.ts`.
- **Input Sanitization**: Callsigns are sanitized against a strict whitelist regex (`^[a-zA-Z0-9_\- ]{1,12}$`), preventing script injection into SQLite and DOM tables.

### 4. Embedded SQLite Database (`storage.sql`)
`MountainDO` uses native, zero-latency SQLite embedded directly inside the Durable Object storage:
- `global_leaderboard`: Tracks `callsign`, `max_distance`, `max_speed`, `survival_time`, `score`, and monotonic timestamp.
- `yeti_kills`: Logs `killer_callsign`, `wave`, `total_lobby_damage`, `clear_time_sec`, and timestamp.

---

## 🎮 Game Controls & Features

| Action | Key / Input |
| :--- | :--- |
| **90° Carving / Steering** | `A` / `D` or `Left` / `Right` Arrow Keys |
| **Throttle / Tuck Speed** | `W` or `Up` Arrow Key |
| **Snow Brake** | `S` or `Down` Arrow Key |
| **180° Rearview Rifle Aim** | Hold `Shift` or `Right-Click` |
| **Fire Precision Rifle** | `Left-Click` |
| **Manual Reload** | `R` (8-round magazine) |
| **In-Game Menu / Leaderboard** | `ESC` or `M` or Top-Right HUD Button |
| **Speed Difficulty Presets** | `1` (Easy: 20-45 MPH) • `2` (Medium: 28-60 MPH) • `3` (Pro: 38-85 MPH) |
| **CRT Scanline Overlay** | `C` |

---

## 🚀 Deployment & Local Development

### 1. Prerequisites
- Node.js `v18+`
- Cloudflare Wrangler CLI (`npm install -g wrangler`)
- Cloudflare Workers Paid Plan (required for Durable Objects)

### 2. Local Simulation
```bash
git clone https://github.com/yavru421/skifree_yeti_do.git
cd skifree_yeti_do
npm install
npx wrangler dev
```

### 3. Live Edge Deployment
```bash
npx wrangler deploy
```

The custom domain route `yeti.dondlingergc.com` will automatically bind to the Worker, provision edge TLS certificates, and route requests to the nearest global Cloudflare data center.

---

## 🛡️ Cost & Zero-Liability Guarantee
- **$0 Bandwidth Egress**: All media, Three.js bundles, MP3 soundtrack streams, and video teaser trailers are served through Cloudflare Static Assets with zero egress charges.
- **Durable Object Flat Economics**: 1 match lobby running continuously for 1 hour consumes $\approx 460.8\text{ GB-s}$, costing $<\$0.00006/\text{hour}$.
