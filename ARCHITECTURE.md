# SkiFree 2: Phase II — Comprehensive Architecture & Technical Specifications

Architectural specification for **SkiFree 2: The Hunt for the Yeti** (`yeti.dondlingergc.com`).

---

## 1. Executive Summary & Core Paradigm
**SkiFree 2: The Hunt for the Yeti** reimagines the 1991 2D classic as a **60 FPS 3D Downhill & Steam-Harpoon Boss Hunt** built on **Babylon.js 7.0 (WebGPU / WebGL2)** and deployed on **Cloudflare Workers + D1 SQLite** under the **Zero-Liability (`$0.00` Wall-Clock Compute) Invariant**.

All 60Hz downhill ski kinematics, mogul suspension, hitscan ballistics, and Yeti boss AI run 100% client-side with 0ms network latency, while the stateless Cloudflare Worker (`src/index.ts`) serves static assets (`ASSETS`) and persists global leaderboards, PIN-locked callsigns, and player beta feedback in Cloudflare D1 (`skifree-global-db`).

```
┌────────────────────────────────────────────────────────┐
│              Cloudflare Edge Network                   │
│                                                        │
│   ┌────────────────────────────────────────────────┐   │
│   │         Stateless Worker Router (index.ts)     │   │
│   │  • GET/POST /api/scores (PIN-Locked Standings) │   │
│   │  • GET/POST /api/feedback (Beta Issue Tracker) │   │
│   │  • Static Asset Binding (ASSETS - $0 Egress)   │   │
│   └───────────────────────┬────────────────────────┘   │
│                           │                            │
│                           ▼                            │
│   ┌────────────────────────────────────────────────┐   │
│   │       Cloudflare D1 SQLite (skifree-global-db) │   │
│   │  • global_leaderboard (callsign, wave, score)  │   │
│   │  • callsign_pins (4-digit PIN ownership lock)  │   │
│   │  • beta_feedback (live bug & balance reports)  │   │
│   └────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────┘
```

---

## 2. Client Engine Architecture (`src/client/`)

* **[`main.ts`](file:///c:/dev/skifree-yeti-do/src/client/main.ts)**: Master game loop (`tick()`), downhill carving kinematics, **Ski-Boat Tow** spring-tether physics, level progression across Granby Ranch runs, cutscene orchestration, and D1 API integration.
* **[`yeti.ts`](file:///c:/dev/skifree-yeti-do/src/client/yeti.ts)**: 3D rigged Yeti boss (`yeti.glb`), quadrupedal gallop kinematics, flank weak-point vulnerability switching, **Harpoon Ski-Boat Surge** (`triggerHarpoonSurge()`), and 220m finish-line Turnaround Ambush Showdown.
* **[`combat.ts`](file:///c:/dev/skifree-yeti-do/src/client/combat.ts) & [`harpoon.ts`](file:///c:/dev/skifree-yeti-do/src/client/harpoon.ts)**: Hitscan raycast combat with smart auto-aim magnetism, CS:GO-style dynamic crosshair bloom, floating damage numbers, brass Steam-Harpoon cannon (1st-person & 3rd-person rigs), and catenary steel towline cable.
* **[`skierAvatar.ts`](file:///c:/dev/skifree-yeti-do/src/client/skierAvatar.ts) & [`camera.ts`](file:///c:/dev/skifree-yeti-do/src/client/camera.ts)**: Blender 5.2 `skier.glb` downhill racer with volumetric Gaussian powder snow spray, 3rd-person mounted Steam-Harpoon cannon, and dual-mode (`third_person` / `first_person`) camera rig with 3-phase takedown orbit cutscenes.
* **[`terrain.ts`](file:///c:/dev/skifree-yeti-do/src/client/terrain.ts) & [`granbyTracks.ts`](file:///c:/dev/skifree-yeti-do/src/client/granbyTracks.ts)**: Procedural Granby Ranch runs (rod-and-gun green to double-black diamond), 3D mogul fields, slalom gates, and Nitro Wax / Cryo Harpoon power-ups.

---

## 3. Ski-Boat Tow & Takedown Mechanics

1. **Harpoon Impact & Ski-Boat Surge**: Landing a harpoon hit locks the braided steel towline onto the Yeti and triggers `yetiEntity.triggerHarpoonSurge()`. The Yeti takes off down the fall-line at `1.42x` speed, towing the skier behind it like a ski-boat between `11m–34m`.
2. **Progressive Level Takedown**:
   * **Level 1**: Landing a direct harpoon hit initiates an immediate high-speed ski-boat tow surge into a guaranteed knockdown so players immediately experience the takedown cutscene and advance to Level 2.
   * **Level 2+**: Players rapidly mash `Space` / `Click` on the glowing **TAP!** winch button or hold `S` while carving `A` / `D` across the fall-line to saw the steel cable, drain the Yeti's HP, and reel the beast inside `< 8.5m` for a point-blank takedown.
