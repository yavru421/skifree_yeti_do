/**
 * SkierAvatar.ts
 * High-Fidelity Athletic 3D Skier Character Avatar:
 * - Athletic V-taper alpine racing suit with Alpine Gold livery and carbon contrast flank panels.
 * - Aerodynamic teardrop racing helmet with rear wind spoiler and curved polarized mirror snow goggles.
 * - Articulated athletic downhill crouch kinematics (flexed knees, canted shins, alloy micro-buckles).
 * - Detailed twin-tip downhill racing skis with polished steel edges and racing red tip scoops.
 * - Ergonomic graphite ski poles with snow baskets and angled shafts held properly in gloved hands.
 * - ALWAYS-VISIBLE TACTICAL HARPOON RIFLE:
 *     * Cruising / Downhill Stance: Magnetically slung diagonally across tactical backpack scabbard
 *       (fluted barrel, optic scope, tension coils, and cable drum clearly visible over right shoulder).
 *     * Combat / Aiming / Tethered Stance: Drawn into hands in two-handed tactical ready-fire posture.
 * - Dynamic procedural animations (carving roll, ski edge bite, aerodynamic tuck, snowplow brake,
 *   high-speed tip chatter, powder snow rooster tails, and end-of-level victory celebration pose).
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
  private leftGlove: Mesh;
  private rightGlove: Mesh;
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

  // Harpoon Weapon System (Always visible)
  public rifleRoot: Mesh;
  private currentRiflePos: Vector3 = new Vector3(0.18, 1.15, 0.28);
  private targetRiflePos: Vector3 = new Vector3(0.18, 1.15, 0.28);
  private currentRifleRot: Vector3 = new Vector3(0.25, 0.35, 0.85);
  private targetRifleRot: Vector3 = new Vector3(0.25, 0.35, 0.85);

  // Powder Snow Particle Spray
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
    suitMat.diffuseColor = new Color3(0.92, 0.68, 0.14);
    suitMat.specularColor = new Color3(0.40, 0.35, 0.22);
    suitMat.emissiveColor = new Color3(0.14, 0.10, 0.03);
    suitMat.roughness = 0.35;

    // 2. Tactical Contrast Black Panels (Flanks, Underarm, Knees, Elbows)
    const blackPanelMat = new StandardMaterial("skierBlackPanelMat", this.scene);
    blackPanelMat.diffuseColor = new Color3(0.10, 0.11, 0.13);
    blackPanelMat.specularColor = new Color3(0.28, 0.28, 0.30);
    blackPanelMat.roughness = 0.45;

    // 3. Tactical Backpack Material (Matte Cordura)
    const backpackMat = new StandardMaterial("skierBackpackMat", this.scene);
    backpackMat.diffuseColor = new Color3(0.08, 0.08, 0.10);
    backpackMat.specularColor = new Color3(0.18, 0.18, 0.20);
    backpackMat.roughness = 0.65;

    // 4. Aerodynamic Carbon Racing Helmet
    const helmetMat = new StandardMaterial("skierHelmetMat", this.scene);
    helmetMat.diffuseColor = new Color3(0.07, 0.08, 0.10);
    helmetMat.specularColor = new Color3(0.70, 0.70, 0.75);
    helmetMat.roughness = 0.20;

    // 5. Mirrored Polarized Snow Goggles (Gold & Cyan Sun-Glint)
    const visorMat = new StandardMaterial("skierVisorMat", this.scene);
    visorMat.diffuseColor = new Color3(0.02, 0.04, 0.06);
    visorMat.specularColor = new Color3(1.0, 0.85, 0.40);
    visorMat.emissiveColor = new Color3(0.02, 0.08, 0.12);
    visorMat.specularPower = 160;

    // 6. Carbon Downhill Skis
    const skiMat = new StandardMaterial("skierSkiMat", this.scene);
    skiMat.diffuseColor = new Color3(0.08, 0.09, 0.11);
    skiMat.specularColor = new Color3(0.75, 0.75, 0.82);
    skiMat.roughness = 0.2;

    // 7. Polished Metal Ski Edge & Binding Alloy
    const metalEdgeMat = new StandardMaterial("skierMetalEdgeMat", this.scene);
    metalEdgeMat.diffuseColor = new Color3(0.80, 0.82, 0.86);
    metalEdgeMat.specularColor = new Color3(0.98, 0.98, 1.0);

    // 8. Racing Red Livery Accent
    const redAccentMat = new StandardMaterial("skierRedAccentMat", this.scene);
    redAccentMat.diffuseColor = new Color3(0.92, 0.14, 0.16);
    redAccentMat.specularColor = new Color3(0.6, 0.6, 0.6);

    // 9. Gunmetal / Titanium Alloy (Harpoon Barrel & Poles)
    const gunmetalMat = new StandardMaterial("skierGunmetalMat", this.scene);
    gunmetalMat.diffuseColor = new Color3(0.22, 0.24, 0.27);
    gunmetalMat.specularColor = new Color3(0.90, 0.92, 0.98);

    // 10. Molded Alpine Ski Boot Material
    const bootMat = new StandardMaterial("skierBootMat", this.scene);
    bootMat.diffuseColor = new Color3(0.13, 0.14, 0.16);
    bootMat.specularColor = new Color3(0.45, 0.45, 0.50);
    bootMat.roughness = 0.35;

    // 11. Optical Scope Glass Lens
    const lensMat = new StandardMaterial("skierScopeLensMat", this.scene);
    lensMat.diffuseColor = new Color3(0.05, 0.25, 0.40);
    lensMat.specularColor = new Color3(0.95, 1.0, 1.0);
    lensMat.specularPower = 180;

    // ==========================================
    // ATHLETIC SKELETAL GEOMETRY & ANATOMY
    // ==========================================

    // 1. Torso / Jacket (Athletic V-Taper, Contoured Proportions)
    // Upper Chest
    this.bodyMesh = MeshBuilder.CreateBox("skierChest", { width: 0.52, height: 0.46, depth: 0.32 }, this.scene);
    this.bodyMesh.material = suitMat;
    this.bodyMesh.position.set(0, 1.18, -0.02);
    this.bodyMesh.parent = this.rootNode;

    // Tapered Lower Waist
    const waistMesh = MeshBuilder.CreateBox("skierWaist", { width: 0.42, height: 0.32, depth: 0.28 }, this.scene);
    waistMesh.material = suitMat;
    waistMesh.position.set(0, -0.32, 0.01);
    waistMesh.parent = this.bodyMesh;

    // High Wind Cowl / Neck Collar
    this.collarMesh = MeshBuilder.CreateCylinder("skierCollar", { height: 0.12, diameter: 0.30 }, this.scene);
    this.collarMesh.material = blackPanelMat;
    this.collarMesh.position.set(0, 0.28, -0.01);
    this.collarMesh.parent = this.bodyMesh;

    // Side Aerodynamic Stretch Flanks (Black contrast racing accents)
    const flankL = MeshBuilder.CreateBox("skierFlankL", { width: 0.06, height: 0.65, depth: 0.28 }, this.scene);
    flankL.material = blackPanelMat;
    flankL.position.set(-0.25, -0.10, 0);
    flankL.parent = this.bodyMesh;

    const flankR = MeshBuilder.CreateBox("skierFlankR", { width: 0.06, height: 0.65, depth: 0.28 }, this.scene);
    flankR.material = blackPanelMat;
    flankR.position.set(0.25, -0.10, 0);
    flankR.parent = this.bodyMesh;

    // Racing Center Stripe (Front)
    const raceStripe = MeshBuilder.CreateBox("skierRaceStripe", { width: 0.07, height: 0.55, depth: 0.02 }, this.scene);
    raceStripe.material = redAccentMat;
    raceStripe.position.set(0, -0.05, -0.165);
    raceStripe.parent = this.bodyMesh;

    // Tactical Waist Utility Belt & Buckle
    this.beltMesh = MeshBuilder.CreateBox("skierBelt", { width: 0.46, height: 0.08, depth: 0.30 }, this.scene);
    this.beltMesh.material = blackPanelMat;
    this.beltMesh.position.set(0, -0.46, 0.01);
    this.beltMesh.parent = this.bodyMesh;

    const beltBuckle = MeshBuilder.CreateBox("skierBeltBuckle", { width: 0.10, height: 0.06, depth: 0.32 }, this.scene);
    beltBuckle.material = metalEdgeMat;
    beltBuckle.position.set(0, -0.46, 0.01);
    beltBuckle.parent = this.bodyMesh;

    // Aerodynamic Shoulder Armor Plates
    const leftEpaulet = MeshBuilder.CreateBox("skierLeftEpaulet", { width: 0.14, height: 0.06, depth: 0.24 }, this.scene);
    leftEpaulet.material = blackPanelMat;
    leftEpaulet.position.set(-0.29, 0.24, 0);
    leftEpaulet.rotation.z = -0.22;
    leftEpaulet.parent = this.bodyMesh;

    const rightEpaulet = MeshBuilder.CreateBox("skierRightEpaulet", { width: 0.14, height: 0.06, depth: 0.24 }, this.scene);
    rightEpaulet.material = blackPanelMat;
    rightEpaulet.position.set(0.29, 0.24, 0);
    rightEpaulet.rotation.z = 0.22;
    rightEpaulet.parent = this.bodyMesh;

    // 2. Streamlined Tactical Gear Pack (Mounted on Upper Back +Z)
    this.backpackMesh = MeshBuilder.CreateBox("skierBackpack", { width: 0.34, height: 0.48, depth: 0.18 }, this.scene);
    this.backpackMesh.material = backpackMat;
    this.backpackMesh.position.set(0, 0.04, 0.22);
    this.backpackMesh.parent = this.bodyMesh;

    // Backpack Aerodynamic Top Cap
    const packCap = MeshBuilder.CreateCylinder("skierPackCap", { height: 0.32, diameter: 0.16 }, this.scene);
    packCap.material = blackPanelMat;
    packCap.rotation.z = Math.PI / 2;
    packCap.position.set(0, 0.24, 0);
    packCap.parent = this.backpackMesh;

    // Diagonal Rifle Scabbard Sheath Across Pack
    const scabbard = MeshBuilder.CreateBox("skierScabbard", { width: 0.10, height: 0.52, depth: 0.08 }, this.scene);
    scabbard.material = blackPanelMat;
    scabbard.position.set(0.04, 0.06, 0.11);
    scabbard.rotation.z = -0.45;
    scabbard.parent = this.backpackMesh;

    // 3. Head, Helmet & Curved Snow Goggles
    this.headMesh = MeshBuilder.CreateSphere("skierHead", { diameter: 0.38, segments: 16 }, this.scene);
    this.headMesh.material = helmetMat;
    this.headMesh.position.set(0, 1.58, 0.01);
    this.headMesh.parent = this.rootNode;

    // Helmet Aerodynamic Rear Wind Spoiler Flare
    const spoiler = MeshBuilder.CreateBox("skierHelmetSpoiler", { width: 0.22, height: 0.08, depth: 0.14 }, this.scene);
    spoiler.material = helmetMat;
    spoiler.position.set(0, 0.06, 0.16);
    spoiler.rotation.x = -0.32;
    spoiler.parent = this.headMesh;

    // Curved Wrap-Around Polarized Mirror Snow Goggles
    this.helmetVisor = MeshBuilder.CreateCylinder("skierVisor", { height: 0.11, diameter: 0.40, arc: 0.48 }, this.scene);
    this.helmetVisor.material = visorMat;
    this.helmetVisor.rotation.y = Math.PI * 0.76;
    this.helmetVisor.position.set(0, 0.02, 0.01);
    this.helmetVisor.parent = this.headMesh;

    const goggleFrame = MeshBuilder.CreateCylinder("skierGoggleFrame", { height: 0.05, diameter: 0.402, arc: 0.50 }, this.scene);
    goggleFrame.material = metalEdgeMat;
    goggleFrame.rotation.y = Math.PI * 0.75;
    goggleFrame.position.set(0, 0.02, 0.01);
    goggleFrame.parent = this.headMesh;

    const goggleStrap = MeshBuilder.CreateCylinder("skierGoggleStrap", { height: 0.06, diameter: 0.39 }, this.scene);
    goggleStrap.material = blackPanelMat;
    goggleStrap.position.set(0, 0.02, 0);
    goggleStrap.parent = this.headMesh;

    // 4. Articulated Legs, Knee Armor, and Molded Ski Boots (Athletic Downhill Stance)
    // Left Leg (Athletic forward cant)
    this.leftLeg = MeshBuilder.CreateCylinder("skierLeftLeg", { height: 0.56, diameter: 0.16 }, this.scene);
    this.leftLeg.material = suitMat;
    this.leftLeg.position.set(-0.16, 0.56, 0.01);
    this.leftLeg.rotation.x = -0.22;
    this.leftLeg.parent = this.rootNode;

    const leftKnee = MeshBuilder.CreateBox("skierLeftKnee", { width: 0.14, height: 0.16, depth: 0.10 }, this.scene);
    leftKnee.material = blackPanelMat;
    leftKnee.position.set(0, 0.04, -0.07);
    leftKnee.parent = this.leftLeg;

    this.leftBoot = MeshBuilder.CreateBox("skierLeftBoot", { width: 0.14, height: 0.22, depth: 0.30 }, this.scene);
    this.leftBoot.material = bootMat;
    this.leftBoot.position.set(0, -0.27, -0.03);
    this.leftBoot.rotation.x = -0.16;
    this.leftBoot.parent = this.leftLeg;

    const leftBuckle = MeshBuilder.CreateBox("skierLeftBuckle", { width: 0.15, height: 0.03, depth: 0.12 }, this.scene);
    leftBuckle.material = metalEdgeMat;
    leftBuckle.position.set(0, 0.04, -0.07);
    leftBuckle.parent = this.leftBoot;

    // Right Leg (Athletic forward cant)
    this.rightLeg = MeshBuilder.CreateCylinder("skierRightLeg", { height: 0.56, diameter: 0.16 }, this.scene);
    this.rightLeg.material = suitMat;
    this.rightLeg.position.set(0.16, 0.56, 0.01);
    this.rightLeg.rotation.x = -0.22;
    this.rightLeg.parent = this.rootNode;

    const rightKnee = MeshBuilder.CreateBox("skierRightKnee", { width: 0.14, height: 0.16, depth: 0.10 }, this.scene);
    rightKnee.material = blackPanelMat;
    rightKnee.position.set(0, 0.04, -0.07);
    rightKnee.parent = this.rightLeg;

    this.rightBoot = MeshBuilder.CreateBox("skierRightBoot", { width: 0.14, height: 0.22, depth: 0.30 }, this.scene);
    this.rightBoot.material = bootMat;
    this.rightBoot.position.set(0, -0.27, -0.03);
    this.rightBoot.rotation.x = -0.16;
    this.rightBoot.parent = this.rightLeg;

    const rightBuckle = MeshBuilder.CreateBox("skierRightBuckle", { width: 0.15, height: 0.03, depth: 0.12 }, this.scene);
    rightBuckle.material = metalEdgeMat;
    rightBuckle.position.set(0, 0.04, -0.07);
    rightBuckle.parent = this.rightBoot;

    // 5. Arms, Elbow Armor & Ski Poles (Cruising Stance)
    // Left Arm
    this.leftArm = MeshBuilder.CreateCylinder("skierLeftArm", { height: 0.38, diameter: 0.13 }, this.scene);
    this.leftArm.material = suitMat;
    this.leftArm.position.set(-0.36, 1.22, -0.02);
    this.leftArm.rotation.set(-0.25, 0, 0.20);
    this.leftArm.parent = this.rootNode;

    this.leftForearm = MeshBuilder.CreateCylinder("skierLeftForearm", { height: 0.36, diameter: 0.11 }, this.scene);
    this.leftForearm.material = suitMat;
    this.leftForearm.position.set(0, -0.28, 0.06);
    this.leftForearm.rotation.x = 0.48;
    this.leftForearm.parent = this.leftArm;

    const leftElbow = MeshBuilder.CreateBox("skierLeftElbow", { width: 0.12, height: 0.12, depth: 0.08 }, this.scene);
    leftElbow.material = blackPanelMat;
    leftElbow.position.set(0, 0.14, 0.05);
    leftElbow.parent = this.leftForearm;

    this.leftGlove = MeshBuilder.CreateSphere("skierLeftGlove", { diameter: 0.13 }, this.scene);
    this.leftGlove.material = blackPanelMat;
    this.leftGlove.position.set(0, -0.20, 0);
    this.leftGlove.parent = this.leftForearm;

    this.leftPole = MeshBuilder.CreateCylinder("skierLeftPole", { height: 1.25, diameter: 0.024 }, this.scene);
    this.leftPole.material = gunmetalMat;
    this.leftPole.position.set(0, -0.25, 0.18);
    this.leftPole.rotation.x = 0.52;
    this.leftPole.parent = this.leftGlove;

    const leftBasket = MeshBuilder.CreateCylinder("skierLeftBasket", { height: 0.02, diameter: 0.11 }, this.scene);
    leftBasket.material = blackPanelMat;
    leftBasket.position.set(0, -0.46, 0);
    leftBasket.parent = this.leftPole;

    // Right Arm
    this.rightArm = MeshBuilder.CreateCylinder("skierRightArm", { height: 0.38, diameter: 0.13 }, this.scene);
    this.rightArm.material = suitMat;
    this.rightArm.position.set(0.36, 1.22, -0.02);
    this.rightArm.rotation.set(-0.25, 0, -0.20);
    this.rightArm.parent = this.rootNode;

    this.rightForearm = MeshBuilder.CreateCylinder("skierRightForearm", { height: 0.36, diameter: 0.11 }, this.scene);
    this.rightForearm.material = suitMat;
    this.rightForearm.position.set(0, -0.28, 0.06);
    this.rightForearm.rotation.x = 0.48;
    this.rightForearm.parent = this.rightArm;

    const rightElbow = MeshBuilder.CreateBox("skierRightElbow", { width: 0.12, height: 0.12, depth: 0.08 }, this.scene);
    rightElbow.material = blackPanelMat;
    rightElbow.position.set(0, 0.14, 0.05);
    rightElbow.parent = this.rightForearm;

    this.rightGlove = MeshBuilder.CreateSphere("skierRightGlove", { diameter: 0.13 }, this.scene);
    this.rightGlove.material = blackPanelMat;
    this.rightGlove.position.set(0, -0.20, 0);
    this.rightGlove.parent = this.rightForearm;

    this.rightPole = MeshBuilder.CreateCylinder("skierRightPole", { height: 1.25, diameter: 0.024 }, this.scene);
    this.rightPole.material = gunmetalMat;
    this.rightPole.position.set(0, -0.25, 0.18);
    this.rightPole.rotation.x = 0.52;
    this.rightPole.parent = this.rightGlove;

    const rightBasket = MeshBuilder.CreateCylinder("skierRightBasket", { height: 0.02, diameter: 0.11 }, this.scene);
    rightBasket.material = blackPanelMat;
    rightBasket.position.set(0, -0.46, 0);
    rightBasket.parent = this.rightPole;

    // ==========================================
    // ALWAYS-VISIBLE TACTICAL HARPOON RIFLE
    // ==========================================
    this.rifleRoot = new Mesh("skierRifleRoot", this.scene);
    this.rifleRoot.parent = this.rootNode;
    // Start in diagonal backpack scabbard mount
    this.rifleRoot.position.set(0.14, 1.28, 0.28);
    this.rifleRoot.rotation.set(0.25, 0.35, 0.85);

    // Receiver & Stock
    const rifleBody = MeshBuilder.CreateBox("skierRifleBody", { width: 0.07, height: 0.13, depth: 0.90 }, this.scene);
    rifleBody.material = gunmetalMat;
    rifleBody.parent = this.rifleRoot;

    // Top Picatinny Rail
    const rail = MeshBuilder.CreateBox("skierRifleRail", { width: 0.05, height: 0.025, depth: 0.65 }, this.scene);
    rail.material = blackPanelMat;
    rail.position.set(0, 0.075, -0.10);
    rail.parent = this.rifleRoot;

    // Fluted Precision Barrel
    const rifleBarrel = MeshBuilder.CreateCylinder("skierRifleBarrel", { height: 0.72, diameter: 0.035 }, this.scene);
    rifleBarrel.material = gunmetalMat;
    rifleBarrel.rotation.x = Math.PI / 2;
    rifleBarrel.position.set(0, 0.02, -0.68);
    rifleBarrel.parent = this.rifleRoot;

    // Muzzle Brake
    const muzzleBrake = MeshBuilder.CreateCylinder("skierMuzzleBrake", { height: 0.09, diameter: 0.050 }, this.scene);
    muzzleBrake.material = blackPanelMat;
    muzzleBrake.rotation.x = Math.PI / 2;
    muzzleBrake.position.set(0, 0.02, -1.05);
    muzzleBrake.parent = this.rifleRoot;

    // Tactical High-Power Optical Scope
    const rifleScope = MeshBuilder.CreateCylinder("skierRifleScope", { height: 0.36, diameter: 0.050 }, this.scene);
    rifleScope.material = blackPanelMat;
    rifleScope.rotation.x = Math.PI / 2;
    rifleScope.position.set(0, 0.12, -0.15);
    rifleScope.parent = this.rifleRoot;

    // Scope Objective Lens (front & rear glass glints)
    const lensFront = MeshBuilder.CreateDisc("skierLensFront", { radius: 0.023 }, this.scene);
    lensFront.material = lensMat;
    lensFront.position.set(0, 0.12, -0.33);
    lensFront.parent = this.rifleRoot;

    const lensRear = MeshBuilder.CreateDisc("skierLensRear", { radius: 0.023 }, this.scene);
    lensRear.material = lensMat;
    lensRear.rotation.y = Math.PI;
    lensRear.position.set(0, 0.12, 0.03);
    lensRear.parent = this.rifleRoot;

    // Heavy Brass Pressure Coils & Red Cable Drum Spool
    const spool = MeshBuilder.CreateCylinder("skierRifleSpool", { height: 0.11, diameter: 0.13 }, this.scene);
    spool.material = redAccentMat;
    spool.position.set(0, -0.08, -0.05);
    spool.parent = this.rifleRoot;

    // Harpoon Projectile Tip (visible loaded in front muzzle)
    const harpoonTip = MeshBuilder.CreateCylinder("skierHarpoonTip", { height: 0.16, diameterTop: 0.005, diameterBottom: 0.03 }, this.scene);
    harpoonTip.material = metalEdgeMat;
    harpoonTip.rotation.x = Math.PI / 2;
    harpoonTip.position.set(0, 0.02, -1.14);
    harpoonTip.parent = this.rifleRoot;

    // Rifle is permanently enabled and visible!
    this.rifleRoot.setEnabled(true);

    // ==========================================
    // RACING DOWNHILL SKIS & BINDINGS
    // ==========================================
    const skiWidth = 0.15;
    const skiLength = 2.10;
    const skiSeparation = 0.26;

    // Left Ski
    this.leftSki = MeshBuilder.CreateBox("skierLeftSki", { width: skiWidth, height: 0.035, depth: skiLength }, this.scene);
    this.leftSki.material = skiMat;
    this.leftSki.position.set(-skiSeparation, 0.02, 0);
    this.leftSki.parent = this.rootNode;

    const leftEdgeL = MeshBuilder.CreateBox("skierLeftEdgeL", { width: 0.010, height: 0.033, depth: skiLength }, this.scene);
    leftEdgeL.material = metalEdgeMat;
    leftEdgeL.position.set(-skiWidth / 2 + 0.005, 0, 0);
    leftEdgeL.parent = this.leftSki;

    const leftEdgeR = MeshBuilder.CreateBox("skierLeftEdgeR", { width: 0.010, height: 0.033, depth: skiLength }, this.scene);
    leftEdgeR.material = metalEdgeMat;
    leftEdgeR.position.set(skiWidth / 2 - 0.005, 0, 0);
    leftEdgeR.parent = this.leftSki;

    this.leftTip = MeshBuilder.CreateBox("skierLeftTip", { width: skiWidth, height: 0.035, depth: 0.30 }, this.scene);
    this.leftTip.material = redAccentMat;
    this.leftTip.position.set(0, 0.05, -skiLength / 2 - 0.12);
    this.leftTip.rotation.x = -0.38;
    this.leftTip.parent = this.leftSki;

    const leftToeClamp = MeshBuilder.CreateBox("skierLeftToeClamp", { width: 0.12, height: 0.08, depth: 0.14 }, this.scene);
    leftToeClamp.material = blackPanelMat;
    leftToeClamp.position.set(0, 0.05, -0.16);
    leftToeClamp.parent = this.leftSki;

    const leftHeelUnit = MeshBuilder.CreateBox("skierLeftHeelUnit", { width: 0.12, height: 0.08, depth: 0.15 }, this.scene);
    leftHeelUnit.material = blackPanelMat;
    leftHeelUnit.position.set(0, 0.06, 0.14);
    leftHeelUnit.parent = this.leftSki;

    // Right Ski
    this.rightSki = MeshBuilder.CreateBox("skierRightSki", { width: skiWidth, height: 0.035, depth: skiLength }, this.scene);
    this.rightSki.material = skiMat;
    this.rightSki.position.set(skiSeparation, 0.02, 0);
    this.rightSki.parent = this.rootNode;

    const rightEdgeL = MeshBuilder.CreateBox("skierRightEdgeL", { width: 0.010, height: 0.033, depth: skiLength }, this.scene);
    rightEdgeL.material = metalEdgeMat;
    rightEdgeL.position.set(-skiWidth / 2 + 0.005, 0, 0);
    rightEdgeL.parent = this.rightSki;

    const rightEdgeR = MeshBuilder.CreateBox("skierRightEdgeR", { width: 0.010, height: 0.033, depth: skiLength }, this.scene);
    rightEdgeR.material = metalEdgeMat;
    rightEdgeR.position.set(skiWidth / 2 - 0.005, 0, 0);
    rightEdgeR.parent = this.rightSki;

    this.rightTip = MeshBuilder.CreateBox("skierRightTip", { width: skiWidth, height: 0.035, depth: 0.30 }, this.scene);
    this.rightTip.material = redAccentMat;
    this.rightTip.position.set(0, 0.05, -skiLength / 2 - 0.12);
    this.rightTip.rotation.x = -0.38;
    this.rightTip.parent = this.rightSki;

    const rightToeClamp = MeshBuilder.CreateBox("skierRightToeClamp", { width: 0.12, height: 0.08, depth: 0.14 }, this.scene);
    rightToeClamp.material = blackPanelMat;
    rightToeClamp.position.set(0, 0.05, -0.16);
    rightToeClamp.parent = this.rightSki;

    const rightHeelUnit = MeshBuilder.CreateBox("skierRightHeelUnit", { width: 0.12, height: 0.08, depth: 0.15 }, this.scene);
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

    // 2b. Cutscene Victory Celebration Pose
    if (this.isCutsceneVictory) {
      this.victoryTimer += deltaTime;
      // Carve triumphant downhill sweep
      this.rootNode.rotation.z = Math.sin(this.victoryTimer * 2.5) * 0.15;
      this.rootNode.rotation.y = Math.sin(this.victoryTimer * 2.0) * 0.12;

      // Right arm raised high in victory pole salute!
      this.rightArm.rotation.set(-1.85, 0.25, -0.45);
      this.rightForearm.rotation.x = 0.25;
      this.rightPole.setEnabled(true);
      this.leftPole.setEnabled(true);

      // Left arm out for balance
      this.leftArm.rotation.set(-0.35, 0, 0.45);
      this.leftForearm.rotation.x = 0.50;

      // Harpoon remains securely slung on back
      this.targetRiflePos.set(0.14, 1.28, 0.28);
      this.targetRifleRot.set(0.25, 0.35, 0.85);
      this.lerpRifleTransform(deltaTime);
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

    this.bodyMesh.position.y = 1.18 - this.currentSquat;
    this.bodyMesh.rotation.x = isTucking ? 0.42 : 0.06;
    this.headMesh.position.y = 1.58 - this.currentSquat * 1.20;
    this.headMesh.position.z = isTucking ? -0.14 : 0.01;

    // Knee flex in tuck
    this.leftLeg.rotation.x = -0.22 - this.currentSquat * 0.40;
    this.rightLeg.rotation.x = -0.22 - this.currentSquat * 0.40;

    // 6. HARPOON STANCE: Cruising Slung vs Combat Aiming / Tethered
    this.isAimingGun = isTethered || isAiming;
    if (this.isAimingGun) {
      // Wielded Firing Stance: Harpoon brought forward into two hands
      this.targetRiflePos.set(0.18, 1.15, -0.42);
      this.targetRifleRot.set(0.10, 0, 0);

      // Hide cruising poles when gripping harpoon
      this.leftPole.setEnabled(false);
      this.rightPole.setEnabled(false);

      // Two-handed scoped rifle grip: Left arm supports barrel rail, Right arm on trigger/stock
      this.leftArm.rotation.set(-0.68, 0.38, 0.42);
      this.leftForearm.rotation.x = 0.85;
      this.rightArm.rotation.set(-0.76, -0.28, -0.38);
      this.rightForearm.rotation.x = 0.70;
    } else {
      // Cruising Downhill Stance: Harpoon slung diagonally across backpack over right shoulder
      this.targetRiflePos.set(0.14, 1.28, 0.28);
      this.targetRifleRot.set(0.25, 0.35, 0.85);

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
        this.leftArm.rotation.set(-0.25, 0, 0.20);
        this.leftForearm.rotation.x = 0.48;
        this.rightArm.rotation.set(-0.25, 0, -0.20);
        this.rightForearm.rotation.x = 0.48;
      }
    }

    // Smooth lerp between holstered and wielded weapon positions
    this.lerpRifleTransform(deltaTime);

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
      this.rootNode.position.x + 0.18,
      this.rootNode.position.y + 1.25,
      this.rootNode.position.z - 1.10
    );
  }
}
