// public/js/YetiPredator.js
// Authentic 2.5D Animated Yeti Boss AI with Chroma-Key Transparency & Backcountry Zone Stalking

import { loadChromaKeyTexture } from './SpriteUtils.js';

export class YetiPredator {
  constructor(sceneManager) {
    this.sceneManager = sceneManager;
    this.textureLoader = new THREE.TextureLoader();

    this.x = 0;
    this.y = 0;
    this.z = 950; // Backcountry wilderness spawn (peaceful groomer runway 0 - 650m)
    this.hp = 8000;
    this.maxHp = 8000;
    this.wave = 1;
    this.state = "DORMANT"; // DORMANT on beginner groomers, STALKING_NPCS in backcountry

    this.staggerTimer = 0;
    this.distractedTimer = 0;
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

    // Load authentic 2.5D Yeti Sprite (5 Rows x 6 Columns)
    loadChromaKeyTexture('/assets/yeti_v2.jpg', 215, (texture) => {
      this.yetiTexture = texture;
      // 6 columns (width: 1/6 = 0.1667), 5 rows (height: 1/5 = 0.2000)
      this.yetiTexture.repeat.set(1 / 6, 1 / 5);
      this.yetiTexture.offset.set(0.0, 4 / 5); // Row 0 (offset.y = 0.8000): Running sprint

      const mat = new THREE.SpriteMaterial({
        map: this.yetiTexture,
        transparent: true,
        alphaTest: 0.05
      });
      this.yetiSprite = new THREE.Sprite(mat);
      this.yetiSprite.scale.set(8.5, 8.5, 1);
      this.yetiSprite.position.set(this.x, 4.2, this.z);
      sceneManager.scene.add(this.yetiSprite);
    });
  }

  initNpcSwarm(sceneManager) {
    // Load Authentic NPC Skier Spritesheet (7 Rows x 8 Columns)
    loadChromaKeyTexture('/assets/npc_skiers.jpg', 215, (npcTex) => {
      npcTex.repeat.set(1 / 8, 1 / 7);

      for (let i = 0; i < 22; i++) {
        const texClone = npcTex.clone();
        // Distribute across different skier rows and colors
        const row = i % 4; // Rows 0-3: downhill recreational skiers & racers
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

    // Hunter Rescue Check: If Yeti was stalking or eating an NPC
    if (this.currentTargetNpc && !this.currentTargetNpc.isRescued) {
      this.currentTargetNpc.isRescued = true;
      this.currentTargetNpc.isEaten = false;
      this.currentTargetNpc = null;
    }
  }

  distractWithBait(baitX, baitZ) {
    this.distractedTimer = 3.5;
    this.state = "DISTRACTED";
    this.x = baitX;
    this.z = baitZ;
  }

  update(dt, playerPos, audioSystem, onEvent) {
    if (this.hp <= 0) {
      this.state = "DEAD";
      if (this.yetiSprite) this.yetiSprite.visible = false;
      if (this.mesh) this.mesh.visible = false;
      return;
    }

    if (this.biteCooldown > 0) {
      this.biteCooldown -= dt;
    }

    // 1. Update Downhill NPCs
    this.npcs.forEach((npc) => {
      if (!npc.isEaten) {
        npc.z += npc.speed * dt * 0.9;
        npc.x += Math.sin(npc.steer) * (npc.speed * 0.04);
        npc.mesh.position.set(npc.x, 0, npc.z);
        npc.mesh.rotation.y = npc.steer;
        npc.mesh.rotation.z = -npc.steer * 0.3;

        // Recycle NPCs falling behind player
        if (playerPos.z - npc.z > 30) {
          npc.z = playerPos.z + 70 + Math.random() * 80;
          npc.x = (Math.random() - 0.5) * 60;
          npc.isEaten = false;
          npc.isRescued = false;
          npc.mesh.visible = true;
        }
      }
    });

    // 2. Yeti State Machine & Predator AI (Backcountry Activation Zone)
    // On the safe Granby Colorado groomer runway (Z < 650m), Yeti remains dormant in the backcountry
    if (playerPos.z < 650) {
      this.state = "DORMANT";
      this.z = 950;
      this.x = 0;
      if (this.yetiSprite) this.yetiSprite.position.set(this.x, 4.2, this.z);
      if (this.mesh) this.mesh.position.set(this.x, 4.0, this.z);
      return;
    }

    // Active Backcountry Hunt Zone (Z >= 650m)
    if (this.state === "DORMANT") {
      this.state = "STALKING_NPCS";
      if (audioSystem) audioSystem.playYetiRoar();
      if (onEvent) onEvent({ type: "YETI_SPAWNED" });
    }

    if (this.staggerTimer > 0) {
      this.staggerTimer -= dt;
      this.state = "STAGGERED";
      if (this.yetiSprite) {
        this.yetiSprite.scale.set(9.8, 8.2, 1);
      }
    } else if (this.distractedTimer > 0) {
      this.distractedTimer -= dt;
      this.state = "DISTRACTED";
      if (this.yetiSprite) {
        this.yetiSprite.scale.set(9.0, 9.0, 1);
      }
    } else {
      // Find closest alive NPC in front
      let closestNpc = null;
      let minNpcDist = 9999;
      this.npcs.forEach((npc) => {
        if (!npc.isEaten && npc.z > playerPos.z - 10) {
          const dist = Math.hypot(this.x - npc.x, this.z - npc.z);
          if (dist < minNpcDist) {
            minNpcDist = dist;
            closestNpc = npc;
          }
        }
      });

      const distToPlayer = Math.hypot(this.x - playerPos.x, this.z - playerPos.z);

      if (distToPlayer < 8.5) {
        // Charge directly at player!
        this.state = "CHARGING";
        const dx = playerPos.x - this.x;
        const dz = playerPos.z - this.z;
        this.x += Math.sign(dx) * Math.min(Math.abs(dx), 4.2 * dt);
        this.z += Math.sign(dz) * Math.min(Math.abs(dz), 5.5 * dt);

        if (distToPlayer < 3.5 && this.biteCooldown <= 0) {
          this.biteCooldown = 2.0;
          if (audioSystem) audioSystem.playBiteChomp();
          if (onEvent) onEvent({ type: "YETI_BITE", damage: 1 });
        }
      } else if (closestNpc && minNpcDist < 50) {
        // Hunt NPC
        this.state = "STALKING_NPCS";
        this.currentTargetNpc = closestNpc;
        const dx = closestNpc.x - this.x;
        const dz = closestNpc.z - this.z;
        this.x += Math.sign(dx) * Math.min(Math.abs(dx), 3.0 * dt);
        this.z += Math.sign(dz) * Math.min(Math.abs(dz), 4.0 * dt);

        if (minNpcDist < 3.0 && !closestNpc.isEaten) {
          closestNpc.isEaten = true;
          closestNpc.mesh.visible = false;
          if (audioSystem) audioSystem.playSkierScream();
          if (onEvent) onEvent({ type: "NPC_MAULED", npcId: closestNpc.id });
        }
      } else {
        // Default Prowl 32m ahead of player
        this.state = "STALKING_NPCS";
        const targetZ = playerPos.z + 32;
        this.z += (targetZ - this.z) * 1.5 * dt;
        this.x += (playerPos.x - this.x) * 1.2 * dt + Math.sin(Date.now() * 0.003) * 0.3;
      }

      // Sprite Sprint Run Cycle Animation (5 Rows x 6 Cols: Row 0 offset.y = 0.80)
      this.animTimer += dt;
      if (this.animTimer > 0.12 && this.yetiTexture) {
        this.animTimer = 0;
        this.animFrame = (this.animFrame + 1) % 6;
        this.yetiTexture.offset.set(this.animFrame * (1 / 6), 0.80);
      }
    }

    // Keep Yeti in active backcountry zone
    if (this.z < playerPos.z - 15) {
      this.z = playerPos.z + 35;
      this.x = playerPos.x + (Math.random() - 0.5) * 18;
    }

    if (this.mesh) {
      this.mesh.position.set(this.x, 4.0, this.z);
    }
    if (this.yetiSprite) {
      this.yetiSprite.position.set(this.x, 4.2, this.z);
    }
  }

  setWave(waveNum) {
    this.wave = waveNum;
    this.maxHp = 8000 * waveNum;
    this.hp = this.maxHp;
    this.state = "STALKING_NPCS";
    if (this.yetiSprite) this.yetiSprite.visible = true;
    if (this.mesh) this.mesh.visible = true;
  }
}
