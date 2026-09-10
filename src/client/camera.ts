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
    this.shakeTrauma = Math.min(2.5, this.shakeTrauma + amount);
  }

  public update(
    playerPosition: Vector3,
    steerInput: number,
    speedMph: number,
    deltaTime: number,
    slopePitchRad: number = 0
  ): void {
    this.currentSpeed = speedMph;

    // 1. Position camera at player's eye level
    const eyeHeight = 1.55;
    this.camera.position.x = Scalar.Lerp(this.camera.position.x, playerPosition.x, 0.25);
    this.camera.position.y = playerPosition.y + eyeHeight;
    this.camera.position.z = playerPosition.z;

    // Calculate Screen Shake Trauma on Impact / Knockdowns
    let shakeX = 0;
    let shakeY = 0;
    let shakeRoll = 0;
    if (this.shakeTrauma > 0.005) {
      const shakePower = this.shakeTrauma * this.shakeTrauma;
      shakeX = (Math.random() - 0.5) * 0.35 * shakePower;
      shakeY = (Math.random() - 0.5) * 0.25 * shakePower;
      shakeRoll = (Math.random() - 0.5) * 0.07 * shakePower;
      this.shakeTrauma = Math.max(0, this.shakeTrauma - deltaTime * 3.0);
    }
    this.camera.position.x += shakeX;
    this.camera.position.y += shakeY;

    // 2. Camera Bank / Roll on carving (set absolute angle, never accumulate!)
    this.targetRoll = -steerInput * 0.08; // Subtle bank into turn (max ~4.5 deg)
    this.currentRoll = Scalar.Lerp(this.currentRoll, this.targetRoll, 0.15);
    this.camera.rotation.z = this.currentRoll + shakeRoll;

    // 3. Dynamic FOV based on downhill speed (speed warp sensation)
    const targetFov = this.baseFov + (speedMph / 100) * 0.22;
    this.camera.fov = Scalar.Lerp(this.camera.fov, targetFov, 0.1);

    // 4. Rearview / 180° Aim Interpolation
    // When looking downhill, Math.PI faces downhill (-Z)
    // Add subtle yaw into turns so skier looks in the direction they are carving
    const carvingYawOffset = -steerInput * 0.06;
    this.targetYaw = (this.isAimingRear ? 0 : Math.PI) + carvingYawOffset;
    this.currentYaw = Scalar.Lerp(this.currentYaw, this.targetYaw, 0.18);
    this.camera.rotation.y = this.currentYaw;

    // Physical downhill slope pitch + subtle eye bob
    const baseSlopeAngle = slopePitchRad * 0.35;
    this.camera.rotation.x = this.isAimingRear ? -0.04 : (0.06 + baseSlopeAngle);
  }

  public getForwardRay(): Vector3 {
    return this.camera.getForwardRay().direction;
  }
}
