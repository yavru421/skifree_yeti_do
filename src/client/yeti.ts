/**
 * SkiFree Yeti DO - Yeti Boss Entity System
 * Loads high-fidelity 3D Alpine Beast Boss from /assets/yeti.glb:
 * - 100% genuine sculpted 3D monster anatomy, fangs, claws, and animated skeletal rig.
 * - Piercing predatory glowing red eyes, eye-beam point lights, and freezing breath mist.
 * - Dynamic 4-beat procedural gallop locomotion: bounding stride, pitch lunges, shoulder roll.
 * - Independent downhill forward velocity integration (uncoupled from camera/player clamp).
 * - Towline drag deceleration: hold 'S' to dig in ski edges, slow beast to 10 MPH, and reel in.
 * - Dead state full-stop: felled beast crashes into snow, stops dead, and skier skis past!
 * - Crystalline weak-point flank glyphs and dynamic blood impact spray.
 */

import "@babylonjs/loaders/glTF";
import {
  Scene,
  StandardMaterial,
  Texture,
  Color3,
  Vector3,
  Mesh,
  MeshBuilder,
  AbstractMesh,
  ParticleSystem,
  Scalar,
  SceneLoader,
  AnimationGroup,
  TransformNode,
  PointLight
} from "@babylonjs/core";
import { YetiAIState, YetiNetState } from "./types";

export class YetiEntity {
  private scene: Scene;
  public rootMesh: Mesh;
  private glbRoot: AbstractMesh | null = null;
  private glbMeshes: AbstractMesh[] = [];
  private animGroups: AnimationGroup[] = [];
  public isGlbLoaded: boolean = false;

  // Visual Effects & Lighting
  private eyeLightL: PointLight | null = null;
  private eyeLightR: PointLight | null = null;
  private bloodParticles: ParticleSystem | null = null;
  private snowFootParticles: ParticleSystem | null = null;
  private breathParticles: ParticleSystem | null = null;

  // Kinematics & Health
  public state: YetiAIState = YetiAIState.CHARGING;
  public hp: number = 3000;
  public maxHp: number = 3000;
  public wave: number = 1;
  public dragSpeed: number = 38; // Physical downhill speed (MPH)
  public baseSpeed: number = 38;
  private runCycle: number = 0;
  private isNetControlled: boolean = false;
  private netTargetPos: Vector3 = new Vector3(0, 0, -32);
  private sprintCooldownTimer: number = 0;
  public isSprinting: boolean = false;
  private sprintDuration: number = 0;
  public onSprintStateChange?: (isSprinting: boolean) => void;

  // Skeletal Transform Nodes for Organic Bone Kinematics
  private hipsNode: TransformNode | null = null;
  private spineNode: TransformNode | null = null;
  private neckNode: TransformNode | null = null;
  private headNode: TransformNode | null = null;
  private leftArmNode: TransformNode | null = null;
  private rightArmNode: TransformNode | null = null;

  // Flank Weak-Spot Vulnerability (Requires carving back and forth to hit)
  public vulnerableFlank: "LEFT" | "RIGHT" = "LEFT";
  private flankTimer: number = 0;
  private flankMarkerL: Mesh | null = null;
  private flankMarkerR: Mesh | null = null;
  private flankMatVuln: StandardMaterial | null = null;
  private flankMatShield: StandardMaterial | null = null;

  constructor(scene: Scene) {
    this.scene = scene;
    this.rootMesh = new Mesh("yetiRoot", this.scene);
    this.rootMesh.position.set(0, 0, -32); // Visible ahead on the slope

    // 1. Setup Atmospheric Particles
    this.initParticleSystems();

    // 2. Load 3D High-Fidelity Rigged GLB Yeti Model
    this.loadYetiModel();

    // 3. Setup Crystalline Flank Weak-Spot Reticles
    this.initFlankMarkers();
  }

  private async loadYetiModel(): Promise<void> {
    try {
      const result = await SceneLoader.ImportMeshAsync("", "/assets/", "yeti.glb", this.scene);
      console.log(`[Yeti] 3D Yeti.glb loaded (${result.meshes.length} meshes, ${result.animationGroups.length} anims)`);

      this.glbRoot = result.meshes[0];
      if (this.glbRoot) {
        this.glbRoot.parent = this.rootMesh;

        // Clear GLTF quaternion so rotation.y works deterministically
        this.glbRoot.rotationQuaternion = null;

        // Scale calibrated to 0.28 produces an imposing 3.8m (12.5ft) hulking mountain boss
        this.glbRoot.scaling.set(0.28, 0.28, 0.28);

        // Ground feet directly on the snow surface
        this.glbRoot.position.set(0, 0.20, 0);

        // Face uphill toward skier (+Z)
        this.glbRoot.rotation.set(0, 0, 0);
        this.glbMeshes = result.meshes;
        this.isGlbLoaded = true;

        // PRESERVE original high-resolution PBR YetiMat textures!
        result.meshes.forEach((m) => {
          if (!m.parent) m.parent = this.rootMesh;
          m.receiveShadows = true;
        });
        result.transformNodes.forEach((tn) => {
          if (!tn.parent) tn.parent = this.rootMesh;
        });

        // Cache skeletal transform nodes for visceral articulation
        this.hipsNode = (result.transformNodes.find((tn) => tn.name === "Yeti_Hips") as TransformNode) || null;
        this.spineNode = (result.transformNodes.find((tn) => tn.name === "Yeti_Spine3" || tn.name === "Yeti_Spine2") as TransformNode) || null;
        this.neckNode = (result.transformNodes.find((tn) => tn.name === "Yeti_Neck") as TransformNode) || null;
        this.headNode = (result.transformNodes.find((tn) => tn.name === "Yeti_Head") as TransformNode) || null;
        this.leftArmNode = (result.transformNodes.find((tn) => tn.name === "Yeti_LeftArm") as TransformNode) || null;
        this.rightArmNode = (result.transformNodes.find((tn) => tn.name === "Yeti_RightArm") as TransformNode) || null;

        // Predator Glowing Red Eye Spotlights (scaled to 3.8m boss, eye level Y ~ 3.1m, Z ~ 0.8m)
        this.eyeLightL = new PointLight("yetiEyeL", new Vector3(-0.35, 3.1, 0.8), this.scene);
        this.eyeLightL.parent = this.rootMesh;
        this.eyeLightL.diffuse = new Color3(1.0, 0.05, 0.0);
        this.eyeLightL.intensity = 3.5;
        this.eyeLightL.range = 10.0;

        this.eyeLightR = new PointLight("yetiEyeR", new Vector3(0.35, 3.1, 0.8), this.scene);
        this.eyeLightR.parent = this.rootMesh;
        this.eyeLightR.diffuse = new Color3(1.0, 0.05, 0.0);
        this.eyeLightR.intensity = 3.5;
        this.eyeLightR.range = 10.0;

        // Play the native rigged Idle animation organically
        if (result.animationGroups && result.animationGroups.length > 0) {
          this.animGroups = result.animationGroups;
          this.animGroups.forEach(a => {
            a.start(true);
            a.speedRatio = 1.2;
          });
        }
      }
    } catch (err) {
      console.warn("[Yeti] GLB load fallback note:", err);
    }
  }

  private initParticleSystems(): void {
    // 1. Blood Spray on Hits
    this.bloodParticles = new ParticleSystem("yetiBlood", 200, this.scene);
    this.bloodParticles.particleTexture = new Texture("/assets/snow_texture.jpg", this.scene);
    this.bloodParticles.emitter = this.rootMesh;
    this.bloodParticles.color1 = new Color3(0.95, 0.05, 0.05).toColor4(1.0);
    this.bloodParticles.color2 = new Color3(0.5, 0.0, 0.0).toColor4(0.8);
    this.bloodParticles.minSize = 0.25;
    this.bloodParticles.maxSize = 0.7;
    this.bloodParticles.minLifeTime = 0.3;
    this.bloodParticles.maxLifeTime = 0.75;
    this.bloodParticles.emitRate = 0;
    this.bloodParticles.direction1 = new Vector3(-1, 2, -1);
    this.bloodParticles.direction2 = new Vector3(1, 4, 1);
    this.bloodParticles.gravity = new Vector3(0, -9.81, 0);
    this.bloodParticles.start();

    // 2. Snow Kickup under heavy beast feet
    this.snowFootParticles = new ParticleSystem("yetiFootSnow", 160, this.scene);
    this.snowFootParticles.particleTexture = new Texture("/assets/snow_texture.jpg", this.scene);
    this.snowFootParticles.emitter = this.rootMesh;
    this.snowFootParticles.isLocal = true;
    this.snowFootParticles.color1 = new Color3(1.0, 1.0, 1.0).toColor4(0.9);
    this.snowFootParticles.color2 = new Color3(0.8, 0.9, 1.0).toColor4(0.4);
    this.snowFootParticles.minSize = 0.35;
    this.snowFootParticles.maxSize = 0.9;
    this.snowFootParticles.minLifeTime = 0.4;
    this.snowFootParticles.maxLifeTime = 0.9;
    this.snowFootParticles.emitRate = 35;
    this.snowFootParticles.direction1 = new Vector3(-1.5, 0.8, -1.5);
    this.snowFootParticles.direction2 = new Vector3(1.5, 1.8, -2.5);
    this.snowFootParticles.gravity = new Vector3(0, -5.0, 0);
    this.snowFootParticles.start();

    // 3. Freezing Mist Breath from ferocious jaws
    this.breathParticles = new ParticleSystem("yetiBreath", 80, this.scene);
    this.breathParticles.particleTexture = new Texture("/assets/snow_texture.jpg", this.scene);
    this.breathParticles.emitter = this.rootMesh;
    this.breathParticles.isLocal = true;
    this.breathParticles.color1 = new Color3(0.7, 0.9, 1.0).toColor4(0.6);
    this.breathParticles.color2 = new Color3(0.4, 0.6, 0.9).toColor4(0.0);
    this.breathParticles.minSize = 0.4;
    this.breathParticles.maxSize = 1.3;
    this.breathParticles.minLifeTime = 0.5;
    this.breathParticles.maxLifeTime = 1.2;
    this.breathParticles.emitRate = 18;
    this.breathParticles.direction1 = new Vector3(-0.5, 0.2, 2.0);
    this.breathParticles.direction2 = new Vector3(0.5, 0.8, 3.5);
    this.breathParticles.gravity = new Vector3(0, 0.2, 0);
    this.breathParticles.start();
  }

  public syncNetState(state: YetiNetState): void {
    this.isNetControlled = true;
    this.netTargetPos.set(state.x, state.y, state.z);
    this.state = state.state;
    this.hp = state.hp;
  }

  public startLevel(wave: number, playerZ: number): void {
    this.wave = wave;
    // Progressive HP scaling: L1=3000, L2=5500, L3=8500, L4=12000, L5=16000
    this.maxHp = Math.round(3000 + (wave - 1) * 2500 + Math.max(0, wave - 2) * 800);
    this.hp = this.maxHp;
    // Progressive base speed: L1=36, L2=46, L3=56, L4=66, L5=76 MPH
    this.baseSpeed = Math.min(76, 36 + (wave - 1) * 10.0);
    this.dragSpeed = this.baseSpeed;
    this.state = YetiAIState.CHARGING;
    this.sprintCooldownTimer = 0;
    this.isSprinting = false;
    this.sprintDuration = 0;
    if (this.onSprintStateChange) this.onSprintStateChange(false);

    // Spawn beast 26m ahead down the slope (-Z) facing DOWNHILL (Math.PI)
    this.rootMesh.position.set(0, 0, playerZ - 26);
    this.rootMesh.rotation.set(0, Math.PI, 0);

    // Dynamic scale progression per level
    const scale = Math.min(1.45, 1.0 + (wave - 1) * 0.12);
    this.rootMesh.scaling.set(scale, scale, scale);

    // Restart foot snow kickup & breath
    if (this.snowFootParticles) this.snowFootParticles.start();
    if (this.breathParticles) this.breathParticles.start();
    if (this.eyeLightL) this.eyeLightL.intensity = 3.5;
    if (this.eyeLightR) this.eyeLightR.intensity = 3.5;
    if (this.animGroups.length > 0) this.animGroups[0].start(true);
  }

  public applyDrag(dragReduction: number, deltaTime: number): void {
    // Player is braking ('S') and carving, applying massive drag torque through the steel towline!
    // On higher levels, the beast resists the towline drag!
    const dragResist = 1.0 + (this.wave - 1) * 0.35;
    this.dragSpeed = Math.max(9.0, this.dragSpeed - (dragReduction / dragResist) * deltaTime * 3.8);
  }

  public update(playerPos: Vector3, deltaTime: number, terrainHeightFn?: (x: number, z: number) => number): void {
    // =========================================================================
    // 1. KINEMATICS & INDEPENDENT FORWARD VELOCITY (-Z DOWNHILL)
    // =========================================================================
    if (this.state !== YetiAIState.DEAD) {
      const distZ = playerPos.z - this.rootMesh.position.z;

      // Sprint burst mechanic (Level >= 2): beast surges ahead when skier approaches
      if (this.wave >= 2) {
        this.sprintCooldownTimer += deltaTime;
        if (!this.isSprinting && this.sprintCooldownTimer > 7.0 && distZ < 28 && distZ > 6) {
          this.isSprinting = true;
          this.sprintDuration = 0;
          this.sprintCooldownTimer = 0;
          if (this.onSprintStateChange) this.onSprintStateChange(true);
        }
        if (this.isSprinting) {
          this.sprintDuration += deltaTime;
          if (this.sprintDuration > 1.8) {
            this.isSprinting = false;
            if (this.onSprintStateChange) this.onSprintStateChange(false);
          }
        }
      } else {
        if (this.isSprinting) {
          this.isSprinting = false;
          if (this.onSprintStateChange) this.onSprintStateChange(false);
        }
      }

      // Forward motion integrated from dragSpeed + sprint surge
      const sprintBonus = this.isSprinting ? Math.min(22, 10 + (this.wave - 1) * 3.5) : 0;
      const effectiveMph = this.dragSpeed + sprintBonus;
      const forwardSpeedUnitsPerSec = (effectiveMph * 0.44704) * 2.2;
      this.rootMesh.position.z -= forwardSpeedUnitsPerSec * deltaTime;

      // Elastic dynamic leash boundary (scales with wave so beast does not throttle to 35 MPH)
      const maxLeashDist = 55 + (this.wave - 1) * 15;
      if (distZ > maxLeashDist) {
        // Beast is pulling too far ahead down the slope; cable tension slows it to base speed
        this.rootMesh.position.z = playerPos.z - maxLeashDist;
        this.dragSpeed = Math.min(this.dragSpeed, this.baseSpeed);
      } else if (distZ < 5) {
        // Skier right on beast's tail; surge forward downhill
        this.rootMesh.position.z = playerPos.z - 5;
        this.dragSpeed = Math.max(this.dragSpeed, this.baseSpeed + 8);
      }

      // Natural mountain corridor weaving (scales with level difficulty)
      const weaveFreq = 0.55 * (1 + (this.wave - 1) * 0.22);
      const weaveAmp = Math.min(30, 10 + (this.wave - 1) * 4.0);
      const targetX = Math.sin(this.runCycle * weaveFreq) * weaveAmp;
      this.rootMesh.position.x = Scalar.Lerp(this.rootMesh.position.x, targetX, deltaTime * (2.5 + (this.wave - 1) * 0.4));
      this.rootMesh.position.x = Scalar.Clamp(this.rootMesh.position.x, -120, 120);

      // Stride cadence dynamically scaled to downhill velocity
      const strideCadence = Math.max(3.6, (effectiveMph / 38) * 5.8);
      this.runCycle += deltaTime * strideCadence;

      // =======================================================================
      // 2. ORGANIC 3D PREDATORY LOCOMOTION & VISCERAL LEAN KINEMATICS
      // =======================================================================

      // 2a. Smooth Vertical Mogul & Fall-Line Anchoring (Eliminate rigid arcade hop)
      let groundY = 0;
      if (terrainHeightFn) {
        groundY = terrainHeightFn(this.rootMesh.position.x, this.rootMesh.position.z);
      }
      // Micro-stride paw plant compression + muscular pounce spring
      const isPouncing = this.state === YetiAIState.POUNCE_CHARGE;
      const isSwiping = this.state === YetiAIState.CLAW_SWIPE;
      const isRoaring = this.state === YetiAIState.ROAR_STORM;

      // Distance to skier
      const distToSkier = Math.hypot(playerPos.x - this.rootMesh.position.x, playerPos.z - this.rootMesh.position.z);
      const isAttackingClose = (isPouncing || isSwiping || isRoaring || distToSkier < 6.5);

      // Trigger pounce lunge or claw swipe when skier gets within striking range
      if (this.state === YetiAIState.CHARGING && distToSkier < 15.0) {
        this.state = Math.random() < 0.5 ? YetiAIState.POUNCE_CHARGE : YetiAIState.CLAW_SWIPE;
        setTimeout(() => {
          if (this.state === YetiAIState.POUNCE_CHARGE || this.state === YetiAIState.CLAW_SWIPE) {
            this.state = this.hp < 1200 ? YetiAIState.BERSERK : YetiAIState.CHARGING;
          }
        }, 1600);
      } else if (this.state === YetiAIState.BERSERK && Math.random() < 0.008) {
        this.state = YetiAIState.ROAR_STORM;
        setTimeout(() => {
          if (this.state === YetiAIState.ROAR_STORM) {
            this.state = YetiAIState.BERSERK;
          }
        }, 2000);
      }

      // Vertical leap or crouch depending on attack state
      let pounceLeapY = 0;
      if (isPouncing) {
        pounceLeapY = Math.sin(this.runCycle * 2.5) > 0 ? 0.75 : -0.15; // Explosive vertical leap down the fall line
      }

      const pawPlantCompression = Math.sin(this.runCycle * 2) * 0.025;
      const targetY = groundY + 0.12 + pawPlantCompression + pounceLeapY;
      this.rootMesh.position.y = Scalar.Lerp(this.rootMesh.position.y, targetY, Math.min(1.0, deltaTime * 12.0));

      if (isPouncing) {
        // Explosive forward & lateral pounce leap directly at skier to close distance for maul takedown
        this.rootMesh.position.x = Scalar.Lerp(this.rootMesh.position.x, playerPos.x, deltaTime * 5.0);
        const pounceSurge = (this.baseSpeed + 24) * 0.44704 * 2.2;
        if (playerPos.z < this.rootMesh.position.z) {
          this.rootMesh.position.z -= pounceSurge * deltaTime * 0.75;
        } else {
          this.rootMesh.position.z += pounceSurge * deltaTime * 0.75;
        }
      }

      // 2b. Forward Charging & Stalking Posture (Pitch on X)
      // Low stalking center of gravity that deepens dynamically with speed
      let targetPitch = 0.16 + (effectiveMph / 65) * 0.09;
      if (this.state === YetiAIState.BERSERK || isPouncing) {
        targetPitch += 0.22; // Aggressive predatory pounce lunge forward
      } else if (isRoaring) {
        targetPitch -= 0.18; // Head thrown back in roar
      } else if (this.state === YetiAIState.STAGGERED) {
        targetPitch -= 0.25; // Reeling back on heavy hit
      }
      // Subtle organic thoracic stride surge
      targetPitch += Math.sin(this.runCycle) * 0.02;
      this.rootMesh.rotation.x = Scalar.Lerp(this.rootMesh.rotation.x, targetPitch, Math.min(1.0, deltaTime * 5.5));

      // 2c. Visceral Lateral Banking into Turns (Roll on Z)
      const lateralDelta = targetX - this.rootMesh.position.x;
      const turnBank = -Scalar.Clamp(lateralDelta * 0.035, -0.22, 0.22);
      const shoulderSway = Math.cos(this.runCycle) * 0.025;
      const targetRoll = turnBank + shoulderSway + (isSwiping ? (lateralDelta > 0 ? 0.15 : -0.15) : 0);
      this.rootMesh.rotation.z = Scalar.Lerp(this.rootMesh.rotation.z, targetRoll, Math.min(1.0, deltaTime * 4.5));

      // 2d. Downhill Forward Facing & Attack Orientation (Yaw on Y)
      // When running downhill, face along -Z (Math.PI) angled into the lateral weave;
      // when counter-attacking or extremely close, face uphill toward skier!
      let targetAngle: number;
      if (isAttackingClose) {
        targetAngle = Math.atan2(playerPos.x - this.rootMesh.position.x, playerPos.z - this.rootMesh.position.z);
      } else {
        const lateralSpeed = (targetX - this.rootMesh.position.x) * 2.5;
        targetAngle = Math.PI + Math.atan2(-lateralSpeed, forwardSpeedUnitsPerSec);
      }

      let diffAngle = targetAngle - this.rootMesh.rotation.y;
      while (diffAngle < -Math.PI) diffAngle += Math.PI * 2;
      while (diffAngle > Math.PI) diffAngle -= Math.PI * 2;
      this.rootMesh.rotation.y += diffAngle * Math.min(1.0, deltaTime * (isAttackingClose ? 8.0 : 4.5));

      // 2e. Native Skeletal Animation Blending & Speed Tracking
      if (this.animGroups.length > 0) {
        const animRate = Scalar.Clamp(effectiveMph / 25, 0.85, 2.4);
        this.animGroups[0].speedRatio = (isPouncing || isSwiping || this.isSprinting) ? animRate * 1.5 : animRate;
      }

      // 2f. Skeletal Node Articulation (Head glance at pursuer, arm reach, visceral claw swat)
      if (this.headNode) {
        const headPitch = isRoaring ? -0.35 : 0;
        const lookAtSkierAngle = Math.atan2(playerPos.x - this.rootMesh.position.x, playerPos.z - this.rootMesh.position.z);
        let lookYaw = lookAtSkierAngle - this.rootMesh.rotation.y;
        while (lookYaw < -Math.PI) lookYaw += Math.PI * 2;
        while (lookYaw > Math.PI) lookYaw -= Math.PI * 2;
        this.headNode.rotation.y = Scalar.Lerp(this.headNode.rotation.y, Scalar.Clamp(lookYaw * 0.45, -0.9, 0.9), Math.min(1.0, deltaTime * 5.5));
        this.headNode.rotation.x = headPitch;
      }
      if (this.leftArmNode && this.rightArmNode) {
        if (isSwiping) {
          // Massive overhead claw swipe arc
          const swipeSwing = Math.sin(this.runCycle * 4) * 1.2;
          this.leftArmNode.rotation.x = -0.6 + swipeSwing;
          this.rightArmNode.rotation.x = -0.6 - swipeSwing;
          this.leftArmNode.rotation.z = 0.45;
          this.rightArmNode.rotation.z = -0.45;
        } else if (isPouncing) {
          // Extended reaching claws ready to grasp
          this.leftArmNode.rotation.x = -0.85;
          this.rightArmNode.rotation.x = -0.85;
          this.leftArmNode.rotation.z = 0.25;
          this.rightArmNode.rotation.z = -0.25;
        } else {
          const armReach = Math.sin(this.runCycle) * 0.14;
          this.leftArmNode.rotation.x = 0.15 + armReach;
          this.rightArmNode.rotation.x = 0.15 - armReach;
          this.leftArmNode.rotation.z = 0.05;
          this.rightArmNode.rotation.z = -0.05;
        }
      }
      if (this.spineNode) {
        const spineFlex = (isPouncing ? -0.15 : (isRoaring ? 0.12 : Math.sin(this.runCycle * 2) * 0.035));
        this.spineNode.rotation.x = spineFlex;
      }

      // Volumetric Breath Mist Boost during Roar & Pounce
      if (this.breathParticles) {
        this.breathParticles.emitRate = isRoaring ? 95 : (isPouncing || this.isSprinting ? 50 : 18);
      }
      if (this.eyeLightL && this.eyeLightR) {
        const eyeIntensity = (isRoaring || this.state === YetiAIState.BERSERK || this.isSprinting) ? 6.5 : 3.5;
        this.eyeLightL.intensity = eyeIntensity;
        this.eyeLightR.intensity = eyeIntensity;
      }

      // Alternating paw snow kickup on stride downbeats
      if (Math.sin(this.runCycle) < -0.85 && this.snowFootParticles) {
        this.snowFootParticles.manualEmitCount = (isPouncing || this.isSprinting) ? 16 : 6;
      }
    } else {
      // =======================================================================
      // 3. DEAD STATE: FULL STOP, TOPPLE ONTO SNOW, SKIER SKIS PAST
      // =======================================================================
      this.dragSpeed = 0; // FULL STOP! No sliding down the hill!

      // Topple flat forward face-down down the slope
      this.rootMesh.rotation.x = Scalar.Lerp(this.rootMesh.rotation.x, Math.PI / 2.15, deltaTime * 8.0);
      this.rootMesh.rotation.y = Scalar.Lerp(this.rootMesh.rotation.y, Math.PI, deltaTime * 8.0);
      this.rootMesh.rotation.z = Scalar.Lerp(this.rootMesh.rotation.z, 0.42, deltaTime * 8.0);
      let groundY = 0;
      if (terrainHeightFn) {
        groundY = terrainHeightFn(this.rootMesh.position.x, this.rootMesh.position.z);
      }
      this.rootMesh.position.y = Scalar.Lerp(this.rootMesh.position.y, groundY + 0.22, deltaTime * 8.0);

      // Stop all active looping effects
      if (this.animGroups.length > 0) this.animGroups[0].stop();
      if (this.snowFootParticles) this.snowFootParticles.stop();
      if (this.breathParticles) this.breathParticles.stop();
      if (this.eyeLightL) this.eyeLightL.intensity = 0;
      if (this.eyeLightR) this.eyeLightR.intensity = 0;
      if (this.flankMarkerL) this.flankMarkerL.isVisible = false;
      if (this.flankMarkerR) this.flankMarkerR.isVisible = false;
    }

    // =========================================================================
    // 4. DYNAMIC FLANK WEAK-SPOT RETICLE LOGIC
    // =========================================================================
    if (this.state !== YetiAIState.DEAD) {
      this.flankTimer += deltaTime;
      const maxFlankDuration = Math.max(1.8, 4.5 - (this.wave - 1) * 0.85);
      if (this.flankTimer > maxFlankDuration) {
        this.switchVulnerableFlank();
      }

      // Rotate weak-spot glyph reticles
      if (this.flankMarkerL) this.flankMarkerL.rotation.z += deltaTime * 2.8;
      if (this.flankMarkerR) this.flankMarkerR.rotation.z += deltaTime * 2.8;

      const pulse = 1.0 + Math.sin(this.runCycle * 4) * 0.22;
      if (this.vulnerableFlank === "LEFT" && this.flankMarkerL) {
        this.flankMarkerL.scaling.set(pulse * 1.15, pulse * 1.15, pulse * 1.15);
      } else if (this.vulnerableFlank === "RIGHT" && this.flankMarkerR) {
        this.flankMarkerR.scaling.set(pulse * 1.15, pulse * 1.15, pulse * 1.15);
      }
    }
  }

  private initFlankMarkers(): void {
    // Crystalline Weak-Point Runic Torus Reticles calibrated to 3.8m beast flanks
    this.flankMarkerL = MeshBuilder.CreateTorus("flankL", { diameter: 0.7, thickness: 0.08, tessellation: 24 }, this.scene);
    this.flankMarkerL.position.set(-1.4, 2.2, 0.1);
    this.flankMarkerL.parent = this.rootMesh;

    this.flankMarkerR = MeshBuilder.CreateTorus("flankR", { diameter: 0.7, thickness: 0.08, tessellation: 24 }, this.scene);
    this.flankMarkerR.position.set(1.4, 2.2, 0.1);
    this.flankMarkerR.parent = this.rootMesh;

    // Vulnerable Flank: Searing Amber/Plasma Emissive Reticle
    this.flankMatVuln = new StandardMaterial("flankVulnMat", this.scene);
    this.flankMatVuln.diffuseColor = new Color3(1.0, 0.2, 0.0);
    this.flankMatVuln.emissiveColor = new Color3(1.4, 0.35, 0.0);
    this.flankMatVuln.specularColor = new Color3(1.0, 0.8, 0.5);

    // Shielded Flank: Crystalline Hardened Cyan Barrier Reticle
    this.flankMatShield = new StandardMaterial("flankShieldMat", this.scene);
    this.flankMatShield.diffuseColor = new Color3(0.1, 0.6, 1.0);
    this.flankMatShield.emissiveColor = new Color3(0.06, 0.3, 0.8);
    this.flankMatShield.alpha = 0.55;

    this.updateFlankVisuals();
  }

  public updateFlankVisuals(): void {
    if (!this.flankMarkerL || !this.flankMarkerR || !this.flankMatVuln || !this.flankMatShield) return;

    if (this.vulnerableFlank === "LEFT") {
      this.flankMarkerL.material = this.flankMatVuln;
      this.flankMarkerL.visibility = 1.0;
      this.flankMarkerR.material = this.flankMatShield;
      this.flankMarkerR.visibility = 0.5;
    } else {
      this.flankMarkerR.material = this.flankMatVuln;
      this.flankMarkerR.visibility = 1.0;
      this.flankMarkerL.material = this.flankMatShield;
      this.flankMarkerL.visibility = 0.5;
    }

    const flankStatus = document.getElementById("flank-status");
    const arrowL = document.getElementById("flank-arrow-l");
    const arrowR = document.getElementById("flank-arrow-r");
    if (flankStatus && arrowL && arrowR) {
      if (this.vulnerableFlank === "LEFT") {
        flankStatus.textContent = "CARVE HARD LEFT! EXPOSED WEAK SPOT";
        flankStatus.style.color = "#ffff00";
        arrowL.style.display = "inline";
        arrowR.style.display = "none";
      } else {
        flankStatus.textContent = "CARVE HARD RIGHT! EXPOSED WEAK SPOT";
        flankStatus.style.color = "#00f0ff";
        arrowL.style.display = "none";
        arrowR.style.display = "inline";
      }
    }
  }

  public switchVulnerableFlank(): void {
    this.flankTimer = 0;
    this.vulnerableFlank = this.vulnerableFlank === "LEFT" ? "RIGHT" : "LEFT";
    this.updateFlankVisuals();
  }

  public evaluateFlankVulnerability(playerX: number): { isPenetrating: boolean; isCritical: boolean; damage: number; message: string } {
    const yetiX = this.rootMesh.position.x;
    const deltaX = playerX - yetiX;

    // Check if player carved into the currently exposed vulnerable flank (+X is screen-left)
    const hitLeft = (this.vulnerableFlank === "LEFT" && deltaX > 0.75);
    const hitRight = (this.vulnerableFlank === "RIGHT" && deltaX < -0.75);

    if (hitLeft || hitRight) {
      this.switchVulnerableFlank();
      return {
        isPenetrating: true,
        isCritical: true,
        damage: 850,
        message: `💥 CRITICAL HIT! ${this.vulnerableFlank === "LEFT" ? "RIGHT" : "LEFT"} FLANK PIERCED! (-850 HP)`
      };
    }

    // Direct center spine armor at higher levels
    if (Math.abs(deltaX) < 0.55 && this.wave >= 2) {
      return {
        isPenetrating: true,
        isCritical: false,
        damage: 200,
        message: `🛡️ ARMORED SPINE DEFLECTION! (-200 HP) • CARVE HARD [A / D] FOR WEAK-SPOT CRITICALS!`
      };
    }

    // Direct center or shielded flank still pierces and hooks!
    return {
      isPenetrating: true,
      isCritical: false,
      damage: 400,
      message: `⚡ HARPOON HOOKED! (-400 HP) • CARVE HARD [A / D] FOR WEAK-SPOT CRITICALS!`
    };
  }

  public takeDamage(amount: number): boolean {
    this.hp = Math.max(0, this.hp - amount);
    this.triggerHitFeedback(amount > 600);

    if (this.hp <= 0 && this.state !== YetiAIState.DEAD) {
      this.state = YetiAIState.DEAD;
      console.log("[Yeti] HP depleted! Transitioning to DEAD state!");
      return true; // Felled
    } else if (this.state !== YetiAIState.DEAD && amount > 600) {
      this.state = YetiAIState.STAGGERED;
      setTimeout(() => {
        if (this.state === YetiAIState.STAGGERED) {
          this.state = this.hp < 1000 ? YetiAIState.BERSERK : YetiAIState.CHARGING;
        }
      }, 1200);
    }
    return this.state === YetiAIState.DEAD;
  }

  public triggerHitFeedback(isHeadshot: boolean): void {
    if (this.bloodParticles) {
      this.bloodParticles.manualEmitCount = isHeadshot ? 50 : 20;
    }
  }

  public getHeadWorldPosition(): Vector3 {
    return this.rootMesh.position.add(new Vector3(0, 3.2, 0));
  }

  public getBodyWorldPosition(): Vector3 {
    return this.rootMesh.position.add(new Vector3(0, 2.0, 0));
  }
}
