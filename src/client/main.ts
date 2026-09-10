/**
 * SkiFree Yeti DO - Main TypeScript Client Entry Point
 * Coordinates Babylon.js WebGPU/WebGL2 pipeline, Havok physics, FPV camera rig,
 * procedural terrain, Yeti boss state machine, precision rifle combat,
 * spatial audio, HUD overlay, and 20Hz edge sync to Cloudflare MountainDO.
 */

import { Vector3, Scalar, Color3, Color4 } from "@babylonjs/core";
import { EngineManager } from "./engine";
import { PhysicsSystem } from "./physics";
import { TerrainSystem } from "./terrain";
import { CameraRig } from "./camera";
import { YetiEntity } from "./yeti";
import { CombatSystem } from "./combat";
import { AudioSystem } from "./audio";
import { NetworkSystem } from "./network";
import { FPVSkis } from "./skis";
import { SteamHarpoon } from "./harpoon";
import { NPCSystem } from "./npcs";
import { HUDManager } from "./hud";
import { GameStatePacket, HitscanPacket, LimbStatus, YetiAIState, PowerUpType } from "./types";
import { getGranbyTrack, GranbyTrackConfig } from "./granbyTracks";

export class SkiFreeApp {
  private engineManager!: EngineManager;
  private physicsSystem!: PhysicsSystem;
  private terrainSystem!: TerrainSystem;
  private cameraRig!: CameraRig;
  private yetiEntity!: YetiEntity;
  private combatSystem!: CombatSystem;
  private audioSystem!: AudioSystem;
  private networkSystem!: NetworkSystem;
  private fpvSkis!: FPVSkis;
  private steamHarpoon!: SteamHarpoon;
  private npcSystem!: NPCSystem;
  private hudSystem!: HUDManager;

  // Skier State
  private playerPos: Vector3 = new Vector3(0, 0, 0);
  private speedMph: number = 28;
  private maxSpeedMph: number = 75;
  private steerInput: number = 0; // -1 to 1
  private isTucking: boolean = false;
  private isBraking: boolean = false;
  private isTakedownTriggered: boolean = false;
  private isWaitingForDropIn: boolean = false;
  private takedownTapProgress: number = 0;
  private isPlayerDead: boolean = false;
  private lastSteerDir: number = 0;
  private currentLevel: number = 1;
  private totalScore: number = 0;
  private nextLevelTimeout: number | null = null;
  private takedownCountdownInterval: number | null = null;
  private dropInCountdownInterval: number | null = null;
  private limbStatus: LimbStatus = LimbStatus.FULL;
  private callsign: string = "Skier_" + Math.floor(1000 + Math.random() * 9000);
  private roomId: string = "alpine-lodge-1";
  private levelStartTime: number = Date.now();

  public static async start(): Promise<SkiFreeApp> {
    const app = new SkiFreeApp();
    await app.init();
    return app;
  }

  private async init(): Promise<void> {
    console.log("[SkiFree] Initializing TypeScript + Babylon.js Engine...");

    // 1. URL Params Setup (Callsign, Room, Difficulty)
    const urlParams = new URLSearchParams(window.location.search);
    const storedCallsign = typeof localStorage !== "undefined" ? localStorage.getItem("skifree_callsign") : null;
    const callsignEl = document.getElementById("callsign-input") as HTMLInputElement | null;
    const inputVal = callsignEl?.value?.trim();

    if (urlParams.get("callsign")) {
      this.callsign = urlParams.get("callsign")!;
    } else if (inputVal && inputVal.length > 0 && inputVal !== "SKIER_PRO") {
      this.callsign = inputVal;
    } else if (storedCallsign && storedCallsign.length > 0) {
      this.callsign = storedCallsign;
    }

    if (callsignEl) {
      callsignEl.value = this.callsign;
    }
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("skifree_callsign", this.callsign);
    }
    if (urlParams.get("room")) this.roomId = urlParams.get("room")!;

    // 2. Engine & Scene Setup
    this.engineManager = await EngineManager.create("renderCanvas");
    const scene = this.engineManager.scene;

    // 3. Havok Physics Setup
    this.physicsSystem = new PhysicsSystem(scene);
    await this.physicsSystem.init();

    // 4. Procedural Terrain & Obstacles
    this.terrainSystem = new TerrainSystem(scene);
    this.terrainSystem.init();

    // 5. FPV Camera Rig
    this.cameraRig = new CameraRig(scene, this.engineManager.canvas);

    // 6. Yeti Boss Entity
    this.yetiEntity = new YetiEntity(scene);

    // 6b. FPV Skis, Steam Harpoon & NPC System
    this.fpvSkis = new FPVSkis(scene, this.cameraRig.camera);
    this.steamHarpoon = new SteamHarpoon(scene, this.cameraRig.camera);
    this.npcSystem = new NPCSystem(scene);
    this.npcSystem.init();
    this.hudSystem = new HUDManager();

    // 7. Audio System
    this.audioSystem = new AudioSystem();
    this.audioSystem.init();

    // 8. Network System (20Hz WebSocket to MountainDO)
    this.networkSystem = new NetworkSystem(this.callsign, this.roomId, (packet: any) => {
      if (this.npcSystem && packet.skiers) {
        this.npcSystem.updatePlayers(packet.skiers.filter((s: any) => s.callsign !== this.callsign));
      }
      if (this.yetiEntity && packet.yeti) {
        this.yetiEntity.syncNetState(packet.yeti);
        const serverWave = typeof packet.wave === "number" ? packet.wave : (packet.yeti && typeof packet.yeti.wave === "number" ? packet.yeti.wave : null);
        if (serverWave !== null && serverWave > this.currentLevel && !this.isWaitingForDropIn && !this.isTakedownTriggered) {
          this.switchTrack(serverWave);
        }
      }
    });
    this.networkSystem.connect();

    // 9. Precision Combat
    this.combatSystem = new CombatSystem(
      scene,
      this.yetiEntity,
      () => {
        this.audioSystem.playRifleShot();
        if (this.steamHarpoon) {
          this.steamHarpoon.fire();
        }
      },
      (packet: HitscanPacket) => {
        if (this.steamHarpoon) {
          this.steamHarpoon.attachTowline();
        }
        const gauge = document.getElementById("tension-gauge-container");
        const prompt = document.getElementById("tow-action-prompt");
        if (gauge) gauge.classList.remove("hidden");
        if (prompt) prompt.classList.remove("hidden");

        // Reveal Rapid-Tap Takedown UI!
        this.takedownTapProgress = 0;
        const tapContainer = document.getElementById("takedown-tap-container");
        const tapProgressEl = document.getElementById("takedown-tap-progress");
        if (tapContainer) tapContainer.classList.remove("hidden");
        if (tapProgressEl) tapProgressEl.textContent = "0%";

        // Apply Harpoon Damage Directly to Yeti!
        const dmg = packet.damage || 400;
        const isFelled = this.yetiEntity.takeDamage(dmg);
        this.totalScore += packet.isCritical ? 1500 : 500;
        this.cameraRig.addImpactShake(packet.isCritical ? 0.7 : 0.3);

        const hpPct = Math.max(0, (this.yetiEntity.hp / this.yetiEntity.maxHp) * 100);
        const bossHpFill = document.getElementById("boss-hp-fill");
        if (bossHpFill) bossHpFill.style.width = `${hpPct}%`;

        if ((isFelled || this.yetiEntity.hp <= 0 || this.yetiEntity.state === YetiAIState.DEAD) && !this.isTakedownTriggered) {
          this.triggerYetiTakedown();
        }

        if (this.networkSystem) {
          this.networkSystem.sendHitscan(packet);
        }
      },
      this.npcSystem
    );

    // 11. Skier Keyboard Controls
    this.setupSkierControls();

    // De-Clutter UI: Strip away multi-button HUD clutter
    this.updateGranbyHud(this.terrainSystem.currentTrack);

    // 12. Setup Intro Overlay & Interaction Dismissals
    this.setupIntroOverlay();

    // 13. Run Main Game Loop
    this.engineManager.startRenderLoop((delta: number) => this.tick(delta));

    console.log("[SkiFree] Babylon.js Engine Active & Ready!");
  }

  private setupIntroOverlay(): void {
    const skipBtn = document.getElementById("btn-skip-intro");
    const hudOverlay = document.getElementById("hud-overlay");

    const dismiss = () => {
      if (hudOverlay) hudOverlay.classList.remove("hidden");
      this.audioSystem.startBGM();
      this.showLevelSplash(this.currentLevel);
      if (this.engineManager && this.engineManager.canvas) {
        this.engineManager.canvas.focus();
      }
    };

    if (skipBtn) {
      skipBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        dismiss();
      });
    }

    window.addEventListener("keydown", (e) => {
      if ((e.code === "Space" || e.code === "Enter") && (this.isWaitingForDropIn || this.isTakedownTriggered)) {
        this.executeDropIn();
      }
    });

    // Also handle start modal if any
    const btnStart = document.getElementById("btn-start");
    if (btnStart) {
      btnStart.addEventListener("click", () => {
        const startModal = document.getElementById("start-modal");
        const backdrop = document.getElementById("modal-backdrop");
        if (startModal) startModal.classList.add("hidden");
        if (backdrop) backdrop.classList.add("hidden");
        dismiss();
      });
    }

    // Handle New Level Screen Drop-In button & modal click
    const btnDropIn = document.getElementById("btn-drop-in");
    if (btnDropIn) {
      btnDropIn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.executeDropIn();
      });
    }
    const levelClearModal = document.getElementById("level-clear-modal");
    if (levelClearModal) {
      levelClearModal.addEventListener("click", () => {
        this.executeDropIn();
      });
    }
  }

  private handleTakedownTap(): void {
    if (!this.steamHarpoon || !this.steamHarpoon.isTethered || this.isTakedownTriggered || this.isPlayerDead) return;

    // Tap step scales down with level: L1=+16%, L2=+10%, L3=+7%, L4=+5%
    const tapStep = Math.max(5, Math.round(16 - (this.currentLevel - 1) * 3.5));
    this.takedownTapProgress = Math.min(100, this.takedownTapProgress + tapStep);
    const tapProgressEl = document.getElementById("takedown-tap-progress");
    if (tapProgressEl) tapProgressEl.textContent = `${this.takedownTapProgress}%`;

    // Reel in the Yeti with drag and damage calibrated to health pool
    this.yetiEntity.applyDrag(35, 0.25);
    const burstDmg = Math.round(350 + (this.currentLevel - 1) * 75);
    const isFelled = this.yetiEntity.takeDamage(burstDmg);
    this.totalScore += 300;
    this.cameraRig.addImpactShake(0.14);
    this.audioSystem.playSkiCarve(1.0);

    const bossHpFill = document.getElementById("boss-hp-fill");
    if (bossHpFill) {
      const hpPct = Math.max(0, (this.yetiEntity.hp / this.yetiEntity.maxHp) * 100);
      bossHpFill.style.width = `${hpPct}%`;
    }

    const towPrompt = document.getElementById("tow-action-prompt");
    if (towPrompt) {
      towPrompt.classList.remove("hidden");
      towPrompt.innerHTML = `⚡ <b>WINCH REEL TURBO!</b> DRAGGING YETI! <span style="color:#ff0055;">-${burstDmg} HP</span> (${this.takedownTapProgress}%)`;
    }

    if (this.takedownTapProgress >= 100 || isFelled || this.yetiEntity.hp <= 0 || this.yetiEntity.state === YetiAIState.DEAD) {
      const tapContainer = document.getElementById("takedown-tap-container");
      if (tapContainer) tapContainer.classList.add("hidden");
      this.triggerYetiTakedown();
    }
  }

  private triggerPlayerMauledByYeti(): void {
    if (this.isPlayerDead || this.isTakedownTriggered) return;
    this.isPlayerDead = true;
    this.speedMph = 0;

    console.log("[SkiFree] YETI TAKEDOWN ON SKIER! RUN FAILED!");

    if (this.steamHarpoon) {
      this.steamHarpoon.detachTowline();
    }
    const tapContainer = document.getElementById("takedown-tap-container");
    if (tapContainer) tapContainer.classList.add("hidden");

    this.yetiEntity.state = YetiAIState.ROAR_STORM;
    this.cameraRig.addImpactShake(3.0);
    this.audioSystem.playWipeout();

    const clawOverlay = document.getElementById("claw-overlay");
    if (clawOverlay) {
      clawOverlay.classList.add("slash-active");
      clawOverlay.style.display = "block";
    }

    const dmgFlash = document.getElementById("damage-flash");
    if (dmgFlash) {
      dmgFlash.style.opacity = "0.9";
      setTimeout(() => { if (dmgFlash) dmgFlash.style.opacity = "0"; }, 600);
    }

    const callsignInput = document.getElementById("callsign-input") as HTMLInputElement;
    const callsign = callsignInput?.value || this.callsign;
    if (this.hudSystem && this.hudSystem.addKillfeedMessage) {
      this.hudSystem.addKillfeedMessage(`☠️ ALPINE YETI <span style="color:#ff0033;">[MAULED]</span> ${callsign} (YETI TAKEDOWN)`);
    }

    setTimeout(() => {
      const backdrop = document.getElementById("modal-backdrop");
      const deathModal = document.getElementById("death-modal");
      const deathTitle = document.getElementById("death-title");
      const deathStat = document.getElementById("death-stat");

      if (backdrop) backdrop.classList.remove("hidden");
      if (deathModal) deathModal.classList.remove("hidden");
      if (deathTitle) deathTitle.textContent = "💀 YETI TAKEDOWN! RUN FAILED";
      if (deathStat) {
        const distM = Math.abs(Math.round(this.playerPos.z));
        deathStat.innerHTML = `THE ALPINE BEAST POUNCED DOWN THE FALL-LINE AND TOOK YOU DOWN!<br>DISTANCE: <b>${distM}M</b> • SCORE: <b>${this.totalScore.toLocaleString()} PTS</b>`;
      }
    }, 400);
  }

  private setupSkierControls(): void {
    const keys: Record<string, boolean> = {};

    window.addEventListener("keydown", (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      keys[key] = true;
      if (key === " " || key === "enter" || key === "f") {
        if (this.steamHarpoon && this.steamHarpoon.isTethered && !this.isTakedownTriggered) {
          e.preventDefault();
          this.handleTakedownTap();
        } else if (key === " ") {
          e.preventDefault();
          if (this.combatSystem && !this.isTakedownTriggered) {
            this.combatSystem.tryFireHarpoon();
          }
        }
      }
    });

    window.addEventListener("keyup", (e: KeyboardEvent) => {
      keys[e.key.toLowerCase()] = false;
    });

    // Wire Rapid-Tap Takedown Button
    const btnTakedownTap = document.getElementById("btn-takedown-tap");
    if (btnTakedownTap) {
      btnTakedownTap.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.handleTakedownTap();
      });
      btnTakedownTap.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.handleTakedownTap();
      });
    }

    // Wire Death Respawn Button
    const btnRespawn = document.getElementById("btn-respawn");
    if (btnRespawn) {
      btnRespawn.addEventListener("click", () => {
        const backdrop = document.getElementById("modal-backdrop");
        const deathModal = document.getElementById("death-modal");
        const clawOverlay = document.getElementById("claw-overlay");
        if (backdrop) backdrop.classList.add("hidden");
        if (deathModal) deathModal.classList.add("hidden");
        if (clawOverlay) {
          clawOverlay.classList.remove("slash-active");
          clawOverlay.style.display = "none";
        }
        this.isPlayerDead = false;
        this.isTakedownTriggered = false;
        this.takedownTapProgress = 0;
        this.speedMph = 30;
        this.yetiEntity.startLevel(this.currentLevel, this.playerPos.z);
        this.audioSystem.startBGM();
      });
    }

    // Wire Leaderboard Claim Buttons
    const btnTakedownClaim = document.getElementById("btn-takedown-claim");
    if (btnTakedownClaim) {
      btnTakedownClaim.addEventListener("click", () => this.openClaimModal("victory"));
    }

    const btnDeathClaim = document.getElementById("btn-claim-from-death");
    if (btnDeathClaim) {
      btnDeathClaim.addEventListener("click", () => this.openClaimModal("death"));
    }

    const btnLevelClearClaim = document.getElementById("btn-level-clear-claim");
    if (btnLevelClearClaim) {
      btnLevelClearClaim.addEventListener("click", () => this.openClaimModal("level_clear"));
    }

    const btnSubmitClaim = document.getElementById("btn-submit-claim");
    const btnSkipClaim = document.getElementById("btn-skip-claim");
    if (btnSkipClaim) {
      btnSkipClaim.addEventListener("click", () => {
        document.getElementById("claim-score-modal")?.classList.add("hidden");
        document.getElementById("modal-backdrop")?.classList.add("hidden");
      });
    }

    if (btnSubmitClaim) {
      btnSubmitClaim.addEventListener("click", async () => {
        const claimCallsignInput = document.getElementById("claim-callsign-input") as HTMLInputElement | null;
        const feedback = document.getElementById("claim-feedback-msg");
        const chosen = (claimCallsignInput?.value?.trim() || this.callsign || "SKIER_PRO").slice(0, 16);
        this.callsign = chosen;
        if (typeof localStorage !== "undefined") {
          localStorage.setItem("skifree_callsign", chosen);
        }
        const callsignEl = document.getElementById("callsign-input") as HTMLInputElement | null;
        if (callsignEl) callsignEl.value = chosen;

        if (feedback) {
          feedback.style.color = "#ffff00";
          feedback.textContent = "TRANSMITTING TO EDGE LEADERBOARD...";
        }

        const elapsedMs = Math.max(1000, Date.now() - this.levelStartTime);
        try {
          const resp = await fetch("/api/scores", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              callsign: chosen,
              wave: this.currentLevel,
              score: this.totalScore,
              time_ms: elapsedMs
            })
          });
          const resJson = (await resp.json()) as any;
          if (resp.ok && resJson.success) {
            if (feedback) {
              feedback.style.color = "#39ff14";
              feedback.textContent = `✅ PUBLISHED AS ${chosen}! SCORE: ${this.totalScore.toLocaleString()}`;
            }
            if (typeof (window as any).refreshLeaderboard === "function") {
              (window as any).refreshLeaderboard();
            }
            setTimeout(() => {
              document.getElementById("claim-score-modal")?.classList.add("hidden");
              document.getElementById("modal-backdrop")?.classList.add("hidden");
            }, 1200);
          } else {
            if (feedback) {
              feedback.style.color = "#ff0055";
              feedback.textContent = `ERROR: ${resJson.error || "Submission failed"}`;
            }
          }
        } catch (err: any) {
          if (feedback) {
            feedback.style.color = "#ff0055";
            feedback.textContent = `NETWORK ERROR: ${err.message}`;
          }
        }
      });
    }

    this.updateControls = () => {
      let steer = 0;
      if (keys["a"] || keys["arrowleft"]) steer -= 1;
      if (keys["d"] || keys["arrowright"]) steer += 1;

      // Limb penalties
      if (this.limbStatus === LimbStatus.LEFT_ARM_LOST && steer < 0) steer *= 0.8;
      if (this.limbStatus === LimbStatus.BOTH_ARMS_LOST) steer *= 0.5;

      // Update inputs (prioritize touch inputs if they exist)
      if (this.steerInput === 0 || (!this.isMobileSteering)) {
          this.steerInput = steer;
      }
      this.isTucking = !!(keys["w"] || keys["arrowup"]);
      // Don't override touch brake
      if (!this.isMobileBraking) {
        this.isBraking = !!(keys["s"] || keys["arrowdown"]);
      }
    };

    // Mobile Touch Controls Wiring
    const btnLeft = document.getElementById("btn-touch-left");
    const btnRight = document.getElementById("btn-touch-right");
    const btnBrake = document.getElementById("btn-touch-brake");
    const btnFire = document.getElementById("btn-touch-fire");

    if (btnLeft) {
      btnLeft.addEventListener("touchstart", (e) => { e.preventDefault(); this.steerInput = -1.0; this.isMobileSteering = true; });
      btnLeft.addEventListener("touchend", (e) => { e.preventDefault(); this.steerInput = 0; this.isMobileSteering = false; });
    }
    if (btnRight) {
      btnRight.addEventListener("touchstart", (e) => { e.preventDefault(); this.steerInput = 1.0; this.isMobileSteering = true; });
      btnRight.addEventListener("touchend", (e) => { e.preventDefault(); this.steerInput = 0; this.isMobileSteering = false; });
    }
    if (btnBrake) {
      btnBrake.addEventListener("touchstart", (e) => { e.preventDefault(); this.isBraking = true; this.isMobileBraking = true; });
      btnBrake.addEventListener("touchend", (e) => { e.preventDefault(); this.isBraking = false; this.isMobileBraking = false; });
    }
    if (btnFire) {
      btnFire.addEventListener("touchstart", (e) => {
        e.preventDefault();
        if (this.combatSystem && !this.isTakedownTriggered) this.combatSystem.tryFireHarpoon();
      });
    }

    // Unhide mobile controls if touch device
    if (typeof window !== "undefined" && ('ontouchstart' in window || navigator.maxTouchPoints > 0)) {
      const mobileUI = document.getElementById("mobile-controls");
      if (mobileUI) mobileUI.style.display = "flex";
    }
  }

  private isMobileSteering: boolean = false;
  private isMobileBraking: boolean = false;
  private updateControls: () => void = () => {};

  private handleNetworkState(packet: GameStatePacket): void {
    if (packet.yeti) {
      this.yetiEntity.syncNetState(packet.yeti);
    }
  }

  private tick(deltaTime: number): void {
    this.updateControls();

    // 1. Skier Downhill Kinematics (Forward along -Z)
    const prevZ = this.playerPos.z;
    if (this.isTucking) {
      this.speedMph = Scalar.Lerp(this.speedMph, this.maxSpeedMph, deltaTime * 1.5);
    } else if (this.isBraking) {
      this.speedMph = Scalar.Lerp(this.speedMph, 8, deltaTime * 4.2);
    } else {
      this.speedMph = Scalar.Lerp(this.speedMph, 38, deltaTime * 0.8);
    }

    const forwardSpeedUnitsPerSec = (this.speedMph * 0.44704) * 2.2; // Convert MPH to scene units
    this.playerPos.z -= forwardSpeedUnitsPerSec * deltaTime;

    // Progressive lateral carving speed scaled with forward velocity
    const dynamicSteerSpeed = 14.0 + 0.22 * this.speedMph;
    this.playerPos.x -= this.steerInput * dynamicSteerSpeed * deltaTime;
    const halfWidth = this.terrainSystem.currentTrack.trailWidth / 2;
    this.playerPos.x = Scalar.Clamp(this.playerPos.x, -halfWidth, halfWidth); // Bound within slope

    // 3D Mogul Mound Vertical Bump & Ski Suspension
    const terrainH = this.terrainSystem.getTerrainHeightAt(this.playerPos.x, this.playerPos.z);
    const mogulH = this.terrainSystem.getMogulHeightAt(this.playerPos.x, this.playerPos.z);
    this.playerPos.y = Scalar.Lerp(this.playerPos.y, terrainH + mogulH, deltaTime * 14.0);
    if (mogulH > 0.35) {
      this.cameraRig.addImpactShake(0.06 * (this.speedMph / 35));
      this.speedMph = Math.max(16, this.speedMph - deltaTime * 5.0); // Mogul carving resistance
    }

    // Sound effect on carving
    if (Math.abs(this.steerInput) > 0.1) {
      this.audioSystem.playSkiCarve(this.speedMph / this.maxSpeedMph);
    }

    // Live Granby Ranch Elevation Tracking
    const currentElev = Math.round(this.terrainSystem.currentTrack.baseElevationFt - (Math.abs(this.playerPos.z) * 0.16));
    const statsEl = document.getElementById("hud-granby-stats");
    if (statsEl) {
      statsEl.textContent = `${this.terrainSystem.currentTrack.mountainArea.toUpperCase()} • ELEV ${currentElev.toLocaleString()}' • ${this.terrainSystem.currentTrack.slopeGradeDeg}° PITCH`;
    }

    // Check if Yeti is dead -> trigger takedown immediately!
    if (this.yetiEntity.state === YetiAIState.DEAD && !this.isTakedownTriggered) {
      this.triggerYetiTakedown();
    }

    // Slalom Gates Crossing Check
    const gateEvent = this.terrainSystem.checkSlalomPass(this.playerPos.x, this.playerPos.z, prevZ);
    if (gateEvent && gateEvent.passed) {
      this.speedMph = Math.min(this.maxSpeedMph + 12, this.speedMph + 10);
      this.totalScore += 500;
      this.audioSystem.playSkiCarve(1.0);
      const prompt = document.getElementById("tow-action-prompt");
      if (prompt) {
        prompt.classList.remove("hidden");
        prompt.innerHTML = `⚡ <b>SLALOM GATE CLEARED!</b> +500 PTS • TURBO ACCEL!`;
        setTimeout(() => {
          if (!this.steamHarpoon || !this.steamHarpoon.isTethered) prompt.classList.add("hidden");
        }, 1500);
      }
    }

    // Power-up Collection Check
    const powerType = this.terrainSystem.checkPowerUp(this.playerPos.x, this.playerPos.z);
    if (powerType === PowerUpType.NITRO_WAX) {
      this.speedMph = Math.min(85, this.speedMph + 25);
      this.totalScore += 1000;
      this.cameraRig.addImpactShake(0.8);
      const prompt = document.getElementById("tow-action-prompt");
      if (prompt) {
        prompt.classList.remove("hidden");
        prompt.innerHTML = `🔥 <b>NITRO WAX BOOST!</b> 85 MPH SURGE • +1,000 PTS!`;
        setTimeout(() => {
          if (!this.steamHarpoon || !this.steamHarpoon.isTethered) prompt.classList.add("hidden");
        }, 2000);
      }
    } else if (powerType === PowerUpType.CRYO_HARPOON) {
      this.combatSystem.currentAmmo = this.combatSystem.maxAmmo;
      this.yetiEntity.applyDrag(40, 1.0);
      this.totalScore += 1500;
      const prompt = document.getElementById("tow-action-prompt");
      if (prompt) {
        prompt.classList.remove("hidden");
        prompt.innerHTML = `❄️ <b>CRYO HARPOON!</b> AMMO REFILLED & YETI FLASH-FROZEN!`;
        setTimeout(() => {
          if (!this.steamHarpoon || !this.steamHarpoon.isTethered) prompt.classList.add("hidden");
        }, 2000);
      }
    }

    // 2. Obstacle Collision Checks
    const hitObstacle = this.terrainSystem.checkCollision(this.playerPos.x, this.playerPos.z);
    if (hitObstacle) {
      this.speedMph = Math.max(12, this.speedMph * 0.5); // Stumble penalty
    }

    // 2b. NPC Skier Collision Checks (Visceral Wipeout Knockdown)
    if (this.npcSystem) {
      const hitNPC = this.npcSystem.checkPlayerCollision(this.playerPos, this.speedMph, this.steerInput);
      if (hitNPC) {
        this.speedMph = Math.max(10, this.speedMph * 0.45); // Player crash speed drop
        this.audioSystem.playWipeout();
        this.cameraRig.addImpactShake(1.4);
      }
    }

    // 3. Update Subsystems
    this.terrainSystem.update(this.playerPos.z, deltaTime);
    this.cameraRig.update(this.playerPos, this.steerInput, this.speedMph, deltaTime, this.terrainSystem.getSlopePitchRad());
    this.yetiEntity.update(this.playerPos, deltaTime, (x, z) => this.terrainSystem.getTerrainHeightAt(x, z));
    if (this.fpvSkis) {
      this.fpvSkis.update(this.steerInput, this.isTucking, this.isBraking, this.speedMph, this.cameraRig.isAimingRear, deltaTime);
    }
    if (this.steamHarpoon) {
      this.steamHarpoon.update(this.yetiEntity.rootMesh.position, this.cameraRig.isAimingRear, deltaTime);
    }
    if (this.npcSystem) {
      this.npcSystem.update(this.playerPos.z, this.yetiEntity.rootMesh.position, deltaTime, (x, z) => this.terrainSystem.getTerrainHeightAt(x, z));
    }

    // 3a. Yeti Attack Proximity & Takedown Check
    const distToYeti = Math.hypot(this.playerPos.x - this.yetiEntity.rootMesh.position.x, this.playerPos.z - this.yetiEntity.rootMesh.position.z);
    if (this.yetiEntity.state !== YetiAIState.DEAD && !this.isTakedownTriggered && !this.isPlayerDead) {
      if (distToYeti < 3.8) {
        this.triggerPlayerMauledByYeti();
      } else if ((this.yetiEntity.state === YetiAIState.POUNCE_CHARGE || this.yetiEntity.state === YetiAIState.CLAW_SWIPE) && distToYeti < 9.0) {
        this.cameraRig.addImpactShake(0.85);
        const clawOverlay = document.getElementById("claw-overlay");
        if (clawOverlay && !clawOverlay.classList.contains("slash-active")) {
          clawOverlay.classList.add("slash-active");
          clawOverlay.style.display = "block";
          setTimeout(() => {
            if (clawOverlay) {
              clawOverlay.classList.remove("slash-active");
              clawOverlay.style.display = "none";
            }
          }, 500);
        }
      }
    }

    // 3b. Harpoon Drag & Braking Tug-of-War (Hold 'S' to drag down Yeti)
    if (this.steamHarpoon && this.steamHarpoon.isTethered) {
      const tensionGauge = document.getElementById("tension-gauge-container");
      const tensionFill = document.getElementById("tension-fill");
      const tensionLabel = document.getElementById("tension-label");
      const towPrompt = document.getElementById("tow-action-prompt");
      const bossHpFill = document.getElementById("boss-hp-fill");

      if (tensionGauge) tensionGauge.classList.remove("hidden");

      if (this.isBraking) {
        // Player is pressing 'S' to dig in skis, brake, and pull the Yeti down!
        this.steamHarpoon.cableTension = 1.0;
        this.cameraRig.addImpactShake(0.04);
        this.audioSystem.playSkiCarve(1.0);

        // Slalom Sawing Mechanic: detect edge transitions while holding 'S'
        const currentSteerDir = Math.sign(this.steerInput);
        if (currentSteerDir !== 0 && currentSteerDir !== this.lastSteerDir && Math.abs(this.steerInput) > 0.3) {
          this.lastSteerDir = currentSteerDir;
          const sawDmg = Math.round(400 + (this.currentLevel - 1) * 80);
          const isFelled = this.yetiEntity.takeDamage(sawDmg);
          this.totalScore += 350;
          this.audioSystem.playSkiCarve(1.0);
          this.cameraRig.addImpactShake(0.09);

          if (towPrompt) {
            towPrompt.classList.remove("hidden");
            towPrompt.innerHTML = `⚡ <b>EDGE SLICE!</b> OPPOSITE CARVE! <span style="color:#ff0055;">-${sawDmg} HP!</span>`;
          }

          if ((isFelled || this.yetiEntity.hp <= 0 || this.yetiEntity.state === YetiAIState.DEAD) && !this.isTakedownTriggered) {
            this.triggerYetiTakedown();
          }
        }

        if (Math.abs(this.steerInput) > 0.3) {
          // Full drag applied when actively carving back and forth
          this.yetiEntity.applyDrag(26, deltaTime);
          this.speedMph = Scalar.Lerp(this.speedMph, 12, deltaTime * 2.5);
        } else {
          // Straight line has heavy slack penalty
          this.yetiEntity.applyDrag(8, deltaTime);
          if (towPrompt) {
            towPrompt.innerHTML = `⚠️ STRAIGHT LINE SLACK! <b>CARVE [A / D]</b> TO SAW CABLE & DRAG YETI!`;
          }
        }

        // Update Tension Gauge & Prompts (Physical cable Hooke strain)
        const distToBeast = Vector3.Distance(this.playerPos, this.yetiEntity.rootMesh.position);
        const nominalDist = 32.0;
        const strainRatio = Scalar.Clamp((distToBeast - nominalDist) / 22.0 + (this.isBraking ? 0.35 : 0.0), 0.05, 1.0);
        this.steamHarpoon.cableTension = strainRatio;
        const tensionPercent = Math.round(strainRatio * 100);
        if (tensionFill) tensionFill.style.width = `${tensionPercent}%`;
        if (tensionLabel) {
          if (tensionPercent > 75) {
            tensionLabel.innerHTML = `<span style="color:#ff0055; font-weight:900;">HIGH TENSION! ${tensionPercent}%</span>`;
          } else if (tensionPercent > 40) {
            tensionLabel.innerHTML = `<span style="color:#ffaa00;">OPTIMAL DRAG! ${tensionPercent}%</span>`;
          } else {
            tensionLabel.innerHTML = `<span style="color:#00f0ff;">SLACK ${tensionPercent}%</span>`;
          }
        }
        if (bossHpFill) {
          const hpPct = Math.max(0, (this.yetiEntity.hp / this.yetiEntity.maxHp) * 100);
          bossHpFill.style.width = `${hpPct}%`;
        }

        // Check if Yeti is downed!
        if ((this.yetiEntity.hp <= 0 || this.yetiEntity.state === YetiAIState.DEAD) && !this.isTakedownTriggered) {
          this.triggerYetiTakedown();
        }
      } else {
        // Not pressing 'S' - Yeti pulls ahead and recovers speed
        this.steamHarpoon.cableTension = 0.45;
        this.yetiEntity.dragSpeed = Scalar.Lerp(this.yetiEntity.dragSpeed, this.yetiEntity.baseSpeed, deltaTime * 1.5);
        // Tension progress decays if not actively reeling on higher levels
        if (this.currentLevel >= 2 && this.takedownTapProgress > 0) {
          this.takedownTapProgress = Math.max(0, this.takedownTapProgress - (this.currentLevel - 1) * 2.0 * deltaTime);
          const tapProgressEl = document.getElementById("takedown-tap-progress");
          if (tapProgressEl) tapProgressEl.textContent = `${Math.round(this.takedownTapProgress)}%`;
        }
        if (tensionLabel) tensionLabel.innerHTML = `<span>40% (SLACK)</span>`;
        if (towPrompt) {
          towPrompt.innerHTML = `⚠️ TOWLINE HOOKED! <b>HOLD [S]</b> & CARVE [A / D] TO SAW & DRAG DOWN YETI!`;
        }
      }
    }

    // 5. Send 20Hz Input Packet to Cloudflare MountainDO
    this.networkSystem.sendInput(
      this.steerInput,
      this.isTucking,
      this.isBraking,
      this.cameraRig.camera.rotation.y,
      this.cameraRig.isAimingRear
    );
  }

  private triggerYetiTakedown(): void {
    this.isTakedownTriggered = true;
    console.log(`[SkiFree] LEVEL ${this.currentLevel} YETI FELLED! HUNT COMPLETE!`);

    // Detach harpoon towline immediately from the felled beast
    if (this.steamHarpoon) {
      this.steamHarpoon.detachTowline();
    }

    // Hide active combat gauges & prompts during celebration
    const gauge = document.getElementById("tension-gauge-container");
    const prompt = document.getElementById("tow-action-prompt");
    const tapContainer = document.getElementById("takedown-tap-container");
    if (gauge) gauge.classList.add("hidden");
    if (prompt) prompt.classList.add("hidden");
    if (tapContainer) tapContainer.classList.add("hidden");

    // Audio & Screen FX
    this.cameraRig.addImpactShake(2.5);
    this.audioSystem.playRifleShot();

    if (this.hudSystem && this.hudSystem.addKillfeedMessage) {
      this.hudSystem.addKillfeedMessage(`🎯 SKIER_PRO <span style="color:#ff0055;">+</span> ALPINE YETI (CRITICAL IMPALE)`);
    }

    // Calculate score & time
    const levelBonus = 10000 * this.currentLevel;
    this.totalScore += levelBonus;
    const takedownTimeMs = Date.now() - this.levelStartTime;
    const seconds = Math.floor((takedownTimeMs / 1000) % 60).toString().padStart(2, "0");
    const minutes = Math.floor((takedownTimeMs / 1000) / 60).toString().padStart(2, "0");
    const ms = Math.floor((takedownTimeMs % 1000) / 100).toString();
    const formattedTime = `${minutes}:${seconds}.${ms}`;

    // Clear any previous transition timers
    if (this.nextLevelTimeout) {
      clearTimeout(this.nextLevelTimeout);
      this.nextLevelTimeout = null;
    }
    if (this.takedownCountdownInterval) {
      clearInterval(this.takedownCountdownInterval);
      this.takedownCountdownInterval = null;
    }
    if (this.dropInCountdownInterval) {
      clearInterval(this.dropInCountdownInterval);
      this.dropInCountdownInterval = null;
    }

    // Skier keeps cruising downhill past the felled beast!
    this.speedMph = Math.max(38, this.speedMph);

    // Show Takedown Cinematic Banners
    const bars = document.getElementById("cinematic-bars");
    const banner = document.getElementById("takedown-cinematic-overlay");

    if (bars) bars.classList.remove("hidden");
    if (banner) {
      banner.classList.remove("hidden");
      banner.style.opacity = "1";
      banner.innerHTML = `
        <div style="font-size: clamp(24px, 4.8vw, 42px); font-weight: 900; color: #39ff14; text-shadow: 0 0 25px #39ff14; letter-spacing: 2px;">
          🏆 LEVEL ${this.currentLevel} COMPLETE!
        </div>
        <div style="font-size: clamp(14px, 2.5vw, 20px); font-weight: 800; color: #ffff00; margin-top: 6px; text-shadow: 0 0 12px #ff0055;">
          BEAST FELLED • +${levelBonus.toLocaleString()} PTS • SKIING PAST DOWNED YETI
        </div>
        <div id="takedown-ski-countdown" style="font-size: clamp(13px, 2.2vw, 17px); font-weight: 900; color: #00f0ff; margin-top: 10px; letter-spacing: 1px; text-shadow: 0 0 10px #00f0ff;">
          LEVEL SUMMARY IN 5.0s...
        </div>
      `;
    }

    // 5-Second Celebration Countdown while skiing downhill past beast
    const celebrationStart = Date.now();
    this.takedownCountdownInterval = window.setInterval(() => {
      const elapsed = (Date.now() - celebrationStart) / 1000;
      const remaining = Math.max(0, 5.0 - elapsed);
      const countdownEl = document.getElementById("takedown-ski-countdown");
      if (countdownEl) {
        countdownEl.textContent = `LEVEL SUMMARY IN ${remaining.toFixed(1)}s...`;
      }
      if (remaining <= 0 && this.takedownCountdownInterval) {
        clearInterval(this.takedownCountdownInterval);
        this.takedownCountdownInterval = null;
      }
    }, 100);

    // After 5 seconds: Reveal Level Complete Modal with a slight pause before next level
    this.nextLevelTimeout = window.setTimeout(() => {
      if (this.takedownCountdownInterval) {
        clearInterval(this.takedownCountdownInterval);
        this.takedownCountdownInterval = null;
      }

      if (banner) {
        banner.style.opacity = "0";
        banner.classList.add("hidden");
      }

      // Populate Level Clear Modal
      const nextLevel = this.currentLevel + 1;
      const nextTrack = getGranbyTrack(nextLevel);
      const clearTitle = document.getElementById("clear-level-title");
      const clearSubtitle = document.getElementById("clear-level-subtitle");
      const nextRunName = document.getElementById("next-run-name");
      const nextRunZone = document.getElementById("next-run-zone");
      const nextRunDiff = document.getElementById("next-run-diff");
      const nextRunElev = document.getElementById("next-run-elev");
      const nextRunPitch = document.getElementById("next-run-pitch");
      const nextRunDesc = document.getElementById("next-run-desc");
      const nextRunYeti = document.getElementById("next-run-yeti");
      const clearBonus = document.getElementById("clear-bonus");
      const clearScore = document.getElementById("clear-score");
      const clearSpeed = document.getElementById("clear-speed");

      if (clearTitle) clearTitle.textContent = `🏆 LEVEL ${this.currentLevel} COMPLETE!`;
      if (clearSubtitle) clearSubtitle.textContent = `GRANBY RANCH • ${getGranbyTrack(this.currentLevel).runName} CLEARED IN ${formattedTime}`;
      if (nextRunName) nextRunName.textContent = nextTrack.runName;
      if (nextRunZone) nextRunZone.textContent = nextTrack.mountainArea.toUpperCase();
      if (nextRunDiff) nextRunDiff.textContent = nextTrack.difficulty;
      if (nextRunElev) nextRunElev.textContent = `${nextTrack.baseElevationFt.toLocaleString()}'`;
      if (nextRunPitch) nextRunPitch.textContent = `${nextTrack.slopeGradeDeg}°`;
      if (nextRunDesc) nextRunDesc.textContent = nextTrack.description;
      if (nextRunYeti) nextRunYeti.textContent = nextTrack.yetiBehaviorDesc;
      if (clearBonus) clearBonus.textContent = `+${levelBonus.toLocaleString()} PTS`;
      if (clearScore) clearScore.textContent = `${this.totalScore.toLocaleString()} PTS`;
      if (clearSpeed) clearSpeed.textContent = `${Math.round(this.speedMph)} MPH`;

      // Show Backdrop & Level Clear Modal
      const backdrop = document.getElementById("modal-backdrop");
      const levelModal = document.getElementById("level-clear-modal");
      if (backdrop) backdrop.classList.remove("hidden");
      if (levelModal) levelModal.classList.remove("hidden");
      this.isWaitingForDropIn = true;

      // Slight pause countdown (3 seconds) before auto-restarting at the next level
      let pauseSeconds = 3;
      const btnDropIn = document.getElementById("btn-drop-in");
      if (btnDropIn) {
        btnDropIn.innerHTML = `⛷️ NEXT RUN DROPPING IN: ${pauseSeconds}s... [SPACE TO DROP NOW]`;
      }

      this.dropInCountdownInterval = window.setInterval(() => {
        pauseSeconds--;
        if (btnDropIn && pauseSeconds > 0) {
          btnDropIn.innerHTML = `⛷️ NEXT RUN DROPPING IN: ${pauseSeconds}s... [SPACE TO DROP NOW]`;
        }
        if (pauseSeconds <= 0) {
          if (this.dropInCountdownInterval) {
            clearInterval(this.dropInCountdownInterval);
            this.dropInCountdownInterval = null;
          }
          if (this.isWaitingForDropIn) {
            this.executeDropIn();
          }
        }
      }, 1000);
    }, 5000);
  }

  private executeDropIn(): void {
    if (!this.isWaitingForDropIn && !this.isTakedownTriggered) return;
    if (this.dropInCountdownInterval) {
      clearInterval(this.dropInCountdownInterval);
      this.dropInCountdownInterval = null;
    }
    if (this.nextLevelTimeout) {
      clearTimeout(this.nextLevelTimeout);
      this.nextLevelTimeout = null;
    }
    this.isWaitingForDropIn = false;
    this.isTakedownTriggered = false;

    if (this.networkSystem) {
      this.networkSystem.sendDropIn();
    }

    const backdrop = document.getElementById("modal-backdrop");
    const levelModal = document.getElementById("level-clear-modal");
    if (backdrop) backdrop.classList.add("hidden");
    if (levelModal) levelModal.classList.add("hidden");

    // Alpine Starting Horn & Drop-In Camera Plunge
    this.audioSystem.playDropIn();
    this.cameraRig.addImpactShake(1.6);

    this.startNextLevel();
  }

  private startNextLevel(): void {
    if (this.nextLevelTimeout) {
      clearTimeout(this.nextLevelTimeout);
      this.nextLevelTimeout = null;
    }

    this.currentLevel++;
    this.isTakedownTriggered = false;
    this.isWaitingForDropIn = false;
    this.levelStartTime = Date.now();

    // Reset cinematic bars & banner
    const bars = document.getElementById("cinematic-bars");
    const banner = document.getElementById("takedown-cinematic-overlay");
    const modal = document.getElementById("takedown-modal");
    const prompt = document.getElementById("tow-action-prompt");
    const gauge = document.getElementById("tension-gauge-container");

    if (bars) bars.classList.add("hidden");
    if (banner) {
      banner.classList.add("hidden");
      banner.style.opacity = "0";
    }
    if (modal) modal.classList.add("hidden");
    if (gauge) gauge.classList.add("hidden");

    // Reset Boss HP Bar in HUD to full
    const bossHpFill = document.getElementById("boss-hp-fill");
    if (bossHpFill) bossHpFill.style.width = "100%";

    // Re-arm combat ammo
    if (this.combatSystem) {
      this.combatSystem.currentAmmo = this.combatSystem.maxAmmo;
      this.combatSystem.isReloading = false;
    }

    // Give skier downhill boost so player smoothly resumes chase
    this.speedMph = Math.max(36, this.speedMph);

    // Progressive level naming & Granby Ranch real run modeling
    const track = getGranbyTrack(this.currentLevel);
    this.terrainSystem.applyTrack(track, this.playerPos.z);

    // Dynamic Atmosphere & Weather Transitions Per Run
    const scene = this.engineManager.scene;
    scene.fogMode = 2; // FOGMODE_EXP2
    scene.fogDensity = track.fogDensity;
    scene.fogColor = track.fogColor;
    scene.clearColor = new Color4(track.clearColor.r, track.clearColor.g, track.clearColor.b, 1.0);

    // Adjust skier terminal speed & acceleration according to physical slope grade
    this.maxSpeedMph = Math.round(75 * track.baseSpeedMultiplier);
    this.speedMph = Math.max(34 * track.baseSpeedMultiplier, this.speedMph);

    // Spawn progressively harder Yeti ahead downhill
    this.yetiEntity.startLevel(this.currentLevel, this.playerPos.z);

    // Audio cue & impact shake for roar
    this.audioSystem.playYetiRoar();
    this.cameraRig.addImpactShake(0.8);

    // Show Level Announcement HUD Banner & Update Granby Info
    this.showLevelSplash(this.currentLevel);
    this.updateGranbyHud(track);

    console.log(`[SkiFree] ADVANCING TO LEVEL ${this.currentLevel} (GRANBY: ${track.runName})! Grade: ${track.slopeGradeDeg}°, Yeti HP: ${this.yetiEntity.maxHp}, Speed: ${this.yetiEntity.dragSpeed} MPH`);
  }

  public switchTrack(level: number): void {
    if (level < 1 || level > 4) return;
    this.currentLevel = level;
    this.isTakedownTriggered = false;

    const track = getGranbyTrack(level);
    this.terrainSystem.applyTrack(track, this.playerPos.z);
    this.yetiEntity.startLevel(level, this.playerPos.z);

    const scene = this.engineManager.scene;
    scene.fogMode = 2;
    scene.fogDensity = track.fogDensity;
    scene.fogColor = track.fogColor;
    scene.clearColor = new Color4(track.clearColor.r, track.clearColor.g, track.clearColor.b, 1.0);

    this.maxSpeedMph = Math.round(75 * track.baseSpeedMultiplier);
    this.speedMph = Math.max(34 * track.baseSpeedMultiplier, this.speedMph);

    this.audioSystem.playDropIn();
    this.cameraRig.addImpactShake(1.2);

    this.showLevelSplash(level);
    this.updateGranbyHud(track);
  }

  private updateGranbyHud(track: GranbyTrackConfig): void {
    const titleEl = document.getElementById("hud-granby-title");
    const badgeEl = document.getElementById("hud-granby-badge");
    const statsEl = document.getElementById("hud-granby-stats");

    if (titleEl) titleEl.textContent = `⛷️ GRANBY: ${track.runName}`;
    if (badgeEl) {
      badgeEl.textContent = track.difficultyBadge;
      if (track.level === 1) badgeEl.style.color = "#39ff14";
      else if (track.level === 2) badgeEl.style.color = "#00f0ff";
      else if (track.level === 3) badgeEl.style.color = "#ffff00";
      else badgeEl.style.color = "#ff0055";
    }
    if (statsEl) {
      statsEl.textContent = `${track.mountainArea.toUpperCase()} • ELEV ${track.baseElevationFt.toLocaleString()}' • ${track.slopeGradeDeg}° PITCH`;
    }
  }

  private showLevelSplash(level: number): void {
    const prompt = document.getElementById("tow-action-prompt");
    const track = getGranbyTrack(level);

    if (prompt) {
      prompt.classList.remove("hidden");
      prompt.innerHTML = `
        <div style="font-size: clamp(15px, 3vw, 22px); font-weight: 900; color: #00f0ff; letter-spacing: 1px;">
          ⛷️ GRANBY RANCH: ${track.runName} (${track.difficultyBadge})
        </div>
        <div style="color: #ffff00; font-size: clamp(11px, 2vw, 14px); font-weight: 700; margin: 3px 0;">
          ${track.mountainArea.toUpperCase()} • ELEV ${track.baseElevationFt.toLocaleString()}' • ${track.slopeGradeDeg}° PITCH
        </div>
        <div style="color: #ffffff; font-size: clamp(10px, 1.6vw, 12px); opacity: 0.95; line-height: 1.4;">
          ${track.description}
        </div>
        <div style="color: #ff0055; font-size: clamp(10px, 1.6vw, 12px); font-weight: bold; margin-top: 3px;">
          YETI THREAT: ${track.yetiBehaviorDesc}
        </div>
      `;
      setTimeout(() => {
        if (!this.steamHarpoon || !this.steamHarpoon.isTethered) {
          prompt.classList.add("hidden");
        }
      }, 4500);
    }
  }

  public openClaimModal(source: "victory" | "death" | "level_clear"): void {
    const backdrop = document.getElementById("modal-backdrop");
    const claimModal = document.getElementById("claim-score-modal");
    const deathModal = document.getElementById("death-modal");
    const takedownModal = document.getElementById("takedown-modal");
    const levelClearModal = document.getElementById("level-clear-modal");
    const statSummary = document.getElementById("claim-stat-summary");
    const callsignInput = document.getElementById("claim-callsign-input") as HTMLInputElement | null;
    const feedback = document.getElementById("claim-feedback-msg");

    if (deathModal) deathModal.classList.add("hidden");
    if (takedownModal) takedownModal.classList.add("hidden");
    if (levelClearModal) levelClearModal.classList.add("hidden");
    if (backdrop) backdrop.classList.remove("hidden");
    if (claimModal) claimModal.classList.remove("hidden");

    if (callsignInput) {
      callsignInput.value = this.callsign;
    }
    if (feedback) {
      feedback.textContent = "";
      feedback.style.color = "#00f0ff";
    }
    const elapsedSec = ((Date.now() - this.levelStartTime) / 1000).toFixed(1);
    if (statSummary) {
      statSummary.innerHTML = `RUN ${this.currentLevel} • SCORE: <span style="color:#ff007f; font-weight:900;">${this.totalScore.toLocaleString()} PTS</span> • TIME: <span style="color:#00f0ff;">${elapsedSec}s</span>`;
    }
  }
}

// Deferred Engine Boot: Gated behind Lobby UI to prevent 350MB WebGPU/Havok startup penalty
if (typeof window !== "undefined") {
  let currentLeaderboardLevel = 1;

  // Initialize lobby callsign input from localStorage
  const savedCallsign = localStorage.getItem("skifree_callsign");
  const callsignInput = document.getElementById("callsign-input") as HTMLInputElement | null;
  if (savedCallsign && callsignInput) {
    callsignInput.value = savedCallsign;
  }
  if (callsignInput) {
    callsignInput.addEventListener("input", () => {
      const val = callsignInput.value.trim();
      if (val) {
        localStorage.setItem("skifree_callsign", val);
      }
    });
  }

  async function fetchLeaderboard() {
    try {
      let entries: any[] = [];
      const res = await fetch("/api/scores");
      if (res.ok) {
        entries = (await res.json()) as any[];
      } else {
        const fallbackRes = await fetch("/status");
        if (fallbackRes.ok) {
          const fbData = (await fallbackRes.json()) as any;
          entries = fbData.telemetry || [];
        }
      }

      const tbody = document.getElementById("leaderboard-body");
      const huntRows = document.getElementById("hunt-leaderboard-rows");
      const currentCallsign = (localStorage.getItem("skifree_callsign") || "").toUpperCase();

      if (tbody) {
        const filtered = entries.filter((t: any) => t.wave === currentLeaderboardLevel).slice(0, 15);
        if (filtered.length === 0) {
          tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding:16px; color:#88a0c0; font-style:italic;">No Standings for this Difficulty.</td></tr>`;
        } else {
          tbody.innerHTML = "";
          filtered.forEach((t: any) => {
            const isMe = currentCallsign && (t.callsign || "").toUpperCase() === currentCallsign;
            const tr = document.createElement("tr");
            tr.style.borderBottom = "1px solid rgba(255,255,255,0.05)";
            if (isMe) tr.style.background = "rgba(0, 240, 255, 0.15)";
            tr.innerHTML = `
              <td style="padding:6px; color:${isMe ? "#ffff00" : "#00f0ff"}; font-weight:${isMe ? "900" : "normal"};">
                ${isMe ? "⭐ " : ""}${t.callsign || "UNKNOWN"}
              </td>
              <td style="padding:6px; text-align:right; color:#fff;">${t.time_ms ? (t.time_ms / 1000).toFixed(1) + "s" : "-"}</td>
              <td style="padding:6px; text-align:right; color:#ff0055; font-weight:bold;">${t.score ? t.score.toLocaleString() : 0}</td>
            `;
            tbody.appendChild(tr);
          });
        }
      }

      if (huntRows) {
        const topEntries = entries.slice(0, 15);
        if (topEntries.length === 0) {
          huntRows.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:10px; color:#88a0c0;">No Edge Records Found.</td></tr>`;
        } else {
          huntRows.innerHTML = "";
          topEntries.forEach((t: any, idx: number) => {
            const isMe = currentCallsign && (t.callsign || "").toUpperCase() === currentCallsign;
            const tr = document.createElement("tr");
            tr.style.borderBottom = "1px solid rgba(255,255,255,0.05)";
            if (isMe) tr.style.background = "rgba(0, 240, 255, 0.15)";
            tr.innerHTML = `
              <td style="padding:4px; color:#88a0c0;">#${idx + 1}</td>
              <td style="padding:4px; color:${isMe ? "#ffff00" : "#00f0ff"}; font-weight:${isMe ? "bold" : "normal"};">${isMe ? "⭐ " : ""}${t.callsign || "UNKNOWN"}</td>
              <td style="padding:4px; color:#ff0055;">${t.score ? t.score.toLocaleString() : 0}</td>
              <td style="padding:4px; color:#39ff14;">${t.time_ms ? (t.time_ms / 1000).toFixed(1) + "s" : "-"}</td>
            `;
            huntRows.appendChild(tr);
          });
        }
      }
    } catch (err) {
      console.warn("Could not fetch leaderboard:", err);
    }
  }

  (window as any).refreshLeaderboard = fetchLeaderboard;

  fetchLeaderboard();
  setInterval(fetchLeaderboard, 15000); // Live poll every 15s

  // Wire Difficulty Tabs
  const diffBtns = document.querySelectorAll(".diff-btn");
  diffBtns.forEach(btn => {
    btn.addEventListener("click", (e) => {
      diffBtns.forEach(b => {
        (b as HTMLElement).style.border = "1px solid #334466";
        b.classList.remove("active");
      });
      const target = e.currentTarget as HTMLElement;
      target.style.border = "1px solid #00ff66";
      target.classList.add("active");
      currentLeaderboardLevel = parseInt(target.getAttribute("data-level") || "1");
      fetchLeaderboard(); // instant refresh
    });
  });

  const introVideo = document.getElementById("intro-video") as HTMLVideoElement | null;

  // Autoplay workaround: start muted immediately
  if (introVideo) {
    introVideo.muted = true;
    introVideo.play().catch(() => {});
  }

  const enterBtn = document.getElementById("btn-skip-intro");
  if (enterBtn) {
    enterBtn.addEventListener("click", () => {
      // Hide Lobby UI, Destroy Videos, Mount Canvas
      document.getElementById("lobby-ui")?.classList.add("hidden");
      document.getElementById("standings-modal")?.classList.add("hidden");
      introVideo?.pause();
      introVideo?.remove();
      const canvas = document.getElementById("renderCanvas");
      if (canvas) {
        canvas.classList.remove("hidden");
      }
      
      // Initialize Engine
      SkiFreeApp.start().catch((err) => console.error("[SkiFree] Boot error:", err));
    });
  }

  const unmuteBtn = document.getElementById("btn-unmute-intro");
  if (unmuteBtn) {
    unmuteBtn.addEventListener("click", () => {
      if (introVideo) {
        introVideo.muted = !introVideo.muted;
        if (!introVideo.muted) {
          introVideo.play().catch(() => {});
        }
        unmuteBtn.textContent = introVideo.muted ? "🔊 UNMUTE AUDIO" : "🔇 MUTE AUDIO";
      }
    });
  }

  const standingsBtn = document.getElementById("btn-toggle-standings");
  const standingsModal = document.getElementById("standings-modal");
  const closeStandingsBtn = document.getElementById("btn-close-standings");

  if (standingsBtn && standingsModal) {
    standingsBtn.addEventListener("click", () => {
      standingsModal.classList.toggle("hidden");
      fetchLeaderboard();
    });
  }
  if (closeStandingsBtn && standingsModal) {
    closeStandingsBtn.addEventListener("click", () => {
      standingsModal.classList.add("hidden");
    });
  }
}
