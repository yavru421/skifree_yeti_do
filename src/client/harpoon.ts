/**
 * SkiFree Yeti DO - FPV Steam Harpoon Cannon & Dynamic Towline Cable
 * High-fidelity steampunk alpine harpoon gun in first-person view with brass pressure gauge,
 * iron sights, steam discharge particle puff, dynamic recoil kickback, and physical
 * steel towline cable connecting the harpoon gun to the Yeti.
 */

import {
  Scene,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Vector3,
  Mesh,
  Camera,
  Scalar,
  LinesMesh,
  ParticleSystem,
  Texture
} from "@babylonjs/core";

export class SteamHarpoon {
  private scene: Scene;
  private camera: Camera;
  public gunRoot: Mesh;

  // Components
  private barrelMesh: Mesh;
  private stockMesh: Mesh;
  private winchSpool: Mesh;
  private pressureGauge: Mesh;
  private gaugeNeedle: Mesh;
  private harpoonSpear: Mesh;
  private steamParticles: ParticleSystem | null = null;

  // Towline Cable State
  public isTethered: boolean = false;
  private towlineMesh: LinesMesh | null = null;
  public cableTension: number = 0.5; // 0 to 1
  private recoilOffset: number = 0;
  private swayCycle: number = 0;

  constructor(scene: Scene, camera: Camera) {
    this.scene = scene;
    this.camera = camera;

    // Gun Root parented to camera (held in player's right hand / shoulder line)
    this.gunRoot = new Mesh("harpoonGunRoot", this.scene);
    this.gunRoot.parent = this.camera;
    this.gunRoot.position.set(0.40, -0.40, 0.95);
    this.gunRoot.scaling.set(0.8, 0.8, 0.8);
    this.gunRoot.rotation.set(-0.04, -0.03, 0.02);

    // --- MATERIALS ---
    // Blued Gunmetal Steel
    const gunSteelMat = new StandardMaterial("gunSteelMat", this.scene);
    gunSteelMat.diffuseColor = new Color3(0.12, 0.16, 0.22);
    gunSteelMat.specularColor = new Color3(0.75, 0.85, 0.95);
    gunSteelMat.roughness = 0.18;

    // Polished Alpine Brass
    const brassMat = new StandardMaterial("gunBrassMat", this.scene);
    brassMat.diffuseColor = new Color3(0.55, 0.42, 0.18);
    brassMat.specularColor = new Color3(0.65, 0.55, 0.35);
    brassMat.roughness = 0.15;

    // Polished Walnut Stock
    const woodMat = new StandardMaterial("gunWoodMat", this.scene);
    woodMat.diffuseColor = new Color3(0.28, 0.14, 0.06);
    woodMat.specularColor = new Color3(0.15, 0.1, 0.05);

    // Hardened Harpoon Steel
    const harpoonSteelMat = new StandardMaterial("harpoonSteelMat", this.scene);
    harpoonSteelMat.diffuseColor = new Color3(0.8, 0.84, 0.92);
    harpoonSteelMat.specularColor = new Color3(1.0, 1.0, 1.0);
    harpoonSteelMat.roughness = 0.08;

    // Gauge Dial Face (Luminescent Green)
    const dialMat = new StandardMaterial("dialMat", this.scene);
    dialMat.diffuseColor = new Color3(0.1, 0.9, 0.4);
    dialMat.emissiveColor = new Color3(0.05, 0.4, 0.15);

    // --- MESH HIERARCHY ---
    // 1. Walnut Stock & Receiver
    this.stockMesh = MeshBuilder.CreateBox(
      "gunStock",
      { width: 0.08, height: 0.16, depth: 0.48 },
      this.scene
    );
    this.stockMesh.material = woodMat;
    this.stockMesh.position.set(0, -0.04, -0.15);
    this.stockMesh.parent = this.gunRoot;

    // 2. Heavy Fluted Blued Steel Barrel
    this.barrelMesh = MeshBuilder.CreateCylinder(
      "gunBarrel",
      { height: 1.05, diameter: 0.11, tessellation: 12 },
      this.scene
    );
    this.barrelMesh.material = gunSteelMat;
    this.barrelMesh.rotation.x = Math.PI / 2;
    this.barrelMesh.position.set(0, 0.04, 0.38);
    this.barrelMesh.parent = this.gunRoot;

    // Muzzle Brake Crown
    const muzzleBrake = MeshBuilder.CreateCylinder(
      "muzzleBrake",
      { height: 0.12, diameter: 0.14, tessellation: 8 },
      this.scene
    );
    muzzleBrake.material = brassMat;
    muzzleBrake.rotation.x = Math.PI / 2;
    muzzleBrake.position.set(0, 0.04, 0.92);
    muzzleBrake.parent = this.gunRoot;

    // Iron Sights (Front & Rear Posts)
    const frontSight = MeshBuilder.CreateBox(
      "frontSight",
      { width: 0.012, height: 0.04, depth: 0.02 },
      this.scene
    );
    frontSight.material = brassMat;
    frontSight.position.set(0, 0.12, 0.88);
    frontSight.parent = this.gunRoot;

    const rearSight = MeshBuilder.CreateBox(
      "rearSight",
      { width: 0.035, height: 0.03, depth: 0.02 },
      this.scene
    );
    rearSight.material = gunSteelMat;
    rearSight.position.set(0, 0.11, 0.08);
    rearSight.parent = this.gunRoot;

    // 3. Brass Steam Expansion Chamber & Winch Spool
    this.winchSpool = MeshBuilder.CreateCylinder(
      "winchSpool",
      { height: 0.2, diameter: 0.22, tessellation: 16 },
      this.scene
    );
    this.winchSpool.material = brassMat;
    this.winchSpool.rotation.z = Math.PI / 2;
    this.winchSpool.position.set(-0.09, -0.06, 0.05);
    this.winchSpool.parent = this.gunRoot;

    // Steel Cable Coil around Spool
    const cableCoil = MeshBuilder.CreateTorus(
      "cableCoil",
      { diameter: 0.18, thickness: 0.04, tessellation: 16 },
      this.scene
    );
    cableCoil.material = harpoonSteelMat;
    cableCoil.rotation.y = Math.PI / 2;
    cableCoil.position.set(-0.09, -0.06, 0.05);
    cableCoil.parent = this.gunRoot;

    // 4. Brass Pressure Manometer Gauge
    this.pressureGauge = MeshBuilder.CreateCylinder(
      "pressureGauge",
      { height: 0.05, diameter: 0.14, tessellation: 16 },
      this.scene
    );
    this.pressureGauge.material = brassMat;
    this.pressureGauge.rotation.y = -Math.PI / 2;
    this.pressureGauge.position.set(-0.08, 0.07, 0.12);
    this.pressureGauge.parent = this.gunRoot;

    const gaugeFace = MeshBuilder.CreateDisc(
      "gaugeFace",
      { radius: 0.055, tessellation: 16 },
      this.scene
    );
    gaugeFace.material = dialMat;
    gaugeFace.rotation.y = -Math.PI / 2;
    gaugeFace.position.set(-0.108, 0.07, 0.12);
    gaugeFace.parent = this.gunRoot;

    this.gaugeNeedle = MeshBuilder.CreateBox(
      "gaugeNeedle",
      { width: 0.006, height: 0.04, depth: 0.004 },
      this.scene
    );
    this.gaugeNeedle.material = gunSteelMat;
    this.gaugeNeedle.position.set(-0.11, 0.07, 0.12);
    this.gaugeNeedle.parent = this.gunRoot;

    // 5. Loaded Trident-Barbed Harpoon Spear
    this.harpoonSpear = MeshBuilder.CreateCylinder(
      "harpoonSpear",
      { height: 0.85, diameterTop: 0.015, diameterBottom: 0.04, tessellation: 8 },
      this.scene
    );
    this.harpoonSpear.material = harpoonSteelMat;
    this.harpoonSpear.rotation.x = Math.PI / 2;
    this.harpoonSpear.position.set(0, 0.04, 0.95);
    this.harpoonSpear.parent = this.gunRoot;

    // Harpoon Trident Barbs
    const barbL = MeshBuilder.CreateCylinder(
      "harpoonBarbL",
      { height: 0.16, diameterTop: 0.008, diameterBottom: 0.02 },
      this.scene
    );
    barbL.material = harpoonSteelMat;
    barbL.rotation.set(-0.4, 0, -0.45);
    barbL.position.set(-0.04, 0.06, 1.28);
    barbL.parent = this.gunRoot;

    const barbR = MeshBuilder.CreateCylinder(
      "harpoonBarbR",
      { height: 0.16, diameterTop: 0.008, diameterBottom: 0.02 },
      this.scene
    );
    barbR.material = harpoonSteelMat;
    barbR.rotation.set(-0.4, 0, 0.45);
    barbR.position.set(0.04, 0.06, 1.28);
    barbR.parent = this.gunRoot;

    // 6. Steam Vent Discharge Particles
    this.initSteamParticles();
  }

  private initSteamParticles(): void {
    this.steamParticles = new ParticleSystem("gunSteam", 60, this.scene);
    this.steamParticles.particleTexture = new Texture("/assets/snow_texture.jpg", this.scene);
    this.steamParticles.emitter = this.barrelMesh;
    this.steamParticles.minSize = 0.08;
    this.steamParticles.maxSize = 0.28;
    this.steamParticles.color1 = new Color3(1, 1, 1).toColor4(0.8);
    this.steamParticles.color2 = new Color3(0.7, 0.8, 0.9).toColor4(0.0);
    this.steamParticles.direction1 = new Vector3(-0.4, 0.8, 1.0);
    this.steamParticles.direction2 = new Vector3(0.4, 1.2, 1.8);
    this.steamParticles.minLifeTime = 0.15;
    this.steamParticles.maxLifeTime = 0.4;
    this.steamParticles.emitRate = 0;
    this.steamParticles.start();
  }

  public fire(): void {
    // Recoil impulse backward along -Z and upward kick
    this.recoilOffset = -0.22;
    this.gunRoot.rotation.x = -0.16;

    // Emit pressurized steam blast
    if (this.steamParticles) {
      this.steamParticles.manualEmitCount = 35;
    }
  }

  public attachTowline(): void {
    this.isTethered = true;
  }

  public detachTowline(): void {
    this.isTethered = false;
    if (this.towlineMesh) {
      this.towlineMesh.dispose();
      this.towlineMesh = null;
    }
  }

  public reset(): void {
    this.detachTowline();
    this.cableTension = 0.5;
    this.recoilOffset = 0;
    this.swayCycle = 0;
    if (this.gunRoot) {
      this.gunRoot.position.set(0.40, -0.40, 0.95);
      this.gunRoot.rotation.set(-0.04, -0.03, 0.02);
    }
  }

  public update(
    yetiWorldPos: Vector3,
    isAimingRear: boolean,
    deltaTime: number,
    isThirdPerson: boolean = false,
    thirdPersonAnchor?: Vector3
  ): void {
    if (isThirdPerson) {
      this.gunRoot.setEnabled(false);
      // In third person, render towline from avatar's anchor if tethered
      if (this.isTethered && thirdPersonAnchor) {
        this.renderTowline(thirdPersonAnchor, yetiWorldPos);
      } else if (this.towlineMesh) {
        this.towlineMesh.dispose();
        this.towlineMesh = null;
      }
      return;
    }
    // Hide gun if player looks 180° backward without rifle
    this.gunRoot.setEnabled(!isAimingRear);
    if (isAimingRear) return;

    this.swayCycle += deltaTime * 4.0;

    // 1. Recoil Recovery & Natural Aim Sway
    this.recoilOffset = Scalar.Lerp(this.recoilOffset, 0, deltaTime * 14);
    this.gunRoot.rotation.x = Scalar.Lerp(this.gunRoot.rotation.x, -0.04, deltaTime * 12);

    const swayX = Math.sin(this.swayCycle * 0.5) * 0.008;
    const swayY = Math.cos(this.swayCycle) * 0.006;
    this.gunRoot.position.set(0.36 + swayX, -0.32 + swayY, 0.82 + this.recoilOffset);

    // 2. Pressure Gauge Needle Jitter
    const gaugeJitter = Math.sin(this.swayCycle * 8) * 0.15 + (this.isTethered ? 0.6 : 0.2);
    this.gaugeNeedle.rotation.z = gaugeJitter;

    // 3. Dynamic Towline Steel Cable Rendering
    if (this.isTethered) {
      const gunMuzzleWorld = this.harpoonSpear.getAbsolutePosition();
      this.renderTowline(gunMuzzleWorld, yetiWorldPos);
    } else if (this.towlineMesh) {
      this.towlineMesh.dispose();
      this.towlineMesh = null;
    }
  }

  private renderTowline(origin: Vector3, yetiWorldPos: Vector3): void {
    const yetiTetherTarget = yetiWorldPos.add(new Vector3(0, 2.2, 0));

    // Multi-segment catenary cable line with dynamic tension droop
    const segments = 6;
    const points: Vector3[] = [];
    const tensionSag = Math.max(0.1, (1.0 - this.cableTension) * 1.8);

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const interp = Vector3.Lerp(origin, yetiTetherTarget, t);
      // Parabolic droop in Y
      const sag = Math.sin(t * Math.PI) * -tensionSag;
      interp.y += sag;
      points.push(interp);
    }

    if (!this.towlineMesh) {
      this.towlineMesh = MeshBuilder.CreateLines(
        "steelTowline",
        { points, updatable: true },
        this.scene
      );
      this.towlineMesh.color = new Color3(0.0, 0.95, 1.0); // Electric Cyan High-Tension Cable
    } else {
      this.towlineMesh = MeshBuilder.CreateLines(
        "steelTowline",
        { points, instance: this.towlineMesh },
        this.scene
      );
    }
  }
}
