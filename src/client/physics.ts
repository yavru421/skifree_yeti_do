/**
 * SkiFree Yeti DO - Havok Physics Engine Integration
 * Provides native WebAssembly-accelerated rigid-body simulation for skier carving & Yeti collision
 */

import { Scene, Vector3, PhysicsAggregate, PhysicsShapeType, HavokPlugin } from "@babylonjs/core";
import HavokPhysics from "@babylonjs/havok";

export class PhysicsSystem {
  private plugin: HavokPlugin | null = null;
  private scene: Scene;

  constructor(scene: Scene) {
    this.scene = scene;
  }

  public async init(): Promise<HavokPlugin> {
    try {
      const havokInstance = await HavokPhysics({
        locateFile: () => "/HavokPhysics.wasm"
      });
      this.plugin = new HavokPlugin(true, havokInstance);
      this.scene.enablePhysics(new Vector3(0, -9.81, -4.2), this.plugin);
      return this.plugin;
    } catch (err) {
      console.warn("Havok Physics WASM init failed, falling back to deterministic kinematic physics:", err);
      // Fallback to software kinematic gravity if WASM is blocked
      return null as any;
    }
  }

  public createTerrainCollider(groundMesh: any): PhysicsAggregate | null {
    if (!this.plugin) return null;
    return new PhysicsAggregate(
      groundMesh,
      PhysicsShapeType.BOX,
      { mass: 0, restitution: 0.1, friction: 0.05 },
      this.scene
    );
  }

  public createPlayerCollider(playerMesh: any): PhysicsAggregate | null {
    if (!this.plugin) return null;
    return new PhysicsAggregate(
      playerMesh,
      PhysicsShapeType.CAPSULE,
      { mass: 75, restitution: 0.05, friction: 0.02 },
      this.scene
    );
  }

  public createObstacleCollider(obstacleMesh: any): PhysicsAggregate | null {
    if (!this.plugin) return null;
    return new PhysicsAggregate(
      obstacleMesh,
      PhysicsShapeType.CYLINDER,
      { mass: 0, restitution: 0.3, friction: 0.8 },
      this.scene
    );
  }

  public getPlugin(): HavokPlugin | null {
    return this.plugin;
  }
}
