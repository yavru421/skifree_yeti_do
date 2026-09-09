/**
 * SkiFree Yeti DO - HUD & Retro CRT Display System
 * Provides DOM-based high-performance overlay with CRT scanline toggles (C key),
 * real-time speedometer (MPH), wave tracker, Yeti HP bar, magazine counter,
 * limb status indicators, and leaderboard modal.
 */

import { LimbStatus, LeaderboardEntry } from "./types";

export class HUDManager {
  private overlayContainer: HTMLElement;
  private speedElement: HTMLElement;
  private waveElement: HTMLElement;
  private yetiHpBar: HTMLElement;
  private ammoElement: HTMLElement;
  private limbElement: HTMLElement;
  private crtOverlay: HTMLElement;
  private isCrtActive: boolean = true;

  constructor() {
    this.overlayContainer = document.getElementById("game-hud") || this.createHUDContainer();
    this.speedElement = document.getElementById("hud-speed") || this.createChild("hud-speed");
    this.waveElement = document.getElementById("hud-wave") || this.createChild("hud-wave");
    this.yetiHpBar = document.getElementById("hud-yeti-hp-fill") || this.createChild("hud-yeti-hp-fill");
    this.ammoElement = document.getElementById("hud-ammo") || this.createChild("hud-ammo");
    this.limbElement = document.getElementById("hud-limb") || this.createChild("hud-limb");
    this.crtOverlay = document.getElementById("crt-overlay") || this.createCRTOverlay();

    this.setupKeyboardListeners();
  }

  private createHUDContainer(): HTMLElement {
    const div = document.createElement("div");
    div.id = "game-hud";
    div.style.position = "absolute";
    div.style.top = "0";
    div.style.left = "0";
    div.style.width = "100%";
    div.style.height = "100%";
    div.style.pointerEvents = "none";
    div.style.zIndex = "100";
    div.style.fontFamily = "'Courier New', Courier, monospace";
    div.style.color = "#00ffcc";
    div.style.textShadow = "0 0 8px rgba(0, 255, 204, 0.7)";
    document.body.appendChild(div);
    return div;
  }

  private createChild(id: string): HTMLElement {
    const el = document.createElement("div");
    el.id = id;
    this.overlayContainer.appendChild(el);
    return el;
  }

  private createCRTOverlay(): HTMLElement {
    const crt = document.createElement("div");
    crt.id = "crt-overlay";
    crt.style.position = "absolute";
    crt.style.top = "0";
    crt.style.left = "0";
    crt.style.width = "100vw";
    crt.style.height = "100vh";
    crt.style.pointerEvents = "none";
    crt.style.zIndex = "150";
    crt.style.background =
      "linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.35) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.04), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.04))";
    crt.style.backgroundSize = "100% 3px, 6px 100%";
    document.body.appendChild(crt);
    return crt;
  }

  private setupKeyboardListeners(): void {
    window.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "c" || e.key === "C") {
        this.toggleCRT();
      }
    });
  }

  public toggleCRT(): boolean {
    this.isCrtActive = !this.isCrtActive;
    this.crtOverlay.style.display = this.isCrtActive ? "block" : "none";
    return this.isCrtActive;
  }

  public update(
    speedMph: number,
    wave: number,
    yetiHp: number,
    maxYetiHp: number,
    ammo: number,
    isReloading: boolean,
    limbStatus: LimbStatus
  ): void {
    this.speedElement.innerHTML = `SPEED: <span style="font-size: 1.4em; color: #fff;">${Math.round(speedMph)}</span> MPH`;
    this.waveElement.innerHTML = `WAVE: <span style="color: #ff3366;">${wave}</span>`;

    const hpPercent = Math.max(0, Math.min(100, (yetiHp / maxYetiHp) * 100));
    this.yetiHpBar.style.width = `${hpPercent}%`;
    this.yetiHpBar.style.backgroundColor = hpPercent > 30 ? "#00ffcc" : "#ff0055";

    if (isReloading) {
      this.ammoElement.innerHTML = `<span style="color: #ffaa00; animation: blink 0.5s infinite;">RELOADING...</span>`;
    } else {
      let bullets = "";
      for (let i = 0; i < 8; i++) {
        bullets += i < ammo ? "▮ " : "▯ ";
      }
      this.ammoElement.innerHTML = `RIFLE: <span style="color: #ffff00;">${bullets}</span>`;
    }

    let limbText = "STATUS: ARMS INTACT";
    let limbColor = "#00ffcc";
    if (limbStatus === LimbStatus.LEFT_ARM_LOST) {
      limbText = "STATUS: LEFT ARM BITTEN OFF (-20% STEER)";
      limbColor = "#ffaa00";
    } else if (limbStatus === LimbStatus.BOTH_ARMS_LOST) {
      limbText = "STATUS: BOTH ARMS SEVERED (-50% STEER)";
      limbColor = "#ff3333";
    } else if (limbStatus === LimbStatus.SKELETONIZED) {
      limbText = "STATUS: SKELETONIZED (CRITICAL)";
      limbColor = "#ff0000";
    }
    this.limbElement.innerHTML = `<span style="color: ${limbColor};">${limbText}</span>`;
  }
}
