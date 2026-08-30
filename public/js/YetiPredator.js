// public/js/YetiPredator.js
// 3D Yeti Boss AI, Stalker State Machine, Kinetic Stagger & Skier Rescue Logic

export class YetiPredator {
  constructor(sceneManager) {
    this.x = 0;
    this.y = 0;
    this.z = 35;
    this.hp = 8000;
    this.maxHp = 8000;
    this.wave = 1;
    this.state = "STALKING_NPCS"; // STALKING_NPCS, CHARGING, STAGGERED, DISTRACTED, EATING_NPC, DEAD

    this.staggerTimer = 0;
    this.distractedTimer = 0;
    this.eatingTimer = 0;
    this.biteCooldown = 0;

    this.mesh = null;
    this.npcs = [];
    this.currentTargetNpc = null;

    this.initMesh(sceneManager);
    this.initNpcSwarm(sceneManager);
  }

  initMesh(sceneManager) {
    const yetiGroup = new THREE.Group();

    // Fur Body
    const bodyGeo = new THREE.BoxGeometry(2.4, 3.2, 1.8);
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0xddeeff });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 1.6;
    yetiGroup.add(body);

    // Head
    const headGeo = new THREE.BoxGeometry(1.6, 1.4, 1.4);
    const headMat = new THREE.MeshLambertMaterial({ color: 0xccddee });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.set(0, 3.6, 0.2);
    yetiGroup.add(head);

    // Glowing Red Eyes
    const eyeGeo = new THREE.BoxGeometry(0.25, 0.15, 0.15);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff0033 });
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.45, 3.7, 0.9);
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.45, 3.7, 0.9);
    yetiGroup.add(leftEye);
    yetiGroup.add(rightEye);

    // Giant Claws
    const armGeo = new THREE.BoxGeometry(0.7, 2.6, 0.7);
    const armMat = new THREE.MeshLambertMaterial({ color: 0xb0ccdd });
    const leftArm = new THREE.Mesh(armGeo, armMat);
    leftArm.position.set(-1.6, 1.8, 0.4);
    leftArm.rotation.x = -0.3;
    const rightArm = new THREE.Mesh(armGeo, armMat);
    rightArm.position.set(1.6, 1.8, 0.4);
    rightArm.rotation.x = -0.3;
    yetiGroup.add(leftArm);
    yetiGroup.add(rightArm);

    this.mesh = yetiGroup;
    this.mesh.position.set(this.x, 0, this.z);
    sceneManager.scene.add(this.mesh);
  }

  initNpcSwarm(sceneManager) {
    const colors = [0xff0055, 0x00f0ff, 0x39ff14, 0xffff00, 0xff7700, 0xaa00ff];
    const npcBodyGeo = new THREE.BoxGeometry(0.6, 0.8, 0.4);
    const npcSkiGeo = new THREE.BoxGeometry(0.14, 0.04, 1.8);

    for (let i = 0; i < 20; i++) {
      const npcGroup = new THREE.Group();
      const color = colors[i % colors.length];
      const mat = new THREE.MeshLambertMaterial({ color });

      const torso = new THREE.Mesh(npcBodyGeo, mat);
      torso.position.y = 0.7;
      npcGroup.add(torso);

      const leftSki = new THREE.Mesh(npcSkiGeo, mat);
      leftSki.position.set(-0.25, 0.02, 0);
      const rightSki = new THREE.Mesh(npcSkiGeo, mat);
      rightSki.position.set(0.25, 0.02, 0);
      npcGroup.add(leftSki);
      npcGroup.add(rightSki);

      const zPos = 25 + i * 18 + Math.random() * 12;
      const xPos = (Math.random() - 0.5) * 55;
      npcGroup.position.set(xPos, 0, zPos);
      sceneManager.scene.add(npcGroup);

      this.npcs.push({
        id: i,
        mesh: npcGroup,
        x: xPos,
        z: zPos,
        speed: 22 + Math.random() * 8,
        steer: (Math.random() - 0.5) * 0.3,
        isEaten: false,
        isRescued: false
      });
    }
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

        // Recycle NPCs falling behind player
        if (playerPos.z - npc.z > 30) {
          npc.z = playerPos.z + 70 + Math.random() * 80;
          npc.x = (Math.random() - 0.5) * 55;
          npc.isEaten = false;
          npc.isRescued = false;
          npc.mesh.visible = true;
        }
      }
    });

    // 2. Yeti State Machine
    if (this.staggerTimer > 0) {
      this.staggerTimer -= dt;
      this.state = "STAGGERED";
    } else if (this.distractedTimer > 0) {
      this.distractedTimer -= dt;
      this.state = "DISTRACTED";
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

      if (distToPlayer < 7.5) {
        // Charge directly at player!
        this.state = "CHARGING";
        const dx = playerPos.x - this.x;
        const dz = playerPos.z - this.z;
        this.x += Math.sign(dx) * Math.min(Math.abs(dx), 3.5 * dt);
        this.z += Math.sign(dz) * Math.min(Math.abs(dz), 4.5 * dt);

        if (distToPlayer < 3.2 && this.biteCooldown <= 0) {
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
        // Default Prowl 25m ahead of player
        this.state = "STALKING_NPCS";
        const targetZ = playerPos.z + 28;
        this.z += (targetZ - this.z) * 1.5 * dt;
        this.x += (playerPos.x - this.x) * 1.2 * dt + Math.sin(Date.now() * 0.003) * 0.3;
      }
    }

    // Keep Yeti in front zone
    if (this.z < playerPos.z - 12) {
      this.z = playerPos.z + 28;
      this.x = playerPos.x + (Math.random() - 0.5) * 16;
    }

    if (this.mesh) {
      this.mesh.position.set(this.x, 0, this.z);
    }
  }

  setWave(waveNum) {
    this.wave = waveNum;
    this.maxHp = 8000 * waveNum;
    this.hp = this.maxHp;
    this.state = "STALKING_NPCS";
    if (this.mesh) this.mesh.visible = true;
  }
}
