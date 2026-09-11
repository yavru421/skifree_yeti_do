/**
 * SkiFree Yeti DO - FPV Camera Rig
 * Provides downhill forward skiing camera with tilt/inertia, dynamic FOV,
 * screen shake on collision/knockdowns, CS:GO/Fortnite weapon screen recoil,
 * and 180° rearview precision rifle aiming.
 */

import { Scene, UniversalCamera, Vector3, Scalar } from "@babylonjs/core";

export type CameraMode = 'third_person' | 'first_person';

export class CameraRig {
  public camera: UniversalCamera;
  private scene: Scene;

  // Camera Perspective Mode (Diablo-style Third-Person Overhead by default)
  public cameraMode: CameraMode = 'third_person';

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

  // CS:GO / Fortnite Screen Recoil Dynamics
  private recoilPitch: number = 0;
  private recoilYaw: number = 0;

  // Yeti Target Auto-Lock & Auto-Aim Framing
  public isTargetLocked: boolean = false;
  public autoLockEnabled: boolean = true;

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

  public setRearview(active: boolean): void {
    this.isAimingRear = active;
  }

  public applyAimDelta(deltaYaw: number, deltaPitch: number): void {
    this.aimYawOffset = Scalar.Clamp(this.aimYawOffset + deltaYaw, -0.60, 0.60);
    this.aimPitchOffset = Scalar.Clamp(this.aimPitchOffset + deltaPitch, -0.35, 0.40);
  }

  public toggleCameraMode(): CameraMode {
    this.cameraMode = this.cameraMode === 'third_person' ? 'first_person' : 'third_person';
    return this.cameraMode;
  }

  public setCameraMode(mode: CameraMode): void {
    this.cameraMode = mode;
  }

  public addImpactShake(amount: number = 1.0): void {
    this.shakeTrauma = Math.min(1.0, this.shakeTrauma + amount);
  }

  /**
   * Weapon Screen Recoil Impulse:
   * Instant upward kick with slight random horizontal deviation,
   * dampening back smoothly via spring-damper lerp.
   */
  public triggerRecoil(pitchKick: number = 0.08, yawKick: number = 0.025): void {
    this.recoilPitch += pitchKick;
    this.recoilYaw += (Math.random() - 0.5) * yawKick;
  }

  public update(
    playerPosition: Vector3,
    steerInput: number,
    speedMph: number,
    deltaTime: number,
    slopePitchRad: number = 0,
    targetPos?: Vector3,
    isTargetActive?: boolean
  ): void {
    this.currentSpeed = speedMph;

    // 0. Recoil Decay (Spring recovery)
    if (Math.abs(this.recoilPitch) > 0.0005 || Math.abs(this.recoilYaw) > 0.0005) {
      this.recoilPitch = Scalar.Lerp(this.recoilPitch, 0, Math.min(1.0, deltaTime * 16.0));
      this.recoilYaw = Scalar.Lerp(this.recoilYaw, 0, Math.min(1.0, deltaTime * 16.0));
    }

    // 1. Position camera based on cameraMode
    const isThirdPerson = this.cameraMode === 'third_person';
    const speedRatio = Math.min(1.8, speedMph / 45);
    const mogulChatter = Math.sin(Date.now() * 0.024) * 0.012 * speedRatio;

    if (isThirdPerson) {
      // Tight over-the-shoulder action perspective matching thats_the_best_video_you_have.mp4
      const followDist = 3.8;
      const followHeight = 1.85;
      const targetX = playerPosition.x + 0.32 + (this.isAimingRear ? 0 : this.aimYawOffset * 2.0);
      const targetY = playerPosition.y + followHeight + mogulChatter * 0.2;
      const targetZ = playerPosition.z + (this.isAimingRear ? -followDist : followDist);

      this.camera.position.x = Scalar.Lerp(this.camera.position.x, targetX, Math.min(1.0, deltaTime * 14.0));
      this.camera.position.y = Scalar.Lerp(this.camera.position.y, targetY, Math.min(1.0, deltaTime * 12.0));
      this.camera.position.z = Scalar.Lerp(this.camera.position.z, targetZ, Math.min(1.0, deltaTime * 14.0));
    } else {
      // Classic FPV eye level
      const eyeHeight = 1.55;
      const targetY = playerPosition.y + eyeHeight + mogulChatter;
      this.camera.position.x = Scalar.Lerp(this.camera.position.x, playerPosition.x, Math.min(1.0, deltaTime * 16.0));
      this.camera.position.y = Scalar.Lerp(this.camera.position.y, targetY, Math.min(1.0, deltaTime * 14.0));
      this.camera.position.z = playerPosition.z;
    }

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

    // 2. Camera Bank / Roll on carving
    if (isThirdPerson) {
      this.targetRoll = -steerInput * 0.04; // Subtle bank to keep horizon stable
    } else {
      this.targetRoll = -steerInput * 0.14; // Visceral FPV bank into turn (~8 deg)
    }
    this.currentRoll = Scalar.Lerp(this.currentRoll, this.targetRoll, Math.min(1.0, deltaTime * 10.0));
    this.camera.rotation.z = this.currentRoll + shakeRoll;

    // 3. Dynamic FOV based on downhill speed (speed warp sensation: 0.85 -> 1.07 rad)
    const targetFov = this.baseFov + (speedMph / 100) * 0.22;
    this.camera.fov = Scalar.Lerp(this.camera.fov, targetFov, Math.min(1.0, deltaTime * 8.0));

    // 4. Yeti Auto-Lock & Target Framing (Upper Torso/Head vs Scenic Horizon)
    const carvingYawOffset = -steerInput * 0.09;
    const defaultYaw = (this.isAimingRear ? 0 : Math.PI) + (isThirdPerson ? carvingYawOffset * 0.4 : carvingYawOffset);

    let targetPitchAngle = 0;
    let targetYawAngle = defaultYaw;

    const hasValidTarget = !!(
      this.autoLockEnabled &&
      isTargetActive &&
      targetPos &&
      Math.abs(targetPos.z - playerPosition.z) > 1.0 &&
      Math.hypot(targetPos.x - playerPosition.x, targetPos.z - playerPosition.z) < 180
    );

    if (hasValidTarget && targetPos) {
      this.isTargetLocked = true;
      // Target Yeti upper torso / head (2.2m above ground surface)
      const targetCenterY = targetPos.y + 2.2;
      const dx = targetPos.x - this.camera.position.x;
      const dy = targetCenterY - this.camera.position.y;
      const dz = targetPos.z - this.camera.position.z;
      const distXZ = Math.hypot(dx, dz);

      // Pitch calculation: Looking UP is negative rotation.x, looking DOWN is positive
      const idealPitch = -Math.atan2(dy, distXZ) - 0.02;

      // Yaw calculation: Angle to target in world coordinates
      const idealYaw = Math.atan2(dx, dz);

      targetPitchAngle = idealPitch + this.aimPitchOffset * 0.4;
      targetYawAngle = idealYaw + this.aimYawOffset * 0.4;
    } else {
      this.isTargetLocked = false;
      if (isThirdPerson) {
        // Tight over-the-shoulder downhill action framing matching thats_the_best_video_you_have.mp4
        const speedPitchCompression = (speedMph / 80) * 0.02;
        const basePitch = this.isAimingRear
          ? -0.02 + this.aimPitchOffset * 0.3
          : (0.02 + slopePitchRad * 0.15 + speedPitchCompression + this.aimPitchOffset * 0.3);
        targetPitchAngle = basePitch;
        targetYawAngle = defaultYaw + this.aimYawOffset;
      } else {
        // Natural downhill horizon framing (level eye-line, never looking down at skis)
        const speedPitchCompression = (speedMph / 80) * 0.03;
        const basePitch = this.isAimingRear 
          ? -0.02 + this.aimPitchOffset 
          : (0.01 + slopePitchRad * 0.12 + speedPitchCompression + this.aimPitchOffset);

        targetPitchAngle = basePitch;
        targetYawAngle = defaultYaw + this.aimYawOffset;
      }
    }

    // Shortest-path yaw lerp (prevents 360 wrap flickers)
    let yawDiff = targetYawAngle - this.currentYaw;
    while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
    while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
    this.currentYaw += yawDiff * Math.min(1.0, deltaTime * (this.isTargetLocked ? 14.0 : 12.0));
    this.camera.rotation.y = this.currentYaw + this.recoilYaw;

    // Pitch lerp (kicks upward on recoil)
    this.camera.rotation.x = Scalar.Lerp(
      this.camera.rotation.x,
      targetPitchAngle - this.recoilPitch,
      Math.min(1.0, deltaTime * (this.isTargetLocked ? 14.0 : 10.0))
    );
  }

  public getForwardRay(): Vector3 {
    return this.camera.getForwardRay().direction;
  }
}
