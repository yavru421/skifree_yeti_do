/**
 * SkiFree Yeti DO - FPV Camera Rig
 * Provides downhill forward skiing camera with tilt/inertia, dynamic FOV,
 * screen shake on collision/knockdowns, and 180° rearview precision rifle aiming.
 */

import { Scene, UniversalCamera, Vector3, Scalar } from "@babylonjs/core";

export class CameraRig {
  public camera: UniversalCamera;
  private scene: Scene;

  // State
  public isAimingRear: boolean = false;
  private currentYaw: number = Math.PI;
  private targetYaw: number = Math.PI;
  private currentRoll: number = 0;
  private targetRoll: number = 0;
  private baseFov: number = 0.85; // rad (~48 deg)
  private currentSpeed: number = 0;
  private shakeTrauma: number = 0;
  public aimYawOffset: number = 0;
  public aimPitchOffset: number = 0;

  constructor(scene: Scene, canvas: HTMLCanvasElement) {
    this.scene = scene;
    this.camera = new UniversalCamera("fpvCamera", new Vector3(0, 1.6, 0), this.scene);
    this.camera.setTarget(new Vector3(0, 1.4, -20)); // Looking downhill along -Z
    this.camera.fov = this.baseFov;
    this.camera.minZ = 0.1;
    this.camera.maxZ = 1200;

    // Attach mouse controls for fine rifle aiming
    this.camera.inputs.clear(); // Custom control handling
    this.setupInputListeners(canvas);
  }

  private setupInputListeners(canvas: HTMLCanvasElement): void {
    canvas.addEventListener("click", () => {
      if (document.pointerLockElement !== canvas) {
        canvas.requestPointerLock?.();
      }
    });

    window.addEventListener("mousemove", (e: MouseEvent) => {
      if (document.pointerLockElement === canvas) {
        const sens = 0.0018;
        this.aimYawOffset = Scalar.Clamp(this.aimYawOffset - e.movementX * sens, -0.60, 0.60);
        this.aimPitchOffset = Scalar.Clamp(this.aimPitchOffset - e.movementY * sens, -0.35, 0.40);
      }
    });

    window.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "Shift") {
        this.isAimingRear = true;
      }
    });

    window.addEventListener("keyup", (e: KeyboardEvent) => {
      if (e.key === "Shift") {
        this.isAimingRear = false;
      }
    });

    canvas.addEventListener("mousedown", (e: MouseEvent) => {
      if (e.button === 2) { // Right-click aim
        this.isAimingRear = true;
        e.preventDefault();
      }
    });

    canvas.addEventListener("mouseup", (e: MouseEvent) => {
      if (e.button === 2) {
        this.isAimingRear = false;
        e.preventDefault();
      }
    });

    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  public addImpactShake(amount: number = 1.0): void {
    this.shakeTrauma = Math.min(1.0, this.shakeTrauma + amount);
  }

  public update(
    playerPosition: Vector3,
    steerInput: number,
    speedMph: number,
    deltaTime: number,
    slopePitchRad: number = 0
  ): void {
    this.currentSpeed = speedMph;

    // 1. Position camera at player's eye level with dynamic mogul/bump compression
    const eyeHeight = 1.55;
    this.camera.position.x = Scalar.Lerp(this.camera.position.x, playerPosition.x, Math.min(1.0, deltaTime * 16.0));
    
    // High-speed mogul chatter & terrain compression
    const speedRatio = Math.min(1.8, speedMph / 45);
    const mogulChatter = Math.sin(Date.now() * 0.024) * 0.012 * speedRatio;
    const targetY = playerPosition.y + eyeHeight + mogulChatter;
    this.camera.position.y = Scalar.Lerp(this.camera.position.y, targetY, Math.min(1.0, deltaTime * 14.0));
    this.camera.position.z = playerPosition.z;

    // Harmonic Screen Shake on Impact / Knockdowns (Zero high-frequency strobe)
    let shakeX = 0;
    let shakeY = 0;
    let shakeRoll = 0;
    if (this.shakeTrauma > 0.005) {
      const shakePower = this.shakeTrauma * this.shakeTrauma;
      const t = performance.now() * 0.001;
      shakeX = Math.sin(t * 38.0) * 0.18 * shakePower;
      shakeY = Math.cos(t * 46.0) * 0.14 * shakePower;
      shakeRoll = Math.sin(t * 26.0) * 0.035 * shakePower;
      this.shakeTrauma = Math.max(0, this.shakeTrauma - deltaTime * 2.8);
    }
    this.camera.position.x += shakeX;
    this.camera.position.y += shakeY;

    // 2. Camera Bank / Roll on carving (-8° max banking into turns with helmet inertia)
    this.targetRoll = -steerInput * 0.14; // Visceral bank into turn (~8 deg)
    this.currentRoll = Scalar.Lerp(this.currentRoll, this.targetRoll, Math.min(1.0, deltaTime * 10.0));
    this.camera.rotation.z = this.currentRoll + shakeRoll;

    // 3. Dynamic FOV based on downhill speed (speed warp sensation: 0.85 -> 1.07 rad)
    const targetFov = this.baseFov + (speedMph / 100) * 0.22;
    this.camera.fov = Scalar.Lerp(this.camera.fov, targetFov, Math.min(1.0, deltaTime * 8.0));

    // 4. Rearview / 180° Aim Interpolation + Mouse Aim Offset
    const carvingYawOffset = -steerInput * 0.09;
    this.targetYaw = (this.isAimingRear ? 0 : Math.PI) + carvingYawOffset + this.aimYawOffset;
    this.currentYaw = Scalar.Lerp(this.currentYaw, this.targetYaw, Math.min(1.0, deltaTime * 12.0));
    this.camera.rotation.y = this.currentYaw;

    // Physical downhill slope pitch + subtle helmet forward lean on high velocity + pitch aim
    const baseSlopeAngle = slopePitchRad * 0.40;
    const speedPitchCompression = (speedMph / 80) * 0.05;
    this.camera.rotation.x = this.isAimingRear 
      ? -0.04 + this.aimPitchOffset 
      : (0.07 + baseSlopeAngle + speedPitchCompression + this.aimPitchOffset);
  }

  public getForwardRay(): Vector3 {
    return this.camera.getForwardRay().direction;
  }
}
