/**
 * SkierAvatar.ts
 * High-Fidelity Athletic 3D Skier Character Avatar:
 * - Anatomically contoured downhill racing speed suit (Alpine Gold livery, compression flanks, red pinstripes).
 * - Aerodynamic teardrop World Cup racing helmet with wrap-around polarized mirror goggles and tactical gaiter.
 * - Articulated downhill racing kinematics: natural knee flex, canted shins, molded alpine racing boots.
 * - Continuous high-performance twin-tip downhill skis with seamless curved rockered tips and stainless steel edges.
 * - Authentic downhill racing pole carriage: grips held at hip level, shafts angled down and back toward the snow.
 * - ALWAYS-VISIBLE TACTICAL HARPOON RIFLE:
 *     * Cruising / Downhill Stance: Slung diagonally across tactical backpack scabbard over right shoulder.
 *     * Combat / Aiming / Tethered Stance: Drawn into hands in two-handed tactical downhill ready-fire posture.
 * - Soft volumetric alpine powder snow spray powered by in-memory dynamic radial alpha particle texture.
 * - Dynamic procedural animations (carving bank, ski edge bite, aerodynamic tuck, snowplow brake, tip chatter).
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
  DynamicTexture
} from "@babylonjs/core";

export class SkierAvatar {
  private scene: Scene;
  public rootNode: Mesh;

  // Anatomical Body Anatomy
  private bodyMesh: Mesh;
  private collarMesh: Mesh;
  private beltMesh: Mesh;
  private backpackMesh: Mesh;
  private headMesh: Mesh;
  private helmetVisor: Mesh;
  private leftArm: Mesh;
  private rightArm: Mesh;
  private leftForearm: Mesh;
  private rightForearm: Mesh;
  private leftGlove: Mesh;
  private rightGlove: Mesh;
  private leftLeg: Mesh;
  private rightLeg: Mesh;
  private leftShin: Mesh;
  private rightShin: Mesh;
  private leftBoot: Mesh;
  private rightBoot: Mesh;
  private leftPole: Mesh;
  private rightPole: Mesh;
  private leftSki: Mesh;
  private rightSki: Mesh;
  private leftTip: Mesh;
  private rightTip: Mesh;

  // Harpoon Weapon System (Always visible)
  public rifleRoot: Mesh;
  private currentRiflePos: Vector3 = new Vector3(0.14, 1.26, 0.26);
  private targetRiflePos: Vector3 = new Vector3(0.14, 1.26, 0.26);
  private currentRifleRot: Vector3 = new Vector3(0.25, 0.35, 0.85);
  private targetRifleRot: Vector3 = new Vector3(0.25, 0.35, 0.85);

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

    // ==========================================
    // AUTHENTIC ALPINE RACING MATERIALS
    // ==========================================

    // 1. Alpine Gold / Mustard Racing Suit Material
    const suitMat = new StandardMaterial("skierSuitGoldMat", this.scene);
    suitMat.diffuseColor = new Color3(0.88, 0.65, 0.12);
    suitMat.specularColor = new Color3(0.35, 0.30, 0.18);
    suitMat.emissiveColor = new Color3(0.12, 0.08, 0.02);
    suitMat.roughness = 0.40;

    // 2. Tactical Contrast Black Compression Panels
    const blackPanelMat = new StandardMaterial("skierBlackPanelMat", this.scene);
    blackPanelMat.diffuseColor = new Color3(0.08, 0.08, 0.10);
    blackPanelMat.specularColor = new Color3(0.20, 0.20, 0.22);
    blackPanelMat.roughness = 0.55;

    // 3. Tactical Backpack Material (Matte Cordura)
    const backpackMat = new StandardMaterial("skierBackpackMat", this.scene);
    backpackMat.diffuseColor = new Color3(0.06, 0.07, 0.09);
    backpackMat.specularColor = new Color3(0.15, 0.15, 0.18);
    backpackMat.roughness = 0.70;

    // 4. Aerodynamic Carbon Racing Helmet Shell
    const helmetMat = new StandardMaterial("skierHelmetMat", this.scene);
    helmetMat.diffuseColor = new Color3(0.05, 0.06, 0.08);
    helmetMat.specularColor = new Color3(0.85, 0.85, 0.90);
    helmetMat.specularPower = 128;
    helmetMat.roughness = 0.15;

    // 5. Mirrored Polarized Snow Goggles (Gold & Amber Polarized Reflection)
    const visorMat = new StandardMaterial("skierVisorMat", this.scene);
    visorMat.diffuseColor = new Color3(0.02, 0.04, 0.06);
    visorMat.emissiveColor = new Color3(0.06, 0.12, 0.16);
    visorMat.specularColor = new Color3(1.0, 0.85, 0.40);
    visorMat.specularPower = 180;

    // 6. High-Modulus Carbon Downhill Skis
    const skiMat = new StandardMaterial("skierSkiMat", this.scene);
    skiMat.diffuseColor = new Color3(0.07, 0.08, 0.10);
    skiMat.specularColor = new Color3(0.70, 0.70, 0.75);
    skiMat.roughness = 0.25;

    // 7. Polished Stainless Steel Ski Edges & Alloy Buckles
    const metalEdgeMat = new StandardMaterial("skierMetalEdgeMat", this.scene);
    metalEdgeMat.diffuseColor = new Color3(0.82, 0.84, 0.88);
    metalEdgeMat.specularColor = new Color3(0.98, 0.98, 1.0);
    metalEdgeMat.specularPower = 160;

    // 8. Racing Red Livery Accent
    const redAccentMat = new StandardMaterial("skierRedAccentMat", this.scene);
    redAccentMat.diffuseColor = new Color3(0.92, 0.12, 0.14);
    redAccentMat.specularColor = new Color3(0.60, 0.60, 0.60);

    // 9. Gunmetal / Titanium Alloy (Harpoon Barrel & Poles)
    const gunmetalMat = new StandardMaterial("skierGunmetalMat", this.scene);
    gunmetalMat.diffuseColor = new Color3(0.22, 0.24, 0.27);
    gunmetalMat.specularColor = new Color3(0.90, 0.92, 0.98);

    // 10. Molded Alpine Racing Boot Shell (Nordica / Lange World Cup Style)
    const bootMat = new StandardMaterial("skierBootMat", this.scene);
    bootMat.diffuseColor = new Color3(0.08, 0.10, 0.14);
    bootMat.specularColor = new Color3(0.65, 0.65, 0.75);
    bootMat.specularPower = 120;
    bootMat.roughness = 0.22;

    // 11. Optical Scope Glass Lens
    const lensMat = new StandardMaterial("skierScopeLensMat", this.scene);
    lensMat.diffuseColor = new Color3(0.04, 0.20, 0.35);
    lensMat.specularColor = new Color3(0.95, 1.0, 1.0);
    lensMat.specularPower = 200;

    // 12. Matte Tactical Face Gaiter / Balaclava
    const gaiterMat = new StandardMaterial("skierGaiterMat", this.scene);
    gaiterMat.diffuseColor = new Color3(0.05, 0.05, 0.06);
    gaiterMat.roughness = 0.90;

    // ==========================================
    // ANATOMICAL ATHLETIC SKELETAL GEOMETRY
    // ==========================================

    // 1. Torso / Speed Suit (Tapered Athletic V-Taper, Contoured Proportions)
    // Upper Chest (Tapered Anatomical Cylinder with human ribcage proportions)
    this.bodyMesh = MeshBuilder.CreateCylinder(
      "skierChest",
      { height: 0.46, diameterTop: 0.44, diameterBottom: 0.36, tessellation: 24 },
      this.scene
    );
    this.bodyMesh.scaling.z = 0.74; // Anatomical front-to-back depth
    this.bodyMesh.material = suitMat;
    this.bodyMesh.position.set(0, 1.16, 0);
    this.bodyMesh.parent = this.rootNode;

    // Sculpted Deltoid Shoulders
    const shoulderL = MeshBuilder.CreateSphere("skierShoulderL", { diameter: 0.17, segments: 16 }, this.scene);
    shoulderL.material = suitMat;
    shoulderL.position.set(-0.23, 0.16, 0);
    shoulderL.parent = this.bodyMesh;

    const shoulderR = MeshBuilder.CreateSphere("skierShoulderR", { diameter: 0.17, segments: 16 }, this.scene);
    shoulderR.material = suitMat;
    shoulderR.position.set(0.23, 0.16, 0);
    shoulderR.parent = this.bodyMesh;

    // Tapered Athletic Waist & Abdomen
    const waistMesh = MeshBuilder.CreateCylinder(
      "skierWaist",
      { height: 0.34, diameterTop: 0.36, diameterBottom: 0.32, tessellation: 24 },
      this.scene
    );
    waistMesh.scaling.z = 0.74;
    waistMesh.material = suitMat;
    waistMesh.position.set(0, -0.34, 0);
    waistMesh.parent = this.bodyMesh;

    // High Wind Cowl / Neck Collar
    this.collarMesh = MeshBuilder.CreateCylinder("skierCollar", { height: 0.12, diameter: 0.22, tessellation: 20 }, this.scene);
    this.collarMesh.material = blackPanelMat;
    this.collarMesh.position.set(0, 0.26, 0);
    this.collarMesh.parent = this.bodyMesh;

    // Aerodynamic Stretch Flanks (Black contrast compression panels)
    const flankL = MeshBuilder.CreateCylinder("skierFlankL", { height: 0.48, diameter: 0.12, tessellation: 16 }, this.scene);
    flankL.scaling.set(0.4, 1.0, 1.4);
    flankL.material = blackPanelMat;
    flankL.position.set(-0.21, -0.04, 0);
    flankL.parent = this.bodyMesh;

    const flankR = MeshBuilder.CreateCylinder("skierFlankR", { height: 0.48, diameter: 0.12, tessellation: 16 }, this.scene);
    flankR.scaling.set(0.4, 1.0, 1.4);
    flankR.material = blackPanelMat;
    flankR.position.set(0.21, -0.04, 0);
    flankR.parent = this.bodyMesh;

    // Racing Center Stripe (Front)
    const raceStripe = MeshBuilder.CreateBox("skierRaceStripe", { width: 0.04, height: 0.46, depth: 0.02 }, this.scene);
    raceStripe.material = redAccentMat;
    raceStripe.position.set(0, 0, -0.165);
    raceStripe.parent = this.bodyMesh;

    // Tactical Utility Belt & Alloy Buckle
    this.beltMesh = MeshBuilder.CreateCylinder("skierBelt", { height: 0.07, diameter: 0.35, tessellation: 24 }, this.scene);
    this.beltMesh.scaling.z = 0.76;
    this.beltMesh.material = blackPanelMat;
    this.beltMesh.position.set(0, -0.48, 0);
    this.beltMesh.parent = this.bodyMesh;

    const beltBuckle = MeshBuilder.CreateBox("skierBeltBuckle", { width: 0.08, height: 0.05, depth: 0.04 }, this.scene);
    beltBuckle.material = metalEdgeMat;
    beltBuckle.position.set(0, -0.48, -0.14);
    beltBuckle.parent = this.bodyMesh;

    // 2. Streamlined Low-Profile Alpine Pack (Mounted Flush on Back)
    this.backpackMesh = MeshBuilder.CreateCylinder("skierBackpack", { height: 0.42, diameterTop: 0.24, diameterBottom: 0.18, tessellation: 20 }, this.scene);
    this.backpackMesh.scaling.z = 0.60;
    this.backpackMesh.material = backpackMat;
    this.backpackMesh.position.set(0, -0.02, 0.18);
    this.backpackMesh.parent = this.bodyMesh;

    // Diagonal Rifle Scabbard Sheath Across Pack
    const scabbard = MeshBuilder.CreateCylinder("skierScabbard", { height: 0.58, diameter: 0.07, tessellation: 16 }, this.scene);
    scabbard.material = blackPanelMat;
    scabbard.position.set(0.04, 0.04, 0.09);
    scabbard.rotation.z = -0.45;
    scabbard.parent = this.backpackMesh;

    // 3. Head, Helmet & Mirrored Goggles
    this.headMesh = MeshBuilder.CreateSphere("skierHead", { diameter: 0.36, segments: 24 }, this.scene);
    this.headMesh.scaling.set(1.0, 1.05, 1.14); // Aerodynamic teardrop elongation
    this.headMesh.material = helmetMat;
    this.headMesh.position.set(0, 1.54, 0.02);
    this.headMesh.parent = this.rootNode;

    // Curved Panoramic Mirror Snow Goggles
    this.helmetVisor = MeshBuilder.CreateCylinder("skierVisor", { height: 0.11, diameter: 0.375, arc: 0.52, tessellation: 24 }, this.scene);
    this.helmetVisor.material = visorMat;
    this.helmetVisor.rotation.y = Math.PI * 0.74;
    this.helmetVisor.position.set(0, 0.02, 0.01);
    this.helmetVisor.parent = this.headMesh;

    const goggleStrap = MeshBuilder.CreateCylinder("skierGoggleStrap", { height: 0.045, diameter: 0.368, tessellation: 24 }, this.scene);
    goggleStrap.material = blackPanelMat;
    goggleStrap.position.set(0, 0.02, 0);
    goggleStrap.parent = this.headMesh;

    // Tactical Face Gaiter / Balaclava under visor
    const gaiter = MeshBuilder.CreateCylinder("skierGaiter", { height: 0.13, diameterTop: 0.24, diameterBottom: 0.22, tessellation: 20 }, this.scene);
    gaiter.material = gaiterMat;
    gaiter.position.set(0, -0.11, -0.02);
    gaiter.parent = this.headMesh;

    // 4. Articulated Legs, Knee Protectors & Molded Alpine Ski Boots
    // Left Leg (Athletic downhill forward cant)
    this.leftLeg = MeshBuilder.CreateCylinder(
      "skierLeftLeg",
      { height: 0.50, diameterTop: 0.20, diameterBottom: 0.15, tessellation: 20 },
      this.scene
    );
    this.leftLeg.material = suitMat;
    this.leftLeg.position.set(-0.15, 0.58, 0.01);
    this.leftLeg.rotation.x = -0.24;
    this.leftLeg.parent = this.rootNode;

    const leftKnee = MeshBuilder.CreateSphere("skierLeftKnee", { diameter: 0.15, segments: 16 }, this.scene);
    leftKnee.scaling.z = 0.75;
    leftKnee.material = blackPanelMat;
    leftKnee.position.set(0, -0.24, 0.02);
    leftKnee.parent = this.leftLeg;

    this.leftShin = MeshBuilder.CreateCylinder(
      "skierLeftShin",
      { height: 0.44, diameterTop: 0.14, diameterBottom: 0.11, tessellation: 20 },
      this.scene
    );
    this.leftShin.material = suitMat;
    this.leftShin.position.set(0, -0.22, 0.03);
    this.leftShin.rotation.x = -0.14;
    this.leftShin.parent = leftKnee;

    // Left Molded Alpine Racing Boot
    this.leftBoot = MeshBuilder.CreateBox("skierLeftBoot", { width: 0.13, height: 0.14, depth: 0.30 }, this.scene);
    this.leftBoot.material = bootMat;
    this.leftBoot.position.set(0, -0.22, 0.02);
    this.leftBoot.parent = this.leftShin;

    const leftBootCuff = MeshBuilder.CreateCylinder("skierLeftBootCuff", { height: 0.16, diameter: 0.14, tessellation: 18 }, this.scene);
    leftBootCuff.material = bootMat;
    leftBootCuff.rotation.x = -0.26;
    leftBootCuff.position.set(0, 0.06, -0.02);
    leftBootCuff.parent = this.leftBoot;

    const leftBuckle1 = MeshBuilder.CreateBox("skierLeftBuckle1", { width: 0.14, height: 0.02, depth: 0.06 }, this.scene);
    leftBuckle1.material = metalEdgeMat;
    leftBuckle1.position.set(0, 0.08, -0.06);
    leftBuckle1.parent = this.leftBoot;

    const leftBuckle2 = MeshBuilder.CreateBox("skierLeftBuckle2", { width: 0.14, height: 0.02, depth: 0.06 }, this.scene);
    leftBuckle2.material = metalEdgeMat;
    leftBuckle2.position.set(0, 0.02, -0.07);
    leftBuckle2.parent = this.leftBoot;

    // Right Leg (Athletic downhill forward cant)
    this.rightLeg = MeshBuilder.CreateCylinder(
      "skierRightLeg",
      { height: 0.50, diameterTop: 0.20, diameterBottom: 0.15, tessellation: 20 },
      this.scene
    );
    this.rightLeg.material = suitMat;
    this.rightLeg.position.set(0.15, 0.58, 0.01);
    this.rightLeg.rotation.x = -0.24;
    this.rightLeg.parent = this.rootNode;

    const rightKnee = MeshBuilder.CreateSphere("skierRightKnee", { diameter: 0.15, segments: 16 }, this.scene);
    rightKnee.scaling.z = 0.75;
    rightKnee.material = blackPanelMat;
    rightKnee.position.set(0, -0.24, 0.02);
    rightKnee.parent = this.rightLeg;

    this.rightShin = MeshBuilder.CreateCylinder(
      "skierRightShin",
      { height: 0.44, diameterTop: 0.14, diameterBottom: 0.11, tessellation: 20 },
      this.scene
    );
    this.rightShin.material = suitMat;
    this.rightShin.position.set(0, -0.22, 0.03);
    this.rightShin.rotation.x = -0.14;
    this.rightShin.parent = rightKnee;

    // Right Molded Alpine Racing Boot
    this.rightBoot = MeshBuilder.CreateBox("skierRightBoot", { width: 0.13, height: 0.14, depth: 0.30 }, this.scene);
    this.rightBoot.material = bootMat;
    this.rightBoot.position.set(0, -0.22, 0.02);
    this.rightBoot.parent = this.rightShin;

    const rightBootCuff = MeshBuilder.CreateCylinder("skierRightBootCuff", { height: 0.16, diameter: 0.14, tessellation: 18 }, this.scene);
    rightBootCuff.material = bootMat;
    rightBootCuff.rotation.x = -0.26;
    rightBootCuff.position.set(0, 0.06, -0.02);
    rightBootCuff.parent = this.rightBoot;

    const rightBuckle1 = MeshBuilder.CreateBox("skierRightBuckle1", { width: 0.14, height: 0.02, depth: 0.06 }, this.scene);
    rightBuckle1.material = metalEdgeMat;
    rightBuckle1.position.set(0, 0.08, -0.06);
    rightBuckle1.parent = this.rightBoot;

    const rightBuckle2 = MeshBuilder.CreateBox("skierRightBuckle2", { width: 0.14, height: 0.02, depth: 0.06 }, this.scene);
    rightBuckle2.material = metalEdgeMat;
    rightBuckle2.position.set(0, 0.02, -0.07);
    rightBuckle2.parent = this.rightBoot;

    // 5. Arms, Hands & Ski Poles (AUTHENTIC RACING POLE CARRIAGE)
    // Left Arm
    this.leftArm = MeshBuilder.CreateCylinder(
      "skierLeftArm",
      { height: 0.34, diameterTop: 0.12, diameterBottom: 0.10, tessellation: 18 },
      this.scene
    );
    this.leftArm.material = suitMat;
    this.leftArm.position.set(-0.25, 1.20, -0.01);
    this.leftArm.rotation.set(0.35, 0, 0.22);
    this.leftArm.parent = this.rootNode;

    const leftElbow = MeshBuilder.CreateSphere("skierLeftElbow", { diameter: 0.11, segments: 14 }, this.scene);
    leftElbow.material = blackPanelMat;
    leftElbow.position.set(0, -0.17, 0);
    leftElbow.parent = this.leftArm;

    this.leftForearm = MeshBuilder.CreateCylinder(
      "skierLeftForearm",
      { height: 0.32, diameterTop: 0.10, diameterBottom: 0.08, tessellation: 18 },
      this.scene
    );
    this.leftForearm.material = suitMat;
    this.leftForearm.position.set(0, -0.15, 0.03);
    this.leftForearm.rotation.x = -0.75;
    this.leftForearm.parent = leftElbow;

    this.leftGlove = MeshBuilder.CreateSphere("skierLeftGlove", { diameter: 0.11, segments: 14 }, this.scene);
    this.leftGlove.material = blackPanelMat;
    this.leftGlove.position.set(0, -0.16, 0);
    this.leftGlove.parent = this.leftForearm;

    // Left Ski Pole - Shaft angles DOWN and BACKWARD toward the snow!
    this.leftPole = MeshBuilder.CreateCylinder("skierLeftPole", { height: 1.20, diameter: 0.018, tessellation: 12 }, this.scene);
    this.leftPole.material = gunmetalMat;
    this.leftPole.position.set(0, -0.05, 0.10);
    this.leftPole.rotation.set(1.20, 0, 0.15);
    this.leftPole.parent = this.leftGlove;

    const leftBasket = MeshBuilder.CreateCylinder("skierLeftBasket", { height: 0.015, diameter: 0.09, tessellation: 16 }, this.scene);
    leftBasket.material = blackPanelMat;
    leftBasket.position.set(0, -0.50, 0);
    leftBasket.parent = this.leftPole;

    // Right Arm
    this.rightArm = MeshBuilder.CreateCylinder(
      "skierRightArm",
      { height: 0.34, diameterTop: 0.12, diameterBottom: 0.10, tessellation: 18 },
      this.scene
    );
    this.rightArm.material = suitMat;
    this.rightArm.position.set(0.25, 1.20, -0.01);
    this.rightArm.rotation.set(0.35, 0, -0.22);
    this.rightArm.parent = this.rootNode;

    const rightElbow = MeshBuilder.CreateSphere("skierRightElbow", { diameter: 0.11, segments: 14 }, this.scene);
    rightElbow.material = blackPanelMat;
    rightElbow.position.set(0, -0.17, 0);
    rightElbow.parent = this.rightArm;

    this.rightForearm = MeshBuilder.CreateCylinder(
      "skierRightForearm",
      { height: 0.32, diameterTop: 0.10, diameterBottom: 0.08, tessellation: 18 },
      this.scene
    );
    this.rightForearm.material = suitMat;
    this.rightForearm.position.set(0, -0.15, 0.03);
    this.rightForearm.rotation.x = -0.75;
    this.rightForearm.parent = rightElbow;

    this.rightGlove = MeshBuilder.CreateSphere("skierRightGlove", { diameter: 0.11, segments: 14 }, this.scene);
    this.rightGlove.material = blackPanelMat;
    this.rightGlove.position.set(0, -0.16, 0);
    this.rightGlove.parent = this.rightForearm;

    // Right Ski Pole - Shaft angles DOWN and BACKWARD toward the snow!
    this.rightPole = MeshBuilder.CreateCylinder("skierRightPole", { height: 1.20, diameter: 0.018, tessellation: 12 }, this.scene);
    this.rightPole.material = gunmetalMat;
    this.rightPole.position.set(0, -0.05, 0.10);
    this.rightPole.rotation.set(1.20, 0, -0.15);
    this.rightPole.parent = this.rightGlove;

    const rightBasket = MeshBuilder.CreateCylinder("skierRightBasket", { height: 0.015, diameter: 0.09, tessellation: 16 }, this.scene);
    rightBasket.material = blackPanelMat;
    rightBasket.position.set(0, -0.50, 0);
    rightBasket.parent = this.rightPole;

    // ==========================================
    // ALWAYS-VISIBLE TACTICAL HARPOON RIFLE
    // ==========================================
    this.rifleRoot = new Mesh("skierRifleRoot", this.scene);
    this.rifleRoot.parent = this.rootNode;
    // Slung diagonally across backpack scabbard over right shoulder
    this.rifleRoot.position.set(0.14, 1.26, 0.26);
    this.rifleRoot.rotation.set(0.25, 0.35, 0.85);

    // Receiver & Stock
    const rifleBody = MeshBuilder.CreateBox("skierRifleBody", { width: 0.06, height: 0.11, depth: 0.82 }, this.scene);
    rifleBody.material = gunmetalMat;
    rifleBody.parent = this.rifleRoot;

    // Picatinny Top Rail
    const rail = MeshBuilder.CreateBox("skierRifleRail", { width: 0.04, height: 0.02, depth: 0.60 }, this.scene);
    rail.material = blackPanelMat;
    rail.position.set(0, 0.065, -0.08);
    rail.parent = this.rifleRoot;

    // Fluted Precision Barrel
    const rifleBarrel = MeshBuilder.CreateCylinder("skierRifleBarrel", { height: 0.68, diameter: 0.032, tessellation: 16 }, this.scene);
    rifleBarrel.material = gunmetalMat;
    rifleBarrel.rotation.x = Math.PI / 2;
    rifleBarrel.position.set(0, 0.02, -0.64);
    rifleBarrel.parent = this.rifleRoot;

    // Tactical Muzzle Brake
    const muzzleBrake = MeshBuilder.CreateCylinder("skierMuzzleBrake", { height: 0.08, diameter: 0.046, tessellation: 16 }, this.scene);
    muzzleBrake.material = blackPanelMat;
    muzzleBrake.rotation.x = Math.PI / 2;
    muzzleBrake.position.set(0, 0.02, -1.00);
    muzzleBrake.parent = this.rifleRoot;

    // High-Power Optical Scope
    const rifleScope = MeshBuilder.CreateCylinder("skierRifleScope", { height: 0.34, diameter: 0.046, tessellation: 16 }, this.scene);
    rifleScope.material = blackPanelMat;
    rifleScope.rotation.x = Math.PI / 2;
    rifleScope.position.set(0, 0.11, -0.14);
    rifleScope.parent = this.rifleRoot;

    const lensFront = MeshBuilder.CreateDisc("skierLensFront", { radius: 0.021, tessellation: 16 }, this.scene);
    lensFront.material = lensMat;
    lensFront.position.set(0, 0.11, -0.31);
    lensFront.parent = this.rifleRoot;

    const lensRear = MeshBuilder.CreateDisc("skierLensRear", { radius: 0.021, tessellation: 16 }, this.scene);
    lensRear.material = lensMat;
    lensRear.rotation.y = Math.PI;
    lensRear.position.set(0, 0.11, 0.03);
    lensRear.parent = this.rifleRoot;

    // Cable Drum Spool
    const spool = MeshBuilder.CreateCylinder("skierRifleSpool", { height: 0.10, diameter: 0.11, tessellation: 16 }, this.scene);
    spool.material = redAccentMat;
    spool.position.set(0, -0.07, -0.04);
    spool.parent = this.rifleRoot;

    // Harpoon Projectile Tip (Loaded in front muzzle)
    const harpoonTip = MeshBuilder.CreateCylinder("skierHarpoonTip", { height: 0.15, diameterTop: 0.004, diameterBottom: 0.028, tessellation: 12 }, this.scene);
    harpoonTip.material = metalEdgeMat;
    harpoonTip.rotation.x = Math.PI / 2;
    harpoonTip.position.set(0, 0.02, -1.09);
    harpoonTip.parent = this.rifleRoot;

    this.rifleRoot.setEnabled(true);

    // ==========================================
    // HIGH-PERFORMANCE RACING DOWNHILL SKIS
    // ==========================================
    const skiWidth = 0.14;
    const skiLength = 2.10;
    const skiSeparation = 0.24;

    // Left Ski (Continuous, Seamless Rockered Construction)
    this.leftSki = MeshBuilder.CreateBox("skierLeftSki", { width: skiWidth, height: 0.028, depth: skiLength }, this.scene);
    this.leftSki.material = skiMat;
    this.leftSki.position.set(-skiSeparation, 0.015, 0);
    this.leftSki.parent = this.rootNode;

    const leftEdgeL = MeshBuilder.CreateBox("skierLeftEdgeL", { width: 0.008, height: 0.026, depth: skiLength }, this.scene);
    leftEdgeL.material = metalEdgeMat;
    leftEdgeL.position.set(-skiWidth / 2 + 0.004, 0, 0);
    leftEdgeL.parent = this.leftSki;

    const leftEdgeR = MeshBuilder.CreateBox("skierLeftEdgeR", { width: 0.008, height: 0.026, depth: skiLength }, this.scene);
    leftEdgeR.material = metalEdgeMat;
    leftEdgeR.position.set(skiWidth / 2 - 0.004, 0, 0);
    leftEdgeR.parent = this.leftSki;

    // Left Ski Rockered Tip Scoop (Seamlessly connected, NO floating gaps!)
    this.leftTip = MeshBuilder.CreateBox("skierLeftTip", { width: skiWidth, height: 0.026, depth: 0.28 }, this.scene);
    this.leftTip.material = redAccentMat;
    this.leftTip.position.set(0, 0.045, -skiLength / 2 + 0.12);
    this.leftTip.rotation.x = -0.42;
    this.leftTip.parent = this.leftSki;

    const leftToeClamp = MeshBuilder.CreateBox("skierLeftToeClamp", { width: 0.10, height: 0.06, depth: 0.12 }, this.scene);
    leftToeClamp.material = blackPanelMat;
    leftToeClamp.position.set(0, 0.035, -0.15);
    leftToeClamp.parent = this.leftSki;

    const leftHeelUnit = MeshBuilder.CreateCylinder("skierLeftHeelUnit", { height: 0.07, diameter: 0.10, tessellation: 16 }, this.scene);
    leftHeelUnit.material = blackPanelMat;
    leftHeelUnit.position.set(0, 0.040, 0.15);
    leftHeelUnit.parent = this.leftSki;

    // Right Ski (Continuous, Seamless Rockered Construction)
    this.rightSki = MeshBuilder.CreateBox("skierRightSki", { width: skiWidth, height: 0.028, depth: skiLength }, this.scene);
    this.rightSki.material = skiMat;
    this.rightSki.position.set(skiSeparation, 0.015, 0);
    this.rightSki.parent = this.rootNode;

    const rightEdgeL = MeshBuilder.CreateBox("skierRightEdgeL", { width: 0.008, height: 0.026, depth: skiLength }, this.scene);
    rightEdgeL.material = metalEdgeMat;
    rightEdgeL.position.set(-skiWidth / 2 + 0.004, 0, 0);
    rightEdgeL.parent = this.rightSki;

    const rightEdgeR = MeshBuilder.CreateBox("skierRightEdgeR", { width: 0.008, height: 0.026, depth: skiLength }, this.scene);
    rightEdgeR.material = metalEdgeMat;
    rightEdgeR.position.set(skiWidth / 2 - 0.004, 0, 0);
    rightEdgeR.parent = this.rightSki;

    // Right Ski Rockered Tip Scoop (Seamlessly connected, NO floating gaps!)
    this.rightTip = MeshBuilder.CreateBox("skierRightTip", { width: skiWidth, height: 0.026, depth: 0.28 }, this.scene);
    this.rightTip.material = redAccentMat;
    this.rightTip.position.set(0, 0.045, -skiLength / 2 + 0.12);
    this.rightTip.rotation.x = -0.42;
    this.rightTip.parent = this.rightSki;

    const rightToeClamp = MeshBuilder.CreateBox("skierRightToeClamp", { width: 0.10, height: 0.06, depth: 0.12 }, this.scene);
    rightToeClamp.material = blackPanelMat;
    rightToeClamp.position.set(0, 0.035, -0.15);
    rightToeClamp.parent = this.rightSki;

    const rightHeelUnit = MeshBuilder.CreateCylinder("skierRightHeelUnit", { height: 0.07, diameter: 0.10, tessellation: 16 }, this.scene);
    rightHeelUnit.material = blackPanelMat;
    rightHeelUnit.position.set(0, 0.040, 0.15);
    rightHeelUnit.parent = this.rightSki;

    // ==========================================
    // VOLUMETRIC POWDER SNOW SPRAY PARTICLES
    // ==========================================
    this.initPowderParticles();
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

    this.leftSpray = new ParticleSystem("skierLeftSpray", 140, this.scene);
    this.leftSpray.particleTexture = this.powderTexture;
    this.leftSpray.blendMode = ParticleSystem.BLENDMODE_STANDARD;
    this.leftSpray.emitter = this.leftSki;
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

    this.rightSpray = new ParticleSystem("skierRightSpray", 140, this.scene);
    this.rightSpray.particleTexture = this.powderTexture;
    this.rightSpray.blendMode = ParticleSystem.BLENDMODE_STANDARD;
    this.rightSpray.emitter = this.rightSki;
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

      // Right arm raised in triumphant downhill pole salute!
      this.rightArm.rotation.set(-1.80, 0.20, -0.40);
      this.rightForearm.rotation.x = 0.20;
      this.rightPole.setEnabled(true);
      this.leftPole.setEnabled(true);

      // Left arm out for balance
      this.leftArm.rotation.set(-0.35, 0, 0.45);
      this.leftForearm.rotation.x = 0.50;

      // Harpoon remains slung on back
      this.targetRiflePos.set(0.14, 1.26, 0.26);
      this.targetRifleRot.set(0.25, 0.35, 0.85);
      this.lerpRifleTransform(deltaTime);
      return;
    }

    // 3. Dynamic Carving Body Banking & Ski Edge Bite
    const targetBank = -steerInput * 0.40; // Lean up to ~23 degrees into turn
    this.currentBank = Scalar.Lerp(this.currentBank, targetBank, Math.min(1.0, deltaTime * 12.0));
    this.rootNode.rotation.z = this.currentBank;
    this.rootNode.rotation.y = -steerInput * 0.24; // Yaw skis smoothly into downhill turn

    // Both skis roll onto their edges into the carving direction
    const edgeRoll = -steerInput * 0.16;
    this.leftSki.rotation.z = edgeRoll;
    this.rightSki.rotation.z = edgeRoll;

    // 4. High-Speed Chatter & Mogul Vibration
    this.chatterCycle += deltaTime * 35.0;
    const speedRatio = Math.min(1.5, speedMph / 45.0);
    const tipVibration = speedMph > 28 ? Math.sin(this.chatterCycle) * 0.015 * speedRatio : 0;
    this.leftTip.rotation.x = -0.42 + tipVibration;
    this.rightTip.rotation.x = -0.42 - tipVibration;

    // 5. Downhill Aerodynamic Tuck Squat
    const targetSquat = isTucking ? 0.28 : 0.0;
    this.currentSquat = Scalar.Lerp(this.currentSquat, targetSquat, Math.min(1.0, deltaTime * 10.0));

    this.bodyMesh.position.y = 1.16 - this.currentSquat;
    this.bodyMesh.rotation.x = isTucking ? 0.38 : 0.05;
    this.headMesh.position.y = 1.54 - this.currentSquat * 1.15;
    this.headMesh.position.z = isTucking ? -0.12 : 0.02;

    // Knee flex in tuck
    this.leftLeg.rotation.x = -0.24 - this.currentSquat * 0.35;
    this.rightLeg.rotation.x = -0.24 - this.currentSquat * 0.35;

    // 6. HARPOON STANCE: Cruising Slung vs Combat Aiming / Tethered
    this.isAimingGun = isTethered || isAiming;
    if (this.isAimingGun) {
      // Wielded Firing Stance: Harpoon brought forward into two hands
      this.targetRiflePos.set(0.16, 1.16, -0.40);
      this.targetRifleRot.set(0.08, 0, 0);

      // Hide cruising poles when gripping harpoon
      this.leftPole.setEnabled(false);
      this.rightPole.setEnabled(false);

      // Two-handed scoped rifle grip: Left arm supports barrel rail, Right arm on trigger/stock
      this.leftArm.rotation.set(-0.65, 0.35, 0.40);
      this.leftForearm.rotation.x = 0.80;
      this.rightArm.rotation.set(-0.72, -0.25, -0.35);
      this.rightForearm.rotation.x = 0.65;
    } else {
      // Cruising Downhill Stance: Harpoon slung diagonally across backpack over right shoulder
      this.targetRiflePos.set(0.14, 1.26, 0.26);
      this.targetRifleRot.set(0.25, 0.35, 0.85);

      this.leftPole.setEnabled(true);
      this.rightPole.setEnabled(true);

      if (isTucking) {
        // Pin arms back aerodynamically against ribs, poles flat under armpits
        this.leftArm.rotation.set(0.60, 0, 0.30);
        this.leftForearm.rotation.x = 0.15;
        this.leftPole.rotation.set(0.40, 0, 0.08);

        this.rightArm.rotation.set(0.60, 0, -0.30);
        this.rightForearm.rotation.x = 0.15;
        this.rightPole.rotation.set(0.40, 0, -0.08);
      } else {
        // Authentic downhill racing pole carriage: hands at waist height, shafts down and back toward snow
        this.leftArm.rotation.set(0.35, 0, 0.22);
        this.leftForearm.rotation.x = -0.75;
        this.leftPole.rotation.set(1.20, 0, 0.15);

        this.rightArm.rotation.set(0.35, 0, -0.22);
        this.rightForearm.rotation.x = -0.75;
        this.rightPole.rotation.set(1.20, 0, -0.15);
      }
    }

    // Smooth lerp between holstered and wielded weapon positions
    this.lerpRifleTransform(deltaTime);

    // 7. Snowplow Wedge Braking
    const targetPlow = isBraking ? 0.25 : 0.0;
    this.currentPlow = Scalar.Lerp(this.currentPlow, targetPlow, Math.min(1.0, deltaTime * 14.0));
    this.leftSki.rotation.y = this.currentPlow;
    this.rightSki.rotation.y = -this.currentPlow;

    // 8. Powder Snow Rooster Tail Particle Dynamics
    const sprayRate = speedMph > 8 ? Math.min(140, Math.floor(speedMph * 2.8)) : 0;
    if (this.leftSpray) {
      this.leftSpray.emitRate = Math.abs(steerInput) > 0.1 || isBraking ? sprayRate * 1.5 : sprayRate;
    }
    if (this.rightSpray) {
      this.rightSpray.emitRate = Math.abs(steerInput) > 0.1 || isBraking ? sprayRate * 1.5 : sprayRate;
    }
  }

  private lerpRifleTransform(deltaTime: number): void {
    const lerpSpeed = 12.0;
    this.currentRiflePos.x = Scalar.Lerp(this.currentRiflePos.x, this.targetRiflePos.x, Math.min(1.0, deltaTime * lerpSpeed));
    this.currentRiflePos.y = Scalar.Lerp(this.currentRiflePos.y, this.targetRiflePos.y, Math.min(1.0, deltaTime * lerpSpeed));
    this.currentRiflePos.z = Scalar.Lerp(this.currentRiflePos.z, this.targetRiflePos.z, Math.min(1.0, deltaTime * lerpSpeed));
    this.rifleRoot.position.copyFrom(this.currentRiflePos);

    this.currentRifleRot.x = Scalar.Lerp(this.currentRifleRot.x, this.targetRifleRot.x, Math.min(1.0, deltaTime * lerpSpeed));
    this.currentRifleRot.y = Scalar.Lerp(this.currentRifleRot.y, this.targetRifleRot.y, Math.min(1.0, deltaTime * lerpSpeed));
    this.currentRifleRot.z = Scalar.Lerp(this.currentRifleRot.z, this.targetRifleRot.z, Math.min(1.0, deltaTime * lerpSpeed));
    this.rifleRoot.rotation.copyFrom(this.currentRifleRot);
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
    this.rootNode.rotation.set(0, 0, 0);
  }

  public getTowlineAnchorWorldPosition(): Vector3 {
    // Connects directly to the harpoon muzzle / cable drum in front of the skier
    return new Vector3(
      this.rootNode.position.x + 0.16,
      this.rootNode.position.y + 1.22,
      this.rootNode.position.z - 1.05
    );
  }

  public resetCombatState(): void {
    this.isAimingGun = false;
    this.isCutsceneVictory = false;
    this.targetRiflePos.set(0.14, 1.26, 0.26);
    this.targetRifleRot.set(0.25, 0.35, 0.85);
    this.currentRiflePos.set(0.14, 1.26, 0.26);
    this.currentRifleRot.set(0.25, 0.35, 0.85);
    this.rifleRoot.position.set(0.14, 1.26, 0.26);
    this.rifleRoot.rotation.set(0.25, 0.35, 0.85);
    this.leftPole.setEnabled(true);
    this.rightPole.setEnabled(true);
  }
}
