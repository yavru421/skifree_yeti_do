// public/js/YetiPredator.js
// 3D Yeti Boss AI with UV-Cropped Sprite Animation & Multi-Color NPC Skier Swarm

export class YetiPredator {
  constructor(sceneManager) {
    this.sceneManager = sceneManager;
    this.textureLoader = new THREE.TextureLoader();

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
    this.yetiGroup = new THREE.Group();

    // 1. Hunched Muscular Silver-White Fur Torso & Traps
    const torsoGeo = new THREE.CylinderGeometry(1.8, 1.3, 3.2, 10);
    const furMat = new THREE.MeshStandardMaterial({
      color: 0xeef4ff,
      roughness: 0.85,
      metalness: 0.05
    });
    const darkSkinMat = new THREE.MeshStandardMaterial({
      color: 0x8a9bb8,
      roughness: 0.9
    });

    const torso = new THREE.Mesh(torsoGeo, furMat);
    torso.position.set(0, 2.4, -0.2);
    torso.rotation.x = 0.35; // Aggressive forward beast hunch
    this.yetiGroup.add(torso);

    // Muscular Chest / Pectoral Fur Plate
    const chestGeo = new THREE.BoxGeometry(2.4, 1.6, 1.4);
    const chest = new THREE.Mesh(chestGeo, darkSkinMat);
    chest.position.set(0, 2.7, 0.45);
    chest.rotation.x = 0.25;
    this.yetiGroup.add(chest);

    // 2. Fierce Horned Beast Head & Snarling Fanged Maw
    const headGroup = new THREE.Group();
    const headGeo = new THREE.BoxGeometry(1.6, 1.5, 1.8);
    const head = new THREE.Mesh(headGeo, darkSkinMat);
    head.position.set(0, 4.1, 0.5);
    headGroup.add(head);

    // Snarling Jaw & Teeth
    const jawGeo = new THREE.BoxGeometry(1.3, 0.6, 1.2);
    const jaw = new THREE.Mesh(jawGeo, darkSkinMat);
    jaw.position.set(0, 3.5, 1.1);
    headGroup.add(jaw);

    const fangsMat = new THREE.MeshStandardMaterial({ color: 0xffffee, roughness: 0.2 });
    for (let f = 0; f < 4; f++) {
      const fang = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.3, 5), fangsMat);
      fang.rotation.x = Math.PI;
      fang.position.set((f - 1.5) * 0.32, 3.8, 1.4);
      headGroup.add(fang);
    }

    // Glowing Blood-Red Predatory Eyes
    const eyeGeo = new THREE.SphereGeometry(0.16, 8, 8);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff0033 });
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.45, 4.3, 1.35);
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.45, 4.3, 1.35);
    headGroup.add(leftEye);
    headGroup.add(rightEye);

    // Curved Obsidian Ram Horns
    const hornMat = new THREE.MeshStandardMaterial({ color: 0x1a1a24, roughness: 0.3 });
    const hornGeo = new THREE.ConeGeometry(0.28, 1.4, 8);

    const leftHorn = new THREE.Mesh(hornGeo, hornMat);
    leftHorn.position.set(-0.9, 4.9, 0.2);
    leftHorn.rotation.z = 0.8;
    leftHorn.rotation.x = -0.4;
    headGroup.add(leftHorn);

    const rightHorn = new THREE.Mesh(hornGeo, hornMat);
    rightHorn.position.set(0.9, 4.9, 0.2);
    rightHorn.rotation.z = -0.8;
    rightHorn.rotation.x = -0.4;
    headGroup.add(rightHorn);

    this.yetiGroup.add(headGroup);

    // 3. Muscular Ape-Like Arms with Sharp Obsidian Claws
    const armGeo = new THREE.CylinderGeometry(0.42, 0.35, 3.2, 8);
    const clawMat = new THREE.MeshStandardMaterial({ color: 0x0a0a14, roughness: 0.1 });

    this.leftArm = new THREE.Group();
    const lArmMesh = new THREE.Mesh(armGeo, furMat);
    lArmMesh.position.y = -1.4;
    const lClaw = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.45, 1.1), clawMat);
    lClaw.position.set(0, -3.0, 0.2);
    this.leftArm.add(lArmMesh);
    this.leftArm.add(lClaw);
    this.leftArm.position.set(-2.0, 3.4, 0);
    this.yetiGroup.add(this.leftArm);

    this.rightArm = new THREE.Group();
    const rArmMesh = new THREE.Mesh(armGeo, furMat);
    rArmMesh.position.y = -1.4;
    const rClaw = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.45, 1.1), clawMat);
    rClaw.position.set(0, -3.0, 0.2);
    this.rightArm.add(rArmMesh);
    this.rightArm.add(rClaw);
    this.rightArm.position.set(2.0, 3.4, 0);
    this.yetiGroup.add(this.rightArm);

    // 4. Muscular Digitigrade Legs & Paws
    const legGeo = new THREE.CylinderGeometry(0.55, 0.45, 2.2, 8);
    const leftLeg = new THREE.Mesh(legGeo, furMat);
    leftLeg.position.set(-0.95, 1.1, -0.2);
    const rightLeg = new THREE.Mesh(legGeo, furMat);
    rightLeg.position.set(0.95, 1.1, -0.2);
    this.yetiGroup.add(leftLeg);
    this.yetiGroup.add(rightLeg);

    this.mesh = this.yetiGroup;
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.userData = { isYeti: true };
    sceneManager.scene.add(this.yetiGroup);
  }

  initNpcSwarm(sceneManager) {
    const npcColors = [0xff0055, 0x00f0ff, 0x39ff14, 0xffff00, 0xff7700, 0xaa00ff, 0x0088ff];
    const torsoGeo = new THREE.BoxGeometry(0.65, 0.8, 0.4);
    const headGeo = new THREE.SphereGeometry(0.24, 8, 8);
    const skiGeo = new THREE.BoxGeometry(0.14, 0.04, 2.0);

    for (let i = 0; i < 22; i++) {
      const npcGroup = new THREE.Group();
      const color = npcColors[i % npcColors.length];
      const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.3 });
      const darkMat = new THREE.MeshStandardMaterial({ color: 0x111122 });

      const torso = new THREE.Mesh(torsoGeo, mat);
      torso.position.y = 0.7;
      npcGroup.add(torso);

      const head = new THREE.Mesh(headGeo, darkMat);
      head.position.y = 1.3;
      npcGroup.add(head);

      const leftSki = new THREE.Mesh(skiGeo, mat);
      leftSki.position.set(-0.3, 0.02, 0);
      const rightSki = new THREE.Mesh(skiGeo, mat);
      rightSki.position.set(0.3, 0.02, 0);
      npcGroup.add(leftSki);
      npcGroup.add(rightSki);

      const zPos = 30 + i * 20 + Math.random() * 10;
      const xPos = (Math.random() - 0.5) * 60;
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

    // 2. Yeti State Machine & Predator AI
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
        // Default Prowl 28m ahead of player
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

    // Animate 3D Yeti Mesh, Orientation & Arm Swing Cadence
    if (this.mesh) {
      this.mesh.position.set(this.x, 0, this.z);

      // Face towards moving target / player
      const targetAngle = Math.atan2(playerPos.x - this.x, playerPos.z - this.z);
      this.mesh.rotation.y = targetAngle;

      // Muscular arm swing running cadence
      if (this.leftArm && this.rightArm) {
        const armSpeed = this.state === "CHARGING" ? 0.018 : 0.010;
        const armSwing = Math.sin(Date.now() * armSpeed) * 0.75;
        this.leftArm.rotation.x = armSwing;
        this.rightArm.rotation.x = -armSwing;
      }

      // Stagger recoil vs breath pulse
      if (this.staggerTimer > 0) {
        this.mesh.scale.set(1.2, 0.85, 1.2);
      } else {
        const pulse = 1.0 + Math.sin(Date.now() * 0.006) * 0.04;
        this.mesh.scale.set(pulse, pulse, pulse);
      }
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
