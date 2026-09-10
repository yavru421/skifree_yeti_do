/**
 * SkiFree Yeti DO - Procedural Terrain, Granby Colorado Runs & Slalom System
 * Generates an authentic Granby Ranch (CO) ski mountain experience:
 * - Real Granby Colorado Runs: Quick Draw (Aspens), Jackalope (Cruiser), Rodeo (Moguls), High Roller (Glades).
 * - Colorado Golden Aspen Trees vs Colorado Blue Spruce pines per run.
 * - Dynamic atmospheric lighting, fog, snow tint, and sky shifts for each Colorado run.
 * - Alpine race boundary safety netting along the trail borders.
 * - True 3D sculpted mogul mounds for Rodeo (Black Diamond).
 * - Overhead Course Archways and Trail Mile Markers repeating down the mountain.
 * - Collectible nitro wax and cryo harpoon power-ups.
 */

import {
  Scene,
  MeshBuilder,
  StandardMaterial,
  Texture,
  DynamicTexture,
  Color3,
  Vector3,
  Mesh,
  InstancedMesh
} from "@babylonjs/core";
import { PowerUpType } from "./types";
import { GranbyTrackConfig, getGranbyTrack } from "./granbyTracks";

export interface ObstacleInstance {
  mesh: InstancedMesh | Mesh;
  x: number;
  z: number;
  radius: number;
  type: "tree" | "aspen" | "rock" | "mogul" | "fence" | "arch" | "sign";
}

export interface SlalomGateInstance {
  id: string;
  x: number;
  z: number;
  width: number;
  passed: boolean;
  leftPole: InstancedMesh;
  rightPole: InstancedMesh;
}

export interface PowerUpInstance {
  id: string;
  x: number;
  z: number;
  type: PowerUpType;
  mesh: Mesh;
  collected: boolean;
}

export class TerrainSystem {
  private scene: Scene;
  private groundChunks: Mesh[] = [];
  private chunkSize: number = 300;
  private totalChunks: number = 5;
  private snowMat!: StandardMaterial;

  // Templates for Instancing
  private baseTreeMesh: Mesh | null = null;
  private baseAspenMesh: Mesh | null = null;
  private baseRockMesh: Mesh | null = null;
  private baseMogulMesh: Mesh | null = null;
  private baseFenceMesh: Mesh | null = null;
  private baseSlalomRedMesh: Mesh | null = null;
  private baseSlalomBlueMesh: Mesh | null = null;

  public obstacles: ObstacleInstance[] = [];
  public slalomGates: SlalomGateInstance[] = [];
  public powerUps: PowerUpInstance[] = [];
  public currentTrack: GranbyTrackConfig = getGranbyTrack(1);
  private archwayCounter: number = 0;

  constructor(scene: Scene) {
    this.scene = scene;
  }

  public init(): void {
    // 1. Snow Slope Material with Groomed Corduroy Texture
    this.snowMat = new StandardMaterial("snowMat", this.scene);
    this.snowMat.diffuseTexture = new Texture("/assets/snow_texture.jpg", this.scene);
    (this.snowMat.diffuseTexture as Texture).uScale = 40;
    (this.snowMat.diffuseTexture as Texture).vScale = 40;
    this.snowMat.specularColor = new Color3(0.2, 0.2, 0.25);
    this.snowMat.ambientColor = new Color3(0.9, 0.95, 1.0);

    // 2. Build recycled ground chunks downhill along -Z
    for (let i = 0; i < this.totalChunks; i++) {
      const ground = MeshBuilder.CreateGround(
        `snowGround_${i}`,
        { width: 500, height: this.chunkSize, subdivisions: 64, updatable: true },
        this.scene
      );
      ground.material = this.snowMat;
      ground.position.z = -i * this.chunkSize;
      ground.position.y = 0;
      ground.receiveShadows = true;
      this.groundChunks.push(ground);
    }

    // 3. Create template meshes for instancing
    this.createTemplateObstacles();

    // 4. Apply initial Level 1 (Quick Draw) Atmosphere & Obstacles
    this.applyTrack(this.currentTrack);
  }

  private createTemplateObstacles(): void {
    // 1. Colorado Blue Spruce Pine Tree Template
    this.baseTreeMesh = MeshBuilder.CreateCylinder(
      "baseTree",
      { height: 8.0, diameterTop: 0.15, diameterBottom: 3.8, tessellation: 7 },
      this.scene
    );
    const treeMat = new StandardMaterial("treeMat", this.scene);
    treeMat.diffuseColor = new Color3(0.08, 0.24, 0.14); // Deep Colorado spruce green
    treeMat.specularColor = new Color3(0.02, 0.02, 0.02);
    this.baseTreeMesh.material = treeMat;
    this.baseTreeMesh.position.y = 4.0;
    this.baseTreeMesh.isVisible = false;

    // 2. Colorado Golden Aspen Tree Template (Slender white bark + glowing amber leaves)
    this.baseAspenMesh = MeshBuilder.CreateCylinder(
      "baseAspenTrunk",
      { height: 8.5, diameterTop: 0.25, diameterBottom: 0.42, tessellation: 8 },
      this.scene
    );
    const aspenTrunkMat = new StandardMaterial("aspenTrunkMat", this.scene);
    aspenTrunkMat.diffuseColor = new Color3(0.92, 0.90, 0.86); // Distinct white birch/aspen bark
    aspenTrunkMat.specularColor = new Color3(0.05, 0.05, 0.05);
    this.baseAspenMesh.material = aspenTrunkMat;

    const aspenCanopy = MeshBuilder.CreateSphere(
      "baseAspenCanopy",
      { diameterX: 3.4, diameterY: 4.8, diameterZ: 3.4, segments: 5 },
      this.scene
    );
    const aspenLeafMat = new StandardMaterial("aspenLeafMat", this.scene);
    aspenLeafMat.diffuseColor = new Color3(0.98, 0.72, 0.12); // Radiant Colorado golden aspen foliage
    aspenLeafMat.specularColor = new Color3(0.1, 0.08, 0.02);
    aspenCanopy.material = aspenLeafMat;
    aspenCanopy.position.y = 2.4;
    aspenCanopy.parent = this.baseAspenMesh;

    this.baseAspenMesh.position.y = 4.25;
    this.baseAspenMesh.isVisible = false;
    aspenCanopy.isVisible = false;

    // 3. Granite Boulder Template
    this.baseRockMesh = MeshBuilder.CreateSphere(
      "baseRock",
      { diameterX: 2.8, diameterY: 1.8, diameterZ: 3.0, segments: 4 },
      this.scene
    );
    const rockMat = new StandardMaterial("rockMat", this.scene);
    rockMat.diffuseColor = new Color3(0.35, 0.38, 0.42);
    rockMat.specularColor = new Color3(0.05, 0.05, 0.05);
    this.baseRockMesh.material = rockMat;
    this.baseRockMesh.position.y = 0.8;
    this.baseRockMesh.isVisible = false;

    // 4. True 3D Mogul Snow Mound Template (for Rodeo Black Diamond)
    this.baseMogulMesh = MeshBuilder.CreateSphere(
      "baseMogul",
      { diameterX: 5.2, diameterY: 1.6, diameterZ: 4.4, segments: 6 },
      this.scene
    );
    const mogulMat = new StandardMaterial("mogulMat", this.scene);
    mogulMat.diffuseColor = new Color3(0.90, 0.94, 1.0);
    mogulMat.specularColor = new Color3(0.3, 0.3, 0.35);
    this.baseMogulMesh.material = mogulMat;
    this.baseMogulMesh.position.y = 0.5;
    this.baseMogulMesh.isVisible = false;

    // 5. Alpine Race Safety Netting Fence Template
    this.baseFenceMesh = MeshBuilder.CreateBox(
      "baseFence",
      { width: 0.18, height: 2.4, depth: 16.0 },
      this.scene
    );
    const fenceMat = new StandardMaterial("fenceMat", this.scene);
    fenceMat.diffuseColor = new Color3(1.0, 0.35, 0.0); // High-vis ski area orange
    fenceMat.emissiveColor = new Color3(0.35, 0.10, 0.0);
    this.baseFenceMesh.material = fenceMat;
    this.baseFenceMesh.position.y = 1.2;
    this.baseFenceMesh.isVisible = false;

    // 6. Slalom Red Pole Template
    this.baseSlalomRedMesh = MeshBuilder.CreateCylinder(
      "baseSlalomRed",
      { height: 4.4, diameter: 0.26 },
      this.scene
    );
    const redMat = new StandardMaterial("slalomRedMat", this.scene);
    redMat.diffuseColor = new Color3(1.0, 0.08, 0.2);
    redMat.emissiveColor = new Color3(0.7, 0.05, 0.15);
    this.baseSlalomRedMesh.material = redMat;
    this.baseSlalomRedMesh.position.y = 2.2;
    this.baseSlalomRedMesh.isVisible = false;

    // 7. Slalom Blue Pole Template
    this.baseSlalomBlueMesh = MeshBuilder.CreateCylinder(
      "baseSlalomBlue",
      { height: 4.4, diameter: 0.26 },
      this.scene
    );
    const blueMat = new StandardMaterial("slalomBlueMat", this.scene);
    blueMat.diffuseColor = new Color3(0.1, 0.55, 1.0);
    blueMat.emissiveColor = new Color3(0.08, 0.3, 0.85);
    this.baseSlalomBlueMesh.material = blueMat;
    this.baseSlalomBlueMesh.position.y = 2.2;
    this.baseSlalomBlueMesh.isVisible = false;
  }


  public getTerrainHeightAt(px: number, pz: number): number {
    const track = this.currentTrack;
    let y = 0;
    
    // Base slope pitch
    y += pz * Math.tan(this.getSlopePitchRad());
    
    // Banked carving turns (S-Curves)
    const turnBank = Math.sin(pz * track.turnFrequency);
    y += px * turnBank * track.bankAmplitude;
    
    // Fall-line rolls / elevation pitch drops
    if (track.pitchDropZ > 0) {
      // pz is negative downhill, so compute drops relative to distance
      const absZ = Math.abs(pz);
      const dropCycles = Math.floor(absZ / track.pitchDropZ);
      const dropProgress = (absZ % track.pitchDropZ) / track.pitchDropZ;
      
      y -= dropCycles * track.pitchDropAmount;
      
      // Smooth step for the actual drop region (happens over the last 30% of the segment)
      if (dropProgress > 0.7) {
        const t = (dropProgress - 0.7) / 0.3; // 0 to 1
        const smoothT = t * t * (3 - 2 * t);
        y -= smoothT * track.pitchDropAmount;
      }
    }
    
    // Natural contour ridges
    y += Math.sin(pz * track.turnFrequency * 1.8) * track.rollAmplitude;
    y += Math.sin(px * 0.05 + pz * 0.02) * (track.rollAmplitude * 0.6);
    y += Math.cos(px * 0.1 - pz * 0.04) * (track.rollAmplitude * 0.3);
    
    return y;
  }

  private applyTerrainContours(chunk: import("@babylonjs/core").Mesh): void {
    const positions = chunk.getVerticesData("position");
    if (!positions) return;
    for (let i = 0; i < positions.length; i += 3) {
      const vx = positions[i];
      const vz = positions[i + 2];
      const worldZ = chunk.position.z + vz;
      positions[i + 1] = this.getTerrainHeightAt(vx, worldZ);
    }
    chunk.updateVerticesData("position", positions);
    // Note: Recomputing normals every frame for procedural terrain is expensive.
    // For flat-shaded or high-speed CS:GO aesthetic, the original normals or simple shader is sufficient.
  }

  public applyTrack(track: GranbyTrackConfig, playerZ: number = 0): void {
    this.currentTrack = track;

    // 1. Atmosphere, Sky & Fog Shift
    this.scene.clearColor = track.clearColor.toColor4(1.0);
    this.scene.fogColor = track.fogColor;
    this.scene.fogDensity = track.fogDensity;

    // 2. Snow Surface Tint & Corduroy Pattern
    if (this.snowMat) {
      if (track.level === 1) {
        // Quick Draw: Bright pristine corduroy groomer in Colorado sunshine
        this.snowMat.diffuseColor = new Color3(1.0, 1.0, 1.0);
        this.snowMat.specularColor = new Color3(0.3, 0.3, 0.35);
      } else if (track.level === 2) {
        // Jackalope: High-speed alpine bluebird snow
        this.snowMat.diffuseColor = new Color3(0.92, 0.96, 1.0);
        this.snowMat.specularColor = new Color3(0.4, 0.45, 0.55);
      } else if (track.level === 3) {
        // Rodeo: Steep dusk alpenglow, violet tint
        this.snowMat.diffuseColor = new Color3(0.85, 0.80, 0.92);
        this.snowMat.specularColor = new Color3(0.5, 0.35, 0.5);
      } else {
        // High Roller Glades: Deep blizzard shadow powder
        this.snowMat.diffuseColor = new Color3(0.74, 0.80, 0.88);
        this.snowMat.specularColor = new Color3(0.2, 0.25, 0.35);
      }
    }

    // 3. Re-align recycled ground chunks around active player position
    for (let i = 0; i < this.totalChunks; i++) {
      if (this.groundChunks[i]) {
        this.groundChunks[i].position.z = playerZ - i * this.chunkSize;
        this.groundChunks[i].rotation.x = 0;
        this.groundChunks[i].position.y = 0;
        this.applyTerrainContours(this.groundChunks[i]);
      }
    }

    // 4. Clear existing obstacles and regenerate across active player chunks
    this.clearAllObstacles();
    for (let i = 0; i < this.totalChunks; i++) {
      this.spawnObstaclesForChunk(playerZ - i * this.chunkSize);
    }

    // 5. Spawn Granby Trail Course Archway 35m ahead of player
    this.spawnTrailArchway(playerZ - 35);
  }

  private clearAllObstacles(): void {
    for (const obs of this.obstacles) {
      obs.mesh.dispose();
    }
    this.obstacles = [];

    for (const gate of this.slalomGates) {
      gate.leftPole.dispose();
      gate.rightPole.dispose();
    }
    this.slalomGates = [];

    for (const pup of this.powerUps) {
      pup.mesh.dispose();
    }
    this.powerUps = [];
  }

  public spawnTrailArchway(z: number): void {
    this.archwayCounter++;
    const halfWidth = this.currentTrack.trailWidth / 2;
    const postDist = Math.min(35, halfWidth * 0.75);
    const yCenter = this.getTerrainHeightAt(0, z);

    // Heavy Colorado Timber Arch Posts
    const postL = MeshBuilder.CreateCylinder(`archPostL_${z}_${this.archwayCounter}`, { height: 11, diameter: 0.9 }, this.scene);
    postL.position.set(-postDist, this.getTerrainHeightAt(-postDist, z) + 5.5, z);
    const postR = MeshBuilder.CreateCylinder(`archPostR_${z}_${this.archwayCounter}`, { height: 11, diameter: 0.9 }, this.scene);
    postR.position.set(postDist, this.getTerrainHeightAt(postDist, z) + 5.5, z);

    // Crossbeam Banner
    const beamW = postDist * 2 + 3;
    const beam = MeshBuilder.CreateBox(`archBeam_${z}_${this.archwayCounter}`, { width: beamW, height: 2.4, depth: 0.9 }, this.scene);
    beam.position.set(0, yCenter + 10.5, z);

    const archMat = new StandardMaterial(`archMat_${z}_${this.archwayCounter}`, this.scene);
    archMat.diffuseColor = new Color3(0.32, 0.20, 0.10); // Rustic Colorado Lodge Timber
    postL.material = archMat;
    postR.material = archMat;
    beam.material = archMat;

    // High-Resolution 3D Dynamic Trail Sign Banner facing uphill (+Z) toward approaching skier
    const signW = Math.min(36, beamW * 0.88);
    const signPlane = MeshBuilder.CreatePlane(`archSign_${z}_${this.archwayCounter}`, { width: signW, height: 2.0 }, this.scene);
    signPlane.position.set(0, yCenter + 10.5, z + 0.48);
    signPlane.rotation.y = Math.PI; // Face oncoming downhill skier along -Z fall line

    const signTex = new DynamicTexture(`archTex_${z}_${this.archwayCounter}`, { width: 1024, height: 256 }, this.scene, true);
    const ctx = signTex.getContext() as CanvasRenderingContext2D;

    // Sign background: Rich dark alpine navy with gold trim
    ctx.fillStyle = "#0c1420";
    ctx.fillRect(0, 0, 1024, 256);
    ctx.strokeStyle = "#ffcc00"; // Alpine gold border
    ctx.lineWidth = 10;
    ctx.strokeRect(10, 10, 1004, 236);

    // Draw Trail Difficulty Badge & Run Title
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 52px Trebuchet MS, Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${this.currentTrack.difficultyBadge}  ${this.currentTrack.archTitle}`, 512, 90);

    // Draw Mountain Zone, Elevation & Slope Pitch Subtitle
    ctx.fillStyle = "#00f0ff";
    ctx.font = "bold 26px Trebuchet MS, Arial, sans-serif";
    ctx.fillText(
      `${this.currentTrack.mountainArea.toUpperCase()} • ELEV ${this.currentTrack.baseElevationFt.toLocaleString()}' • SLOPE ${this.currentTrack.slopeGradeDeg}° • ${this.currentTrack.archSubtitle}`,
      512,
      175
    );
    signTex.update();

    const signMat = new StandardMaterial(`signMat_${z}_${this.archwayCounter}`, this.scene);
    signMat.diffuseTexture = signTex;
    signMat.emissiveTexture = signTex;
    signMat.specularColor = new Color3(0.1, 0.1, 0.1);
    signPlane.material = signMat;

    this.obstacles.push({ mesh: postL, x: -postDist, z, radius: 1.2, type: "arch" });
    this.obstacles.push({ mesh: postR, x: postDist, z, radius: 1.2, type: "arch" });
    this.obstacles.push({ mesh: beam, x: 0, z, radius: 2.0, type: "arch" });
    this.obstacles.push({ mesh: signPlane, x: 0, z, radius: 0.1, type: "arch" });
  }

  private spawnObstaclesForChunk(centerZ: number): void {
    if (!this.baseTreeMesh || !this.baseRockMesh || !this.baseSlalomRedMesh || !this.baseSlalomBlueMesh) return;

    const count = this.currentTrack.obstacleCountPerChunk;
    const halfWidth = this.currentTrack.trailWidth / 2;

    // 1. Spawn Trail Safety Netting along left and right borders
    if (this.baseFenceMesh) {
      const fenceSpacing = 16.0;
      const numFences = Math.floor(this.chunkSize / fenceSpacing);
      for (let f = 0; f < numFences; f++) {
        const fz = centerZ - this.chunkSize / 2 + f * fenceSpacing;
        // Left Fence
        const fenceL = this.baseFenceMesh.createInstance(`fenceL_${fz}`);
        fenceL.position.set(-halfWidth, this.getTerrainHeightAt(-halfWidth, fz) + 1.2, fz);
        this.obstacles.push({ mesh: fenceL, x: -halfWidth, z: fz, radius: 1.5, type: "fence" });

        // Right Fence
        const fenceR = this.baseFenceMesh.createInstance(`fenceR_${fz}`);
        fenceR.position.set(halfWidth, this.getTerrainHeightAt(halfWidth, fz) + 1.2, fz);
        this.obstacles.push({ mesh: fenceR, x: halfWidth, z: fz, radius: 1.5, type: "fence" });
      }
    }

    // 2. Periodic Repeating Granby Ranch Trail Archway every 2 chunks (~600m)
    if (Math.abs(Math.round(centerZ / this.chunkSize)) % 2 === 0 && Math.abs(centerZ) > 100) {
      this.spawnTrailArchway(centerZ - 40);
    }

    // 3. Spawn 3D Mogul Snow Mounds for Level 3 (Rodeo Black Diamond)
    if (this.currentTrack.level === 3 && this.baseMogulMesh) {
      const mogulCount = 36;
      for (let m = 0; m < mogulCount; m++) {
        const mx = (Math.random() - 0.5) * (this.currentTrack.trailWidth * 0.75);
        const mz = centerZ + (Math.random() - 0.5) * this.chunkSize;
        const mogul = this.baseMogulMesh.createInstance(`mogul_${mz}_${m}`);
        const scale = 0.85 + Math.random() * 0.65;
        mogul.scaling.set(scale, scale * 1.2, scale);
        mogul.position.set(mx, this.getTerrainHeightAt(mx, mz) + 0.4 * scale, mz);
        this.obstacles.push({
          mesh: mogul,
          x: mx,
          z: mz,
          radius: 2.2 * scale,
          type: "mogul"
        });
      }
    }

    // 4. Spawn Colorado Trees (Aspens on Quick Draw, Spruces on others) and Granite Boulders
    for (let i = 0; i < count; i++) {
      const isRock = Math.random() < this.currentTrack.rockRatio;
      const x = (Math.random() - 0.5) * (this.currentTrack.trailWidth * 0.85);
      const z = centerZ + (Math.random() - 0.5) * this.chunkSize;

      // Keep center ski carving channel open
      if (Math.abs(x) < 4.0) continue;

      if (isRock) {
        const rock = this.baseRockMesh.createInstance(`rock_${z}_${i}`);
        rock.position.set(x, this.getTerrainHeightAt(x, z) + 0.7, z);
        rock.rotation.y = Math.random() * Math.PI * 2;
        const scale = 0.9 + Math.random() * 0.8;
        rock.scaling.set(scale, scale, scale);
        this.obstacles.push({
          mesh: rock,
          x,
          z,
          radius: 1.5 * scale,
          type: "rock"
        });
      } else {
        // Quick Draw (Level 1) features famous Colorado Golden Aspen Meadows (75% Aspens)!
        const isAspen = this.currentTrack.level === 1 && this.baseAspenMesh && Math.random() < 0.75;

        if (isAspen && this.baseAspenMesh) {
          const aspen = this.baseAspenMesh.createInstance(`aspen_${z}_${i}`);
          aspen.position.set(x, this.getTerrainHeightAt(x, z) + 4.25, z);
          aspen.rotation.y = Math.random() * Math.PI * 2;
          const scale = 0.85 + Math.random() * 0.6;
          aspen.scaling.set(scale, scale * 1.1, scale);
          this.obstacles.push({
            mesh: aspen,
            x,
            z,
            radius: 1.3 * scale,
            type: "aspen"
          });
        } else {
          const tree = this.baseTreeMesh.createInstance(`tree_${z}_${i}`);
          tree.position.set(x, this.getTerrainHeightAt(x, z) + 4.0, z);
          tree.rotation.y = Math.random() * Math.PI * 2;
          // Glades has taller, more imposing pines
          const heightMult = this.currentTrack.level === 4 ? 1.4 : 1.0;
          const scale = (0.8 + Math.random() * 0.7) * heightMult;
          tree.scaling.set(scale, scale, scale);
          this.obstacles.push({
            mesh: tree,
            x,
            z,
            radius: 1.4 * scale,
            type: "tree"
          });
        }
      }
    }

    // 5. Spawn Competition Slalom Gates along the run corridor
    const gateZ1 = centerZ - this.chunkSize * 0.28;
    const gateZ2 = centerZ + this.chunkSize * 0.28;
    const maxGateWeave = Math.max(12, halfWidth * 0.38);
    this.spawnSlalomGate(gateZ1, (Math.random() - 0.5) * maxGateWeave);
    this.spawnSlalomGate(gateZ2, (Math.random() - 0.5) * maxGateWeave);

    // 6. Spawn Collectible Power-ups
    const powerZ = centerZ + (Math.random() - 0.5) * this.chunkSize * 0.5;
    const powerX = (Math.random() - 0.5) * maxGateWeave * 1.1;
    const pType = Math.random() < 0.55 ? PowerUpType.NITRO_WAX : PowerUpType.CRYO_HARPOON;
    this.spawnPowerUp(powerX, powerZ, pType);
  }

  private spawnSlalomGate(z: number, centerX: number): void {
    if (!this.baseSlalomRedMesh || !this.baseSlalomBlueMesh) return;
    const width = this.currentTrack.gateWidth;
    const leftX = centerX - width / 2;
    const rightX = centerX + width / 2;

    const leftPole = this.baseSlalomRedMesh.createInstance(`gate_l_${z}`);
    leftPole.position.set(leftX, this.getTerrainHeightAt(leftX, z) + 2.2, z);

    const rightPole = this.baseSlalomBlueMesh.createInstance(`gate_r_${z}`);
    rightPole.position.set(rightX, this.getTerrainHeightAt(rightX, z) + 2.2, z);

    this.slalomGates.push({
      id: `gate_${z}`,
      x: centerX,
      z,
      width,
      passed: false,
      leftPole,
      rightPole
    });
  }

  private spawnPowerUp(x: number, z: number, type: PowerUpType): void {
    const isNitro = type === PowerUpType.NITRO_WAX;
    const powerMesh = MeshBuilder.CreatePolyhedron(`pup_${z}`, {
      type: 1, // Octahedron
      size: 1.2
    }, this.scene);

    const mat = new StandardMaterial(`mat_pup_${z}`, this.scene);
    if (isNitro) {
      mat.diffuseColor = new Color3(1.0, 0.6, 0.0);
      mat.emissiveColor = new Color3(1.0, 0.45, 0.0);
    } else {
      mat.diffuseColor = new Color3(0.0, 0.9, 1.0);
      mat.emissiveColor = new Color3(0.15, 0.7, 1.0);
    }
    powerMesh.material = mat;
    powerMesh.position.set(x, this.getTerrainHeightAt(x, z) + 1.8, z);

    this.powerUps.push({
      id: `pup_${z}`,
      x,
      z,
      type,
      mesh: powerMesh,
      collected: false
    });
  }

  public update(playerZ: number, deltaTime: number = 0.016): void {
    // Recalculate chunks relative to player downhill position (-Z)
    for (const chunk of this.groundChunks) {
      if (chunk.position.z > playerZ + this.chunkSize) {
        let minZ = chunk.position.z;
        for (const c of this.groundChunks) {
          if (c.position.z < minZ) minZ = c.position.z;
        }
        const newZ = minZ - this.chunkSize;
        chunk.position.z = newZ;
        this.applyTerrainContours(chunk);
        this.spawnObstaclesForChunk(newZ);
      }
    }

    // Spin powerups
    for (const pup of this.powerUps) {
      if (!pup.collected && pup.mesh) {
        pup.mesh.rotation.y += deltaTime * 2.5;
        pup.mesh.position.y = this.getTerrainHeightAt(pup.x, pup.z) + 1.8 + Math.sin(performance.now() * 0.004) * 0.3;
      }
    }

    // Prune stale obstacles uphill
    this.obstacles = this.obstacles.filter(obs => {
      if (obs.z > playerZ + 200) {
        obs.mesh.dispose();
        return false;
      }
      return true;
    });

    // Prune stale gates
    this.slalomGates = this.slalomGates.filter(gate => {
      if (gate.z > playerZ + 200) {
        gate.leftPole.dispose();
        gate.rightPole.dispose();
        return false;
      }
      return true;
    });

    // Prune stale powerups
    this.powerUps = this.powerUps.filter(pup => {
      if (pup.z > playerZ + 200) {
        pup.mesh.dispose();
        return false;
      }
      return true;
    });
  }

  public checkCollision(px: number, pz: number, playerRadius: number = 0.8): ObstacleInstance | null {
    for (const obs of this.obstacles) {
      // Moguls are ridden over with physical bump displacement, not fatal crash wipeouts
      if (obs.type === "mogul") continue;

      const dx = obs.x - px;
      const dz = obs.z - pz;
      const dist = Math.hypot(dx, dz);
      if (dist < obs.radius + playerRadius) {
        return obs;
      }
    }
    return null;
  }

  public getSlopePitchRad(): number {
    return (this.currentTrack.slopeGradeDeg * Math.PI) / 180;
  }

  public getMogulHeightAt(px: number, pz: number): number {
    if (this.currentTrack.level !== 3) return 0;
    for (const obs of this.obstacles) {
      if (obs.type === "mogul") {
        const dx = obs.x - px;
        const dz = obs.z - pz;
        const dist = Math.hypot(dx, dz);
        if (dist < obs.radius) {
          const moundFactor = Math.cos((dist / obs.radius) * (Math.PI * 0.5));
          return moundFactor * 1.35; // Physical 3D mogul vertical mound bounce
        }
      }
    }
    return 0;
  }

  public checkSlalomPass(px: number, pz: number, prevZ: number): { passed: boolean; gate: SlalomGateInstance } | null {
    for (const gate of this.slalomGates) {
      if (!gate.passed && prevZ >= gate.z && pz <= gate.z) {
        // Skier crossed the gate line along Z
        const halfW = gate.width / 2;
        if (px >= gate.x - halfW && px <= gate.x + halfW) {
          gate.passed = true;
          return { passed: true, gate };
        }
      }
    }
    return null;
  }

  public checkPowerUp(px: number, pz: number, playerRadius: number = 2.2): PowerUpType | null {
    for (const pup of this.powerUps) {
      if (!pup.collected) {
        const dx = pup.x - px;
        const dz = pup.z - pz;
        if (Math.hypot(dx, dz) < playerRadius) {
          pup.collected = true;
          pup.mesh.dispose();
          return pup.type;
        }
      }
    }
    return null;
  }
}
