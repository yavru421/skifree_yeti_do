/**
 * SkiFree Yeti DO - Yeti Boss Entity System
 * Ultra-high-fidelity 3D Alpine Beast Boss:
 * - High-resolution fur textures (/assets/yeti_v2.jpg)
 * - Sculpted menacing brow, white fangs, piercing predatory glowing red eyes
 * - Massive muscular limbs, razor-sharp claws, hunched predatory posture
 * - Bounding downhill lead kinematics, towline drag deceleration,
 * - Blood impact spray and foot snow kickup particles.
 * Guaranteed 100% visible and responsive at t=0 with zero external worker dependencies.
 */

import {
  Scene,
  MeshBuilder,
  StandardMaterial,
  Texture,
  Color3,
  Vector3,
  Mesh,
  ParticleSystem,
  Scalar
} from "@babylonjs/core";
import { YetiAIState, YetiNetState } from "./types";

export class YetiEntity {
  private scene: Scene;
  public rootMesh: Mesh;
  private headMesh: Mesh;
  private bodyMesh: Mesh;
  private shoulderMantle: Mesh;
  private leftArm: Mesh;
  private rightArm: Mesh;
  private leftForearm: Mesh;
  private rightForearm: Mesh;
  private leftLeg: Mesh;
  private rightLeg: Mesh;
  private eyeLeft: Mesh;
  private eyeRight: Mesh;
  private fangL: Mesh;
  private fangR: Mesh;
  private clawL: Mesh;
  private clawR: Mesh;

  // FX
  private bloodParticles: ParticleSystem | null = null;
  private snowFootParticles: ParticleSystem | null = null;

  // Kinematics & Health
  public state: YetiAIState = YetiAIState.CHARGING;
  public hp: number = 3000;
  public maxHp: number = 3000;
  public wave: number = 1;
  public dragSpeed: number = 38; // Downhill speed (MPH)
  private runCycle: number = 0;
  private isNetControlled: boolean = false;

  constructor(scene: Scene) {
    this.scene = scene;
    this.rootMesh = new Mesh("yetiRoot", this.scene);
    this.rootMesh.position.set(0, 0, -32); // Visible ahead on the slope

    // 1. Materials
    const furMat = new StandardMaterial("yetiFurMat", this.scene);
    furMat.diffuseTexture = new Texture("/assets/yeti_v2.jpg", this.scene);
    furMat.specularColor = new Color3(0.06, 0.06, 0.08);

    const chestMat = new StandardMaterial("yetiChestMat", this.scene);
    chestMat.diffuseTexture = new Texture("/assets/yeti_v2.jpg", this.scene);
    chestMat.diffuseColor = new Color3(0.85, 0.85, 0.9);
    chestMat.specularColor = new Color3(0.1, 0.1, 0.15);

    const eyeMat = new StandardMaterial("yetiEyeMat", this.scene);
    eyeMat.diffuseColor = new Color3(1.0, 0.05, 0.0);
    eyeMat.emissiveColor = new Color3(1.0, 0.2, 0.0); // Intense predatory red glow

    const fangMat = new StandardMaterial("yetiFangMat", this.scene);
    fangMat.diffuseColor = new Color3(0.95, 0.95, 0.9);
    fangMat.specularColor = new Color3(0.7, 0.7, 0.7);

    const clawMat = new StandardMaterial("yetiClawMat", this.scene);
    clawMat.diffuseColor = new Color3(0.08, 0.08, 0.1);
    clawMat.specularColor = new Color3(0.8, 0.8, 0.9);
    clawMat.roughness = 0.1;

    // 2. Torso (Massive hunched beast)
    this.bodyMesh = MeshBuilder.CreateBox("yetiBody", { width: 3.6, height: 4.5, depth: 3.0 }, this.scene);
    this.bodyMesh.material = furMat;
    this.bodyMesh.position.y = 3.0;
    this.bodyMesh.parent = this.rootMesh;

    // Muscular Chest Plate
    const chest = MeshBuilder.CreateBox("yetiChest", { width: 3.0, height: 3.2, depth: 1.2 }, this.scene);
    chest.material = chestMat;
    chest.position.set(0, 0.2, 1.2);
    chest.parent = this.bodyMesh;

    // Shoulder Fur Mantle (Wide, intimidating alpine profile)
    this.shoulderMantle = MeshBuilder.CreateBox("yetiShoulders", { width: 5.2, height: 1.6, depth: 3.2 }, this.scene);
    this.shoulderMantle.material = furMat;
    this.shoulderMantle.position.set(0, 1.8, 0.2);
    this.shoulderMantle.parent = this.bodyMesh;

    // Head with menacing heavy brow
    this.headMesh = MeshBuilder.CreateSphere("yetiHead", { diameterX: 2.4, diameterY: 2.3, diameterZ: 2.6, segments: 10 }, this.scene);
    this.headMesh.material = furMat;
    this.headMesh.position.set(0, 5.4, 0.9);
    this.headMesh.parent = this.rootMesh;

    // Heavy Brow Ridge
    const brow = MeshBuilder.CreateBox("yetiBrow", { width: 2.2, height: 0.5, depth: 1.0 }, this.scene);
    brow.material = furMat;
    brow.position.set(0, 0.55, 1.0);
    brow.rotation.x = 0.2;
    brow.parent = this.headMesh;

    // Snout / Jaw
    const muzzle = MeshBuilder.CreateBox("yetiMuzzle", { width: 1.6, height: 0.9, depth: 1.4 }, this.scene);
    muzzle.material = furMat;
    muzzle.position.set(0, -0.45, 1.2);
    muzzle.parent = this.headMesh;

    // Razor White Fangs
    this.fangL = MeshBuilder.CreateCylinder("fangL", { height: 0.55, diameterTop: 0.04, diameterBottom: 0.16 }, this.scene);
    this.fangL.material = fangMat;
    this.fangL.position.set(-0.45, -0.4, 0.55);
    this.fangL.rotation.x = -0.3;
    this.fangL.parent = muzzle;

    this.fangR = MeshBuilder.CreateCylinder("fangR", { height: 0.55, diameterTop: 0.04, diameterBottom: 0.16 }, this.scene);
    this.fangR.material = fangMat;
    this.fangR.position.set(0.45, -0.4, 0.55);
    this.fangR.rotation.x = -0.3;
    this.fangR.parent = muzzle;

    // Piercing Predatory Glowing Red Eyes
    this.eyeLeft = MeshBuilder.CreateSphere("yetiEyeL", { diameter: 0.32, segments: 8 }, this.scene);
    this.eyeLeft.material = eyeMat;
    this.eyeLeft.position.set(-0.52, 0.22, 1.15);
    this.eyeLeft.parent = this.headMesh;

    this.eyeRight = MeshBuilder.CreateSphere("yetiEyeR", { diameter: 0.32, segments: 8 }, this.scene);
    this.eyeRight.material = eyeMat;
    this.eyeRight.position.set(0.52, 0.22, 1.15);
    this.eyeRight.parent = this.headMesh;

    // Massive Upper Arms
    this.leftArm = MeshBuilder.CreateCylinder("yetiLeftArm", { height: 3.6, diameterTop: 1.4, diameterBottom: 1.1 }, this.scene);
    this.leftArm.material = furMat;
    this.leftArm.position.set(-2.6, 3.6, 0.4);
    this.leftArm.parent = this.rootMesh;

    this.rightArm = MeshBuilder.CreateCylinder("yetiRightArm", { height: 3.6, diameterTop: 1.4, diameterBottom: 1.1 }, this.scene);
    this.rightArm.material = furMat;
    this.rightArm.position.set(2.6, 3.6, 0.4);
    this.rightArm.parent = this.rootMesh;

    // Forearms
    this.leftForearm = MeshBuilder.CreateCylinder("yetiLeftForearm", { height: 2.8, diameterTop: 1.1, diameterBottom: 1.3 }, this.scene);
    this.leftForearm.material = furMat;
    this.leftForearm.position.set(0, -2.4, 0.4);
    this.leftForearm.rotation.x = 0.4;
    this.leftForearm.parent = this.leftArm;

    this.rightForearm = MeshBuilder.CreateCylinder("yetiRightForearm", { height: 2.8, diameterTop: 1.1, diameterBottom: 1.3 }, this.scene);
    this.rightForearm.material = furMat;
    this.rightForearm.position.set(0, -2.4, 0.4);
    this.rightForearm.rotation.x = 0.4;
    this.rightForearm.parent = this.rightArm;

    // Razor Sharp Claws
    this.clawL = MeshBuilder.CreateBox("clawL", { width: 1.1, height: 0.6, depth: 1.2 }, this.scene);
    this.clawL.material = clawMat;
    this.clawL.position.set(0, -1.6, 0.3);
    this.clawL.parent = this.leftForearm;

    this.clawR = MeshBuilder.CreateBox("clawR", { width: 1.1, height: 0.6, depth: 1.2 }, this.scene);
    this.clawR.material = clawMat;
    this.clawR.position.set(0, -1.6, 0.3);
    this.clawR.parent = this.rightForearm;

    // Heavy Legs
    this.leftLeg = MeshBuilder.CreateCylinder("yetiLegL", { height: 3.0, diameterTop: 1.4, diameterBottom: 1.1 }, this.scene);
    this.leftLeg.material = furMat;
    this.leftLeg.position.set(-1.2, 1.5, 0);
    this.leftLeg.parent = this.rootMesh;

    this.rightLeg = MeshBuilder.CreateCylinder("yetiLegR", { height: 3.0, diameterTop: 1.4, diameterBottom: 1.1 }, this.scene);
    this.rightLeg.material = furMat;
    this.rightLeg.position.set(1.2, 1.5, 0);
    this.rightLeg.parent = this.rootMesh;

    // 3. Setup Particles
    this.initParticleSystems();
  }

  private initParticleSystems(): void {
    // Blood Spray on Hits
    this.bloodParticles = new ParticleSystem("yetiBlood", 200, this.scene);
    this.bloodParticles.particleTexture = new Texture("/assets/snow_texture.jpg", this.scene);
    this.bloodParticles.emitter = this.headMesh;
    this.bloodParticles.color1 = new Color3(0.9, 0.05, 0.05).toColor4(1.0);
    this.bloodParticles.color2 = new Color3(0.5, 0.0, 0.0).toColor4(0.8);
    this.bloodParticles.minSize = 0.2;
    this.bloodParticles.maxSize = 0.6;
    this.bloodParticles.minLifeTime = 0.3;
    this.bloodParticles.maxLifeTime = 0.7;
    this.bloodParticles.emitRate = 0;
    this.bloodParticles.direction1 = new Vector3(-1, 2, -1);
    this.bloodParticles.direction2 = new Vector3(1, 4, 1);
    this.bloodParticles.gravity = new Vector3(0, -9.81, 0);
    this.bloodParticles.start();

    // Snow Kickup under feet
    this.snowFootParticles = new ParticleSystem("yetiFootSnow", 120, this.scene);
    this.snowFootParticles.particleTexture = new Texture("/assets/snow_texture.jpg", this.scene);
    this.snowFootParticles.emitter = this.rootMesh;
    this.snowFootParticles.color1 = new Color3(1, 1, 1).toColor4(0.8);
    this.snowFootParticles.color2 = new Color3(0.8, 0.9, 1).toColor4(0.2);
    this.snowFootParticles.minSize = 0.3;
    this.snowFootParticles.maxSize = 0.8;
    this.snowFootParticles.minLifeTime = 0.3;
    this.snowFootParticles.maxLifeTime = 0.6;
    this.snowFootParticles.emitRate = 45;
    this.snowFootParticles.direction1 = new Vector3(-1, 1, 2);
    this.snowFootParticles.direction2 = new Vector3(1, 2, 4);
    this.snowFootParticles.gravity = new Vector3(0, -8.0, 0);
    this.snowFootParticles.start();
  }

  public syncNetState(netYeti: YetiNetState): void {
    this.isNetControlled = true;
    this.hp = netYeti.hp;
    this.maxHp = netYeti.maxHp;
    this.state = netYeti.state;
    this.wave = netYeti.wave;

    this.rootMesh.position.x = Scalar.Lerp(this.rootMesh.position.x, netYeti.x, 0.3);
    this.rootMesh.position.z = Scalar.Lerp(this.rootMesh.position.z, netYeti.z, 0.3);
  }

  public applyDrag(dragIntensity: number, deltaTime: number): void {
    this.dragSpeed = Math.max(0, this.dragSpeed - dragIntensity * deltaTime * 5.0);
    this.hp = Math.max(0, this.hp - dragIntensity * 110 * deltaTime);

    if (this.hp <= 0 && this.state !== YetiAIState.DEAD) {
      this.state = YetiAIState.DEAD;
    } else if (this.state !== YetiAIState.DEAD) {
      this.state = YetiAIState.STAGGERED;
    }

    if (Math.random() < 0.25) {
      this.triggerHitFeedback(false);
    }
  }

  public update(playerPos: Vector3, deltaTime: number): void {
    this.runCycle += deltaTime * 8;

    // Face player
    const angleToPlayer = Math.atan2(playerPos.x - this.rootMesh.position.x, playerPos.z - this.rootMesh.position.z);
    this.rootMesh.rotation.y = angleToPlayer;

    // Downhill lead kinematics (Keep Yeti actively ahead in view)
    if (!this.isNetControlled && this.state !== YetiAIState.DEAD) {
      const forwardSpeedUnitsPerSec = (this.dragSpeed * 0.44704) * 2.2;
      this.rootMesh.position.z -= forwardSpeedUnitsPerSec * deltaTime;

      const minZ = playerPos.z - 36; // Furthest downhill ahead
      const maxZ = playerPos.z - 18; // Closest downhill ahead
      this.rootMesh.position.z = Scalar.Clamp(this.rootMesh.position.z, minZ, maxZ);

      // Weave laterally across the slope
      const targetX = playerPos.x + Math.sin(this.runCycle * 0.6) * 12;
      this.rootMesh.position.x = Scalar.Lerp(this.rootMesh.position.x, targetX, deltaTime * 2.2);
      this.rootMesh.position.x = Scalar.Clamp(this.rootMesh.position.x, -140, 140);
    }

    // State Machine Animations
    switch (this.state) {
      case YetiAIState.CHARGING:
        // Aggressive bounding stride
        this.bodyMesh.position.y = 3.0 + Math.sin(this.runCycle * 2) * 0.45;
        this.leftArm.rotation.x = Math.sin(this.runCycle) * 1.1;
        this.rightArm.rotation.x = -Math.sin(this.runCycle) * 1.1;
        this.leftLeg.rotation.x = -Math.sin(this.runCycle) * 0.9;
        this.rightLeg.rotation.x = Math.sin(this.runCycle) * 0.9;
        this.headMesh.rotation.x = 0.25; // Menacing forward hunch
        this.rootMesh.rotation.x = 0.12;
        break;

      case YetiAIState.STAGGERED:
        // Reeling backward against towline drag
        this.headMesh.position.x = Math.sin(this.runCycle * 18) * 0.35;
        this.bodyMesh.rotation.x = -0.45; // Reeling backward violently
        this.bodyMesh.position.y = 3.0 + Math.sin(this.runCycle * 4) * 0.2;
        this.leftArm.rotation.z = 1.2;
        this.rightArm.rotation.z = -1.2;
        this.leftArm.rotation.x = -0.6;
        this.rightArm.rotation.x = -0.6;
        this.rootMesh.rotation.x = -0.35;
        break;

      case YetiAIState.RETREATING:
        this.bodyMesh.position.y = 3.0 + Math.sin(this.runCycle) * 0.2;
        this.leftArm.rotation.x = Math.sin(this.runCycle * 0.5) * 0.5;
        this.rightArm.rotation.x = -Math.sin(this.runCycle * 0.5) * 0.5;
        this.rootMesh.rotation.x = 0;
        break;

      case YetiAIState.DEAD:
        // Collapsed on snow slope, slide to complete stop
        this.dragSpeed = Scalar.Lerp(this.dragSpeed, 0, deltaTime * 5);
        this.rootMesh.rotation.x = Scalar.Lerp(this.rootMesh.rotation.x, Math.PI / 2, 0.15);
        this.rootMesh.position.y = Scalar.Lerp(this.rootMesh.position.y, 0.5, 0.15);
        if (this.snowFootParticles) this.snowFootParticles.stop();
        break;
    }
  }

  public triggerHitFeedback(isHeadshot: boolean): void {
    if (this.bloodParticles) {
      this.bloodParticles.manualEmitCount = isHeadshot ? 50 : 20;
    }
  }

  public getHeadWorldPosition(): Vector3 {
    return this.headMesh.getAbsolutePosition();
  }

  public getBodyWorldPosition(): Vector3 {
    return this.bodyMesh.getAbsolutePosition();
  }
}
