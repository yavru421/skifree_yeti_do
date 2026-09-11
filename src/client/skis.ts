/**
 * SkiFree Yeti DO - FPV Skis & Ski Poles System
 * High-fidelity first-person alpine skis and dynamic ski poles with bindings,
 * carving tilt, alternate pole plant animations, and dual powder spray emitters.
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
  ParticleSystem,
  Texture
} from "@babylonjs/core";

export class FPVSkis {
  private scene: Scene;
  private camera: Camera;
  public rootNode: Mesh;
  private leftSki: Mesh;
  private rightSki: Mesh;
  private leftSkiTip: Mesh;
  private rightSkiTip: Mesh;

  // Ski Poles
  private leftPoleRoot: Mesh;
  private rightPoleRoot: Mesh;
  private poleCycle: number = 0;

  // Snow Spray
  private powderParticlesLeft: ParticleSystem | null = null;
  private powderParticlesRight: ParticleSystem | null = null;

  constructor(scene: Scene, camera: Camera) {
    this.scene = scene;
    this.camera = camera;

    // Root node parented to camera for 1:1 FPV locking
    this.rootNode = new Mesh("fpvSkisRoot", this.scene);
    this.rootNode.parent = this.camera;
    this.rootNode.position.set(0, -0.82, 1.1); // Positioned naturally along bottom viewport edge
    this.rootNode.rotation.x = 0.08;

    // --- MATERIALS ---
    // Carbon Fiber Ski Body with Gloss
    const skiTopMat = new StandardMaterial("skiTopMat", this.scene);
    skiTopMat.diffuseColor = new Color3(0.06, 0.08, 0.12);
    skiTopMat.specularColor = new Color3(0.6, 0.7, 0.9);
    skiTopMat.roughness = 0.15;

    // Racing Accent Stripe (Electric Cyan)
    const stripeMat = new StandardMaterial("skiStripeMat", this.scene);
    stripeMat.diffuseColor = new Color3(0.0, 0.95, 1.0);
    stripeMat.emissiveColor = new Color3(0.0, 0.25, 0.35);

    // Tip Accent (High-Vis Neon Orange)
    const tipMat = new StandardMaterial("skiTipMat", this.scene);
    tipMat.diffuseColor = new Color3(1.0, 0.3, 0.0);
    tipMat.emissiveColor = new Color3(0.35, 0.08, 0.0);

    // Steel Edge Material
    const steelMat = new StandardMaterial("steelEdgeMat", this.scene);
    steelMat.diffuseColor = new Color3(0.85, 0.88, 0.92);
    steelMat.specularColor = new Color3(1.0, 1.0, 1.0);
    steelMat.roughness = 0.1;

    // Ski Binding Material (Matte Black Technical Polymer)
    const bindingMat = new StandardMaterial("bindingMat", this.scene);
    bindingMat.diffuseColor = new Color3(0.12, 0.14, 0.16);
    bindingMat.specularColor = new Color3(0.2, 0.2, 0.2);

    // Ski Pole Carbon Fiber & Grip Materials
    const poleShaftMat = new StandardMaterial("poleShaftMat", this.scene);
    poleShaftMat.diffuseColor = new Color3(0.1, 0.12, 0.15);
    poleShaftMat.specularColor = new Color3(0.5, 0.5, 0.6);

    const poleGripMat = new StandardMaterial("poleGripMat", this.scene);
    poleGripMat.diffuseColor = new Color3(0.0, 0.8, 0.9);

    const poleBasketMat = new StandardMaterial("poleBasketMat", this.scene);
    poleBasketMat.diffuseColor = new Color3(0.05, 0.05, 0.05);

    // --- SKI ASSEMBLY HELPER ---
    const buildSki = (name: string, posX: number) => {
      const skiBase = MeshBuilder.CreateBox(
        `${name}Base`,
        { width: 0.16, height: 0.035, depth: 2.1 },
        this.scene
      );
      skiBase.material = skiTopMat;
      skiBase.position.set(posX, 0, 0);
      skiBase.parent = this.rootNode;

      // Racing center stripe
      const stripe = MeshBuilder.CreateBox(
        `${name}Stripe`,
        { width: 0.045, height: 0.038, depth: 1.95 },
        this.scene
      );
      stripe.material = stripeMat;
      stripe.parent = skiBase;

      // Steel carving side rails
      const edgeL = MeshBuilder.CreateBox(
        `${name}EdgeL`,
        { width: 0.012, height: 0.036, depth: 2.08 },
        this.scene
      );
      edgeL.material = steelMat;
      edgeL.position.x = -0.076;
      edgeL.parent = skiBase;

      const edgeR = MeshBuilder.CreateBox(
        `${name}EdgeR`,
        { width: 0.012, height: 0.036, depth: 2.08 },
        this.scene
      );
      edgeR.material = steelMat;
      edgeR.position.x = 0.076;
      edgeR.parent = skiBase;

      // Up-curved ski tip with sleek racing rocker
      const tip = MeshBuilder.CreateBox(
        `${name}Tip`,
        { width: 0.14, height: 0.022, depth: 0.28 },
        this.scene
      );
      tip.material = tipMat;
      tip.position.set(0, 0.07, 1.08);
      tip.rotation.x = -0.42; // Upward rocker bend
      tip.parent = skiBase;

      // Bindings: Toe piece
      const toeBinding = MeshBuilder.CreateBox(
        `${name}Toe`,
        { width: 0.11, height: 0.065, depth: 0.18 },
        this.scene
      );
      toeBinding.material = bindingMat;
      toeBinding.position.set(0, 0.045, 0.25);
      toeBinding.parent = skiBase;

      // Bindings: Stepped Heel tower
      const heelBinding = MeshBuilder.CreateBox(
        `${name}Heel`,
        { width: 0.1, height: 0.08, depth: 0.2 },
        this.scene
      );
      heelBinding.material = bindingMat;
      heelBinding.position.set(0, 0.055, -0.2);
      heelBinding.parent = skiBase;

      return { skiBase, tip };
    };

    const left = buildSki("leftSki", -0.34);
    this.leftSki = left.skiBase;
    this.leftSkiTip = left.tip;

    const right = buildSki("rightSki", 0.34);
    this.rightSki = right.skiBase;
    this.rightSkiTip = right.tip;

    // --- SKI POLE ASSEMBLY ---
    const buildPole = (name: string, posX: number) => {
      const poleRoot = new Mesh(`${name}Root`, this.scene);
      poleRoot.parent = this.rootNode;
      poleRoot.position.set(posX, 0.15, 0.4);

      // Carbon fiber shaft
      const shaft = MeshBuilder.CreateCylinder(
        `${name}Shaft`,
        { height: 1.45, diameterTop: 0.024, diameterBottom: 0.016 },
        this.scene
      );
      shaft.material = poleShaftMat;
      shaft.rotation.x = 0.55; // Angle forward toward snow
      shaft.position.set(0, -0.35, 0.3);
      shaft.parent = poleRoot;

      // Ergonomic Grip
      const grip = MeshBuilder.CreateCylinder(
        `${name}Grip`,
        { height: 0.22, diameter: 0.038 },
        this.scene
      );
      grip.material = poleGripMat;
      grip.rotation.x = 0.55;
      grip.position.set(0, 0.32, -0.15);
      grip.parent = poleRoot;

      // Snow Basket near tip
      const basket = MeshBuilder.CreateDisc(
        `${name}Basket`,
        { radius: 0.08, tessellation: 12 },
        this.scene
      );
      basket.material = poleBasketMat;
      basket.rotation.x = Math.PI / 2 + 0.55;
      basket.position.set(0, -0.85, 0.75);
      basket.parent = poleRoot;

      // Carbide Tip
      const tip = MeshBuilder.CreateCylinder(
        `${name}Tip`,
        { height: 0.1, diameterTop: 0.016, diameterBottom: 0.004 },
        this.scene
      );
      tip.material = steelMat;
      tip.rotation.x = 0.55;
      tip.position.set(0, -0.96, 0.83);
      tip.parent = poleRoot;

      return poleRoot;
    };

    this.leftPoleRoot = buildPole("leftPole", -0.58);
    this.rightPoleRoot = buildPole("rightPole", 0.58);
    // Hide floating detached ski poles in FPV view
    this.leftPoleRoot.setEnabled(false);
    this.rightPoleRoot.setEnabled(false);

    // 3. Snow Powder Spray Particles
    this.initPowderParticles();
  }

  private initPowderParticles(): void {
    // Left spray (Dynamic high-velocity rooster tail)
    this.powderParticlesLeft = new ParticleSystem("powderL", 600, this.scene);
    this.powderParticlesLeft.particleTexture = new Texture("/assets/snow_texture.jpg", this.scene);
    this.powderParticlesLeft.blendMode = ParticleSystem.BLENDMODE_ADD;
    this.powderParticlesLeft.emitter = this.leftSki;
    this.powderParticlesLeft.minSize = 0.05;
    this.powderParticlesLeft.maxSize = 0.28;
    this.powderParticlesLeft.color1 = new Color3(1, 1, 1).toColor4(0.85);
    this.powderParticlesLeft.color2 = new Color3(0.85, 0.94, 1).toColor4(0.25);
    this.powderParticlesLeft.direction1 = new Vector3(-1.8, 0.8, -2.2);
    this.powderParticlesLeft.direction2 = new Vector3(-0.4, 1.6, -0.4);
    this.powderParticlesLeft.minLifeTime = 0.25;
    this.powderParticlesLeft.maxLifeTime = 0.65;
    this.powderParticlesLeft.emitRate = 0;
    this.powderParticlesLeft.start();

    // Right spray (Dynamic high-velocity rooster tail)
    this.powderParticlesRight = new ParticleSystem("powderR", 600, this.scene);
    this.powderParticlesRight.particleTexture = new Texture("/assets/snow_texture.jpg", this.scene);
    this.powderParticlesRight.blendMode = ParticleSystem.BLENDMODE_ADD;
    this.powderParticlesRight.emitter = this.rightSki;
    this.powderParticlesRight.minSize = 0.05;
    this.powderParticlesRight.maxSize = 0.28;
    this.powderParticlesRight.color1 = new Color3(1, 1, 1).toColor4(0.85);
    this.powderParticlesRight.color2 = new Color3(0.85, 0.94, 1).toColor4(0.25);
    this.powderParticlesRight.direction1 = new Vector3(0.4, 1.6, -0.4);
    this.powderParticlesRight.direction2 = new Vector3(1.8, 0.8, -2.2);
    this.powderParticlesRight.minLifeTime = 0.25;
    this.powderParticlesRight.maxLifeTime = 0.65;
    this.powderParticlesRight.emitRate = 0;
    this.powderParticlesRight.start();
  }

  public update(
    steerInput: number,
    isTucking: boolean,
    isBraking: boolean,
    speedMph: number,
    isAimingRear: boolean,
    deltaTime: number,
    isThirdPerson: boolean = false
  ): void {
    if (isThirdPerson) {
      this.rootNode.setEnabled(false);
      return;
    }
    // Hide skis and poles if player is looking 180° backward uphill
    this.rootNode.setEnabled(!isAimingRear);
    if (isAimingRear) return;

    // 1. Carving Bank / Tilt Roll
    const targetRoll = -steerInput * 0.38;
    this.rootNode.rotation.z = Scalar.Lerp(this.rootNode.rotation.z, targetRoll, 0.2);

    // 2. High Speed Tip Chatter Vibration
    const speedRatio = Math.min(1.5, speedMph / 45);
    const tipChatter = (Math.random() - 0.5) * 0.015 * speedRatio;
    this.leftSkiTip.rotation.x = -0.48 + tipChatter;
    this.rightSkiTip.rotation.x = -0.48 - tipChatter;

    // 3. Skier Tuck / Brake Pitch & Height
    let targetPitch = 0.06;
    let targetY = -0.62;
    if (isTucking) {
      targetPitch = 0.22;
      targetY = -0.48; // Camera pulls tight into tuck
    } else if (isBraking) {
      targetPitch = -0.14; // Tail dig on braking
      targetY = -0.7;
    }
    this.rootNode.rotation.x = Scalar.Lerp(this.rootNode.rotation.x, targetPitch, 0.15);
    this.rootNode.position.y = Scalar.Lerp(this.rootNode.position.y, targetY, 0.15);

    // 4. Dynamic Ski Pole Plant Cycle (Alternating L/R Rhythm)
    const strideFreq = Math.max(2.0, (speedMph / 18) * Math.PI);
    this.poleCycle += deltaTime * strideFreq;

    if (isTucking) {
      // Tuck: Poles clamped aerodynamic under armpits
      this.leftPoleRoot.position.set(-0.38, -0.05, 0.25);
      this.leftPoleRoot.rotation.set(0.1, 0.2, -0.15);

      this.rightPoleRoot.position.set(0.38, -0.05, 0.25);
      this.rightPoleRoot.rotation.set(0.1, -0.2, 0.15);
    } else {
      // Natural downhill alternating pole plant swing
      const leftSwing = Math.sin(this.poleCycle);
      const rightSwing = -leftSwing;

      this.leftPoleRoot.position.y = 0.15 + leftSwing * 0.08;
      this.leftPoleRoot.position.z = 0.4 + leftSwing * 0.18;
      this.leftPoleRoot.rotation.x = -leftSwing * 0.25;

      this.rightPoleRoot.position.y = 0.15 + rightSwing * 0.08;
      this.rightPoleRoot.position.z = 0.4 + rightSwing * 0.18;
      this.rightPoleRoot.rotation.x = -rightSwing * 0.25;
    }

    // 5. High-Velocity Snow Powder Spray emission
    const carveIntensity = Math.abs(steerInput);
    if (this.powderParticlesLeft && this.powderParticlesRight) {
      if (speedMph > 14) {
        // Hurl high-velocity snow rooster tails outward on carving edges
        const baseSpray = Math.round(25 + (speedMph / 40) * 35);
        this.powderParticlesLeft.emitRate = Math.round(steerInput > 0 ? carveIntensity * 380 + baseSpray : baseSpray);
        this.powderParticlesRight.emitRate = Math.round(steerInput < 0 ? carveIntensity * 380 + baseSpray : baseSpray);
      } else {
        this.powderParticlesLeft.emitRate = 0;
        this.powderParticlesRight.emitRate = 0;
      }
    }
  }
}
