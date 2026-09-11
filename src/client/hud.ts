/**
 * SkiFree Yeti DO - Tactical Competitive HUD & Retro CRT Display System
 * Elevates gameplay to CS:GO and Fortnite competitive standards:
 * - Dynamic Crosshair Bloom (expands with speed & firing, decays on steady aim)
 * - Crisp Directional Hit Markers (\ / / \) with glowing gold headshot / white body feedback
 * - Floating Damage Numbers (animated popups with physics bounce)
 * - Top-Right Tactical Action Feed ([Skier] 🎯 HARPOON [Yeti])
 * - Radial Reload Progress Wheel (animated SVG circular sweep)
 * - Downhill Threat Compass & Yeti Radar bearing tracker
 * - Segmented Health (5 blocks green/yellow/red) & Tuck Stamina (cyan electric blocks)
 * - Post-Match Competitive Stats Screen (Accuracy %, DPS, Distance, Rank)
 */

import { LimbStatus } from "./types";

export interface PostMatchStats {
  accuracy: number;
  dps: number;
  distance: number;
  totalShots: number;
  hitsCount: number;
  headshotsCount: number;
  rank: string;
}

export class HUDManager {
  private csgoHpElement: HTMLElement | null;
  private csgoAmmoElement: HTMLElement | null;
  private isCrtActive: boolean = false;

  // Crosshair Elements & Bloom State
  private chTop: HTMLElement | null = null;
  private chBottom: HTMLElement | null = null;
  private chLeft: HTMLElement | null = null;
  private chRight: HTMLElement | null = null;
  private csgoCrosshair: HTMLElement | null = null;
  private targetLockBadge: HTMLElement | null = null;
  private bloomSpread: number = 0;

  // Directional Hitmarker Overlay
  private hitmarkerOverlay: HTMLElement | null = null;
  private hitmarkerTimeout: number | null = null;

  // Floating Damage Numbers Container
  private dmgContainer: HTMLElement | null = null;

  // Tactical Action Feed
  private tacticalKillfeed: HTMLElement | null = null;

  // Radial Reload Wheel
  private radialReloadSvg: HTMLElement | null = null;
  private radialReloadCircle: SVGCircleElement | null = null;
  private reloadAnimationId: number | null = null;

  // Downhill Threat Compass / Radar
  private compassYetiPip: HTMLElement | null = null;
  private compassThreatBadge: HTMLElement | null = null;
  private compassDegreeText: HTMLElement | null = null;

  // Segmented Gauges
  private segmentedHpBar: HTMLElement | null = null;
  private segmentedStaminaBar: HTMLElement | null = null;

  // Post-Match Modal
  private postMatchModal: HTMLElement | null = null;

  constructor() {
    this.csgoHpElement = document.getElementById("csgo-hp-val");
    this.csgoAmmoElement = document.getElementById("csgo-ammo-val");

    this.initCrosshairElements();
    this.initHitmarkerOverlay();
    this.initDamageContainer();
    this.initTacticalKillfeed();
    this.initRadialReload();
    this.initCompassElements();
    this.initSegmentedGauges();
    this.initPostMatchModal();

    // Optional CRT overlay
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

  // ==========================================
  // 1. DYNAMIC CROSSHAIR BLOOM (CS:GO STYLE)
  // ==========================================
  private initCrosshairElements(): void {
    this.chTop = document.querySelector(".ch-top");
    this.chBottom = document.querySelector(".ch-bottom");
    this.chLeft = document.querySelector(".ch-left");
    this.chRight = document.querySelector(".ch-right");
    this.csgoCrosshair = document.getElementById("csgo-crosshair");
  }

  public updateLockIndicator(isLocked: boolean, targetName: string = "BEAST"): void {
    if (!this.csgoCrosshair) {
      this.csgoCrosshair = document.getElementById("csgo-crosshair");
      if (!this.csgoCrosshair) return;
    }

    if (isLocked) {
      this.csgoCrosshair.classList.add("target-locked");
      if (!this.targetLockBadge) {
        this.targetLockBadge = document.createElement("div");
        this.targetLockBadge.id = "target-lock-badge";
        this.targetLockBadge.className = "target-lock-badge";
        this.targetLockBadge.innerHTML = `<span>🎯 LOCKED [${targetName}]</span>`;
        this.csgoCrosshair.appendChild(this.targetLockBadge);
      }
      this.targetLockBadge.style.opacity = "1";
    } else {
      this.csgoCrosshair.classList.remove("target-locked");
      if (this.targetLockBadge) {
        this.targetLockBadge.style.opacity = "0";
      }
    }
  }

  public triggerBloomKick(amount: number = 18): void {
    this.bloomSpread = Math.min(32, this.bloomSpread + amount);
  }

  public updateCrosshair(speedMph: number, isTucking: boolean, deltaTime: number): void {
    // Decay firing bloom spread exponentially
    if (this.bloomSpread > 0.05) {
      this.bloomSpread = Math.max(0, this.bloomSpread - this.bloomSpread * Math.min(1.0, deltaTime * 16.0));
    } else {
      this.bloomSpread = 0;
    }

    // Dynamic speed gap: tucking tightens grouping, high velocity spreads
    const speedRatio = Math.min(1.5, speedMph / 65);
    const speedGap = isTucking ? speedRatio * 3.5 : speedRatio * 9.0;
    const totalGap = Math.round(5 + speedGap + this.bloomSpread);

    if (this.chTop) this.chTop.style.transform = `translateY(-${totalGap}px)`;
    if (this.chBottom) this.chBottom.style.transform = `translateY(${totalGap}px)`;
    if (this.chLeft) this.chLeft.style.transform = `translateX(-${totalGap}px)`;
    if (this.chRight) this.chRight.style.transform = `translateX(${totalGap}px)`;
  }

  // ==========================================
  // 2. DIRECTIONAL HITMARKERS (FORTNITE / CS)
  // ==========================================
  private initHitmarkerOverlay(): void {
    let hm = document.getElementById("hitmarker-overlay");
    if (!hm) {
      hm = document.createElement("div");
      hm.id = "hitmarker-overlay";
      hm.className = "hitmarker-container";
      hm.innerHTML = `
        <div class="hm-line hm-tl"></div>
        <div class="hm-line hm-tr"></div>
        <div class="hm-line hm-bl"></div>
        <div class="hm-line hm-br"></div>
      `;
      document.body.appendChild(hm);
    }
    this.hitmarkerOverlay = hm;
  }

  public triggerHitmarker(isHeadshot: boolean, damage: number): void {
    if (!this.hitmarkerOverlay) return;

    if (this.hitmarkerTimeout !== null) {
      window.clearTimeout(this.hitmarkerTimeout);
    }

    this.hitmarkerOverlay.classList.remove("active", "hm-gold", "hm-white");
    void this.hitmarkerOverlay.offsetWidth; // Force reflow

    this.hitmarkerOverlay.classList.add("active");
    this.hitmarkerOverlay.classList.add(isHeadshot ? "hm-gold" : "hm-white");

    this.hitmarkerTimeout = window.setTimeout(() => {
      if (this.hitmarkerOverlay) {
        this.hitmarkerOverlay.classList.remove("active", "hm-gold", "hm-white");
      }
    }, isHeadshot ? 160 : 120);

    // Also spawn floating damage number
    this.spawnFloatingDamage(damage, isHeadshot);
  }

  // ==========================================
  // 3. FLOATING DAMAGE NUMBERS
  // ==========================================
  private initDamageContainer(): void {
    this.dmgContainer = document.getElementById("floating-dmg-container");
    if (!this.dmgContainer) {
      this.dmgContainer = document.createElement("div");
      this.dmgContainer.id = "floating-dmg-container";
      document.body.appendChild(this.dmgContainer);
    }
  }

  public spawnFloatingDamage(damage: number, isHeadshot: boolean): void {
    if (!this.dmgContainer) return;

    const popup = document.createElement("div");
    popup.className = `dmg-popup ${isHeadshot ? "dmg-crit" : "dmg-normal"}`;

    // Center screen with slight random scatter (-24px to +24px)
    const scatterX = (Math.random() - 0.5) * 48;
    const scatterY = (Math.random() - 0.5) * 32;
    const centerX = window.innerWidth / 2 + scatterX;
    const centerY = window.innerHeight / 2 - 40 + scatterY;

    popup.style.left = `${centerX}px`;
    popup.style.top = `${centerY}px`;

    if (isHeadshot) {
      popup.innerHTML = `<span>🎯 ${damage}</span><span class="crit-tag">CRIT!</span>`;
    } else {
      popup.innerText = `${damage}`;
    }

    this.dmgContainer.appendChild(popup);

    setTimeout(() => {
      if (popup.parentElement === this.dmgContainer) {
        this.dmgContainer!.removeChild(popup);
      }
    }, 780);
  }

  // ==========================================
  // 4. TOP-RIGHT TACTICAL ACTION FEED
  // ==========================================
  private initTacticalKillfeed(): void {
    this.tacticalKillfeed = document.getElementById("tactical-killfeed");
    if (!this.tacticalKillfeed) {
      this.tacticalKillfeed = document.createElement("div");
      this.tacticalKillfeed.id = "tactical-killfeed";
      this.tacticalKillfeed.className = "tactical-killfeed";
      document.body.appendChild(this.tacticalKillfeed);
    }
  }

  public addTacticalFeed(
    attacker: string,
    icon: string,
    victim: string,
    detail: string = "",
    isCrit: boolean = false
  ): void {
    if (!this.tacticalKillfeed) return;

    const row = document.createElement("div");
    row.className = `killfeed-card ${isCrit ? "crit-event" : ""}`;
    row.innerHTML = `
      <span class="kf-attacker">${attacker}</span>
      <span class="kf-icon">${icon}</span>
      <span class="kf-victim">${victim}</span>
      ${detail ? `<span class="kf-detail">${detail}</span>` : ""}
    `;

    this.tacticalKillfeed.insertBefore(row, this.tacticalKillfeed.firstChild);

    // Limit to 4 cards max
    while (this.tacticalKillfeed.children.length > 4) {
      this.tacticalKillfeed.removeChild(this.tacticalKillfeed.lastChild!);
    }

    setTimeout(() => {
      if (row.parentElement === this.tacticalKillfeed) {
        row.classList.add("fade-out");
        setTimeout(() => {
          if (row.parentElement === this.tacticalKillfeed) {
            this.tacticalKillfeed!.removeChild(row);
          }
        }, 300);
      }
    }, 4200);
  }

  public addKillfeedMessage(message: string): void {
    // Compatibility wrapper for legacy calls
    this.addTacticalFeed("TACTICAL", "⚡", message);
  }

  // ==========================================
  // 5. RADIAL RELOAD WHEEL
  // ==========================================
  private initRadialReload(): void {
    this.radialReloadSvg = document.getElementById("radial-reload-wheel");
    this.radialReloadCircle = document.querySelector("#radial-reload-wheel .reload-progress-circle");
  }

  public startReload(durationMs: number = 1600): void {
    if (!this.radialReloadSvg || !this.radialReloadCircle) return;

    this.radialReloadSvg.style.display = "block";
    const circumference = 2 * Math.PI * 26; // r=26 -> ~163.36px
    this.radialReloadCircle.style.strokeDasharray = `${circumference}`;
    this.radialReloadCircle.style.strokeDashoffset = `${circumference}`;

    const startTime = performance.now();

    const animateReload = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(1.0, elapsed / durationMs);
      const offset = circumference * (1.0 - progress);

      if (this.radialReloadCircle) {
        this.radialReloadCircle.style.strokeDashoffset = `${offset}`;
      }

      if (progress < 1.0) {
        this.reloadAnimationId = requestAnimationFrame(animateReload);
      } else {
        this.endReload();
      }
    };

    if (this.reloadAnimationId !== null) {
      cancelAnimationFrame(this.reloadAnimationId);
    }
    this.reloadAnimationId = requestAnimationFrame(animateReload);
  }

  public endReload(): void {
    if (this.reloadAnimationId !== null) {
      cancelAnimationFrame(this.reloadAnimationId);
      this.reloadAnimationId = null;
    }
    if (this.radialReloadSvg) {
      this.radialReloadSvg.style.display = "none";
    }
  }

  // ==========================================
  // 6. DOWNHILL THREAT COMPASS & YETI RADAR
  // ==========================================
  private initCompassElements(): void {
    this.compassYetiPip = document.getElementById("compass-yeti-pip");
    this.compassThreatBadge = document.getElementById("compass-threat-badge");
    this.compassDegreeText = document.getElementById("compass-degree-text");
  }

  public updateCompass(
    cameraYaw: number,
    playerX: number,
    playerZ: number,
    yetiX: number,
    yetiZ: number,
    isYetiActive: boolean
  ): void {
    if (!this.compassYetiPip || !this.compassThreatBadge) return;

    if (!isYetiActive) {
      this.compassYetiPip.style.opacity = "0";
      this.compassThreatBadge.style.opacity = "0";
      return;
    }

    // Downhill bearing is 0 rad (South along -Z)
    // Calculate angle from player to Yeti
    const dx = yetiX - playerX;
    const dz = yetiZ - playerZ;
    const distToYeti = Math.round(Math.hypot(dx, dz));

    // World angle to Yeti in radians (downhill along -Z is 0 rad)
    const angleToYeti = Math.atan2(dx, -dz);

    // Relative angle relative to camera view
    let relativeAngle = angleToYeti - cameraYaw;
    while (relativeAngle < -Math.PI) relativeAngle += Math.PI * 2;
    while (relativeAngle > Math.PI) relativeAngle -= Math.PI * 2;

    // Map angle (-PI to PI) onto horizontal compass tape (-120px to +120px)
    const compassWidthPx = 240;
    const maxViewAngle = Math.PI * 0.55; // ~100 deg FOV
    const clampedAngle = Math.max(-maxViewAngle, Math.min(maxViewAngle, relativeAngle));
    const pipOffset = (clampedAngle / maxViewAngle) * (compassWidthPx / 2);

    this.compassYetiPip.style.transform = `translateX(${pipOffset}px)`;
    this.compassYetiPip.style.opacity = "1";

    if (distToYeti < 85) {
      this.compassThreatBadge.style.opacity = "1";
      this.compassThreatBadge.innerHTML = `<span class="threat-pulse">⚠️ YETI CLOSING: ${distToYeti}m</span>`;
      if (distToYeti < 35) {
        this.compassThreatBadge.classList.add("threat-danger");
      } else {
        this.compassThreatBadge.classList.remove("threat-danger");
      }
    } else {
      this.compassThreatBadge.style.opacity = "0";
    }

    if (this.compassDegreeText) {
      const headingDeg = Math.round(((cameraYaw % (Math.PI * 2)) / (Math.PI * 2)) * 360);
      const normalizedDeg = (headingDeg + 360) % 360;
      this.compassDegreeText.innerText = `${normalizedDeg}° DOWNHILL`;
    }
  }

  // ==========================================
  // 7. SEGMENTED HP & TUCK STAMINA GAUGES
  // ==========================================
  private initSegmentedGauges(): void {
    this.segmentedHpBar = document.getElementById("segmented-hp-bar");
    this.segmentedStaminaBar = document.getElementById("segmented-stamina-bar");

    if (this.segmentedHpBar && this.segmentedHpBar.children.length === 0) {
      for (let i = 0; i < 5; i++) {
        const seg = document.createElement("div");
        seg.className = "gauge-seg hp-seg active";
        this.segmentedHpBar.appendChild(seg);
      }
    }

    if (this.segmentedStaminaBar && this.segmentedStaminaBar.children.length === 0) {
      for (let i = 0; i < 5; i++) {
        const seg = document.createElement("div");
        seg.className = "gauge-seg stamina-seg active";
        this.segmentedStaminaBar.appendChild(seg);
      }
    }
  }

  public updateSegmentedGauges(hpRatio: number, staminaRatio: number): void {
    if (this.segmentedHpBar) {
      const hpSegments = this.segmentedHpBar.children;
      const activeHpCount = Math.ceil(hpRatio * hpSegments.length);
      for (let i = 0; i < hpSegments.length; i++) {
        const seg = hpSegments[i] as HTMLElement;
        if (i < activeHpCount) {
          seg.classList.add("active");
          if (activeHpCount <= 1) {
            seg.style.background = "#ff0033";
            seg.style.boxShadow = "0 0 8px #ff0033";
          } else if (activeHpCount <= 2) {
            seg.style.background = "#ffaa00";
            seg.style.boxShadow = "0 0 8px #ffaa00";
          } else {
            seg.style.background = "#00ff66";
            seg.style.boxShadow = "0 0 8px #00ff66";
          }
        } else {
          seg.classList.remove("active");
          seg.style.background = "rgba(255, 255, 255, 0.1)";
          seg.style.boxShadow = "none";
        }
      }
    }

    if (this.segmentedStaminaBar) {
      const staminaSegments = this.segmentedStaminaBar.children;
      const activeStaminaCount = Math.ceil(staminaRatio * staminaSegments.length);
      for (let i = 0; i < staminaSegments.length; i++) {
        const seg = staminaSegments[i] as HTMLElement;
        if (i < activeStaminaCount) {
          seg.classList.add("active");
        } else {
          seg.classList.remove("active");
        }
      }
    }
  }

  // ==========================================
  // 8. POST-MATCH STATS SCREEN
  // ==========================================
  private initPostMatchModal(): void {
    this.postMatchModal = document.getElementById("post-match-modal");
  }

  public showPostMatchModal(
    stats: PostMatchStats,
    onRestart: () => void,
    onLobby: () => void
  ): void {
    if (!this.postMatchModal) return;

    const accEl = document.getElementById("pm-accuracy-val");
    const dpsEl = document.getElementById("pm-dps-val");
    const distEl = document.getElementById("pm-distance-val");
    const rankEl = document.getElementById("pm-rank-badge");
    const shotsEl = document.getElementById("pm-shots-val");
    const critsEl = document.getElementById("pm-crits-val");

    if (accEl) accEl.innerText = `${stats.accuracy.toFixed(1)}%`;
    if (dpsEl) dpsEl.innerText = `${stats.dps}`;
    if (distEl) distEl.innerText = `${Math.round(stats.distance)}m`;
    if (shotsEl) shotsEl.innerText = `${stats.hitsCount} / ${stats.totalShots}`;
    if (critsEl) critsEl.innerText = `${stats.headshotsCount}`;

    if (rankEl) {
      rankEl.innerText = stats.rank;
      rankEl.className = `rank-badge rank-${stats.rank.toLowerCase().charAt(0)}`;
    }

    const btnRestart = document.getElementById("pm-btn-restart");
    const btnLobby = document.getElementById("pm-btn-lobby");

    if (btnRestart) {
      btnRestart.onclick = (e) => {
        e.stopPropagation();
        this.hidePostMatchModal();
        onRestart();
      };
    }

    if (btnLobby) {
      btnLobby.onclick = (e) => {
        e.stopPropagation();
        this.hidePostMatchModal();
        onLobby();
      };
    }

    this.postMatchModal.classList.remove("hidden");
    this.postMatchModal.style.display = "flex";
  }

  public hidePostMatchModal(): void {
    if (this.postMatchModal) {
      this.postMatchModal.classList.add("hidden");
      this.postMatchModal.style.display = "none";
    }
  }

  // ==========================================
  // CORE FRAME UPDATE
  // ==========================================
  public update(
    speedMph: number,
    wave: number,
    yetiHp: number,
    maxYetiHp: number,
    ammo: number,
    isReloading: boolean,
    limbStatus: LimbStatus
  ): void {
    // 1. Update Player HP numeric readout
    let hpRatio = 1.0;
    if (this.csgoHpElement) {
      if (limbStatus === LimbStatus.SKELETONIZED) {
        this.csgoHpElement.innerText = "0";
        this.csgoHpElement.style.color = "#ff0033";
        hpRatio = 0.0;
      } else if (limbStatus === LimbStatus.BOTH_ARMS_LOST) {
        this.csgoHpElement.innerText = "30";
        this.csgoHpElement.style.color = "#ff3333";
        hpRatio = 0.3;
      } else if (limbStatus === LimbStatus.LEFT_ARM_LOST) {
        this.csgoHpElement.innerText = "65";
        this.csgoHpElement.style.color = "#ffff00";
        hpRatio = 0.65;
      } else {
        this.csgoHpElement.innerText = "100";
        this.csgoHpElement.style.color = "#00ff66";
        hpRatio = 1.0;
      }
    }

    // 2. Update Weapon Ammo counter
    if (this.csgoAmmoElement) {
      if (isReloading) {
        this.csgoAmmoElement.innerHTML = `<span style="color:#ffaa00; font-size:16px;">[ REWIND ]</span>`;
      } else {
        this.csgoAmmoElement.innerText = ammo.toString();
      }
    }
  }
}
