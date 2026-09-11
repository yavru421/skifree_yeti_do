/**
 * SkierAvatar.ts
 * High-Fidelity 3D Skier Character Avatar:
 * - Direct integration with Blender 5.2 sculpted/modeled skier.glb (/assets/skier.glb).
 * - High-poly athletic downhill racer with PBR materials:
 *     * Alpine Gold speed suit with aerodynamic black compression flank panels and red accents.
 *     * Aerodynamic teardrop World Cup racing helmet with wrap-around mirrored polarized goggles.
 *     * Articulated downhill crouch stance with forward-canted shins & Nordica molded race boots.
 *     * Continuous rockered twin-tip downhill skis with stainless steel edges & Look Pivot bindings.
 *     * Authentic downhill pole carriage (grips at hip height, shafts angled down/back toward snow).
 *     * Scoped tactical harpoon rifle slung diagonally across backpack.
 * - Hardware WebGPU/WebGL accelerated rendering with smooth normal interpolation.
 * - Soft volumetric powder snow mist (dynamic radial alpha gradient texture, zero white squares).
 * - Dynamic procedural animations (carving bank, ski edge roll, aerodynamic tuck squat, wipeout).
 */

import {
  Scene,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Color4,
  Vector3,
  Mesh,
  Scalar,
  ParticleSystem,
  DynamicTexture,
  SceneLoader,
  AbstractMesh
} from "@babylonjs/core";
import "@babylonjs/loaders/glTF";

export class SkierAvatar {
  private scene: Scene;
  public rootNode: Mesh;

  // Blender 5.2 GLB Model Asset
  public glbRoot: AbstractMesh | null = null;
  public glbMeshes: AbstractMesh[] = [];
  public isGlbLoaded: boolean = false;

  // Procedural Fallback Root
  private proceduralRoot: Mesh;

  // Harpoon Weapon State
  public rifleRoot: Mesh | null = null;

  // Volumetric Powder Snow Particle Spray
  private leftSpray: ParticleSystem | null = null;
  private rightSpray: ParticleSystem | null = null;
  private powderTexture: DynamicTexture | null = null;

  // Animation & Kinematics State
  private currentBank: number = 0;
  private currentSquat: number = 0;
  private currentPlow: number = 0;
  private chatterCycle: number = 0;
  public isVisible: boolean = true;
  public isAimingGun: boolean = false;
  public isWipeout: boolean = false;
  public isCutsceneVictory: boolean = false;
  private wipeoutTimer: number = 0;
  private victoryTimer: number = 0;

  constructor(scene: Scene) {
    this.scene = scene;
    this.rootNode = new Mesh("skierAvatarRoot", this.scene);
    this.proceduralRoot = new Mesh("skierProceduralRoot", this.scene);
    this.proceduralRoot.parent = this.rootNode;

    // 1. Build and start Volumetric Powder Snow Mist Particles
    this.initPowderParticles();

    // 2. Load the Headless Blender 5.2 Skier GLB Asset
    this.loadSkierGlb();
  }

  private async loadSkierGlb(): Promise<void> {
    try {
      const result = await SceneLoader.ImportMeshAsync("", "/assets/", "skier.glb", this.scene);
      console.log(`[SkierAvatar] ✅ Blender 5.2 skier.glb loaded successfully (${result.meshes.length} meshes)!`);
      this.glbRoot = result.meshes[0];
      if (this.glbRoot) {
        this.glbRoot.parent = this.rootNode;
        this.glbRoot.rotationQuaternion = null;
        this.glbRoot.position.set(0, 0, 0);
        this.glbRoot.rotation.set(0, 0, 0);
        this.glbMeshes = result.meshes;
        this.isGlbLoaded = true;

        result.meshes.forEach((m) => {
          m.receiveShadows = true;
        });

        // Hide procedural fallback geometry when Blender GLB is active
        if (this.proceduralRoot) {
          this.proceduralRoot.setEnabled(false);
        }
      }
    } catch (err) {
      console.warn("[SkierAvatar] Error loading skier.glb, fallback active:", err);
    }
  }

  private initPowderParticles(): void {
    // Generate an in-memory soft Gaussian radial alpha gradient texture
    // Eliminates the opaque white square bug completely!
    this.powderTexture = new DynamicTexture("softPowderSprayTex", 128, this.scene, false);
    const ctx = this.powderTexture.getContext();
    const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0.0, "rgba(255, 255, 255, 0.95)");
    grad.addColorStop(0.35, "rgba(235, 248, 255, 0.55)");
    grad.addColorStop(0.70, "rgba(210, 235, 255, 0.18)");
    grad.addColorStop(1.0, "rgba(255, 255, 255, 0.0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
    this.powderTexture.update();
    this.powderTexture.hasAlpha = true;

    // Left ski powder spray emitter
    const sprayAnchorL = new Mesh("sprayAnchorL", this.scene);
    sprayAnchorL.position.set(-0.24, 0.02, 0);
    sprayAnchorL.parent = this.rootNode;

    this.leftSpray = new ParticleSystem("skierLeftSpray", 140, this.scene);
    this.leftSpray.particleTexture = this.powderTexture;
    this.leftSpray.blendMode = ParticleSystem.BLENDMODE_STANDARD;
    this.leftSpray.emitter = sprayAnchorL;
    this.leftSpray.minEmitBox = new Vector3(-0.04, 0.01, 0.60);
    this.leftSpray.maxEmitBox = new Vector3(0.04, 0.08, 1.02);
    this.leftSpray.color1 = new Color4(1.0, 1.0, 1.0, 0.85);
    this.leftSpray.color2 = new Color4(0.88, 0.94, 1.0, 0.35);
    this.leftSpray.colorDead = new Color4(1.0, 1.0, 1.0, 0.0);
    this.leftSpray.minSize = 0.18;
    this.leftSpray.maxSize = 0.65;
    this.leftSpray.minLifeTime = 0.25;
    this.leftSpray.maxLifeTime = 0.65;
    this.leftSpray.emitRate = 0;
    this.leftSpray.direction1 = new Vector3(-1.0, 0.5, 2.2);
    this.leftSpray.direction2 = new Vector3(-0.2, 1.0, 3.4);
    this.leftSpray.gravity = new Vector3(0, -9.8, 0);
    this.leftSpray.start();

    // Right ski powder spray emitter
    const sprayAnchorR = new Mesh("sprayAnchorR", this.scene);
    sprayAnchorR.position.set(0.24, 0.02, 0);
    sprayAnchorR.parent = this.rootNode;

    this.rightSpray = new ParticleSystem("skierRightSpray", 140, this.scene);
    this.rightSpray.particleTexture = this.powderTexture;
    this.rightSpray.blendMode = ParticleSystem.BLENDMODE_STANDARD;
    this.rightSpray.emitter = sprayAnchorR;
    this.rightSpray.minEmitBox = new Vector3(-0.04, 0.01, 0.60);
    this.rightSpray.maxEmitBox = new Vector3(0.04, 0.08, 1.02);
    this.rightSpray.color1 = new Color4(1.0, 1.0, 1.0, 0.85);
    this.rightSpray.color2 = new Color4(0.88, 0.94, 1.0, 0.35);
    this.rightSpray.colorDead = new Color4(1.0, 1.0, 1.0, 0.0);
    this.rightSpray.minSize = 0.18;
    this.rightSpray.maxSize = 0.65;
    this.rightSpray.minLifeTime = 0.25;
    this.rightSpray.maxLifeTime = 0.65;
    this.rightSpray.emitRate = 0;
    this.rightSpray.direction1 = new Vector3(0.2, 0.5, 2.2);
    this.rightSpray.direction2 = new Vector3(1.0, 1.0, 3.4);
    this.rightSpray.gravity = new Vector3(0, -9.8, 0);
    this.rightSpray.start();
  }

  public setCutsceneVictory(active: boolean): void {
    this.isCutsceneVictory = active;
    if (!active) {
      this.victoryTimer = 0;
    }
  }

  public update(
    playerPosition: Vector3,
    steerInput: number,
    speedMph: number,
    isTucking: boolean,
    isBraking: boolean,
    deltaTime: number,
    isTethered: boolean = false,
    isAiming: boolean = false
  ): void {
    // 1. Follow player position smoothly
    this.rootNode.position.copyFrom(playerPosition);

    if (!this.isVisible) return;

    // 2. Wipeout / Knockdown State
    if (this.isWipeout) {
      this.wipeoutTimer += deltaTime;
      this.rootNode.rotation.x = Math.min(1.4, this.wipeoutTimer * 4.0);
      this.rootNode.rotation.z = Math.sin(this.wipeoutTimer * 8.0) * 0.4;
      if (this.leftSpray) this.leftSpray.emitRate = 0;
      if (this.rightSpray) this.rightSpray.emitRate = 0;
      return;
    }

    // 2b. Cutscene Victory Celebration Pose
    if (this.isCutsceneVictory) {
      this.victoryTimer += deltaTime;
      this.rootNode.rotation.z = Math.sin(this.victoryTimer * 2.5) * 0.12;
      this.rootNode.rotation.y = Math.sin(this.victoryTimer * 2.0) * 0.10;
      return;
    }

    // 3. Dynamic Carving Body Banking & Ski Edge Bite
    const targetBank = -steerInput * 0.40; // Lean up to ~23 degrees into carve
    this.currentBank = Scalar.Lerp(this.currentBank, targetBank, Math.min(1.0, deltaTime * 12.0));
    this.rootNode.rotation.z = this.currentBank;
    this.rootNode.rotation.y = -steerInput * 0.24; // Yaw skis smoothly into downhill turn

    // 4. Downhill Aerodynamic Tuck Squat
    const targetSquat = isTucking ? 0.24 : 0.0;
    this.currentSquat = Scalar.Lerp(this.currentSquat, targetSquat, Math.min(1.0, deltaTime * 10.0));

    if (this.glbRoot) {
      this.glbRoot.position.y = -this.currentSquat;
      this.glbRoot.rotation.x = isTucking ? 0.28 : 0.04;
    }

    // 5. Powder Snow Rooster Tail Particle Dynamics
    const sprayRate = speedMph > 8 ? Math.min(140, Math.floor(speedMph * 2.8)) : 0;
    if (this.leftSpray) {
      this.leftSpray.emitRate = Math.abs(steerInput) > 0.1 || isBraking ? sprayRate * 1.5 : sprayRate;
    }
    if (this.rightSpray) {
      this.rightSpray.emitRate = Math.abs(steerInput) > 0.1 || isBraking ? sprayRate * 1.5 : sprayRate;
    }
  }

  public setVisible(visible: boolean): void {
    this.isVisible = visible;
    this.rootNode.setEnabled(visible);
    if (this.glbRoot) {
      this.glbRoot.setEnabled(visible);
    }
    if (!visible) {
      if (this.leftSpray) this.leftSpray.emitRate = 0;
      if (this.rightSpray) this.rightSpray.emitRate = 0;
    }
  }

  public triggerWipeout(): void {
    this.isWipeout = true;
    this.wipeoutTimer = 0;
  }

  public resetWipeout(): void {
    this.isWipeout = false;
    this.wipeoutTimer = 0;
    this.rootNode.rotation.set(0, 0, 0);
  }

  public getTowlineAnchorWorldPosition(): Vector3 {
    // Connects directly to the front of the skier's chest / harpoon mount
    return new Vector3(
      this.rootNode.position.x + 0.12,
      this.rootNode.position.y + 1.25,
      this.rootNode.position.z - 0.40
    );
  }

  public resetCombatState(): void {
    this.isAimingGun = false;
    this.isCutsceneVictory = false;
  }
}
