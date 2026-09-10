/**
 * SkiFree Yeti DO - Precision Rifle & Raycast Combat System
 * Implements authoritative hitscan detection, magazine reload (8 rounds),
 * muzzle flash point-light dynamics, bullet tracers, and server hit dispatch.
 * Supports Left Click, PointerDown, Touch, Spacebar, and Enter.
 */

import {
  Scene,
  Vector3,
  Ray,
  PointLight,
  Color3,
  StandardMaterial
} from "@babylonjs/core";
import { YetiEntity } from "./yeti";
import { HitscanPacket } from "./types";
import { NPCSystem } from "./npcs";

export class CombatSystem {
  private scene: Scene;
  private yeti: YetiEntity;
  private npcSystem: NPCSystem | null = null;
  private onFireCallback: () => void;
  private onHitCallback: (packet: HitscanPacket) => void;

  // Weapon State
  public currentAmmo: number = 8;
  public maxAmmo: number = 8;
  public isReloading: boolean = false;
  private reloadTimeMs: number = 1600;
  private lastShotTime: number = 0;
  private fireCooldownMs: number = 180; // Rate limit anti-cheat parity

  // Visual Effects
  private muzzleFlashLight: PointLight | null = null;
  private tracerMaterial: StandardMaterial | null = null;

  constructor(
    scene: Scene,
    yeti: YetiEntity,
    onFire: () => void,
    onHit: (packet: HitscanPacket) => void,
    npcSystem?: NPCSystem
  ) {
    this.scene = scene;
    this.yeti = yeti;
    this.onFireCallback = onFire;
    this.onHitCallback = onHit;
    if (npcSystem) this.npcSystem = npcSystem;
    this.initVFX();
    this.setupInputListeners();
  }

  public setNPCSystem(npcSystem: NPCSystem): void {
    this.npcSystem = npcSystem;
  }

  private initVFX(): void {
    // Dynamic muzzle flash light
    this.muzzleFlashLight = new PointLight("muzzleFlash", new Vector3(0, 0, 0), this.scene);
    this.muzzleFlashLight.diffuse = new Color3(1.0, 0.85, 0.4);
    this.muzzleFlashLight.intensity = 0;
    this.muzzleFlashLight.range = 25;

    // Bullet tracer material
    this.tracerMaterial = new StandardMaterial("tracerMat", this.scene);
    this.tracerMaterial.emissiveColor = new Color3(1.0, 0.95, 0.5);
    this.tracerMaterial.disableLighting = true;
  }

  private setupInputListeners(): void {
    const tryFire = (e?: Event) => {
      // Don't fire if interacting with an explicit UI button or input
      if (e && e.target instanceof HTMLElement) {
        if (e.target.tagName === "BUTTON" || e.target.tagName === "INPUT") return;
      }
      this.fire();
    };

    // 1. Pointer Down (Desktop mouse & mobile touch)
    window.addEventListener("pointerdown", (e: PointerEvent) => {
      if (e.button === 0 || e.pointerType === "touch") {
        tryFire(e);
      }
    });

    // 2. Mouse Down (Fallback)
    window.addEventListener("mousedown", (e: MouseEvent) => {
      if (e.button === 0) {
        tryFire(e);
      }
    });

    // 3. Keyboard (Spacebar, Enter, F to fire; R to reload)
    window.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "Enter" || e.key === "f" || e.key === "F") {
        tryFire(e);
      }
      if (e.key === "r" || e.key === "R") {
        this.reload();
      }
    });
  }

  public tryFireHarpoon(): boolean {
    return this.fire();
  }

  public fire(): boolean {
    const now = performance.now();
    if (this.isReloading || this.currentAmmo <= 0 || now - this.lastShotTime < this.fireCooldownMs) {
      return false;
    }

    this.currentAmmo--;
    this.lastShotTime = now;

    // ALWAYS TRIGGER ON-FIRE CALLBACK (Sound, Harpoon Recoil, Steam Vent Puff)
    this.onFireCallback();

    // 1. Flash Muzzle Light
    if (this.muzzleFlashLight) {
      this.muzzleFlashLight.position.copyFrom(this.scene.activeCamera!.position);
      this.muzzleFlashLight.intensity = 4.0;
      setTimeout(() => {
        if (this.muzzleFlashLight) this.muzzleFlashLight.intensity = 0;
      }, 55);
    }

    // 2. Raycast from camera along look vector
    const camera = this.scene.activeCamera!;
    const ray = camera.getForwardRay(350);

    // 3. Test intersection against Yeti Hitbox
    this.evaluateHitscan(ray, now);

    // Auto reload on empty
    if (this.currentAmmo === 0) {
      this.reload();
    }

    return true;
  }

  private evaluateHitscan(ray: Ray, timestamp: number): void {
    const headPos = this.yeti.getHeadWorldPosition();
    const bodyPos = this.yeti.getBodyWorldPosition();

    // Generous head sphere intersection check (2.4m radius)
    const distToHeadRay = this.distancePointToRay(headPos, ray.origin, ray.direction);
    const distHead = Vector3.Distance(ray.origin, headPos);

    if (distToHeadRay < 2.4 && distHead < 350) {
      const flankCheck = this.yeti.evaluateFlankVulnerability(ray.origin.x);
      this.triggerDeflectFeedback(flankCheck.message);
      this.yeti.triggerHitFeedback(true);
      this.onHitCallback({
        type: "hitscan",
        target: "yeti",
        hitPart: "head",
        damage: flankCheck.damage + 200,
        isCritical: flankCheck.isCritical,
        distance: distHead,
        rayOrigin: { x: ray.origin.x, y: ray.origin.y, z: ray.origin.z },
        rayDir: { x: ray.direction.x, y: ray.direction.y, z: ray.direction.z },
        timestamp
      });
      return;
    }

    // Generous body box intersection check (4.2m radius)
    const distToBodyRay = this.distancePointToRay(bodyPos, ray.origin, ray.direction);
    const distBody = Vector3.Distance(ray.origin, bodyPos);

    if (distToBodyRay < 4.2 && distBody < 350) {
      const flankCheck = this.yeti.evaluateFlankVulnerability(ray.origin.x);
      this.triggerDeflectFeedback(flankCheck.message);
      this.yeti.triggerHitFeedback(flankCheck.isCritical);
      this.onHitCallback({
        type: "hitscan",
        target: "yeti",
        hitPart: "body",
        damage: flankCheck.damage,
        isCritical: flankCheck.isCritical,
        distance: distBody,
        rayOrigin: { x: ray.origin.x, y: ray.origin.y, z: ray.origin.z },
        rayDir: { x: ray.direction.x, y: ray.direction.y, z: ray.direction.z },
        timestamp
      });
      return;
    }

    // 4. Test intersection against active NPCs
    if (this.npcSystem) {
      this.npcSystem.checkRayHit(ray);
    }
  }

  private distancePointToRay(point: Vector3, rayOrigin: Vector3, rayDir: Vector3): number {
    const v = point.subtract(rayOrigin);
    const t = Vector3.Dot(v, rayDir);
    if (t < 0) return Infinity; // Behind ray
    const proj = rayOrigin.add(rayDir.scale(t));
    return Vector3.Distance(point, proj);
  }

  public reload(): void {
    if (this.isReloading || this.currentAmmo === this.maxAmmo) return;
    this.isReloading = true;
    setTimeout(() => {
      this.currentAmmo = this.maxAmmo;
      this.isReloading = false;
    }, this.reloadTimeMs);
  }

  private triggerDeflectFeedback(message: string): void {
    const prompt = document.getElementById("tow-action-prompt");
    if (prompt) {
      prompt.classList.remove("hidden");
      prompt.innerHTML = `<span style="color:#ff0055; font-size:1.1em; font-weight:900;">${message}</span>`;
      setTimeout(() => {
        prompt.classList.add("hidden");
      }, 1600);
    }
  }
}
