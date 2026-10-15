# 🎿 SkiFree 2: The Hunt for the Yeti

[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers_%2B_D1-F38020?logo=cloudflare)](https://developers.cloudflare.com/d1/)
[![Babylon.js](https://img.shields.io/badge/Render-Babylon.js_7.0_WebGPU%2FWebGL2-bb464b)](https://www.babylonjs.com/)
[![License](https://img.shields.io/badge/License-MIT-00f0ff)](LICENSE)

A high-octane 3D downhill & Steam-Harpoon boss-hunting sequel to the 1991 classic **SkiFree**, powered by **Babylon.js 7.0 (WebGPU / WebGL2)**, **Ski-Boat Tow** cable physics, Granby Ranch topographic runs, and a zero-liability **Cloudflare Workers + D1 SQLite** edge backend.

🌐 **Production Deployment**: [`https://yeti.dondlingergc.com`](https://yeti.dondlingergc.com)

---

## 🎮 Game Controls & Mechanics

| Action | Key / Input |
| :--- | :--- |
| **Carve Left / Right** | `A` / `D` or `Left` / `Right` Arrow Keys |
| **Aerodynamic Tuck (Boost)** | `W` or `Up` Arrow Key |
| **Snow Brake / Cable Drag** | `S` or `Down` Arrow Key |
| **Fire Steam-Harpoon** | `Left-Click`, `F`, or `Enter` |
| **Jump Moguls / Obstacles** | `Space` (when untethered) |
| **Turbo Winch Reel Mash** | Rapidly tap `Space`, `F`, `Enter`, or the glowing **TAP!** button (when tethered) |
| **Manual Reload** | `R` (8-round magazine) |
| **Toggle 3rd / 1st Person Camera** | `C` |
| **Toggle Retro CRT Scanlines** | `V` |
| **Match Telemetry Report** | `Tab` (on Level Clear / Run Failed screen) |

---

## 🚀 Build & Deployment

```bash
npm run verify
npx wrangler deploy
```
