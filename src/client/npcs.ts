/**
 * SkiFree Yeti DO - Procedural NPC Skiers & Physical Wipeout Knockdown Engine
 * Features elevated skier anatomy (beanie, mirrored goggles, ski poles, curved skis)
 * and true physical "Yard Sale" wipeout dynamics: ski binding eject, body tumble,
 * snow powder plume explosions, and downhill friction slide.
 */

import {
  Scene,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Vector3,
  Mesh,
  Scalar,
  ParticleSystem,
  Texture,
  Ray,
  DynamicTexture,
  LinesMesh
} from "@babylonjs/core";

export const NPC_COLORS = [
  "#ffcc00", // Hazard Patrol Yellow
  "#ffd700", // Alpine Gold Yellow
  "#e6b800", // High-Vis Amber Yellow
  "#ffea00"  // Radiant Tactical Yellow
];

export interface DetachedGear {
  mesh: Mesh;
  velocity: Vector3;
  angularVelocity: Vector3;
  isGrounded: boolean;
}

export interface RemotePlayerInstance {
  id: string;
  callsign: string;
  rootMesh: Mesh;
  bodyMesh: Mesh;
  headMesh: Mesh;
  leftSkiMesh: Mesh;
  rightSkiMesh: Mesh;
  nametagPlane: Mesh;
  nametagTexture: DynamicTexture;
  towlineMesh: LinesMesh | null;
  x: number;
  y: number;
  z: number;
  targetX: number;
  targetY: number;
  targetZ: number;
  rotationY: number;
  targetRotationY: number;
  speed: number;
  hp: number;
  isTethered: boolean;
  isDragging: boolean;
  lastPacketTime: number;
}

export interface NPCInstance {
  mesh: Mesh;
  bodyMesh: Mesh;
  headMesh: Mesh;
  leftSkiMesh: Mesh;
  rightSkiMesh: Mesh;
  leftPoleMesh: Mesh;
  rightPoleMesh: Mesh;
  x: number;
  y: number;
  z: number;
  speed: number;
  steer: number;
  type: "skier" | "snowboarder";
  isKnockedOver: boolean;
  knockTimer: number;
  velocity: Vector3;
  angularVelocity: Vector3;
  detachedGear: DetachedGear[];
  color: string;
}

export class NPCSystem {
  private scene: Scene;
  public npcs: NPCInstance[] = [];
  private totalCount: number = 24;
  private snowParticleSystem: ParticleSystem | null = null;
  private bloodParticleSystem: ParticleSystem | null = null;

  constructor(scene: Scene) {
    this.scene = scene;
  }

  public init(): void {
    this.initParticleSystems();

    // Scatter NPCs ahead of skier downhill (along -Z)
    for (let i = 0; i < this.totalCount; i++) {
      this.spawnNPC(i, -25 - i * 22);
    }
  }

  public remotePlayers: Map<string, RemotePlayerInstance> = new Map();

  public updatePlayers(skiers: any[]): void {
    if (!skiers || !Array.isArray(skiers)) return;
    const now = Date.now();
    const activeIds = new Set<string>();

    for (const skier of skiers) {
      const id = skier.id || skier.callsign;
      if (!id) continue;
      activeIds.add(id);

      let player = this.remotePlayers.get(id);
      if (!player) {
        player = this.spawnRemotePlayer(id, skier.callsign || id, skier.x ?? 0, skier.y ?? 0, skier.z ?? 0);
        this.remotePlayers.set(id, player);
      }

      player.targetX = typeof skier.x === "number" ? skier.x : player.x;
      player.targetY = typeof skier.y === "number" ? skier.y : player.y;
      player.targetZ = typeof skier.z === "number" ? skier.z : player.z;
      if (typeof skier.rotationY === "number") {
        player.targetRotationY = skier.rotationY;
      }
      player.speed = skier.speed ?? player.speed;
      player.hp = skier.hp ?? player.hp;
      player.isTethered = Boolean(skier.isTethered);
      player.isDragging = Boolean(skier.isDragging);
      player.lastPacketTime = now;
    }

    for (const [id, player] of this.remotePlayers.entries()) {
      if (!activeIds.has(id) && now - player.lastPacketTime > 3500) {
        this.disposeRemotePlayer(player);
        this.remotePlayers.delete(id);
      }
    }
  }

  private spawnRemotePlayer(id: string, callsign: string, x: number, y: number, z: number): RemotePlayerInstance {
    const root = new Mesh(`remoteSkier_${id}`, this.scene);
    root.position.set(x, y, z);

    let hash = 0;
    for (let i = 0; i < callsign.length; i++) {
      hash = callsign.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colorPalette = ["#00e5ff", "#ff007f", "#76ff03", "#ff9100", "#d500f9", "#00e676", "#3d5afe"];
    const jacketHex = colorPalette[Math.abs(hash) % colorPalette.length];

    const jacketMat = new StandardMaterial(`remoteJacket_${id}`, this.scene);
    jacketMat.diffuseColor = Color3.FromHexString(jacketHex);
    jacketMat.specularColor = new Color3(0.4, 0.4, 0.4);

    const gearMat = new StandardMaterial(`remoteGear_${id}`, this.scene);
    gearMat.diffuseColor = new Color3(0.12, 0.14, 0.18);

    const body = MeshBuilder.CreateBox(`remoteBody_${id}`, { width: 0.85, height: 1.15, depth: 0.52 }, this.scene);
    body.material = jacketMat;
    body.position.set(0, 1.05, 0.05);
    body.rotation.x = 0.12;
    body.parent = root;

    const head = MeshBuilder.CreateSphere(`remoteHead_${id}`, { diameter: 0.52 }, this.scene);
    head.material = jacketMat;
    head.position.set(0, 1.85, 0.15);
    head.parent = root;

    const goggleMat = new StandardMaterial(`remoteGoggle_${id}`, this.scene);
    goggleMat.diffuseColor = new Color3(0.05, 0.2, 0.35);
    goggleMat.specularColor = new Color3(0.9, 0.95, 1.0);
    goggleMat.specularPower = 64;
    const goggles = MeshBuilder.CreateBox(`remoteGoggles_${id}`, { width: 0.48, height: 0.16, depth: 0.22 }, this.scene);
    goggles.material = goggleMat;
    goggles.position.set(0, 1.86, -0.16);
    goggles.parent = root;

    const leftSki = MeshBuilder.CreateBox(`remoteLeftSki_${id}`, { width: 0.14, height: 0.04, depth: 1.8 }, this.scene);
    leftSki.material = gearMat;
    leftSki.position.set(-0.26, 0.02, 0);
    leftSki.parent = root;

    const rightSki = MeshBuilder.CreateBox(`remoteRightSki_${id}`, { width: 0.14, height: 0.04, depth: 1.8 }, this.scene);
    rightSki.material = gearMat;
    rightSki.position.set(0.26, 0.02, 0);
    rightSki.parent = root;

    const tex = new DynamicTexture(`remoteNametagTex_${id}`, { width: 256, height: 64 }, this.scene, false);
    tex.hasAlpha = true;
    tex.drawText(callsign.toUpperCase(), null, 42, "bold 28px monospace", jacketHex, "rgba(8,12,24,0.85)", true);

    const nametagPlane = MeshBuilder.CreatePlane(`remoteNametagPlane_${id}`, { width: 2.2, height: 0.55 }, this.scene);
    const nametagMat = new StandardMaterial(`remoteNametagMat_${id}`, this.scene);
    nametagMat.diffuseTexture = tex;
    nametagMat.emissiveColor = new Color3(0.6, 0.9, 1.0);
    nametagMat.backFaceCulling = false;
    nametagPlane.material = nametagMat;
    nametagPlane.billboardMode = Mesh.BILLBOARDMODE_ALL;
    nametagPlane.position.set(0, 2.45, 0);
    nametagPlane.parent = root;

    return {
      id,
      callsign,
      rootMesh: root,
      bodyMesh: body,
      headMesh: head,
      leftSkiMesh: leftSki,
      rightSkiMesh: rightSki,
      nametagPlane,
      nametagTexture: tex,
      towlineMesh: null,
      x,
      y,
      z,
      targetX: x,
      targetY: y,
      targetZ: z,
      rotationY: Math.PI,
      targetRotationY: Math.PI,
      speed: 35,
      hp: 100,
      isTethered: false,
      isDragging: false,
      lastPacketTime: Date.now()
    };
  }

  private disposeRemotePlayer(player: RemotePlayerInstance): void {
    if (player.towlineMesh) {
      player.towlineMesh.dispose();
      player.towlineMesh = null;
    }
    if (player.nametagTexture) {
      player.nametagTexture.dispose();
    }
    if (player.rootMesh) {
      player.rootMesh.dispose();
    }
  }

  private initParticleSystems(): void {
    // Volumetric Snow Explosion Plume on Wipeout
    this.snowParticleSystem = new ParticleSystem("npcSnowBurst", 300, this.scene);
    this.snowParticleSystem.particleTexture = new Texture("/assets/snow_texture.jpg", this.scene);
    this.snowParticleSystem.color1 = new Color3(1.0, 1.0, 1.0).toColor4(0.9);
    this.snowParticleSystem.color2 = new Color3(0.8, 0.95, 1.0).toColor4(0.5);
    this.snowParticleSystem.colorDead = new Color3(1.0, 1.0, 1.0).toColor4(0.0);
    this.snowParticleSystem.minSize = 0.25;
    this.snowParticleSystem.maxSize = 0.85;
    this.snowParticleSystem.minLifeTime = 0.4;
    this.snowParticleSystem.maxLifeTime = 1.1;
    this.snowParticleSystem.emitRate = 0; // Triggered on knockdown
    this.snowParticleSystem.direction1 = new Vector3(-3, 4, -3);
    this.snowParticleSystem.direction2 = new Vector3(3, 7, 3);
    this.snowParticleSystem.gravity = new Vector3(0, -9.81, 0);
    this.snowParticleSystem.start();

    // Crimson Impact Plume for Yeti Swat Knockdowns
    this.bloodParticleSystem = new ParticleSystem("npcBloodBurst", 150, this.scene);
    this.bloodParticleSystem.particleTexture = new Texture("/assets/ice_texture.jpg", this.scene);
    this.bloodParticleSystem.color1 = new Color3(0.85, 0.05, 0.05).toColor4(1.0);
    this.bloodParticleSystem.color2 = new Color3(0.4, 0.0, 0.0).toColor4(0.7);
    this.bloodParticleSystem.colorDead = new Color3(0.2, 0.0, 0.0).toColor4(0.0);
    this.bloodParticleSystem.minSize = 0.2;
    this.bloodParticleSystem.maxSize = 0.55;
    this.bloodParticleSystem.minLifeTime = 0.3;
    this.bloodParticleSystem.maxLifeTime = 0.8;
    this.bloodParticleSystem.emitRate = 0;
    this.bloodParticleSystem.direction1 = new Vector3(-2, 3, -2);
    this.bloodParticleSystem.direction2 = new Vector3(2, 6, 2);
    this.bloodParticleSystem.gravity = new Vector3(0, -12.0, 0);
    this.bloodParticleSystem.start();
  }

  private spawnNPC(index: number, z: number): void {
    const isSnowboarder = Math.random() < 0.25;
    const colorHex = NPC_COLORS[index % NPC_COLORS.length];
    const x = (Math.random() - 0.5) * 110;
    const speed = 24 + Math.random() * 16;

    const npcRoot = new Mesh(`npcRoot_${index}`, this.scene);
    npcRoot.position.set(x, 0, z);

    // Jacket Material
    const jacketMat = new StandardMaterial(`jacketMat_${index}`, this.scene);
    jacketMat.diffuseColor = Color3.FromHexString(colorHex);
    jacketMat.specularColor = new Color3(0.15, 0.15, 0.15);

    // Mirrored Goggles Material (High specular metallic shine)
    const goggleMat = new StandardMaterial(`goggleMat_${index}`, this.scene);
    goggleMat.diffuseColor = new Color3(0.05, 0.2, 0.35);
    goggleMat.specularColor = new Color3(0.9, 0.95, 1.0);
    goggleMat.specularPower = 64;

    // Ski/Board Gear Material
    const gearMat = new StandardMaterial(`gearMat_${index}`, this.scene);
    gearMat.diffuseColor = new Color3(0.12, 0.14, 0.18);
    gearMat.specularColor = new Color3(0.3, 0.3, 0.3);

    // Ski Pole Metal Material
    const poleMat = new StandardMaterial(`poleMat_${index}`, this.scene);
    poleMat.diffuseColor = new Color3(0.7, 0.72, 0.75);
    poleMat.specularColor = new Color3(0.8, 0.8, 0.8);

    // 1. Torso / Jacket (Athletic forward ski posture)
    const body = MeshBuilder.CreateBox(`npcBody_${index}`, { width: 0.85, height: 1.15, depth: 0.52 }, this.scene);
    body.material = jacketMat;
    body.position.set(0, 1.05, 0.05);
    body.rotation.x = 0.12; // Forward lean
    body.parent = npcRoot;

    // Racing Bib on Chest
    const bib = MeshBuilder.CreatePlane(`npcBib_${index}`, { width: 0.55, height: 0.45 }, this.scene);
    const bibMat = new StandardMaterial(`bibMat_${index}`, this.scene);
    bibMat.diffuseColor = new Color3(0.95, 0.95, 0.95);
    bib.material = bibMat;
    bib.position.set(0, 1.1, -0.23);
    bib.rotation.x = 0.12;
    bib.parent = npcRoot;

    // 2. Head with Beanie
    const head = MeshBuilder.CreateSphere(`npcHead_${index}`, { diameter: 0.52 }, this.scene);
    head.material = jacketMat;
    head.position.set(0, 1.85, 0.15);
    head.parent = npcRoot;

    // 3. Mirrored Wraparound Goggles
    const goggles = MeshBuilder.CreateBox(`npcGoggles_${index}`, { width: 0.48, height: 0.16, depth: 0.22 }, this.scene);
    goggles.material = goggleMat;
    goggles.position.set(0, 1.86, -0.16);
    goggles.parent = npcRoot;

    // 4. Arms & Poles
    const leftArm = MeshBuilder.CreateCylinder(`npcLeftArm_${index}`, { height: 0.85, diameter: 0.18 }, this.scene);
    leftArm.material = jacketMat;
    leftArm.position.set(-0.55, 1.05, 0.1);
    leftArm.rotation.z = -0.3;
    leftArm.rotation.x = 0.4;
    leftArm.parent = npcRoot;

    const rightArm = MeshBuilder.CreateCylinder(`npcRightArm_${index}`, { height: 0.85, diameter: 0.18 }, this.scene);
    rightArm.material = jacketMat;
    rightArm.position.set(0.55, 1.05, 0.1);
    rightArm.rotation.z = 0.3;
    rightArm.rotation.x = 0.4;
    rightArm.parent = npcRoot;

    // Ski Poles (Detachable during yard-sale wipeout)
    const leftPole = MeshBuilder.CreateCylinder(`npcLeftPole_${index}`, { height: 1.35, diameter: 0.04 }, this.scene);
    leftPole.material = poleMat;
    leftPole.position.set(-0.7, 0.65, 0.25);
    leftPole.rotation.x = 0.35;
    leftPole.parent = npcRoot;

    const leftBasket = MeshBuilder.CreateCylinder(`npcLeftBasket_${index}`, { height: 0.02, diameter: 0.16 }, this.scene);
    leftBasket.material = gearMat;
    leftBasket.position.set(0, -0.55, 0);
    leftBasket.parent = leftPole;

    const rightPole = MeshBuilder.CreateCylinder(`npcRightPole_${index}`, { height: 1.35, diameter: 0.04 }, this.scene);
    rightPole.material = poleMat;
    rightPole.position.set(0.7, 0.65, 0.25);
    rightPole.rotation.x = 0.35;
    rightPole.parent = npcRoot;

    const rightBasket = MeshBuilder.CreateCylinder(`npcRightBasket_${index}`, { height: 0.02, diameter: 0.16 }, this.scene);
    rightBasket.material = gearMat;
    rightBasket.position.set(0, -0.55, 0);
    rightBasket.parent = rightPole;

    // 5. Downhill Skis with Curved Upward Tips (Detachable)
    const leftSki = MeshBuilder.CreateBox(`npcLeftSki_${index}`, { width: 0.14, height: 0.04, depth: 1.8 }, this.scene);
    leftSki.material = gearMat;
    leftSki.position.set(-0.26, 0.02, 0);
    leftSki.parent = npcRoot;

    const leftTip = MeshBuilder.CreateBox(`npcLeftTip_${index}`, { width: 0.14, height: 0.04, depth: 0.28 }, this.scene);
    leftTip.material = jacketMat;
    leftTip.position.set(0, 0.08, -0.92);
    leftTip.rotation.x = -0.45; // Curved ski tip
    leftTip.parent = leftSki;

    const rightSki = MeshBuilder.CreateBox(`npcRightSki_${index}`, { width: 0.14, height: 0.04, depth: 1.8 }, this.scene);
    rightSki.material = gearMat;
    rightSki.position.set(0.26, 0.02, 0);
    rightSki.parent = npcRoot;

    const rightTip = MeshBuilder.CreateBox(`npcRightTip_${index}`, { width: 0.14, height: 0.04, depth: 0.28 }, this.scene);
    rightTip.material = jacketMat;
    rightTip.position.set(0, 0.08, -0.92);
    rightTip.rotation.x = -0.45;
    rightTip.parent = rightSki;

    // Face downhill (-Z)
    npcRoot.rotation.y = Math.PI;

    this.npcs.push({
      mesh: npcRoot,
      bodyMesh: body,
      headMesh: head,
      leftSkiMesh: leftSki,
      rightSkiMesh: rightSki,
      leftPoleMesh: leftPole,
      rightPoleMesh: rightPole,
      x,
      y: 0,
      z,
      speed,
      steer: (Math.random() - 0.5) * 0.4,
      type: isSnowboarder ? "snowboarder" : "skier",
      isKnockedOver: false,
      knockTimer: 0,
      velocity: Vector3.Zero(),
      angularVelocity: Vector3.Zero(),
      detachedGear: [],
      color: colorHex
    });
  }

  /**
   * Triggers a visceral physical knock-over & "yard sale" wipeout.
   * Detaches skis and poles, throws them across the snow, pitches the skier 90°,
   * and slides downhill with kinetic snow friction.
   */
  public knockOver(
    npc: NPCInstance,
    impactVelocity: Vector3,
    source: "player" | "yeti" | "shot"
  ): void {
    if (npc.isKnockedOver) return;

    npc.isKnockedOver = true;
    npc.knockTimer = 0;

    // 1. Powder Explosion at Impact Location
    this.spawnSnowPlume(npc.mesh.position, source === "yeti");

    // 2. The "Yard Sale": Skis & Poles Detach into World Space
    this.detachSkiOrPole(npc, npc.leftSkiMesh, new Vector3(-6.5, 7.5, impactVelocity.z * 0.7));
    this.detachSkiOrPole(npc, npc.rightSkiMesh, new Vector3(6.5, 8.2, impactVelocity.z * 0.7));
    this.detachSkiOrPole(npc, npc.leftPoleMesh, new Vector3(-4.0, 9.5, impactVelocity.z * 0.5));
    this.detachSkiOrPole(npc, npc.rightPoleMesh, new Vector3(4.0, 10.0, impactVelocity.z * 0.5));

    // 3. Skier Body Momentum & Tumble Impulses
    if (source === "player") {
      // Player high-speed collision: direct forward impact + lateral deflection
      npc.velocity = new Vector3(
        impactVelocity.x * 0.75 + (Math.random() - 0.5) * 8.0,
        5.2,
        impactVelocity.z * 1.15
      );
      // Pitch forward & roll violently into the snow
      npc.angularVelocity = new Vector3(9.5, (Math.random() - 0.5) * 8.0, (Math.random() - 0.5) * 12.0);
    } else if (source === "yeti") {
      // Yeti massive claw swipe / pounce: launched 15m into the air
      npc.velocity = new Vector3(
        (Math.random() - 0.5) * 22.0,
        15.5,
        -32.0 // Blasted downhill
      );
      // Violent 360-degree cartwheel tumble
      npc.angularVelocity = new Vector3(14.0, 8.5, 11.0);
    } else {
      // Rifle shot / Harpoon impact: knocked backwards
      npc.velocity = new Vector3(
        impactVelocity.x * 12.0,
        4.2,
        impactVelocity.z * 18.0
      );
      npc.angularVelocity = new Vector3(-8.5, 4.0, 5.0);
    }
  }

  private detachSkiOrPole(npc: NPCInstance, gearMesh: Mesh, baseVel: Vector3): void {
    if (!gearMesh) return;

    // Get current absolute world position before unparenting
    const worldPos = gearMesh.getAbsolutePosition().clone();
    const worldRot = gearMesh.rotation.clone();

    gearMesh.parent = null;
    gearMesh.position.copyFrom(worldPos);
    gearMesh.rotation.copyFrom(worldRot);

    npc.detachedGear.push({
      mesh: gearMesh,
      velocity: new Vector3(
        baseVel.x + (Math.random() - 0.5) * 4.0,
        baseVel.y + Math.random() * 3.0,
        baseVel.z + (Math.random() - 0.5) * 6.0
      ),
      angularVelocity: new Vector3(
        (Math.random() - 0.5) * 20.0,
        (Math.random() - 0.5) * 20.0,
        (Math.random() - 0.5) * 20.0
      ),
      isGrounded: false
    });
  }

  private spawnSnowPlume(position: Vector3, isYetiSwat: boolean): void {
    if (this.snowParticleSystem) {
      const plumeEmitter = new Mesh("snowPlumeEmitter", this.scene);
      plumeEmitter.position.copyFrom(position);
      this.snowParticleSystem.emitter = plumeEmitter;
      this.snowParticleSystem.manualEmitCount = isYetiSwat ? 260 : 180;

      setTimeout(() => {
        plumeEmitter.dispose();
      }, 1500);
    }

    if (isYetiSwat && this.bloodParticleSystem) {
      const bloodEmitter = new Mesh("bloodPlumeEmitter", this.scene);
      bloodEmitter.position.copyFrom(position);
      this.bloodParticleSystem.emitter = bloodEmitter;
      this.bloodParticleSystem.manualEmitCount = 120;

      setTimeout(() => {
        bloodEmitter.dispose();
      }, 1500);
    }
  }

  /**
   * Tests for player collision against active (standing) NPCs.
   * If collision occurs, triggers knockOver with player's forward speed vector.
   */
  public checkPlayerCollision(
    playerPos: Vector3,
    playerSpeedMph: number,
    steerInput: number
  ): boolean {
    const forwardUnitsPerSec = (playerSpeedMph * 0.44704) * 2.2;
    const playerVel = new Vector3(-steerInput * 22, 0, -forwardUnitsPerSec);

    for (const npc of this.npcs) {
      if (npc.isKnockedOver) continue;

      const dx = Math.abs(npc.x - playerPos.x);
      const dz = Math.abs(npc.z - playerPos.z);

      // Hitbox: 1.4m width, 1.8m depth
      if (dx < 1.4 && dz < 1.8) {
        this.knockOver(npc, playerVel, "player");
        return true;
      }
    }
    return false;
  }

  /**
   * Tests hitscan rifle ray against active NPCs.
   */
  public checkRayHit(ray: Ray): boolean {
    for (const npc of this.npcs) {
      if (npc.isKnockedOver) continue;

      const npcCenter = npc.mesh.position.add(new Vector3(0, 1.2, 0));
      const v = npcCenter.subtract(ray.origin);
      const t = Vector3.Dot(v, ray.direction);
      if (t > 0 && t < 220) {
        const proj = ray.origin.add(ray.direction.scale(t));
        const dist = Vector3.Distance(npcCenter, proj);
        if (dist < 1.1) {
          this.knockOver(npc, ray.direction, "shot");
          return true;
        }
      }
    }
    return false;
  }

  public update(playerZ: number, yetiPos: Vector3, deltaTime: number, terrainHeightFn?: (x: number, z: number) => number): void {
    const dt = Math.min(deltaTime, 0.1);

    // Update Remote Network Players
    for (const player of this.remotePlayers.values()) {
      player.x = Scalar.Lerp(player.x, player.targetX, dt * 14.0);
      player.y = Scalar.Lerp(player.y, player.targetY, dt * 14.0);
      player.z = Scalar.Lerp(player.z, player.targetZ, dt * 14.0);
      player.rotationY = Scalar.Lerp(player.rotationY, player.targetRotationY, dt * 10.0);

      if (terrainHeightFn) {
        const groundH = terrainHeightFn(player.x, player.z);
        player.y = Math.max(player.y, groundH);
      }

      player.rootMesh.position.set(player.x, player.y, player.z);
      player.rootMesh.rotation.y = player.rotationY;

      if (player.isTethered && yetiPos) {
        const startPos = player.rootMesh.position.add(new Vector3(0, 1.1, -0.3));
        const endPos = yetiPos.add(new Vector3(0, 2.2, 0));
        if (!player.towlineMesh) {
          player.towlineMesh = MeshBuilder.CreateLines(
            `remoteTow_${player.id}`,
            { points: [startPos, endPos], updatable: true },
            this.scene
          );
          player.towlineMesh.color = new Color3(1.0, 0.84, 0.0);
        } else {
          MeshBuilder.CreateLines(
            `remoteTow_${player.id}`,
            { points: [startPos, endPos], instance: player.towlineMesh }
          );
        }
      } else if (player.towlineMesh) {
        player.towlineMesh.dispose();
        player.towlineMesh = null;
      }
    }

    for (const npc of this.npcs) {
      if (!npc.isKnockedOver) {
        // -------------------------------------------------------------
        // -------------------------------------------------------------
        // STATE A: STANDING & SKIING DOWNHILL (WITH REACTIVE PANIC AI)
        // -------------------------------------------------------------
        // Yeti Proximity & Threat Perception (< 18m behind skier)
        const distToYeti = Vector3.Distance(npc.mesh.position, yetiPos);
        const isYetiPursuing = distToYeti < 18.0 && yetiPos.z > npc.z;

        if (isYetiPursuing) {
          // Threat detected: Lookback uphill at Yeti + Panic tuck + Evasive Carve
          npc.headMesh.rotation.y = Scalar.Lerp(npc.headMesh.rotation.y, Math.PI * 0.9, dt * 8.0);
          npc.bodyMesh.rotation.x = Scalar.Lerp(npc.bodyMesh.rotation.x, 0.32, dt * 6.0); // Deep aerodynamic speed tuck
          npc.speed = Math.min(62, npc.speed + 14 * dt * 2.5); // Panic acceleration (+12-16 MPH)

          // Desperate evasive carving away from Yeti's attack corridor
          const evadeDir = npc.x > yetiPos.x ? 1 : -1;
          npc.x += evadeDir * 12 * dt;
        } else {
          npc.headMesh.rotation.y = Scalar.Lerp(npc.headMesh.rotation.y, 0, dt * 4.0);
          npc.bodyMesh.rotation.x = Scalar.Lerp(npc.bodyMesh.rotation.x, 0.12, dt * 4.0);
        }

        const forwardUnits = (npc.speed * 0.44704) * 2.2;
        npc.z -= forwardUnits * dt;
        npc.x += Math.sin(npc.z * 0.05) * 8 * dt;

        let groundY = 0;
        if (terrainHeightFn) {
            groundY = terrainHeightFn(npc.x, npc.z);
        }
        npc.y = groundY;
        npc.mesh.position.set(npc.x, npc.y, npc.z);

        // Dynamic carving tilt
        npc.mesh.rotation.z = Math.sin(npc.z * 0.05) * 0.18 + (isYetiPursuing ? (npc.x > yetiPos.x ? 0.15 : -0.15) : 0);

        // Yeti Proximity Check (< 3.8m from Yeti): Yeti Swat Knockdown!
        if (distToYeti < 3.8) {
          const yetiSwipeVector = npc.mesh.position.subtract(yetiPos).normalize().scale(28);
          yetiSwipeVector.y = 16;
          this.knockOver(npc, yetiSwipeVector, "yeti");
        }

        // Recycle NPC ahead if player has passed far beyond
        if (npc.z > playerZ + 90) {
          this.recycleNPC(npc, playerZ);
        }
      } else {
        // -------------------------------------------------------------
        // STATE B: KNOCKED OVER / TUMBLING IN POWDER ("YARD SALE")
        // -------------------------------------------------------------
        npc.knockTimer += dt;

        // 1. Gravity on skier body
        npc.velocity.y -= 19.6 * dt;

        // 2. Linear Position integration
        npc.x += npc.velocity.x * dt;
        npc.y += npc.velocity.y * dt;
        npc.z += npc.velocity.z * dt;

        // 3. Ground collision with true 3D snow slope (0.35m resting body height)
        const bodyRestY = terrainHeightFn ? terrainHeightFn(npc.x, npc.z) + 0.35 : 0.35;
        if (npc.y <= bodyRestY) {
          npc.y = bodyRestY;
          if (npc.velocity.y < -3.0) {
            // Elastic bounce off snow + puff
            npc.velocity.y = -npc.velocity.y * 0.22;
          } else {
            npc.velocity.y = 0;
          }

          // Kinetic snow slide friction (rapid deceleration along X and Z)
          const snowFriction = Math.max(0, 1.0 - 3.2 * dt);
          npc.velocity.x *= snowFriction;
          npc.velocity.z *= snowFriction;

          // Dampen angular tumbling once sliding on snow
          npc.angularVelocity.scaleInPlace(Math.max(0, 1.0 - 4.2 * dt));
        }

        npc.mesh.position.set(npc.x, npc.y, npc.z);

        // 4. Angular Tumble Rotation
        npc.mesh.rotation.x += npc.angularVelocity.x * dt;
        npc.mesh.rotation.y += npc.angularVelocity.y * dt;
        npc.mesh.rotation.z += npc.angularVelocity.z * dt;

        // 5. Simulate Detached Gear (Flying Skis & Poles)
        for (const gear of npc.detachedGear) {
          if (!gear.mesh) continue;

          gear.velocity.y -= 18.0 * dt;
          gear.mesh.position.addInPlace(gear.velocity.scale(dt));

          // Ground bounce and slide for skis/poles (0.08m resting gear height)
          const gearRestY = terrainHeightFn ? terrainHeightFn(gear.mesh.position.x, gear.mesh.position.z) + 0.08 : 0.08;
          if (gear.mesh.position.y <= gearRestY) {
            gear.mesh.position.y = gearRestY;
            if (gear.velocity.y < -2.0) {
              gear.velocity.y = -gear.velocity.y * 0.25;
            } else {
              gear.velocity.y = 0;
              gear.isGrounded = true;
            }
            gear.velocity.x *= Math.max(0, 1.0 - 2.8 * dt);
            gear.velocity.z *= Math.max(0, 1.0 - 2.8 * dt);
            gear.angularVelocity.scaleInPlace(Math.max(0, 1.0 - 3.5 * dt));
          }

          gear.mesh.rotation.addInPlace(gear.angularVelocity.scale(dt));
        }

        // Recycle after player moves far downhill
        if (npc.z > playerZ + 120) {
          this.recycleNPC(npc, playerZ);
        }
      }
    }
  }

  private recycleNPC(npc: NPCInstance, playerZ: number): void {
    // Clean up detached gear meshes
    for (const gear of npc.detachedGear) {
      if (gear.mesh) gear.mesh.dispose();
    }
    npc.detachedGear = [];

    // Reset position ahead of player downhill
    npc.x = (Math.random() - 0.5) * 110;
    npc.y = 0.35;
    npc.z = playerZ - 180 - Math.random() * 90;
    npc.speed = 24 + Math.random() * 16;
    npc.isKnockedOver = false;
    npc.knockTimer = 0;
    npc.velocity.set(0, 0, 0);
    npc.angularVelocity.set(0, 0, 0);

    // Re-parent skis and poles
    this.rebuildGearOnNPC(npc);

    npc.mesh.position.set(npc.x, 0, npc.z);
    npc.mesh.rotation.set(0, Math.PI, 0);
    npc.mesh.setEnabled(true);
  }

  private rebuildGearOnNPC(npc: NPCInstance): void {
    const gearMat = new StandardMaterial(`gearMat_rebuilt`, this.scene);
    gearMat.diffuseColor = new Color3(0.12, 0.14, 0.18);

    const poleMat = new StandardMaterial(`poleMat_rebuilt`, this.scene);
    poleMat.diffuseColor = new Color3(0.7, 0.72, 0.75);

    // Re-create skis
    npc.leftSkiMesh = MeshBuilder.CreateBox("npcLeftSki_r", { width: 0.14, height: 0.04, depth: 1.8 }, this.scene);
    npc.leftSkiMesh.material = gearMat;
    npc.leftSkiMesh.position.set(-0.26, 0.02, 0);
    npc.leftSkiMesh.parent = npc.mesh;

    npc.rightSkiMesh = MeshBuilder.CreateBox("npcRightSki_r", { width: 0.14, height: 0.04, depth: 1.8 }, this.scene);
    npc.rightSkiMesh.material = gearMat;
    npc.rightSkiMesh.position.set(0.26, 0.02, 0);
    npc.rightSkiMesh.parent = npc.mesh;

    // Re-create poles
    npc.leftPoleMesh = MeshBuilder.CreateCylinder("npcLeftPole_r", { height: 1.35, diameter: 0.04 }, this.scene);
    npc.leftPoleMesh.material = poleMat;
    npc.leftPoleMesh.position.set(-0.7, 0.65, 0.25);
    npc.leftPoleMesh.rotation.x = 0.35;
    npc.leftPoleMesh.parent = npc.mesh;

    npc.rightPoleMesh = MeshBuilder.CreateCylinder("npcRightPole_r", { height: 1.35, diameter: 0.04 }, this.scene);
    npc.rightPoleMesh.material = poleMat;
    npc.rightPoleMesh.position.set(0.7, 0.65, 0.25);
    npc.rightPoleMesh.rotation.x = 0.35;
    npc.rightPoleMesh.parent = npc.mesh;
  }
}
