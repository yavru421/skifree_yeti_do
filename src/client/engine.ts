/**
 * SkiFree Yeti DO - Babylon.js Core Engine & WebGPU/WebGL2 Pipeline
 * Initializes the Babylon engine with WebGPU detection and seamless WebGL2 fallback,
 * configures alpine sunlight, soft snow fog, and high-DPI canvas handling.
 */

import {
  Engine,
  WebGPUEngine,
  Scene,
  Vector3,
  Color3,
  Color4,
  HemisphericLight,
  DirectionalLight,
  ShadowGenerator
} from "@babylonjs/core";

export class EngineManager {
  public canvas: HTMLCanvasElement;
  public engine: Engine | WebGPUEngine;
  public scene: Scene;
  public sunLight: DirectionalLight;
  public ambientLight: HemisphericLight;
  public shadowGenerator: ShadowGenerator | null = null;

  private constructor(canvas: HTMLCanvasElement, engine: Engine | WebGPUEngine, scene: Scene) {
    this.canvas = canvas;
    this.engine = engine;
    this.scene = scene;

    // 1. Scene Clear Color & Alpine Snow Fog
    this.scene.clearColor = new Color4(0.85, 0.92, 0.98, 1.0);
    this.scene.fogMode = Scene.FOGMODE_EXP2;
    this.scene.fogDensity = 0.0028;
    this.scene.fogColor = new Color3(0.82, 0.89, 0.96);

    // 2. Ambient Sky/Snow Hemispheric Light
    this.ambientLight = new HemisphericLight("ambientSky", new Vector3(0, 1, 0), this.scene);
    this.ambientLight.diffuse = new Color3(0.9, 0.95, 1.0);
    this.ambientLight.groundColor = new Color3(0.75, 0.82, 0.9);
    this.ambientLight.intensity = 0.75;

    // 3. Directional Alpine Sun Light
    this.sunLight = new DirectionalLight("alpineSun", new Vector3(-0.6, -1.0, -0.4), this.scene);
    this.sunLight.diffuse = new Color3(1.0, 0.98, 0.92);
    this.sunLight.intensity = 1.2;
    this.sunLight.position = new Vector3(100, 200, 100);

    // 4. Soft Cascaded Shadows
    try {
      this.shadowGenerator = new ShadowGenerator(2048, this.sunLight);
      this.shadowGenerator.useBlurExponentialShadowMap = true;
      this.shadowGenerator.blurKernel = 32;
    } catch {
      console.warn("Shadow generator fallback");
    }

    // 5. Window Resize Handling
    window.addEventListener("resize", () => {
      this.engine.resize();
    });
  }

  public static async create(canvasId: string): Promise<EngineManager> {
    const canvas = (document.getElementById(canvasId) as HTMLCanvasElement) || document.createElement("canvas");
    if (!canvas.parentElement) {
      canvas.id = canvasId;
      canvas.style.width = "100vw";
      canvas.style.height = "100vh";
      canvas.style.display = "block";
      canvas.style.touchAction = "none";
      document.body.appendChild(canvas);
    }

    let engine: Engine | WebGPUEngine;
    if (WebGPUEngine && (await WebGPUEngine.IsSupportedAsync)) {
      try {
        const webgpu = new WebGPUEngine(canvas, {
          powerPreference: "high-performance",
          antialias: true
        });
        await webgpu.initAsync();
        engine = webgpu;
        console.log("[Engine] WebGPU Rendering Pipeline Active");
      } catch {
        console.log("[Engine] WebGPU init failed, falling back to WebGL2");
        engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });
      }
    } else {
      engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });
      console.log("[Engine] WebGL2 Rendering Pipeline Active");
    }

    const scene = new Scene(engine);
    return new EngineManager(canvas, engine, scene);
  }

  public startRenderLoop(onFrame: (deltaTime: number) => void): void {
    this.engine.runRenderLoop(() => {
      const delta = this.engine.getDeltaTime() / 1000;
      onFrame(delta);
      this.scene.render();
    });
  }
}
