/**
 * BabylonCameraManager.ts
 * Integrates MobileTouchController with Babylon.js UniversalCamera,
 * handling 180° rearview flip, dynamic speed FOV scaling, and rifle recoil impulses.
 */

import { Scene, UniversalCamera, Vector3, Matrix } from '@babylonjs/core';
import { MobileTouchController, TouchInputState } from './MobileTouchController';

export class BabylonCameraManager {
  private camera: UniversalCamera;
  private scene: Scene;
  private baseFOV: number = 1.22; // ~70 degrees in radians
  private targetYaw: number = 0;   // 0 = Forward, Math.PI = 180° Rearview

  constructor(scene: Scene, canvas: HTMLCanvasElement, touchController: MobileTouchController) {
    this.scene = scene;

    // Initialize Babylon.js First-Person Camera
    this.camera = new UniversalCamera('FPV_Skier_Camera', new Vector3(0, 1.6, 0), this.scene);
    this.camera.fov = this.baseFOV;
    this.camera.minZ = 0.1;
    this.camera.maxZ = 1000.0;
    this.scene.activeCamera = this.camera;

    // Subscribe to Babylon-native Touch Input Observables
    touchController.onInputUpdatedObservable.add((state: TouchInputState) => {
      this.processInputUpdate(state);
    });

    touchController.onRearviewToggleObservable.add((isRearview: boolean) => {
      this.targetYaw = isRearview ? Math.PI : 0;
    });

    // Attach to Scene Render Loop for smooth camera updates
    this.scene.onBeforeRenderObservable.add(() => {
      this.updateCameraFrame();
    });
  }

  /**
   * Updates camera pitch, FOV, and yaw transition on every Babylon render frame.
   */
  private processInputUpdate(state: TouchInputState): void {
    // FOV Tuck Boost: Increase FOV when tucking downhill (throttleY > 0.5)
    const fovBoost = state.throttleY > 0.5 ? 0.15 : 0.0;
    this.camera.fov = this.baseFOV + fovBoost;
  }

  /**
   * Smoothly interpolates camera rotation (Yaw 180° flip)
   */
  private updateCameraFrame(): void {
    // Smooth Lerp toward target yaw (180° flip)
    let currentYaw = this.camera.rotation.y;
    let diff = this.targetYaw - currentYaw;

    // Shortest path angle wrapping
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;

    this.camera.rotation.y += diff * 0.2; // 20% lerp speed
  }

  /**
   * Triggers screen recoil impulse when firing rifle backward
   */
  public triggerRifleRecoil(): void {
    this.camera.rotation.x -= 0.08; // Kick camera pitch upward
    setTimeout(() => {
      this.camera.rotation.x += 0.08; // Recovery
    }, 80);
  }

  public getCamera(): UniversalCamera {
    return this.camera;
  }
}
