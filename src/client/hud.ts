/**
 * SkiFree Yeti DO - HUD & Retro CRT Display System
 * Provides DOM-based high-performance overlay with CRT scanline toggles (C key),
 * real-time speedometer (MPH), wave tracker, Yeti HP bar, magazine counter,
 * limb status indicators, and leaderboard modal.
 */

import { LimbStatus, LeaderboardEntry } from "./types";

export class HUDManager {
  private csgoHpElement: HTMLElement | null;
  private csgoAmmoElement: HTMLElement | null;
  private isCrtActive: boolean = false;

  constructor() {
    this.csgoHpElement = document.getElementById("csgo-hp-val");
    this.csgoAmmoElement = document.getElementById("csgo-ammo-val");

    // Optional: Setup CRT toggle if you still want retro overlay on 'C'
    const crtOverlay = document.getElementById("crt-overlay");
    if (!crtOverlay) {
      const crt = document.createElement("div");
      crt.id = "crt-overlay";
      crt.style.position = "absolute";
      crt.style.top = "0";
      crt.style.left = "0";
      crt.style.width = "100vw";
      crt.style.height = "100vh";
      crt.style.pointerEvents = "none";
      crt.style.zIndex = "150";
      crt.style.display = "none";
      crt.style.background =
        "linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.35) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.04), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.04))";
      crt.style.backgroundSize = "100% 3px, 6px 100%";
      document.body.appendChild(crt);
    }
    this.setupKeyboardListeners();
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
    const crt = document.getElementById("crt-overlay");
    if (crt) crt.style.display = this.isCrtActive ? "block" : "none";
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
    // 1. Update Player HP (Derived from LimbStatus for now, or default 100)
    if (this.csgoHpElement) {
      if (limbStatus === LimbStatus.SKELETONIZED) {
        this.csgoHpElement.innerText = "0";
        this.csgoHpElement.style.color = "#ff0033";
      } else if (limbStatus === LimbStatus.BOTH_ARMS_LOST) {
        this.csgoHpElement.innerText = "30";
        this.csgoHpElement.style.color = "#ff3333";
      } else if (limbStatus === LimbStatus.LEFT_ARM_LOST) {
        this.csgoHpElement.innerText = "65";
        this.csgoHpElement.style.color = "#ffff00";
      } else {
        this.csgoHpElement.innerText = "100";
        this.csgoHpElement.style.color = "#00ff66";
      }
    }

    // 2. Update Weapon Ammo (Harpoon charges)
    if (this.csgoAmmoElement) {
      if (isReloading) {
        this.csgoAmmoElement.innerHTML = `<span style="color:#ffaa00; font-size:16px;">[ REWIND ]</span>`;
      } else {
        this.csgoAmmoElement.innerText = ammo.toString();
      }
    }
  }

  public addKillfeedMessage(message: string): void {
    const killfeed = document.getElementById("csgo-killfeed");
    if (!killfeed) return;

    const row = document.createElement("div");
    row.className = "killfeed-row";
    row.innerHTML = message;
    
    // Add to top of list
    killfeed.insertBefore(row, killfeed.firstChild);

    // Keep max 4 messages
    if (killfeed.children.length > 4) {
      killfeed.removeChild(killfeed.lastChild!);
    }

    // Auto-remove after 4 seconds
    setTimeout(() => {
      if (row.parentElement === killfeed) {
        killfeed.removeChild(row);
      }
    }, 4000);
  }
}
