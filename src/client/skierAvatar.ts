/**
 * SkierAvatar.ts
 * High-Fidelity Procedural 3D Skier Character Avatar matching "thats_the_best_video_you_have.mp4":
 * - Authentic Alpine Gold / Mustard Yellow tactical racing suit with micro-contrast.
 * - Tactical black contrast panels (shoulders, underarm torso, knee pads, elbow pads).
 * - Composite tactical shoulder armor epaulets & utility waist belt.
 * - Molded alpine ski boots with forward lean & metallic alloy micro-buckles.
 * - Heavy-duty step-in downhill bindings (toe clamp, heel housing, lateral brake arms).
 * - Dual carbon racing skis with metal edges, red tips, and rear twin-tip tail flares.
 * - Rugged black tactical expedition backpack with dual front chest harness & compression straps.
 * - Matte aerodynamic ski racing helmet with rear spoiler and dark polarized snow goggles.
 * - Tactical Scoped Harpoon Rifle (fluted barrel, elevated scope with lens glint, cable drum spool).
 * - Dual graphite ski poles with snow baskets and wrist loops.
 * - Dynamic procedural animations (carving bank, ski edge bite, aerodynamic tuck, snowplow brake, high-speed tip chatter).
 * - Dual ski-tail powder snow rooster tail particle emitters.
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
  Texture
} from "@babylonjs/core";

export class SkierAvatar {
  private scene: Scene;
  public rootNode: Mesh;

  // Body Anatomy
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
  private leftLeg: Mesh;
  private rightLeg: Mesh;
  private leftBoot: Mesh;
  private rightBoot: Mesh;
  private leftPole: Mesh;
  private rightPole: Mesh;
  private leftSki: Mesh;
  private rightSki: Mesh;
  private leftTip: Mesh;
  private rightTip: Mesh;
  private rifleRoot: Mesh;

  // Particle Spray
  private leftSpray: ParticleSystem | null = null;
  private rightSpray: ParticleSystem | null = null;

  // Animation & Kinematics State
  private currentBank: number = 0;
  private currentSquat: number = 0;
  private currentPlow: number = 0;
  private chatterCycle: number = 0;
  public isVisible: boolean = true;
  public isAimingGun: boolean = false;
  public isWipeout: boolean = false;
  private wipeoutTimer: number = 0;

  constructor(scene: Scene) {
    this.scene = scene;
    this.rootNode = new Mesh("skierAvatarRoot", this.scene);

    // ==========================================
    // AUTHENTIC MATERIALS FROM VIDEO
    // ==========================================

    // 1. Alpine Gold / Mustard Yellow Suit Material
    const suitMat = new StandardMaterial("skierSuitGoldMat", this.scene);
    suitMat.diffuseColor = new Color3(0.88, 0.65, 0.12);
    suitMat.specularColor = new Color3(0.35, 0.30, 0.18);
    suitMat.emissiveColor = new Color3(0.12, 0.08, 0.02);
    suitMat.roughness = 0.45;

    // 2. Tactical Contrast Black Panels (Shoulders, Knee Pads, Underarms, Elbows)
    const blackPanelMat = new StandardMaterial("skierBlackPanelMat", this.scene);
    blackPanelMat.diffuseColor = new Color3(0.10, 0.10, 0.12);
    blackPanelMat.specularColor = new Color3(0.25, 0.25, 0.28);
    blackPanelMat.roughness = 0.5;

    // 3. Tactical Backpack Material (Rugged Cordura Black)
    const backpackMat = new StandardMaterial("skierBackpackMat", this.scene);
    backpackMat.diffuseColor = new Color3(0.08, 0.08, 0.10);
    backpackMat.specularColor = new Color3(0.15, 0.15, 0.15);
    backpackMat.roughness = 0.75;

    // 4. Matte Black Aerodynamic Racing Helmet
    const helmetMat = new StandardMaterial("skierHelmetMat", this.scene);
    helmetMat.diffuseColor = new Color3(0.06, 0.07, 0.09);
    helmetMat.specularColor = new Color3(0.60, 0.60, 0.65);
    helmetMat.roughness = 0.25;

    // 5. Dark Polarized Visor with Mirror Sun Glint
    const visorMat = new StandardMaterial("skierVisorMat", this.scene);
    visorMat.diffuseColor = new Color3(0.03, 0.03, 0.04);
    visorMat.specularColor = new Color3(0.95, 0.98, 1.0);
    visorMat.specularPower = 128; // Piercing specular highlight

    // 6. Carbon Downhill Ski Material
    const skiMat = new StandardMaterial("skierSkiMat", this.scene);
    skiMat.diffuseColor = new Color3(0.08, 0.09, 0.11);
    skiMat.specularColor = new Color3(0.70, 0.70, 0.80);
    skiMat.roughness = 0.2;

    // 7. Polished Metal Ski Edge & Binding Material
    const metalEdgeMat = new StandardMaterial("skierMetalEdgeMat", this.scene);
    metalEdgeMat.diffuseColor = new Color3(0.75, 0.78, 0.82);
    metalEdgeMat.specularColor = new Color3(0.95, 0.95, 1.0);

    // 8. Racing Red Accent Material
    const redAccentMat = new StandardMaterial("skierRedAccentMat", this.scene);
    redAccentMat.diffuseColor = new Color3(0.88, 0.12, 0.14);
    redAccentMat.specularColor = new Color3(0.5, 0.5, 0.5);

    // 9. Gunmetal Material (Poles & Scoped Rifle)
    const gunmetalMat = new StandardMaterial("skierGunmetalMat", this.scene);
    gunmetalMat.diffuseColor = new Color3(0.20, 0.22, 0.24);
    gunmetalMat.specularColor = new Color3(0.85, 0.90, 0.95);

    // 10. Molded Alpine Ski Boot Material
    const bootMat = new StandardMaterial("skierBootMat", this.scene);
    bootMat.diffuseColor = new Color3(0.14, 0.14, 0.16);
    bootMat.specularColor = new Color3(0.40, 0.40, 0.45);
    bootMat.roughness = 0.4;

    // 11. Optical Scope Glass Lens Material
    const lensMat = new StandardMaterial("skierScopeLensMat", this.scene);
    lensMat.diffuseColor = new Color3(0.05, 0.20, 0.35);
    lensMat.specularColor = new Color3(0.95, 1.0, 1.0);
    lensMat.specularPower = 128;

    // ==========================================
    // MESH HIERARCHY & DETAILED SKELETAL ANATOMY
    // ==========================================

    // 1. Torso / Body (Alpine Gold Jacket)
    this.bodyMesh = MeshBuilder.CreateBox("skierTorso", { width: 0.66, height: 0.82, depth: 0.42 }, this.scene);
    this.bodyMesh.material = suitMat;
    this.bodyMesh.position.set(0, 1.05, 0);
    this.bodyMesh.parent = this.rootNode;

    // High Wind Cowl / Neck Collar
    this.collarMesh = MeshBuilder.CreateCylinder("skierCollar", { height: 0.14, diameter: 0.38 }, this.scene);
    this.collarMesh.material = blackPanelMat;
    this.collarMesh.position.set(0, 0.45, -0.02);
    this.collarMesh.parent = this.bodyMesh;

    // Torso Side Contrast Panels (Black tactical trim)
    const leftPanel = MeshBuilder.CreateBox("skierTorsoLeftPanel", { width: 0.08, height: 0.78, depth: 0.38 }, this.scene);
    leftPanel.material = blackPanelMat;
    leftPanel.position.set(-0.30, 0, 0);
    leftPanel.parent = this.bodyMesh;

    const rightPanel = MeshBuilder.CreateBox("skierTorsoRightPanel", { width: 0.08, height: 0.78, depth: 0.38 }, this.scene);
    rightPanel.material = blackPanelMat;
    rightPanel.position.set(0.30, 0, 0);
    rightPanel.parent = this.bodyMesh;

    // Tactical Utility Belt & Buckle
    this.beltMesh = MeshBuilder.CreateBox("skierBelt", { width: 0.68, height: 0.10, depth: 0.44 }, this.scene);
    this.beltMesh.material = blackPanelMat;
    this.beltMesh.position.set(0, -0.38, 0);
    this.beltMesh.parent = this.bodyMesh;

    const beltBuckle = MeshBuilder.CreateBox("skierBeltBuckle", { width: 0.12, height: 0.08, depth: 0.46 }, this.scene);
    beltBuckle.material = metalEdgeMat;
    beltBuckle.position.set(0, -0.38, 0);
    beltBuckle.parent = this.bodyMesh;

    // Shoulder Armor Epaulets
    const leftEpaulet = MeshBuilder.CreateBox("skierLeftEpaulet", { width: 0.18, height: 0.08, depth: 0.32 }, this.scene);
    leftEpaulet.material = blackPanelMat;
    leftEpaulet.position.set(-0.36, 0.38, 0);
    leftEpaulet.rotation.z = -0.18;
    leftEpaulet.parent = this.bodyMesh;

    const rightEpaulet = MeshBuilder.CreateBox("skierRightEpaulet", { width: 0.18, height: 0.08, depth: 0.32 }, this.scene);
    rightEpaulet.material = blackPanelMat;
    rightEpaulet.position.set(0.36, 0.38, 0);
    rightEpaulet.rotation.z = 0.18;
    rightEpaulet.parent = this.bodyMesh;

    // 2. Tactical Black Expedition Backpack (Mounted on Back +Z)
    this.backpackMesh = MeshBuilder.CreateBox("skierBackpack", { width: 0.48, height: 0.62, depth: 0.26 }, this.scene);
    this.backpackMesh.material = backpackMat;
    this.backpackMesh.position.set(0, 0.04, 0.26);
    this.backpackMesh.parent = this.bodyMesh;

    // Backpack Top Flap
    const packFlap = MeshBuilder.CreateBox("skierPackFlap", { width: 0.44, height: 0.12, depth: 0.28 }, this.scene);
    packFlap.material = blackPanelMat;
    packFlap.position.set(0, 0.26, 0.02);
    packFlap.parent = this.backpackMesh;

    // Backpack Dual Compression Straps with Buckles
    const strapL = MeshBuilder.CreateBox("skierPackStrapL", { width: 0.04, height: 0.58, depth: 0.28 }, this.scene);
    strapL.material = blackPanelMat;
    strapL.position.set(-0.16, 0, 0.01);
    strapL.parent = this.backpackMesh;

    const buckleL = MeshBuilder.CreateBox("skierPackBuckleL", { width: 0.06, height: 0.04, depth: 0.29 }, this.scene);
    buckleL.material = metalEdgeMat;
    buckleL.position.set(-0.16, 0.08, 0.01);
    buckleL.parent = this.backpackMesh;

    const strapR = MeshBuilder.CreateBox("skierPackStrapR", { width: 0.04, height: 0.58, depth: 0.28 }, this.scene);
    strapR.material = blackPanelMat;
    strapR.position.set(0.16, 0, 0.01);
    strapR.parent = this.backpackMesh;

    const buckleR = MeshBuilder.CreateBox("skierPackBuckleR", { width: 0.06, height: 0.04, depth: 0.29 }, this.scene);
    buckleR.material = metalEdgeMat;
    buckleR.position.set(0.16, 0.08, 0.01);
    buckleR.parent = this.backpackMesh;

    // Chest Sternum Harness Straps (Front of jacket)
    const chestHarness = MeshBuilder.CreateBox("skierChestHarness", { width: 0.38, height: 0.05, depth: 0.43 }, this.scene);
    chestHarness.material = blackPanelMat;
    chestHarness.position.set(0, 0.12, 0);
    chestHarness.parent = this.bodyMesh;

    // 3. Helmet & Head
    this.headMesh = MeshBuilder.CreateSphere("skierHead", { diameter: 0.46, segments: 14 }, this.scene);
    this.headMesh.material = helmetMat;
    this.headMesh.position.set(0, 1.62, 0.02);
    this.headMesh.parent = this.rootNode;

    // Rear Helmet Aerodynamic Spoiler Flare
    const spoiler = MeshBuilder.CreateBox("skierHelmetSpoiler", { width: 0.28, height: 0.12, depth: 0.16 }, this.scene);
    spoiler.material = helmetMat;
    spoiler.position.set(0, 0.08, 0.20);
    spoiler.rotation.x = -0.25;
    spoiler.parent = this.headMesh;

    // Cylindrical Mirrored Visor / Dark Snow Goggles
    this.helmetVisor = MeshBuilder.CreateCylinder("skierVisor", { height: 0.14, diameter: 0.48, arc: 0.45 }, this.scene);
    this.helmetVisor.material = visorMat;
    this.helmetVisor.rotation.y = Math.PI * 0.775;
    this.helmetVisor.position.set(0, 0.02, 0);
    this.helmetVisor.parent = this.headMesh;

    // Goggle Strap
    const strap = MeshBuilder.CreateCylinder("skierGoggleStrap", { height: 0.07, diameter: 0.48 }, this.scene);
    strap.material = blackPanelMat;
    strap.position.set(0, 0.02, 0);
    strap.parent = this.headMesh;

    // 4. Legs, Knee Armor, and Molded Ski Boots
    // Left Leg
    this.leftLeg = MeshBuilder.CreateCylinder("skierLeftLeg", { height: 0.62, diameter: 0.19 }, this.scene);
    this.leftLeg.material = suitMat;
    this.leftLeg.position.set(-0.19, 0.52, -0.02);
    this.leftLeg.rotation.x = -0.14;
    this.leftLeg.parent = this.rootNode;

    const leftKnee = MeshBuilder.CreateBox("skierLeftKnee", { width: 0.17, height: 0.20, depth: 0.12 }, this.scene);
    leftKnee.material = blackPanelMat;
    leftKnee.position.set(0, 0.05, -0.09);
    leftKnee.parent = this.leftLeg;

    // Left Molded Ski Boot (with forward cuff angle & buckles)
    this.leftBoot = MeshBuilder.CreateBox("skierLeftBoot", { width: 0.16, height: 0.24, depth: 0.32 }, this.scene);
    this.leftBoot.material = bootMat;
    this.leftBoot.position.set(0, -0.28, -0.04);
    this.leftBoot.rotation.x = -0.18;
    this.leftBoot.parent = this.leftLeg;

    const leftBootBuckle = MeshBuilder.CreateBox("skierLeftBootBuckle", { width: 0.17, height: 0.04, depth: 0.14 }, this.scene);
    leftBootBuckle.material = metalEdgeMat;
    leftBootBuckle.position.set(0, 0.04, -0.08);
    leftBootBuckle.parent = this.leftBoot;

    // Right Leg
    this.rightLeg = MeshBuilder.CreateCylinder("skierRightLeg", { height: 0.62, diameter: 0.19 }, this.scene);
    this.rightLeg.material = suitMat;
    this.rightLeg.position.set(0.19, 0.52, -0.02);
    this.rightLeg.rotation.x = -0.14;
    this.rightLeg.parent = this.rootNode;

    const rightKnee = MeshBuilder.CreateBox("skierRightKnee", { width: 0.17, height: 0.20, depth: 0.12 }, this.scene);
    rightKnee.material = blackPanelMat;
    rightKnee.position.set(0, 0.05, -0.09);
    rightKnee.parent = this.rightLeg;

    this.rightBoot = MeshBuilder.CreateBox("skierRightBoot", { width: 0.16, height: 0.24, depth: 0.32 }, this.scene);
    this.rightBoot.material = bootMat;
    this.rightBoot.position.set(0, -0.28, -0.04);
    this.rightBoot.rotation.x = -0.18;
    this.rightBoot.parent = this.rightLeg;

    const rightBootBuckle = MeshBuilder.CreateBox("skierRightBootBuckle", { width: 0.17, height: 0.04, depth: 0.14 }, this.scene);
    rightBootBuckle.material = metalEdgeMat;
    rightBootBuckle.position.set(0, 0.04, -0.08);
    rightBootBuckle.parent = this.rightBoot;

    // 5. Arms, Elbow Armor & Ski Poles (Cruising)
    // Left Arm
    this.leftArm = MeshBuilder.CreateCylinder("skierLeftArm", { height: 0.42, diameter: 0.15 }, this.scene);
    this.leftArm.material = suitMat;
    this.leftArm.position.set(-0.46, 1.22, -0.05);
    this.leftArm.rotation.set(-0.25, 0, 0.22);
    this.leftArm.parent = this.rootNode;

    this.leftForearm = MeshBuilder.CreateCylinder("skierLeftForearm", { height: 0.40, diameter: 0.13 }, this.scene);
    this.leftForearm.material = suitMat;
    this.leftForearm.position.set(0, -0.32, 0.08);
    this.leftForearm.rotation.x = 0.45;
    this.leftForearm.parent = this.leftArm;

    const leftElbow = MeshBuilder.CreateBox("skierLeftElbow", { width: 0.14, height: 0.14, depth: 0.09 }, this.scene);
    leftElbow.material = blackPanelMat;
    leftElbow.position.set(0, 0.16, 0.06);
    leftElbow.parent = this.leftForearm;

    const leftGlove = MeshBuilder.CreateSphere("skierLeftGlove", { diameter: 0.15 }, this.scene);
    leftGlove.material = blackPanelMat;
    leftGlove.position.set(0, -0.22, 0);
    leftGlove.parent = this.leftForearm;

    this.leftPole = MeshBuilder.CreateCylinder("skierLeftPole", { height: 1.28, diameter: 0.026 }, this.scene);
    this.leftPole.material = gunmetalMat;
    this.leftPole.position.set(0, -0.25, 0.20);
    this.leftPole.rotation.x = 0.55;
    this.leftPole.parent = leftGlove;

    const leftBasket = MeshBuilder.CreateCylinder("skierLeftBasket", { height: 0.02, diameter: 0.12 }, this.scene);
    leftBasket.material = blackPanelMat;
    leftBasket.position.set(0, -0.48, 0);
    leftBasket.parent = this.leftPole;

    // Right Arm
    this.rightArm = MeshBuilder.CreateCylinder("skierRightArm", { height: 0.42, diameter: 0.15 }, this.scene);
    this.rightArm.material = suitMat;
    this.rightArm.position.set(0.46, 1.22, -0.05);
    this.rightArm.rotation.set(-0.25, 0, -0.22);
    this.rightArm.parent = this.rootNode;

    this.rightForearm = MeshBuilder.CreateCylinder("skierRightForearm", { height: 0.40, diameter: 0.13 }, this.scene);
    this.rightForearm.material = suitMat;
    this.rightForearm.position.set(0, -0.32, 0.08);
    this.rightForearm.rotation.x = 0.45;
    this.rightForearm.parent = this.rightArm;

    const rightElbow = MeshBuilder.CreateBox("skierRightElbow", { width: 0.14, height: 0.14, depth: 0.09 }, this.scene);
    rightElbow.material = blackPanelMat;
    rightElbow.position.set(0, 0.16, 0.06);
    rightElbow.parent = this.rightForearm;

    const rightGlove = MeshBuilder.CreateSphere("skierRightGlove", { diameter: 0.15 }, this.scene);
    rightGlove.material = blackPanelMat;
    rightGlove.position.set(0, -0.22, 0);
    rightGlove.parent = this.rightForearm;

    this.rightPole = MeshBuilder.CreateCylinder("skierRightPole", { height: 1.28, diameter: 0.026 }, this.scene);
    this.rightPole.material = gunmetalMat;
    this.rightPole.position.set(0, -0.25, 0.20);
    this.rightPole.rotation.x = 0.55;
    this.rightPole.parent = rightGlove;

    const rightBasket = MeshBuilder.CreateCylinder("skierRightBasket", { height: 0.02, diameter: 0.12 }, this.scene);
    rightBasket.material = blackPanelMat;
    rightBasket.position.set(0, -0.48, 0);
    rightBasket.parent = this.rightPole;

    // 6. Tactical Scoped Hunting Rifle / Harpoon Gun (Combat Stance)
    this.rifleRoot = new Mesh("skierRifleRoot", this.scene);
    this.rifleRoot.position.set(0.18, 1.15, -0.42);
    this.rifleRoot.rotation.set(0.10, 0, 0);
    this.rifleRoot.parent = this.rootNode;

    // Receiver & Stock
    const rifleBody = MeshBuilder.CreateBox("skierRifleBody", { width: 0.08, height: 0.14, depth: 0.95 }, this.scene);
    rifleBody.material = gunmetalMat;
    rifleBody.parent = this.rifleRoot;

    // Top Picatinny Rail
    const rail = MeshBuilder.CreateBox("skierRifleRail", { width: 0.06, height: 0.03, depth: 0.70 }, this.scene);
    rail.material = blackPanelMat;
    rail.position.set(0, 0.08, -0.10);
    rail.parent = this.rifleRoot;

    // Fluted Precision Barrel
    const rifleBarrel = MeshBuilder.CreateCylinder("skierRifleBarrel", { height: 0.75, diameter: 0.038 }, this.scene);
    rifleBarrel.material = gunmetalMat;
    rifleBarrel.rotation.x = Math.PI / 2;
    rifleBarrel.position.set(0, 0.02, -0.70);
    rifleBarrel.parent = this.rifleRoot;

    // Muzzle Brake
    const muzzleBrake = MeshBuilder.CreateCylinder("skierMuzzleBrake", { height: 0.10, diameter: 0.052 }, this.scene);
    muzzleBrake.material = blackPanelMat;
    muzzleBrake.rotation.x = Math.PI / 2;
    muzzleBrake.position.set(0, 0.02, -1.08);
    muzzleBrake.parent = this.rifleRoot;

    // Tactical High-Power Optical Scope
    const rifleScope = MeshBuilder.CreateCylinder("skierRifleScope", { height: 0.38, diameter: 0.052 }, this.scene);
    rifleScope.material = blackPanelMat;
    rifleScope.rotation.x = Math.PI / 2;
    rifleScope.position.set(0, 0.13, -0.15);
    rifleScope.parent = this.rifleRoot;

    // Scope Objective Lens (front & rear glass glints)
    const lensFront = MeshBuilder.CreateDisc("skierLensFront", { radius: 0.024 }, this.scene);
    lensFront.material = lensMat;
    lensFront.position.set(0, 0.13, -0.34);
    lensFront.parent = this.rifleRoot;

    const lensRear = MeshBuilder.CreateDisc("skierLensRear", { radius: 0.024 }, this.scene);
    lensRear.material = lensMat;
    lensRear.rotation.y = Math.PI;
    lensRear.position.set(0, 0.13, 0.04);
    lensRear.parent = this.rifleRoot;

    // Cable Drum Spool
    const spool = MeshBuilder.CreateCylinder("skierRifleSpool", { height: 0.12, diameter: 0.14 }, this.scene);
    spool.material = redAccentMat;
    spool.position.set(0, -0.09, -0.05);
    spool.parent = this.rifleRoot;

    // Hidden by default when cruising downhill; shown when tethered or aiming
    this.rifleRoot.setEnabled(false);

    // 7. Carbon Downhill Skis with Metallic Edges & Mechanical Bindings
    const skiWidth = 0.16;
    const skiLength = 2.10;
    const skiSeparation = 0.28;

    // Left Ski
    this.leftSki = MeshBuilder.CreateBox("skierLeftSki", { width: skiWidth, height: 0.038, depth: skiLength }, this.scene);
    this.leftSki.material = skiMat;
    this.leftSki.position.set(-skiSeparation, 0.02, 0);
    this.leftSki.parent = this.rootNode;

    // Left Metal Ski Edges
    const leftEdgeL = MeshBuilder.CreateBox("skierLeftEdgeL", { width: 0.012, height: 0.036, depth: skiLength }, this.scene);
    leftEdgeL.material = metalEdgeMat;
    leftEdgeL.position.set(-skiWidth / 2 + 0.006, 0, 0);
    leftEdgeL.parent = this.leftSki;

    const leftEdgeR = MeshBuilder.CreateBox("skierLeftEdgeR", { width: 0.012, height: 0.036, depth: skiLength }, this.scene);
    leftEdgeR.material = metalEdgeMat;
    leftEdgeR.position.set(skiWidth / 2 - 0.006, 0, 0);
    leftEdgeR.parent = this.leftSki;

    // Left Red Racing Tip
    this.leftTip = MeshBuilder.CreateBox("skierLeftTip", { width: skiWidth, height: 0.038, depth: 0.32 }, this.scene);
    this.leftTip.material = redAccentMat;
    this.leftTip.position.set(0, 0.06, -skiLength / 2 - 0.12);
    this.leftTip.rotation.x = -0.38;
    this.leftTip.parent = this.leftSki;

    // Left Step-In Ski Binding (Toe clamp + heel unit)
    const leftToeClamp = MeshBuilder.CreateBox("skierLeftToeClamp", { width: 0.13, height: 0.08, depth: 0.12 }, this.scene);
    leftToeClamp.material = metalEdgeMat;
    leftToeClamp.position.set(0, 0.05, -0.16);
    leftToeClamp.parent = this.leftSki;

    const leftHeelUnit = MeshBuilder.CreateBox("skierLeftHeelUnit", { width: 0.13, height: 0.09, depth: 0.16 }, this.scene);
    leftHeelUnit.material = blackPanelMat;
    leftHeelUnit.position.set(0, 0.06, 0.14);
    leftHeelUnit.parent = this.leftSki;

    // Right Ski
    this.rightSki = MeshBuilder.CreateBox("skierRightSki", { width: skiWidth, height: 0.038, depth: skiLength }, this.scene);
    this.rightSki.material = skiMat;
    this.rightSki.position.set(skiSeparation, 0.02, 0);
    this.rightSki.parent = this.rootNode;

    const rightEdgeL = MeshBuilder.CreateBox("skierRightEdgeL", { width: 0.012, height: 0.036, depth: skiLength }, this.scene);
    rightEdgeL.material = metalEdgeMat;
    rightEdgeL.position.set(-skiWidth / 2 + 0.006, 0, 0);
    rightEdgeL.parent = this.rightSki;

    const rightEdgeR = MeshBuilder.CreateBox("skierRightEdgeR", { width: 0.012, height: 0.036, depth: skiLength }, this.scene);
    rightEdgeR.material = metalEdgeMat;
    rightEdgeR.position.set(skiWidth / 2 - 0.006, 0, 0);
    rightEdgeR.parent = this.rightSki;

    this.rightTip = MeshBuilder.CreateBox("skierRightTip", { width: skiWidth, height: 0.038, depth: 0.32 }, this.scene);
    this.rightTip.material = redAccentMat;
    this.rightTip.position.set(0, 0.06, -skiLength / 2 - 0.12);
    this.rightTip.rotation.x = -0.38;
    this.rightTip.parent = this.rightSki;

    const rightToeClamp = MeshBuilder.CreateBox("skierRightToeClamp", { width: 0.13, height: 0.08, depth: 0.12 }, this.scene);
    rightToeClamp.material = metalEdgeMat;
    rightToeClamp.position.set(0, 0.05, -0.16);
    rightToeClamp.parent = this.rightSki;

    const rightHeelUnit = MeshBuilder.CreateBox("skierRightHeelUnit", { width: 0.13, height: 0.09, depth: 0.16 }, this.scene);
    rightHeelUnit.material = blackPanelMat;
    rightHeelUnit.position.set(0, 0.06, 0.14);
    rightHeelUnit.parent = this.rightSki;

    // Initialize Powder Spray Particles
    this.initPowderParticles();
  }

  private initPowderParticles(): void {
    const pTex = new Texture("/assets/snow_texture.jpg", this.scene);

    this.leftSpray = new ParticleSystem("skierLeftSpray", 160, this.scene);
    this.leftSpray.particleTexture = pTex;
    this.leftSpray.emitter = this.leftSki;
    this.leftSpray.minEmitBox = new Vector3(-0.06, 0, 0.65);
    this.leftSpray.maxEmitBox = new Vector3(0.06, 0.12, 1.05);
    this.leftSpray.color1 = new Color4(0.96, 0.98, 1.0, 0.88);
    this.leftSpray.color2 = new Color4(0.85, 0.92, 1.0, 0.35);
    this.leftSpray.colorDead = new Color4(1.0, 1.0, 1.0, 0.0);
    this.leftSpray.minSize = 0.20;
    this.leftSpray.maxSize = 0.72;
    this.leftSpray.minLifeTime = 0.28;
    this.leftSpray.maxLifeTime = 0.75;
    this.leftSpray.emitRate = 0;
    this.leftSpray.direction1 = new Vector3(-1.1, 0.6, 2.4);
    this.leftSpray.direction2 = new Vector3(-0.2, 1.2, 3.6);
    this.leftSpray.gravity = new Vector3(0, -9.8, 0);
    this.leftSpray.start();

    this.rightSpray = new ParticleSystem("skierRightSpray", 160, this.scene);
    this.rightSpray.particleTexture = pTex;
    this.rightSpray.emitter = this.rightSki;
    this.rightSpray.minEmitBox = new Vector3(-0.06, 0, 0.65);
    this.rightSpray.maxEmitBox = new Vector3(0.06, 0.12, 1.05);
    this.rightSpray.color1 = new Color4(0.96, 0.98, 1.0, 0.88);
    this.rightSpray.color2 = new Color4(0.85, 0.92, 1.0, 0.35);
    this.rightSpray.colorDead = new Color4(1.0, 1.0, 1.0, 0.0);
    this.rightSpray.minSize = 0.20;
    this.rightSpray.maxSize = 0.72;
    this.rightSpray.minLifeTime = 0.28;
    this.rightSpray.maxLifeTime = 0.75;
    this.rightSpray.emitRate = 0;
    this.rightSpray.direction1 = new Vector3(0.2, 0.6, 2.4);
    this.rightSpray.direction2 = new Vector3(1.1, 1.2, 3.6);
    this.rightSpray.gravity = new Vector3(0, -9.8, 0);
    this.rightSpray.start();
  }

  public update(
    playerPosition: Vector3,
    steerInput: number,
    speedMph: number,
    isTucking: boolean,
    isBraking: boolean,
    deltaTime: number,
    isTethered: boolean = false
  ): void {
    // 1. Follow player position
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

    // 3. Dynamic Carving Body Banking & Ski Edge Bite
    const targetBank = -steerInput * 0.44; // Roll up to ~25 degrees into turn
    this.currentBank = Scalar.Lerp(this.currentBank, targetBank, Math.min(1.0, deltaTime * 12.0));
    this.rootNode.rotation.z = this.currentBank;
    this.rootNode.rotation.y = -steerInput * 0.28; // Yaw skis into downhill turn

    // Both skis roll onto their edges into the carving direction
    const edgeRoll = -steerInput * 0.18;
    this.leftSki.rotation.z = edgeRoll;
    this.rightSki.rotation.z = edgeRoll;

    // 4. High-Speed Chatter & Mogul Vibration
    this.chatterCycle += deltaTime * 35.0;
    const speedRatio = Math.min(1.6, speedMph / 45.0);
    const tipVibration = speedMph > 28 ? Math.sin(this.chatterCycle) * 0.018 * speedRatio : 0;
    this.leftTip.rotation.x = -0.38 + tipVibration;
    this.rightTip.rotation.x = -0.38 - tipVibration;

    // 5. Downhill Aerodynamic Tuck Squat
    const targetSquat = isTucking ? 0.32 : 0.0;
    this.currentSquat = Scalar.Lerp(this.currentSquat, targetSquat, Math.min(1.0, deltaTime * 10.0));

    this.bodyMesh.position.y = 1.05 - this.currentSquat;
    this.bodyMesh.rotation.x = isTucking ? 0.44 : 0.08;
    this.headMesh.position.y = 1.62 - this.currentSquat * 1.25;
    this.headMesh.position.z = isTucking ? -0.16 : 0.02;

    // Knee flex in tuck
    this.leftLeg.rotation.x = -0.14 - this.currentSquat * 0.45;
    this.rightLeg.rotation.x = -0.14 - this.currentSquat * 0.45;

    // 6. Combat Rifle Stance vs Cruising Poles
    this.isAimingGun = isTethered;
    if (isTethered) {
      // Reveal rifle, position arms to grip rifle
      this.rifleRoot.setEnabled(true);
      this.leftPole.setEnabled(false);
      this.rightPole.setEnabled(false);

      // Two-handed scoped rifle grip: Left arm supports barrel rail, Right arm on trigger/stock
      this.leftArm.rotation.set(-0.68, 0.38, 0.42);
      this.leftForearm.rotation.x = 0.85;
      this.rightArm.rotation.set(-0.76, -0.28, -0.38);
      this.rightForearm.rotation.x = 0.70;
    } else {
      this.rifleRoot.setEnabled(false);
      this.leftPole.setEnabled(true);
      this.rightPole.setEnabled(true);

      if (isTucking) {
        // Pin arms back aerodynamic against ribs
        this.leftArm.rotation.set(0.65, 0, 0.35);
        this.leftForearm.rotation.x = 0.20;
        this.rightArm.rotation.set(0.65, 0, -0.35);
        this.rightForearm.rotation.x = 0.20;
      } else {
        // Athletic downhill pole ready position
        this.leftArm.rotation.set(-0.25, 0, 0.22);
        this.leftForearm.rotation.x = 0.45;
        this.rightArm.rotation.set(-0.25, 0, -0.22);
        this.rightForearm.rotation.x = 0.45;
      }
    }

    // 7. Snowplow Wedge Braking
    const targetPlow = isBraking ? 0.28 : 0.0;
    this.currentPlow = Scalar.Lerp(this.currentPlow, targetPlow, Math.min(1.0, deltaTime * 14.0));
    this.leftSki.rotation.y = this.currentPlow;
    this.rightSki.rotation.y = -this.currentPlow;

    // 8. Powder Snow Rooster Tail Particle Dynamics
    const sprayRate = speedMph > 8 ? Math.min(160, Math.floor(speedMph * 3.0)) : 0;
    if (this.leftSpray) {
      this.leftSpray.emitRate = Math.abs(steerInput) > 0.1 || isBraking ? sprayRate * 1.6 : sprayRate;
    }
    if (this.rightSpray) {
      this.rightSpray.emitRate = Math.abs(steerInput) > 0.1 || isBraking ? sprayRate * 1.6 : sprayRate;
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
    this.rootNode.rotation.set(0, 0, 0);
  }

  public getTowlineAnchorWorldPosition(): Vector3 {
    // Physical towline connects right from the rifle muzzle / cable drum in front of the skier
    return new Vector3(
      this.rootNode.position.x + 0.18,
      this.rootNode.position.y + 1.25,
      this.rootNode.position.z - 1.10
    );
  }
}
