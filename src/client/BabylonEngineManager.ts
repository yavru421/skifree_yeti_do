/**
 * BabylonEngineManager.ts
 * Bootstraps Babylon.js WebGPU Engine, initializes scene, and binds 20Hz DO snapshots.
 */

import { WebGPUEngine, Engine, Scene, Vector3, Color3, HemisphericLight } from '@babylonjs/core';
import { MobileTouchController } from './MobileTouchController';
import { BabylonCameraManager } from './BabylonCameraManager';
import { SnapshotInterpolator } from './SnapshotInterpolation';

export class BabylonEngineManager {
  private engine!: Engine | WebGPUEngine;
  private scene!: Scene;
  private cameraManager!: BabylonCameraManager;
  private touchController!: MobileTouchController;
  private interpolator: SnapshotInterpolator = new SnapshotInterpolator();

  public async initEngine(canvas: HTMLCanvasElement, hudContainerId: string = 'mobile-touch-container'): Promise<void> {
    // 1. Initialize WebGPU Engine if supported, with WebGL fallback
    if (typeof WebGPUEngine !== 'undefined' && (await WebGPUEngine.IsSupportedAsync)) {
      try {
        const webgpuEngine = new WebGPUEngine(canvas, { antialias: true });
        await webgpuEngine.initAsync();
        this.engine = webgpuEngine;
        console.log('🚀 Babylon.js WebGPU Engine Initialized');
      } catch (err) {
        console.warn('WebGPU init failed, falling back to WebGL:', err);
        this.engine = new Engine(canvas, true);
      }
    } else {
      this.engine = new Engine(canvas, true);
      console.log('⚡ Babylon.js WebGL Fallback Initialized');
    }

    // 2. Build Scene
    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color3(0.9, 0.95, 1.0).toColor4(1.0); // Arctic Snow Fog

    // Ambient Lighting
    const light = new HemisphericLight('SunLight', new Vector3(0, 1, 0), this.scene);
    light.intensity = 0.9;

    // 3. Mount Mobile Touch Controller
    this.touchController = new MobileTouchController(hudContainerId);

    // 4. Attach Babylon Camera Manager
    this.cameraManager = new BabylonCameraManager(this.scene, canvas, this.touchController);

    // 5. Connect Fire Observable to Camera Recoil
    this.touchController.onFireObservable.add(() => {
      this.cameraManager.triggerRifleRecoil();
    });

    // 6. Start Render Loop
    this.engine.runRenderLoop(() => {
      // Apply interpolated 20Hz snapshot position
      const renderState = this.interpolator.getInterpolatedState();
      if (renderState) {
        const cam = this.cameraManager.getCamera();
        cam.position.x = renderState.x;
        cam.position.y = renderState.y;
        cam.position.z = renderState.z;
      }

      this.scene.render();
    });

    window.addEventListener('resize', () => this.engine.resize());
  }

  public handleServerSnapshot(snapshot: any): void {
    this.interpolator.pushSnapshot(snapshot);
  }

  public getScene(): Scene {
    return this.scene;
  }

  public getEngine(): Engine | WebGPUEngine {
    return this.engine;
  }

  public getCameraManager(): BabylonCameraManager {
    return this.cameraManager;
  }

  public getTouchController(): MobileTouchController {
    return this.touchController;
  }

  public getInterpolator(): SnapshotInterpolator {
    return this.interpolator;
  }
}
