/**
 * SkiFree Yeti DO - Yeti Boss Entity System
 * Loads high-fidelity 3D Alpine Beast Boss from /assets/yeti.glb:
 * - 100% genuine sculpted 3D monster anatomy, fangs, claws, and animated skeletal rig.
 * - Piercing predatory glowing red eyes, eye-beam point lights, and freezing breath mist.
 * - Dynamic 12-joint procedural gallop locomotion, snarling head tracking, and claw strikes.
 * - Crystalline weak-point flank glyphs (replacing primitive debug spheres).
 * - Bounding downhill lead kinematics, towline drag deceleration, and 120Hz snapshot interpolation.
 * - Dynamic blood impact spray and foot snow kickup particles.
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
  Bone,
  PointLight
} from "@babylonjs/core";
import { YetiAIState, YetiNetState } from "./types";

interface JointBinding {
  node?: TransformNode;
  bone?: Bone;
  initialRot: Vector3;
}

export class YetiEntity {
  private scene: Scene;
  public rootMesh: Mesh;
  private glbRoot: AbstractMesh | null = null;
  private glbMeshes: AbstractMesh[] = [];
  private animGroups: AnimationGroup[] = [];
  public isGlbLoaded: boolean = false;

  // Joint Locomotion Rig
  private leftArm: JointBinding | null = null;
  private rightArm: JointBinding | null = null;
  private leftForearm: JointBinding | null = null;
  private rightForearm: JointBinding | null = null;
  private leftLeg: JointBinding | null = null;
  private rightLeg: JointBinding | null = null;
  private leftKnee: JointBinding | null = null;
  private rightKnee: JointBinding | null = null;
  private spine: JointBinding | null = null;
  private head: JointBinding | null = null;
  private hips: JointBinding | null = null;

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
  public dragSpeed: number = 38; // Downhill speed (MPH)
  private runCycle: number = 0;
  private isNetControlled: boolean = false;
  private netTargetPos: Vector3 = new Vector3(0, 0, -32);

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
        this.glbRoot.scaling.set(2.8, 2.8, 2.8);
        this.glbRoot.position.set(0, 0, 0);
        // Face toward skier looking uphill
        this.glbRoot.rotation.y = 0;
        this.glbMeshes = result.meshes;
        this.isGlbLoaded = true;

        // --- PBR / Standard Anatomical Shaders ---
        // 1. Eyes: Searing Demonic Scarlet
        const eyeMat = new StandardMaterial("yetiEyeMat", this.scene);
        eyeMat.diffuseColor = new Color3(1.0, 0.05, 0.0);
        eyeMat.emissiveColor = new Color3(1.0, 0.25, 0.0);
        eyeMat.specularColor = new Color3(1.0, 0.8, 0.8);

        // 2. Antlers: Glacial Cyan Crystalline Horns
        const antlerMat = new StandardMaterial("yetiAntlerMat", this.scene);
        antlerMat.diffuseColor = new Color3(0.35, 0.75, 1.0);
        antlerMat.emissiveColor = new Color3(0.18, 0.45, 0.75);
        antlerMat.specularColor = new Color3(1.0, 1.0, 1.0);
        antlerMat.specularPower = 64;

        // 3. Teeth: Sharp Menacing Ivory Fangs
        const teethMat = new StandardMaterial("yetiTeethMat", this.scene);
        teethMat.diffuseColor = new Color3(0.96, 0.94, 0.85);
        teethMat.emissiveColor = new Color3(0.12, 0.12, 0.1);
        teethMat.specularColor = new Color3(0.8, 0.8, 0.7);
        teethMat.specularPower = 36;

        // 4. Fur & Beard: Heavy Shaggy Alpine Coat with Frost Rim Glow
        const furMat = new StandardMaterial("yetiFurMat", this.scene);
        furMat.diffuseColor = new Color3(0.86, 0.90, 0.96);
        furMat.emissiveColor = new Color3(0.14, 0.18, 0.26);
        furMat.specularColor = new Color3(0.25, 0.3, 0.4);

        // 5. Body / Muscle: Chiseled Pale Blue-Grey Beast Hide
        const bodyMat = new StandardMaterial("yetiBodyMat", this.scene);
        bodyMat.diffuseColor = new Color3(0.68, 0.75, 0.84);
        bodyMat.emissiveColor = new Color3(0.10, 0.14, 0.20);
        bodyMat.specularColor = new Color3(0.35, 0.45, 0.55);
        bodyMat.specularPower = 32;

        result.meshes.forEach((m) => {
          m.receiveShadows = true;
          const name = m.name.toLowerCase();
          if (name.includes("eye")) {
            m.material = eyeMat;
          } else if (name.includes("antler")) {
            m.material = antlerMat;
          } else if (name.includes("teeth") || name.includes("tooth")) {
            m.material = teethMat;
          } else if (name.includes("fur") || name.includes("beard")) {
            m.material = furMat;
          } else if (name.includes("body")) {
            m.material = bodyMat;
          }
        });

        // Add Predator Glowing Red Eye Spotlights
        this.eyeLightL = new PointLight("yetiEyeL", new Vector3(-0.35, 4.4, 0.7), this.scene);
        this.eyeLightL.parent = this.rootMesh;
        this.eyeLightL.diffuse = new Color3(1.0, 0.1, 0.0);
        this.eyeLightL.intensity = 2.4;
        this.eyeLightL.range = 10.0;

        this.eyeLightR = new PointLight("yetiEyeR", new Vector3(0.35, 4.4, 0.7), this.scene);
        this.eyeLightR.parent = this.rootMesh;
        this.eyeLightR.diffuse = new Color3(1.0, 0.1, 0.0);
        this.eyeLightR.intensity = 2.4;
        this.eyeLightR.range = 10.0;

        // Stop static idle GLTF animation to allow 100% procedural locomotion
        if (result.animationGroups && result.animationGroups.length > 0) {
          this.animGroups = result.animationGroups;
          this.animGroups.forEach(a => a.stop());
        }

        // Bind Skeletal Joints for Gallop & Combat Kinematics
        const bindJoint = (name: string): JointBinding | null => {
          const node = this.scene.getTransformNodeByName(name);
          if (node) {
            return { node, initialRot: node.rotation.clone() };
          }
          if (result.skeletons && result.skeletons.length > 0) {
            for (const skel of result.skeletons) {
              const b = skel.bones.find(bone => bone.name === name);
              if (b) {
                const tNode = b.getTransformNode();
                if (tNode) {
                  return { node: tNode, initialRot: tNode.rotation.clone() };
                }
                return { bone: b, initialRot: b.rotation.clone() };
              }
            }
          }
          return null;
        };

        this.leftArm = bindJoint("Yeti_LeftArm");
        this.rightArm = bindJoint("Yeti_RightArm");
        this.leftForearm = bindJoint("Yeti_LeftForearm");
        this.rightForearm = bindJoint("Yeti_RightForearm");
        this.leftLeg = bindJoint("Yeti_LeftLeg");
        this.rightLeg = bindJoint("Yeti_RightLeg");
        this.leftKnee = bindJoint("Yeti_LeftKnee");
        this.rightKnee = bindJoint("Yeti_RightKnee");
        this.spine = bindJoint("Yeti_Spine2") || bindJoint("Yeti_Spine1");
        this.head = bindJoint("Yeti_Head");
        this.hips = bindJoint("Yeti_Hips");
      }
    } catch (err) {
      console.warn("[Yeti] GLB load fallback note:", err);
    }
  }

  private rotateJoint(joint: JointBinding | null, pitch: number, yaw: number, roll: number): void {
    if (!joint) return;
    if (joint.node) {
      joint.node.rotation.set(
        joint.initialRot.x + pitch,
        joint.initialRot.y + yaw,
        joint.initialRot.z + roll
      );
    } else if (joint.bone) {
      joint.bone.setRotation(
        new Vector3(
          joint.initialRot.x + pitch,
          joint.initialRot.y + yaw,
          joint.initialRot.z + roll
        )
      );
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
    this.snowFootParticles.color1 = new Color3(1, 1, 1).toColor4(0.85);
    this.snowFootParticles.color2 = new Color3(0.8, 0.9, 1).toColor4(0.25);
    this.snowFootParticles.minSize = 0.35;
    this.snowFootParticles.maxSize = 0.95;
    this.snowFootParticles.minLifeTime = 0.35;
    this.snowFootParticles.maxLifeTime = 0.7;
    this.snowFootParticles.emitRate = 60;
    this.snowFootParticles.direction1 = new Vector3(-1.5, 1, 2);
    this.snowFootParticles.direction2 = new Vector3(1.5, 2.5, 4.5);
    this.snowFootParticles.gravity = new Vector3(0, -8.0, 0);
    this.snowFootParticles.start();

    // 3. Freezing Breath Mist from Maw
    this.breathParticles = new ParticleSystem("yetiBreath", 80, this.scene);
    this.breathParticles.particleTexture = new Texture("/assets/snow_texture.jpg", this.scene);
    this.breathParticles.emitter = this.rootMesh;
    this.breathParticles.color1 = new Color3(0.85, 0.95, 1.0).toColor4(0.5);
    this.breathParticles.color2 = new Color3(0.65, 0.85, 0.95).toColor4(0.0);
    this.breathParticles.minSize = 0.25;
    this.breathParticles.maxSize = 0.85;
    this.breathParticles.minLifeTime = 0.4;
    this.breathParticles.maxLifeTime = 0.9;
    this.breathParticles.emitRate = 28;
    this.breathParticles.direction1 = new Vector3(-0.4, 3.8, 1.2);
    this.breathParticles.direction2 = new Vector3(0.4, 4.2, 3.2);
    this.breathParticles.gravity = new Vector3(0, -1.2, 0);
    this.breathParticles.start();
  }

  public syncNetState(netYeti: YetiNetState): void {
    this.isNetControlled = true;
    this.hp = netYeti.hp;
    this.maxHp = netYeti.maxHp;
    this.state = netYeti.state;
    this.wave = netYeti.wave;

    // Record server target position for 120Hz client-side frame interpolation
    this.netTargetPos.set(netYeti.x, 0, netYeti.z);
  }

  public applyDrag(dragIntensity: number, deltaTime: number): void {
    const dragResist = 1.0 + (this.wave - 1) * 0.12;
    this.dragSpeed = Math.max(0, this.dragSpeed - (dragIntensity / dragResist) * deltaTime * 5.0);
    this.hp = Math.max(0, this.hp - (dragIntensity / dragResist) * 110 * deltaTime);

    if (this.hp <= 0 && this.state !== YetiAIState.DEAD) {
      this.state = YetiAIState.DEAD;
    } else if (this.state !== YetiAIState.DEAD) {
      this.state = YetiAIState.STAGGERED;
    }

    if (Math.random() < 0.25) {
      this.triggerHitFeedback(false);
    }
  }

  public startLevel(level: number, playerZ: number): void {
    this.wave = level;
    // Scale HP with level: L1=3000, L2=4500, L3=6500, L4=9000...
    this.maxHp = Math.round(3000 * Math.pow(1.38, level - 1));
    this.hp = this.maxHp;

    // Scale baseline drag pursuit speed: L1=38, L2=44, L3=50...
    this.dragSpeed = Math.min(66, 38 + (level - 1) * 6);

    // Reset state & posture
    this.state = YetiAIState.CHARGING;
    this.rootMesh.rotation.x = 0;
    this.rootMesh.rotation.z = 0;
    this.rootMesh.position.y = 0;

    // Spawn ahead downhill along slope
    this.rootMesh.position.set(0, 0, playerZ - 36);

    // Visual scale progression (beast grows more hulking with each level)
    const scale = Math.min(1.5, 1.0 + (level - 1) * 0.12);
    this.rootMesh.scaling.set(scale, scale, scale);

    // Restart foot snow kickup & breath
    if (this.snowFootParticles) this.snowFootParticles.start();
    if (this.breathParticles) this.breathParticles.start();
  }

  public update(playerPos: Vector3, deltaTime: number): void {
    this.runCycle += deltaTime * 8;

    // Face player locking predatory gaze
    const angleToPlayer = Math.atan2(playerPos.x - this.rootMesh.position.x, playerPos.z - this.rootMesh.position.z);
    this.rootMesh.rotation.y = angleToPlayer;

    // Downhill lead kinematics & 120Hz Client-Side Snapshot Interpolation
    if (this.isNetControlled && this.state !== YetiAIState.DEAD) {
      const lerpSpeed = Math.min(1.0, deltaTime * 14.0);
      this.rootMesh.position.x = Scalar.Lerp(this.rootMesh.position.x, this.netTargetPos.x, lerpSpeed);
      this.rootMesh.position.z = Scalar.Lerp(this.rootMesh.position.z, this.netTargetPos.z, lerpSpeed);
    } else if (!this.isNetControlled && this.state !== YetiAIState.DEAD) {
      const forwardSpeedUnitsPerSec = (this.dragSpeed * 0.44704) * 2.2;
      this.rootMesh.position.z -= forwardSpeedUnitsPerSec * deltaTime;

      const minZ = playerPos.z - 36; // Furthest downhill ahead
      const maxZ = playerPos.z - 18; // Closest downhill ahead
      this.rootMesh.position.z = Scalar.Clamp(this.rootMesh.position.z, minZ, maxZ);

      // Weave laterally across the slope (scales with level difficulty)
      const weaveFreq = 0.6 * (1 + (this.wave - 1) * 0.18);
      const weaveAmp = Math.min(24, 12 + (this.wave - 1) * 3);
      const targetX = playerPos.x + Math.sin(this.runCycle * weaveFreq) * weaveAmp;
      const lerpSpeed = 2.2 + (this.wave - 1) * 0.4;
      this.rootMesh.position.x = Scalar.Lerp(this.rootMesh.position.x, targetX, deltaTime * lerpSpeed);
      this.rootMesh.position.x = Scalar.Clamp(this.rootMesh.position.x, -140, 140);
    }

    // --- Procedural 12-Joint Skeletal Locomotion & State Feedback ---
    if (this.state === YetiAIState.CHARGING || this.state === YetiAIState.BERSERK) {
      const speedMult = this.state === YetiAIState.BERSERK ? 2.3 : 1.5;
      const cycle = this.runCycle * speedMult;

      // Heavy galloping bound: vertical bounce and forward lean
      this.rootMesh.position.y = Math.abs(Math.sin(cycle)) * 0.42;
      this.rootMesh.rotation.x = this.state === YetiAIState.BERSERK ? 0.28 : 0.16;

      // 1. Legs galloping in powerful downhill stride
      const legPitch = Math.sin(cycle) * 0.72;
      this.rotateJoint(this.leftLeg, legPitch, 0, 0.05);
      this.rotateJoint(this.rightLeg, -legPitch, 0, -0.05);

      // 2. Knees bending on recovery stroke
      const kneeL = Math.max(0, -Math.sin(cycle)) * 0.85;
      const kneeR = Math.max(0, Math.sin(cycle)) * 0.85;
      this.rotateJoint(this.leftKnee, kneeL, 0, 0);
      this.rotateJoint(this.rightKnee, kneeR, 0, 0);

      // 3. Arms pumping violently with claws reaching forward
      const armPitch = -Math.sin(cycle) * 0.82;
      const armSway = Math.sin(cycle * 0.5) * 0.22;
      this.rotateJoint(this.leftArm, armPitch + 0.35, armSway, -0.28);
      this.rotateJoint(this.rightArm, -armPitch + 0.35, -armSway, 0.28);

      // 4. Forearms angled inward with clawed grip
      const forearmFlex = 0.45 + Math.abs(Math.sin(cycle)) * 0.35;
      this.rotateJoint(this.leftForearm, forearmFlex, 0.25, 0);
      this.rotateJoint(this.rightForearm, forearmFlex, -0.25, 0);

      // 5. Spine hunched into charge, rolling with heavy impacts
      const spineHunch = 0.3 + Math.sin(cycle * 2) * 0.12;
      const spineRoll = Math.sin(cycle) * 0.1;
      this.rotateJoint(this.spine, spineHunch, 0, spineRoll);

      // 6. Head snarling, bobbing with stride, locking eyes onto player
      const headBob = -0.16 + Math.sin(cycle * 2) * 0.08;
      const headSnarl = Math.sin(cycle * 0.5) * 0.18;
      this.rotateJoint(this.head, headBob, headSnarl, -spineRoll * 0.5);

    } else if (this.state === YetiAIState.STAGGERED) {
      // Staggered: Yanked violently backward by harpoon tension cable!
      this.rootMesh.position.y = Math.sin(this.runCycle * 3) * 0.18;
      this.rootMesh.rotation.x = -0.38;

      const reelCycle = Math.sin(this.runCycle * 5) * 0.15;
      this.rotateJoint(this.spine, -0.55 + reelCycle, 0, 0);
      this.rotateJoint(this.head, -0.45, Math.sin(this.runCycle * 6) * 0.25, 0);
      this.rotateJoint(this.leftArm, -1.1, -0.3, -0.4);
      this.rotateJoint(this.rightArm, -1.1, 0.3, 0.4);
      this.rotateJoint(this.leftLeg, 0.4, 0, 0);
      this.rotateJoint(this.rightLeg, -0.3, 0, 0);

    } else if (this.state === YetiAIState.FROST_NOVA || this.state === YetiAIState.AVALANCHE_TRIGGER) {
      // Roaring up to the heavens, arms raised triggering mountain cascade
      this.rootMesh.position.y = Math.sin(this.runCycle * 4) * 0.45;
      this.rootMesh.rotation.x = -0.25;

      const roarTremor = Math.sin(this.runCycle * 14) * 0.07;
      this.rotateJoint(this.spine, -0.45 + roarTremor, 0, 0);
      this.rotateJoint(this.head, -0.8 + roarTremor, 0, 0);
      this.rotateJoint(this.leftArm, -1.45, -0.4, -0.5);
      this.rotateJoint(this.rightArm, -1.45, 0.4, 0.5);

    } else if (this.state === YetiAIState.DEAD) {
      // Collapsed forward into deep snow
      this.dragSpeed = Scalar.Lerp(this.dragSpeed, 0, deltaTime * 5);
      this.rootMesh.rotation.x = Scalar.Lerp(this.rootMesh.rotation.x, Math.PI / 2.2, 0.15);
      this.rootMesh.position.y = Scalar.Lerp(this.rootMesh.position.y, 0.3, 0.15);

      this.rotateJoint(this.spine, 0.7, 0, 0);
      this.rotateJoint(this.head, 0.5, 0.4, 0);
      this.rotateJoint(this.leftArm, 0.8, 0, -0.5);
      this.rotateJoint(this.rightArm, 0.8, 0, 0.5);

      if (this.snowFootParticles) this.snowFootParticles.stop();
      if (this.breathParticles) this.breathParticles.stop();
      if (this.eyeLightL) this.eyeLightL.intensity = 0;
      if (this.eyeLightR) this.eyeLightR.intensity = 0;
      if (this.flankMarkerL) this.flankMarkerL.isVisible = false;
      if (this.flankMarkerR) this.flankMarkerR.isVisible = false;
    }

    // Dynamic Flank Reticle Pulse & Continuous Rotation
    if (this.state !== YetiAIState.DEAD) {
      this.flankTimer += deltaTime;
      if (this.flankTimer > 4.5) {
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
    // Elegant Crystalline Weak-Point Runic Torus Reticles (Zero crude spheres)
    this.flankMarkerL = MeshBuilder.CreateTorus("flankL", { diameter: 1.4, thickness: 0.18, tessellation: 24 }, this.scene);
    this.flankMarkerL.position.set(-1.75, 2.7, 0.1);
    this.flankMarkerL.parent = this.rootMesh;

    this.flankMarkerR = MeshBuilder.CreateTorus("flankR", { diameter: 1.4, thickness: 0.18, tessellation: 24 }, this.scene);
    this.flankMarkerR.position.set(1.75, 2.7, 0.1);
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

  public evaluateFlankVulnerability(playerX: number): { isPenetrating: boolean; message: string } {
    const yetiX = this.rootMesh.position.x;
    const deltaX = playerX - yetiX;

    // Direct center spine is armored with thick ice plates
    if (Math.abs(deltaX) < 4.2) {
      return {
        isPenetrating: false,
        message: "🛡️ DEFLECTED! ARMOR-PLATED SPINE! CARVE TO FLANK TO HIT!"
      };
    }

    if (this.vulnerableFlank === "LEFT") {
      if (deltaX < -3.2) {
        this.switchVulnerableFlank();
        return { isPenetrating: true, message: "💥 LEFT FLANK PIERCED! CRITICAL HIT!" };
      } else {
        return {
          isPenetrating: false,
          message: "🛡️ DEFLECTED! LEFT FLANK EXPOSED — CARVE HARD LEFT!"
        };
      }
    } else {
      if (deltaX > 3.2) {
        this.switchVulnerableFlank();
        return { isPenetrating: true, message: "💥 RIGHT FLANK PIERCED! CRITICAL HIT!" };
      } else {
        return {
          isPenetrating: false,
          message: "🛡️ DEFLECTED! RIGHT FLANK EXPOSED — CARVE HARD RIGHT!"
        };
      }
    }
  }

  public triggerHitFeedback(isHeadshot: boolean): void {
    if (this.bloodParticles) {
      this.bloodParticles.manualEmitCount = isHeadshot ? 50 : 20;
    }
  }

  public getHeadWorldPosition(): Vector3 {
    return this.rootMesh.position.add(new Vector3(0, 4.8, 0));
  }

  public getBodyWorldPosition(): Vector3 {
    return this.rootMesh.position.add(new Vector3(0, 2.4, 0));
  }
}
