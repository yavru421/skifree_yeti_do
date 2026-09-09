/**
 * SkiFree Yeti DO - Main TypeScript Client Entry Point
 * Coordinates Babylon.js WebGPU/WebGL2 pipeline, Havok physics, FPV camera rig,
 * procedural terrain, Yeti boss state machine, precision rifle combat,
 * spatial audio, HUD overlay, and 20Hz edge sync to Cloudflare MountainDO.
 */

import { Vector3, Scalar } from "@babylonjs/core";
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
import { GameStatePacket, HitscanPacket, LimbStatus } from "./types";

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
  }

  private setupSkierControls(): void {
    const keys: Record<string, boolean> = {};

    window.addEventListener("keydown", (e: KeyboardEvent) => {
      keys[e.key.toLowerCase()] = true;
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
    this.playerPos.x = Scalar.Clamp(this.playerPos.x, -160, 160); // Bound within slope

    // Sound effect on carving
    if (Math.abs(this.steerInput) > 0.1) {
      this.audioSystem.playSkiCarve(this.speedMph / this.maxSpeedMph);
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
    this.terrainSystem.update(this.playerPos.z);
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

        // Drag the Yeti down: decelerate its speed and drain HP
        this.yetiEntity.applyDrag(22, deltaTime);

        // Skier speed also slows down into heavy friction drag
        this.speedMph = Scalar.Lerp(this.speedMph, 10, deltaTime * 2.5);

        // Update Tension Gauge & Prompts
        const dragProgress = Math.min(100, Math.round(((this.yetiEntity.maxHp - this.yetiEntity.hp) / this.yetiEntity.maxHp) * 100));
        if (tensionFill) tensionFill.style.width = `${dragProgress}%`;
        if (tensionLabel) tensionLabel.innerHTML = `<span style="color:#ff0055;">PULLING! ${dragProgress}%</span>`;
        if (towPrompt) {
          towPrompt.innerHTML = `🔥 DIGGING SKIS! [S] HELD — BRAKING THE BEAST! YETI SPEED: <span style="color:#ffff00;">${Math.round(this.yetiEntity.dragSpeed)} MPH</span>`;
        }
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
          towPrompt.innerHTML = `⚠️ TOWLINE HOOKED! <b>HOLD [S]</b> TO DIG IN SKIS & DRAG DOWN YETI!`;
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
    console.log("[SkiFree] YETI FELLED! HUNT COMPLETE!");

    // Audio & Screen FX
    this.cameraRig.addImpactShake(2.5);
    this.audioSystem.playRifleShot();

    // Show Takedown Cinematic Banners & Modals
    const bars = document.getElementById("cinematic-bars");
    const banner = document.getElementById("takedown-cinematic-overlay");
    const modal = document.getElementById("takedown-modal");
    const prompt = document.getElementById("tow-action-prompt");
    const gauge = document.getElementById("tension-gauge-container");

    if (bars) bars.classList.remove("hidden");
    if (banner) {
      banner.classList.remove("hidden");
      banner.style.opacity = "1";
    }
    if (prompt) prompt.classList.add("hidden");
    if (gauge) gauge.classList.add("hidden");

    setTimeout(() => {
      if (modal) modal.classList.remove("hidden");
      const takedownTime = document.getElementById("takedown-time");
      if (takedownTime) takedownTime.textContent = `${(performance.now() / 1000).toFixed(1)}s`;
      const takedownDist = document.getElementById("takedown-dist");
      if (takedownDist) takedownDist.textContent = `${Math.abs(Math.round(this.playerPos.z))}m`;
      const takedownSpeed = document.getElementById("takedown-speed");
      if (takedownSpeed) takedownSpeed.textContent = `${Math.round(this.speedMph)} MPH`;
      const takedownScore = document.getElementById("takedown-score");
      if (takedownScore) takedownScore.textContent = "10,000 PTS";
    }, 1200);
  }
}

// Auto-boot on page load
if (typeof window !== "undefined") {
  window.addEventListener("DOMContentLoaded", () => {
    SkiFreeApp.start();
  });
}
