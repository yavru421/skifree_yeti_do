/**
 * SkiFree Yeti DO - Procedural Terrain & Obstacle System
 * Generates an infinite procedural snow slope using recycled terrain chunks,
 * snow materials, and instanced pine trees/rocks for ultra-fast single-draw-call rendering.
 */

import {
  Scene,
  MeshBuilder,
  StandardMaterial,
  Texture,
  Color3,
  Vector3,
  Mesh,
  InstancedMesh
} from "@babylonjs/core";

export interface ObstacleInstance {
  mesh: InstancedMesh | Mesh;
  x: number;
  z: number;
  radius: number;
  type: "tree" | "rock" | "snowbank";
}

export class TerrainSystem {
  private scene: Scene;
  private groundChunks: Mesh[] = [];
  private chunkSize: number = 300;
  private totalChunks: number = 5;
  private baseTreeMesh: Mesh | null = null;
  private baseRockMesh: Mesh | null = null;
  public obstacles: ObstacleInstance[] = [];

  constructor(scene: Scene) {
    this.scene = scene;
  }

  public init(): void {
    // 1. Snow Slope Material
    const snowMat = new StandardMaterial("snowMat", this.scene);
    snowMat.diffuseTexture = new Texture("/assets/snow_texture.jpg", this.scene);
    (snowMat.diffuseTexture as Texture).uScale = 40;
    (snowMat.diffuseTexture as Texture).vScale = 40;
    snowMat.specularColor = new Color3(0.15, 0.15, 0.2);
    snowMat.ambientColor = new Color3(0.9, 0.95, 1.0);

    // 2. Build recycled ground chunks downhill along -Z
    for (let i = 0; i < this.totalChunks; i++) {
      const ground = MeshBuilder.CreateGround(
        `snowGround_${i}`,
        { width: 400, height: this.chunkSize, subdivisions: 8 },
        this.scene
      );
      ground.material = snowMat;
      ground.position.z = -i * this.chunkSize;
      ground.position.y = 0;
      ground.receiveShadows = true;
      this.groundChunks.push(ground);
    }

    // 3. Create template meshes for instancing
    this.createTemplateObstacles();

    // 4. Initial obstacle scatter across active chunks
    for (let i = 0; i < this.totalChunks; i++) {
      this.spawnObstaclesForChunk(-i * this.chunkSize);
    }
  }

  private createTemplateObstacles(): void {
    // Pine Tree Template
    this.baseTreeMesh = MeshBuilder.CreateCylinder(
      "baseTree",
      { height: 6.5, diameterTop: 0.2, diameterBottom: 3.2, tessellation: 6 },
      this.scene
    );
    const treeMat = new StandardMaterial("treeMat", this.scene);
    treeMat.diffuseColor = new Color3(0.08, 0.28, 0.12);
    treeMat.specularColor = new Color3(0, 0, 0);
    this.baseTreeMesh.material = treeMat;
    this.baseTreeMesh.position.y = 3.25;
    this.baseTreeMesh.isVisible = false; // Hidden template

    // Rock Template
    this.baseRockMesh = MeshBuilder.CreateSphere(
      "baseRock",
      { diameterX: 2.2, diameterY: 1.4, diameterZ: 2.8, segments: 4 },
      this.scene
    );
    const rockMat = new StandardMaterial("rockMat", this.scene);
    rockMat.diffuseColor = new Color3(0.35, 0.38, 0.42);
    rockMat.specularColor = new Color3(0.05, 0.05, 0.05);
    this.baseRockMesh.material = rockMat;
    this.baseRockMesh.position.y = 0.6;
    this.baseRockMesh.isVisible = false;
  }

  private spawnObstaclesForChunk(centerZ: number): void {
    if (!this.baseTreeMesh || !this.baseRockMesh) return;

    const count = 35; // Density per chunk
    for (let i = 0; i < count; i++) {
      const isRock = Math.random() < 0.25;
      const x = (Math.random() - 0.5) * 320;
      const z = centerZ + (Math.random() - 0.5) * this.chunkSize;

      // Keep ski highway clear in the center lane
      if (Math.abs(x) < 4.5) continue;

      if (isRock) {
        const rock = this.baseRockMesh.createInstance(`rock_${z}_${i}`);
        rock.position.set(x, 0.6, z);
        rock.rotation.y = Math.random() * Math.PI * 2;
        const scale = 0.8 + Math.random() * 0.7;
        rock.scaling.set(scale, scale, scale);
        this.obstacles.push({
          mesh: rock,
          x,
          z,
          radius: 1.4 * scale,
          type: "rock"
        });
      } else {
        const tree = this.baseTreeMesh.createInstance(`tree_${z}_${i}`);
        tree.position.set(x, 3.25, z);
        tree.rotation.y = Math.random() * Math.PI * 2;
        const scale = 0.7 + Math.random() * 0.8;
        tree.scaling.set(scale, scale, scale);
        this.obstacles.push({
          mesh: tree,
          x,
          z,
          radius: 1.2 * scale,
          type: "tree"
        });
      }
    }
  }

  public update(playerZ: number): void {
    // Recalculate chunks relative to player downhill position (-Z)
    for (const chunk of this.groundChunks) {
      if (chunk.position.z > playerZ + this.chunkSize) {
        // Find furthest chunk downhill
        let minZ = chunk.position.z;
        for (const c of this.groundChunks) {
          if (c.position.z < minZ) minZ = c.position.z;
        }
        const newZ = minZ - this.chunkSize;
        chunk.position.z = newZ;
        this.spawnObstaclesForChunk(newZ);
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
  }

  public checkCollision(px: number, pz: number, playerRadius: number = 0.8): ObstacleInstance | null {
    for (const obs of this.obstacles) {
      const dx = obs.x - px;
      const dz = obs.z - pz;
      const dist = Math.hypot(dx, dz);
      if (dist < obs.radius + playerRadius) {
        return obs;
      }
    }
    return null;
  }
}
