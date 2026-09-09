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
import { HUDManager } from "./hud";
import { NetworkSystem } from "./network";
import { FPVSkis } from "./skis";
import { SteamHarpoon } from "./harpoon";
import { NPCSystem } from "./npcs";
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
  private hudManager!: HUDManager;
  private networkSystem!: NetworkSystem;
  private fpvSkis!: FPVSkis;
  private steamHarpoon!: SteamHarpoon;
  private npcSystem!: NPCSystem;

  // Skier State
  private playerPos: Vector3 = new Vector3(0, 0, 0);
  private speedMph: number = 28;
  private maxSpeedMph: number = 75;
  private steerInput: number = 0; // -1 to 1
  private isTucking: boolean = false;
  private isBraking: boolean = false;
  private isTakedownTriggered: boolean = false;
  private isWaitingForDropIn: boolean = false;
  private lastSteerDir: number = 0;
  private currentLevel: number = 1;
  private totalScore: number = 0;
  private nextLevelTimeout: number | null = null;
  private limbStatus: LimbStatus = LimbStatus.FULL;
  private callsign: string = "Skier_" + Math.floor(1000 + Math.random() * 9000);
  private roomId: string = "alpine-lodge-1";

  public static async start(): Promise<SkiFreeApp> {
    const app = new SkiFreeApp();
    await app.init();
    return app;
  }

  private async init(): Promise<void> {
    console.log("[SkiFree] Initializing TypeScript + Babylon.js Engine...");

    // 1. URL Params Setup (Callsign, Room, Difficulty)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("callsign")) this.callsign = urlParams.get("callsign")!;
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

    // 7. Audio System
    this.audioSystem = new AudioSystem();
    this.audioSystem.init();

    // 8. Precision Combat
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
        this.networkSystem.sendHitscan(packet);
      },
      this.npcSystem
    );

    // 9. HUD Manager
    this.hudManager = new HUDManager();

    // 10. Network System (20Hz WebSocket to MountainDO)
    this.networkSystem = new NetworkSystem(
      this.callsign,
      this.roomId,
      (packet: GameStatePacket) => this.handleNetworkState(packet)
    );
    this.networkSystem.connect();

    // 11. Skier Keyboard Controls
    this.setupSkierControls();

    // 12. Setup Intro Overlay & Interaction Dismissals
    this.setupIntroOverlay();

    // 13. Run Main Game Loop
    this.engineManager.startRenderLoop((delta: number) => this.tick(delta));

    console.log("[SkiFree] Babylon.js Engine Active & Ready!");
  }

  private setupIntroOverlay(): void {
    const overlay = document.getElementById("intro-overlay");
    const skipBtn = document.getElementById("btn-skip-intro");
    const unmuteBtn = document.getElementById("btn-unmute-intro");
    const video = document.getElementById("intro-video") as HTMLVideoElement | null;
    const hudOverlay = document.getElementById("hud-overlay");

    // Enforce video autoplay policy workaround: muted + playsInline + explicit play invocation
    if (video) {
      video.muted = true;
      video.defaultMuted = true;
      video.playsInline = true;
      video.currentTime = 0.05;
      video.play().catch(() => {});
    }

    const dismiss = () => {
      if (overlay) overlay.style.display = "none";
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

    if (unmuteBtn && video) {
      unmuteBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        video.muted = !video.muted;
        unmuteBtn.textContent = video.muted ? "🔊 UNMUTE" : "🔇 MUTE";
      });
    }

    window.addEventListener("keydown", (e) => {
      if (e.code === "Space" && overlay && overlay.style.display !== "none") {
        dismiss();
      }
      if ((e.code === "Space" || e.code === "Enter") && this.isWaitingForDropIn) {
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

    // Handle New Level Screen Drop-In button
    const btnDropIn = document.getElementById("btn-drop-in");
    if (btnDropIn) {
      btnDropIn.addEventListener("click", () => {
        this.executeDropIn();
      });
    }
  }

  private setupSkierControls(): void {
    const keys: Record<string, boolean> = {};

    window.addEventListener("keydown", (e: KeyboardEvent) => {
      keys[e.key.toLowerCase()] = true;
      if (this.isTakedownTriggered && (e.code === "Space" || e.code === "Enter")) {
        this.startNextLevel();
      }
    });

    window.addEventListener("keyup", (e: KeyboardEvent) => {
      keys[e.key.toLowerCase()] = false;
    });

    // Keyboard polling in tick loop
    this.updateControls = () => {
      // Steer: A / D or ArrowLeft / ArrowRight
      let steer = 0;
      if (keys["a"] || keys["arrowleft"]) steer -= 1;
      if (keys["d"] || keys["arrowright"]) steer += 1;

      // Limb penalties
      if (this.limbStatus === LimbStatus.LEFT_ARM_LOST && steer < 0) steer *= 0.8;
      if (this.limbStatus === LimbStatus.BOTH_ARMS_LOST) steer *= 0.5;

      this.steerInput = steer;
      this.isTucking = !!(keys["w"] || keys["arrowup"]);
      this.isBraking = !!(keys["s"] || keys["arrowdown"]);
    };
  }

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
      this.speedMph = Scalar.Lerp(this.speedMph, 14, deltaTime * 3.0);
    } else {
      this.speedMph = Scalar.Lerp(this.speedMph, 38, deltaTime * 0.8);
    }

    const forwardSpeedUnitsPerSec = (this.speedMph * 0.44704) * 2.2; // Convert MPH to scene units
    this.playerPos.z -= forwardSpeedUnitsPerSec * deltaTime;

    // Lateral carving along X (looking downhill along -Z, +X is screen-left, -X is screen-right)
    const steerSpeed = 22;
    this.playerPos.x -= this.steerInput * steerSpeed * deltaTime;
    const halfWidth = this.terrainSystem.currentTrack.trailWidth / 2;
    this.playerPos.x = Scalar.Clamp(this.playerPos.x, -halfWidth, halfWidth); // Bound within slope

    // Sound effect on carving
    if (Math.abs(this.steerInput) > 0.1) {
      this.audioSystem.playSkiCarve(this.speedMph / this.maxSpeedMph);
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
    this.cameraRig.update(this.playerPos, this.steerInput, this.speedMph, deltaTime);
    this.yetiEntity.update(this.playerPos, deltaTime);
    if (this.fpvSkis) {
      this.fpvSkis.update(this.steerInput, this.isTucking, this.isBraking, this.speedMph, this.cameraRig.isAimingRear, deltaTime);
    }
    if (this.steamHarpoon) {
      this.steamHarpoon.update(this.yetiEntity.rootMesh.position, this.cameraRig.isAimingRear, deltaTime);
    }
    if (this.npcSystem) {
      this.npcSystem.update(this.playerPos.z, this.yetiEntity.rootMesh.position, deltaTime);
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
          const sawDmg = 450 + this.currentLevel * 90;
          this.yetiEntity.hp = Math.max(0, this.yetiEntity.hp - sawDmg);
          this.totalScore += 350;
          this.audioSystem.playSkiCarve(1.0);
          this.cameraRig.addImpactShake(0.09);

          if (towPrompt) {
            towPrompt.classList.remove("hidden");
            towPrompt.innerHTML = `⚡ <b>EDGE SLICE!</b> OPPOSITE CARVE! <span style="color:#ff0055;">-${sawDmg} HP!</span>`;
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

        // Update Tension Gauge & Prompts
        const dragProgress = Math.min(100, Math.round(((this.yetiEntity.maxHp - this.yetiEntity.hp) / this.yetiEntity.maxHp) * 100));
        if (tensionFill) tensionFill.style.width = `${dragProgress}%`;
        if (tensionLabel) tensionLabel.innerHTML = `<span style="color:#ff0055;">PULLING! ${dragProgress}%</span>`;
        if (bossHpFill) {
          const hpPct = Math.max(0, (this.yetiEntity.hp / this.yetiEntity.maxHp) * 100);
          bossHpFill.style.width = `${hpPct}%`;
        }

        // Check if Yeti is downed!
        if (this.yetiEntity.state === YetiAIState.DEAD && !this.isTakedownTriggered) {
          this.triggerYetiTakedown();
        }
      } else {
        // Not pressing 'S' - Yeti pulls ahead and recovers speed
        this.steamHarpoon.cableTension = 0.45;
        this.yetiEntity.dragSpeed = Scalar.Lerp(this.yetiEntity.dragSpeed, 38, deltaTime * 1.5);
        if (tensionLabel) tensionLabel.innerHTML = `<span>40% (SLACK)</span>`;
        if (towPrompt) {
          towPrompt.innerHTML = `⚠️ TOWLINE HOOKED! <b>HOLD [S]</b> & CARVE [A / D] TO SAW & DRAG DOWN YETI!`;
        }
      }
    }

    // 4. Update HUD
    this.hudManager.update(
      this.speedMph,
      this.yetiEntity.wave,
      this.yetiEntity.hp,
      this.yetiEntity.maxHp,
      this.combatSystem.currentAmmo,
      this.combatSystem.isReloading,
      this.limbStatus
    );

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

    // Audio & Screen FX
    this.cameraRig.addImpactShake(2.5);
    this.audioSystem.playRifleShot();

    // Calculate score
    const levelBonus = 10000 * this.currentLevel;
    this.totalScore += levelBonus;

    // Clear auto-timeout so player is in full control of next level drop-in
    if (this.nextLevelTimeout) {
      clearTimeout(this.nextLevelTimeout);
      this.nextLevelTimeout = null;
    }

    // Show Takedown Cinematic Banners
    const bars = document.getElementById("cinematic-bars");
    const banner = document.getElementById("takedown-cinematic-overlay");
    const gauge = document.getElementById("tension-gauge-container");

    if (bars) bars.classList.remove("hidden");
    if (banner) {
      banner.classList.remove("hidden");
      banner.style.opacity = "1";
      banner.innerHTML = `
        <div style="font-size: clamp(22px, 4.5vw, 38px); font-weight: 900; color: #39ff14; text-shadow: 0 0 20px #39ff14; letter-spacing: 2px;">
          RUN ${this.currentLevel} COMPLETE!
        </div>
        <div style="font-size: clamp(13px, 2.2vw, 18px); font-weight: 800; color: #ffff00; margin-top: 6px; text-shadow: 0 0 10px #ff0055;">
          BEAST FELLED • +${levelBonus.toLocaleString()} PTS
        </div>
      `;
    }
    if (gauge) gauge.classList.add("hidden");

    // Populate & Reveal the New Level Screen (Drop-In Modal)
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

    if (clearTitle) clearTitle.textContent = `BEAST DOWNED! RUN ${this.currentLevel} CLEARED`;
    if (clearSubtitle) clearSubtitle.textContent = `GRANBY RANCH • ${getGranbyTrack(this.currentLevel).runName}`;
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

    // Show backdrop and modal after brief 500ms slow-mo takedown view
    setTimeout(() => {
      const backdrop = document.getElementById("modal-backdrop");
      const levelModal = document.getElementById("level-clear-modal");
      if (backdrop) backdrop.classList.remove("hidden");
      if (levelModal) levelModal.classList.remove("hidden");
      this.isWaitingForDropIn = true;
    }, 500);
  }

  private executeDropIn(): void {
    if (!this.isWaitingForDropIn) return;
    this.isWaitingForDropIn = false;

    const backdrop = document.getElementById("modal-backdrop");
    const levelModal = document.getElementById("level-clear-modal");
    if (backdrop) backdrop.classList.add("hidden");
    if (levelModal) levelModal.classList.add("hidden");

    // Alpine Starting Horn & Drop-In Camera Plunge
    this.audioSystem.playDropIn();
    this.cameraRig.addImpactShake(1.6);

    // Initial Drop-In Surge down the fall line
    const nextTrack = getGranbyTrack(this.currentLevel + 1);
    this.speedMph = Math.max(46, 36 * nextTrack.baseSpeedMultiplier);

    this.startNextLevel();
  }

  private startNextLevel(): void {
    if (this.nextLevelTimeout) {
      clearTimeout(this.nextLevelTimeout);
      this.nextLevelTimeout = null;
    }

    this.currentLevel++;
    this.isTakedownTriggered = false;

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
    this.terrainSystem.applyTrack(track);

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
    this.audioSystem.playRifleShot();
    this.cameraRig.addImpactShake(1.4);

    // Show Level Announcement HUD Banner
    this.showLevelSplash(this.currentLevel);

    console.log(`[SkiFree] ADVANCING TO LEVEL ${this.currentLevel} (GRANBY: ${track.runName})! Grade: ${track.slopeGradeDeg}°, Yeti HP: ${this.yetiEntity.maxHp}, Speed: ${this.yetiEntity.dragSpeed} MPH`);
  }

  private showLevelSplash(level: number): void {
    const prompt = document.getElementById("tow-action-prompt");
    const track = getGranbyTrack(level);

    if (prompt) {
      prompt.classList.remove("hidden");
      prompt.innerHTML = `
        <div style="font-size: clamp(14px, 2.5vw, 20px); font-weight: 900; color: #00f0ff; letter-spacing: 1px;">
          ⛷️ GRANBY RANCH: ${track.runName} (${track.difficulty})
        </div>
        <div style="color: #ffff00; font-size: clamp(11px, 1.8vw, 14px); font-weight: 700; margin: 2px 0;">
          ${track.mountainArea.toUpperCase()} • ELEV ${track.baseElevationFt.toLocaleString()}' • ${track.slopeGradeDeg}° GRADE PITCH
        </div>
        <div style="color: #ffffff; font-size: clamp(10px, 1.5vw, 13px); opacity: 0.92;">
          ${track.description}
        </div>
        <div style="color: #ff0055; font-size: clamp(10px, 1.5vw, 13px); font-weight: bold; margin-top: 2px;">
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
}

// Auto-boot on page load with readyState check to prevent deferred module race condition
if (typeof window !== "undefined") {
  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", () => {
      SkiFreeApp.start().catch((err) => console.error("[SkiFree] Boot error:", err));
    });
  } else {
    SkiFreeApp.start().catch((err) => console.error("[SkiFree] Boot error:", err));
  }
}
