// public/js/YetiPredator.js
// Authentic 2.5D Animated Yeti Boss AI with Chroma-Key Transparency, Flare Ignition Panic & Avalanche Flee

import { loadChromaKeyTexture } from './SpriteUtils.js';

export class YetiPredator {
  constructor(sceneManager) {
    this.sceneManager = sceneManager;
    this.textureLoader = new THREE.TextureLoader();

    this.x = 0;
    this.y = 0;
    this.z = 80; // Spawns immediately in sight for high-intensity SkiFree hunt!
    this.hp = 8000;
    this.maxHp = 8000;
    this.wave = 1;
    this.state = "STALKING_NPCS"; // Immediately active!

    this.staggerTimer = 0;
    this.distractedTimer = 0;
    this.flareBurnTimer = 0;
    this.eatingTimer = 0;
    this.biteCooldown = 0;

    this.mesh = null;
    this.yetiSprite = null;
    this.yetiTexture = null;
    this.npcs = [];
    this.currentTargetNpc = null;
    this.animFrame = 0;
    this.animTimer = 0;

    this.initYetiSprite(sceneManager);
    this.initNpcSwarm(sceneManager);
  }

  initYetiSprite(sceneManager) {
    const targetGeo = new THREE.BoxGeometry(6.5, 7.5, 3.5);
    const targetMat = new THREE.MeshBasicMaterial({ visible: false });
    this.mesh = new THREE.Mesh(targetGeo, targetMat);
    this.mesh.position.set(this.x, 4.0, this.z);
    this.mesh.userData = { isYeti: true };
    sceneManager.scene.add(this.mesh);

    // Load authentic 2.5D Yeti Sprite (4 Rows x 4 Columns, pure pixel art)
    loadChromaKeyTexture('/assets/yeti_v2.jpg?v=' + Date.now(), 210, (tex) => {
      this.yetiTexture = tex;
      this.yetiTexture.repeat.set(1 / 4, 1 / 4);
      this.yetiTexture.offset.set(0, 3 / 4);

      const mat = new THREE.SpriteMaterial({
        map: this.yetiTexture,
        transparent: true,
        alphaTest: 0.05
      });
      this.yetiSprite = new THREE.Sprite(mat);
      this.yetiSprite.scale.set(6.5, 6.5, 1);
      this.yetiSprite.position.set(this.x, 3.2, this.z);
      sceneManager.scene.add(this.yetiSprite);
    });
  }

  initNpcSwarm(sceneManager) {
    // Load Authentic NPC Skier Spritesheet (7 Rows x 8 Columns)
    loadChromaKeyTexture('/assets/npc_skiers.jpg', 215, (npcTex) => {
      npcTex.repeat.set(1 / 8, 1 / 7);

      for (let i = 0; i < 22; i++) {
        const texClone = npcTex.clone();
        const row = i % 4;
        const col = (i * 2) % 8;
        texClone.offset.set(col * (1 / 8), (6 - row) / 7);

        const mat = new THREE.SpriteMaterial({
          map: texClone,
          transparent: true,
          alphaTest: 0.05
        });
        const sprite = new THREE.Sprite(mat);
        sprite.scale.set(2.8, 2.8, 1);

        const zPos = 60 + i * 42 + Math.random() * 15;
        const xPos = (Math.random() - 0.5) * 55;
        sprite.position.set(xPos, 1.4, zPos);
        sceneManager.scene.add(sprite);

        this.npcs.push({
          id: i,
          mesh: sprite,
          x: xPos,
          z: zPos,
          speed: 22 + Math.random() * 8,
          steer: (Math.random() - 0.5) * 0.25,
          isEaten: false,
          isRescued: false
        });
      }
    });
  }

  applyDamage(amount, isCrit = false) {
    if (this.hp <= 0) return;
    this.hp = Math.max(0, this.hp - amount);

    // Kinetic Knockback away from player
    this.z += isCrit ? 6.0 : 3.5;
    this.staggerTimer = 0.8;
    this.state = "STAGGERED";

    if (this.currentTargetNpc && !this.currentTargetNpc.isRescued) {
      this.currentTargetNpc.isRescued = true;
      this.currentTargetNpc.isEaten = false;
      this.currentTargetNpc = null;
    }
  }

  igniteFlareBurn(duration = 3.5) {
    this.flareBurnTimer = duration;
    this.state = "BURNING_PANIC";
    this.z += 14.0; // Pushed back down-slope
    if (this.yetiSprite) {
      this.yetiSprite.material.color.setHex(0xff5500); // Glowing orange burn
    }
  }

  distractWithBait(baitX, baitZ) {
    this.distractedTimer = 3.5;
    this.state = "DISTRACTED";
    this.x = baitX;
    this.z = baitZ;
  }

  update(dt, playerInfo, audioSystem, onEvent, currentTrack) {
    if (this.hp <= 0) {
      this.state = "DEAD";
      if (this.yetiSprite) this.yetiSprite.visible = false;
      if (this.mesh) this.mesh.visible = false;
      return;
    }

    if (this.biteCooldown > 0) {
      this.biteCooldown -= dt;
    }

    const playerX = (playerInfo && typeof playerInfo.x === 'number') ? playerInfo.x : 0;
    const playerZ = (playerInfo && typeof playerInfo.z === 'number') ? playerInfo.z : 0;
    const playerSpeed = (playerInfo && typeof playerInfo.speed === 'number') ? playerInfo.speed : 28;
    const forwardRate = playerSpeed * 0.038 * 60;

    // 1. Update Downhill NPCs
    this.npcs.forEach((npc) => {
      if (!npc.isEaten && !npc.isRescued) {
        npc.z += forwardRate * 0.85 * dt;
        npc.x += Math.sin(npc.steer) * (forwardRate * 0.25 * dt);
        if (npc.mesh) {
          npc.mesh.position.set(npc.x, 1.6, npc.z);
          npc.mesh.rotation.y = npc.steer;
          npc.mesh.rotation.z = -npc.steer * 0.3;
        }

        // Recycle NPCs falling behind player
        if (playerZ - npc.z > 40) {
          npc.z = playerZ + 80 + Math.random() * 80;
          npc.x = (Math.random() - 0.5) * 60;
          npc.isEaten = false;
          npc.isRescued = false;
          if (npc.mesh) {
            npc.mesh.visible = true;
            npc.mesh.position.set(npc.x, 1.6, npc.z);
          }
        }
      }
    });

    // 2. Yeti State Machine & Kinematics
    if (this.flareBurnTimer > 0) {
      // BURNING PANIC: Yeti runs away erratically flailing arms
      this.flareBurnTimer -= dt;
      this.state = "BURNING_PANIC";
      this.z += forwardRate * 1.4 * dt; // Sprinting forward ahead in terror
      this.x += Math.sin(Date.now() * 0.01) * 22.0 * dt;
      if (this.flareBurnTimer <= 0 && this.yetiSprite) {
        this.yetiSprite.material.color.setHex(0xffffff); // Return to normal color
      }
    } else if (this.staggerTimer > 0) {
      this.staggerTimer -= dt;
      this.state = "STAGGERED";
      this.z += forwardRate * 0.45 * dt;
      if (this.yetiSprite) {
        this.yetiSprite.scale.set(7.5, 6.0, 1);
      }
    } else if (this.distractedTimer > 0) {
      this.distractedTimer -= dt;
      this.state = "DISTRACTED";
      this.z += forwardRate * 0.2 * dt;
      if (this.yetiSprite) {
        this.yetiSprite.scale.set(6.5, 6.5, 1);
      }
    } else if (currentTrack?.id === "avalanche" && playerInfo?.avalancheDist < 50) {
      // AVALANCHE FLEE: Yeti panics and sprints downhill away from the avalanche
      this.state = "CHARGING";
      this.z += forwardRate * 1.25 * dt;
      this.x += (playerX - this.x) * 0.5 * dt;
    } else {
      const distToPlayer = Math.hypot(this.x - playerX, this.z - playerZ);

      // Closest NPC
      let closestNpc = null;
      let minNpcDist = 9999;
      this.npcs.forEach((npc) => {
        if (!npc.isEaten && !npc.isRescued && npc.z > playerZ - 10) {
          const dist = Math.hypot(this.x - npc.x, this.z - npc.z);
          if (dist < minNpcDist) {
            minNpcDist = dist;
            closestNpc = npc;
          }
        }
      });

      if (distToPlayer < 35.0 && this.z > playerZ) {
        // CHARGING HEAD-ON
        this.state = "CHARGING";
        const dx = playerX - this.x;
        this.x += Math.sign(dx) * Math.min(Math.abs(dx), 18.0 * dt);
        this.z -= 25.0 * dt;

        if (distToPlayer < 4.5 && this.biteCooldown <= 0) {
          this.biteCooldown = 1.8;
          if (audioSystem) audioSystem.playBiteChomp();
          if (onEvent) onEvent({ type: "YETI_BITE", damage: 1 });
        }
      } else if (this.z < playerZ - 5) {
        // CHASING FROM BEHIND
        this.state = "CHARGING";
        const dx = playerX - this.x;
        this.x += Math.sign(dx) * Math.min(Math.abs(dx), 24.0 * dt);
        this.z += forwardRate * 1.35 * dt;

        if (distToPlayer < 4.5 && this.biteCooldown <= 0) {
          this.biteCooldown = 1.8;
          if (audioSystem) audioSystem.playBiteChomp();
          if (onEvent) onEvent({ type: "YETI_BITE", damage: 1 });
        }
      } else if (closestNpc && minNpcDist < 45) {
        // HUNT NPC AHEAD
        this.state = "STALKING_NPCS";
        this.currentTargetNpc = closestNpc;
        const dx = closestNpc.x - this.x;
        const dz = closestNpc.z - this.z;
        this.x += Math.sign(dx) * Math.min(Math.abs(dx), 20.0 * dt);
        this.z += forwardRate * 0.98 * dt + Math.sign(dz) * 12.0 * dt;

        if (minNpcDist < 3.2 && !closestNpc.isEaten) {
          closestNpc.isEaten = true;
          if (closestNpc.mesh) closestNpc.mesh.visible = false;
          if (audioSystem) audioSystem.playSkierScream();
          if (onEvent) onEvent({ type: "NPC_MAULED", npcId: closestNpc.id });
        }
      } else {
        // DEFAULT DOWNHILL SPRINT 30m ahead of player
        this.state = "STALKING_NPCS";
        const targetLeadZ = playerZ + 32;
        const speedDelta = (targetLeadZ - this.z) * 2.5;
        this.z += (forwardRate + speedDelta) * dt;
        this._swayT = (this._swayT || 0) + dt;
        this.x += (playerX - this.x) * 1.5 * dt + Math.sin(this._swayT * 1.13) * 0.8 * dt * 60;
      }

      // Sprite Sprint / Attack Cycle Animation
      this.animTimer += dt;
      if (this.animTimer > 0.09 && this.yetiTexture) {
        this.animTimer = 0;
        this.animFrame = (this.animFrame + 1) % 4;
        let rowOffsetY = 0.75;
        if (this.state === "BURNING_PANIC") {
          rowOffsetY = 0.25; // Flailing panic
        } else if (this.state === "CHARGING") {
          rowOffsetY = 0.50; // Claws forward attack
        } else if (this.state === "STAGGERED") {
          rowOffsetY = 0.0; // Stagger hurt
        }
        this.yetiTexture.offset.set(this.animFrame * 0.25, rowOffsetY);
      }
    }

    // Keep Yeti in bounds
    this.x = Math.max(-60, Math.min(60, this.x));

    if (this.mesh) {
      this.mesh.position.set(this.x, 3.8, this.z);
    }
    if (this.yetiSprite) {
      this.yetiSprite.position.set(this.x, 3.2, this.z);
    }
  }
}
