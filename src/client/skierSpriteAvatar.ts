/**
 * SkierSpriteAvatar.ts
 * Retro Chronogrid Pixel-Art Skier Avatar for SkiFree Yeti DO.
 * Exactly matches the intro teaser video using /assets/skier.jpg:
 * - Chroma-keyed background transparency (white snow cutout via dynamic canvas).
 * - 8 Columns x 7 Rows of authentic 16-color SkiFree pixel animations:
 *     Row 0: Downhill Cruising (pole push cycle)
 *     Row 1: Carve Right (banking with edge spray)
 *     Row 2: Carve Left (banking with edge spray)
 *     Row 3: Speed Tuck Crouch (aerodynamic bullet)
 *     Row 4: Snowplow Wedge Braking & Jumps
 *     Row 5: Wipeout Dynamic Tumbling Roll
 *     Row 6: Wipeout Final Head-in-Snow Poses
 * - Billboard camera alignment with Diablo-style overhead perspective.
 * - Dual tail powder snow spray particle emitters.
 */

import {
  Scene,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Color4,
  Vector3,
  Mesh,
  DynamicTexture,
  ParticleSystem,
  Texture
} from "@babylonjs/core";

export class SkierSpriteAvatar {
  private scene: Scene;
  public rootNode: Mesh;
  private spritePlane: Mesh;
  private material: StandardMaterial;
  private dynamicTexture: DynamicTexture | null = null;

  // Particle Spray
  private leftSpray: ParticleSystem | null = null;
  private rightSpray: ParticleSystem | null = null;

  // Animation State
  private cols: number = 8;
  private rows: number = 7;
  private currentRow: number = 0;
  private currentFrame: number = 0;
  private frameTimer: number = 0;
  private frameRate: number = 10; // fps
  public isVisible: boolean = true;
  public isWipeout: boolean = false;
  private wipeoutTimer: number = 0;

  constructor(scene: Scene) {
    this.scene = scene;
    this.rootNode = new Mesh("skierSpriteRoot", this.scene);

    // Quad billboard plane sized appropriately for 3rd-person isometric view (width 2.4m, height 2.4m)
    this.spritePlane = MeshBuilder.CreatePlane(
      "skierSpritePlane",
      { width: 2.4, height: 2.4 },
      this.scene
    );
    this.spritePlane.parent = this.rootNode;
    this.spritePlane.position.set(0, 1.2, 0); // Center plane above snow
    this.spritePlane.billboardMode = Mesh.BILLBOARDMODE_Y;

    this.material = new StandardMaterial("skierSpriteMat", this.scene);
    this.material.specularColor = new Color3(0, 0, 0);
    this.material.emissiveColor = new Color3(0.9, 0.9, 0.9);
    this.material.backFaceCulling = false;
    this.spritePlane.material = this.material;

    this.initChromaKeyTexture();
    this.initPowderParticles();
  }

  private initChromaKeyTexture(): void {
    if (typeof window === "undefined" || typeof document === "undefined") {
      // Node / headless fallback
      const tex = new Texture("/assets/skier.jpg", this.scene, false, false, Texture.NEAREST_SAMPLINGMODE);
      tex.uScale = 1 / this.cols;
      tex.vScale = 1 / this.rows;
      this.material.diffuseTexture = tex;
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = "/assets/skier.jpg";
    img.onload = () => {
      const w = img.naturalWidth || 1024;
      const h = img.naturalHeight || 1024;

      // Offscreen canvas to punch out white/near-white background
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;

      ctx.drawImage(img, 0, 0);
      const imgData = ctx.getImageData(0, 0, w, h);
      const data = imgData.data;

      // Chroma-key: white/near-white pixel becomes 100% transparent
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        if (r > 235 && g > 235 && b > 235) {
          data[i + 3] = 0;
        }
      }
      ctx.putImageData(imgData, 0, 0);

      // Create DynamicTexture from the alpha-keyed canvas
      this.dynamicTexture = new DynamicTexture(
        "skierChromaTexture",
        canvas,
        this.scene,
        false,
        Texture.NEAREST_SAMPLINGMODE
      );
      this.dynamicTexture.hasAlpha = true;
      this.dynamicTexture.uScale = 1 / this.cols;
      this.dynamicTexture.vScale = 1 / this.rows;
      this.material.diffuseTexture = this.dynamicTexture;
      this.material.useAlphaFromDiffuseTexture = true;
      this.material.opacityTexture = this.dynamicTexture;

      this.setAnimationFrame(this.currentRow, this.currentFrame);
    };
  }

  private initPowderParticles(): void {
    const pTex = new Texture("/assets/snow_texture.jpg", this.scene);

    // Left ski powder plume
    this.leftSpray = new ParticleSystem("skierLeftSpray", 120, this.scene);
    this.leftSpray.particleTexture = pTex;
    this.leftSpray.emitter = this.rootNode;
    this.leftSpray.isLocal = true;
    this.leftSpray.color1 = new Color4(0.95, 0.98, 1.0, 0.8);
    this.leftSpray.color2 = new Color4(0.85, 0.92, 1.0, 0.3);
    this.leftSpray.colorDead = new Color4(1.0, 1.0, 1.0, 0.0);
    this.leftSpray.minSize = 0.2;
    this.leftSpray.maxSize = 0.55;
    this.leftSpray.minLifeTime = 0.2;
    this.leftSpray.maxLifeTime = 0.55;
    this.leftSpray.emitRate = 0;
    this.leftSpray.direction1 = new Vector3(-0.8, 0.4, 1.2);
    this.leftSpray.direction2 = new Vector3(-0.2, 0.9, 2.2);
    this.leftSpray.gravity = new Vector3(0, -9.8, 0);
    this.leftSpray.start();

    // Right ski powder plume
    this.rightSpray = new ParticleSystem("skierRightSpray", 120, this.scene);
    this.rightSpray.particleTexture = pTex;
    this.rightSpray.emitter = this.rootNode;
    this.rightSpray.isLocal = true;
    this.rightSpray.color1 = new Color4(0.95, 0.98, 1.0, 0.8);
    this.rightSpray.color2 = new Color4(0.85, 0.92, 1.0, 0.3);
    this.rightSpray.colorDead = new Color4(1.0, 1.0, 1.0, 0.0);
    this.rightSpray.minSize = 0.2;
    this.rightSpray.maxSize = 0.55;
    this.rightSpray.minLifeTime = 0.2;
    this.rightSpray.maxLifeTime = 0.55;
    this.rightSpray.emitRate = 0;
    this.rightSpray.direction1 = new Vector3(0.2, 0.4, 1.2);
    this.rightSpray.direction2 = new Vector3(0.8, 0.9, 2.2);
    this.rightSpray.gravity = new Vector3(0, -9.8, 0);
    this.rightSpray.start();
  }

  private setAnimationFrame(row: number, frame: number): void {
    this.currentRow = Math.max(0, Math.min(this.rows - 1, row));
    this.currentFrame = Math.max(0, Math.min(this.cols - 1, frame));

    const tex = this.material.diffuseTexture as Texture | null;
    if (!tex) return;

    // UV offsets: u = col * (1 / cols), v = row * (1 / rows)
    tex.uOffset = this.currentFrame / this.cols;
    tex.vOffset = 1.0 - (this.currentRow + 1) / this.rows;

    const opTex = this.material.opacityTexture as Texture | null;
    if (opTex && opTex !== tex) {
      opTex.uOffset = tex.uOffset;
      opTex.vOffset = tex.vOffset;
    }
  }

  public update(
    playerPosition: Vector3,
    steerInput: number,
    speedMph: number,
    isTucking: boolean,
    isBraking: boolean,
    deltaTime: number
  ): void {
    // 1. Follow player position directly on the snow surface
    this.rootNode.position.copyFrom(playerPosition);

    if (!this.isVisible) return;

    // 2. Wipeout / Knockdown state
    if (this.isWipeout) {
      this.wipeoutTimer += deltaTime;
      const wipeFrame = Math.min(7, Math.floor(this.wipeoutTimer * 8));
      this.setAnimationFrame(5, wipeFrame);
      if (this.leftSpray) this.leftSpray.emitRate = 0;
      if (this.rightSpray) this.rightSpray.emitRate = 0;
      return;
    }

    // 3. Determine Chronogrid Sprite Animation Row
    let targetRow = 0; // Downhill default
    let animSpeed = 8; // fps

    if (isBraking) {
      targetRow = 4; // Snowplow brake row
      animSpeed = 12;
    } else if (isTucking) {
      targetRow = 3; // Speed tuck crouch row
      animSpeed = 14;
    } else if (steerInput > 0.15) {
      targetRow = 1; // Carve Right row
      animSpeed = Math.max(6, Math.min(18, speedMph * 0.3));
    } else if (steerInput < -0.15) {
      targetRow = 2; // Carve Left row
      animSpeed = Math.max(6, Math.min(18, speedMph * 0.3));
    } else {
      targetRow = 0; // Downhill straight pole push
      animSpeed = Math.max(4, Math.min(14, speedMph * 0.22));
    }

    // 4. Advance Frame Timer
    this.frameRate = animSpeed;
    this.frameTimer += deltaTime;
    const frameDuration = 1.0 / this.frameRate;

    if (this.frameTimer >= frameDuration) {
      this.frameTimer -= frameDuration;
      this.currentFrame = (this.currentFrame + 1) % this.cols;
      this.setAnimationFrame(targetRow, this.currentFrame);
    } else if (this.currentRow !== targetRow) {
      this.setAnimationFrame(targetRow, this.currentFrame);
    }

    // 5. Powder Snow Spray Particle Dynamics
    const sprayRate = speedMph > 8 ? Math.min(120, Math.floor(speedMph * 2.4)) : 0;
    if (this.leftSpray) {
      this.leftSpray.emitRate = steerInput > 0.1 || isBraking ? sprayRate * 1.5 : sprayRate;
    }
    if (this.rightSpray) {
      this.rightSpray.emitRate = steerInput < -0.1 || isBraking ? sprayRate * 1.5 : sprayRate;
    }
  }

  public setVisible(visible: boolean): void {
    this.isVisible = visible;
    this.rootNode.setEnabled(visible);
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
    this.setAnimationFrame(0, 0);
  }

  public getTowlineAnchorWorldPosition(): Vector3 {
    return new Vector3(
      this.rootNode.position.x,
      this.rootNode.position.y + 0.9,
      this.rootNode.position.z - 0.1
    );
  }
}
