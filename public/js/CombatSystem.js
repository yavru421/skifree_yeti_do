// public/js/CombatSystem.js
// Directional Auto-Target Hip-Fire, Magnesium Flare Gun, NPC Squad Rescue & Stagger Logic

export class CombatSystem {
  constructor() {
    this.ammo = 8;
    this.maxAmmo = 8;
    this.isReloading = false;
    this.reloadDuration = 1.2; // Seconds
    this.reloadTimer = 0;

    this.baitCount = 2;
    this.maxBait = 3;

    // Magnesium Flare Gun (Alt-Fire: KeyE)
    this.flareAmmo = 2;
    this.maxFlareAmmo = 3;
    this.flareCooldown = 0;

    // NPC Squad Rescue Mechanics
    this.rescuedSquad = []; // Array of rescued NPC entities trailing player
    this.rescueMultiplier = 1.0;

    this.setupControls();
  }

  setupControls() {
    window.addEventListener("keydown", (e) => {
      if (e.code === "KeyR") {
        this.reload(window.__audioSystem, window.__onGameEvent);
      } else if (e.code === "KeyB") {
        this.dropBait(
          { x: window.__playerPhysics?.x || 0, z: window.__playerPhysics?.z || 0 },
          window.__yetiEntity,
          window.__audioSystem,
          window.__onGameEvent
        );
      } else if (e.code === "KeyE") {
        // Fire Magnesium Flare Gun
        this.fireFlareGun(
          { x: window.__playerPhysics?.x || 0, y: 0, z: window.__playerPhysics?.z || 0 },
          window.__yetiEntity,
          window.__audioSystem,
          window.__sceneManager,
          window.__onGameEvent
        );
      } else if (e.code === "KeyF") {
        // Hip-fire Rifle
        this.shoot(
          { x: window.__playerPhysics?.x || 0, y: 0, z: window.__playerPhysics?.z || 0 },
          window.__yetiEntity,
          window.__audioSystem,
          window.__sceneManager,
          window.__onGameEvent
        );
      }
    });

    window.addEventListener("pointerdown", (e) => {
      // Prevent clicks on UI buttons from triggering shoot
      if (e.target && (
        e.target.closest("button") ||
        e.target.closest("input") ||
        e.target.closest("#modal-backdrop") ||
        e.target.closest("#start-modal") ||
        e.target.closest("#menu-modal") ||
        e.target.closest("#death-modal") ||
        e.target.closest("#claim-score-modal") ||
        e.target.closest("#intro-overlay") ||
        e.target.closest("#touch-steer-zone")
      )) {
        return;
      }
      this.shoot(
        { x: window.__playerPhysics?.x || 0, y: 0, z: window.__playerPhysics?.z || 0 },
        window.__yetiEntity,
        window.__audioSystem,
        window.__sceneManager,
        window.__onGameEvent
      );
    });
  }

  reload(audioSystem, onEvent) {
    if (this.isReloading || this.ammo === this.maxAmmo) return;
    this.isReloading = true;
    this.reloadTimer = this.reloadDuration;
    if (audioSystem && audioSystem.playReload) audioSystem.playReload();
    if (onEvent) onEvent({ type: "RELOAD_START" });
  }

  update(dt, onEvent, playerPos, npcs, audioSystem) {
    if (this.isReloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        this.isReloading = false;
        this.ammo = this.maxAmmo;
        if (onEvent) onEvent({ type: "RELOAD_COMPLETE", ammo: this.ammo });
      }
    }

    if (this.flareCooldown > 0) {
      this.flareCooldown -= dt;
    }

    // NPC Squad Rescue Check: Detect nearby unrescued NPCs
    if (playerPos && npcs && npcs.length > 0) {
      npcs.forEach(npc => {
        if (!npc.isRescued && !npc.isEaten) {
          const dx = npc.x - playerPos.x;
          const dz = npc.z - playerPos.z;
          const dist = Math.hypot(dx, dz);
          if (dist < 4.8) {
            // Recruited to Squad!
            npc.isRescued = true;
            this.rescuedSquad.push(npc);
            this.rescueMultiplier = 1.0 + (this.rescuedSquad.length * 0.15);
            if (audioSystem && audioSystem.playRescueFanfare) audioSystem.playRescueFanfare();
            if (onEvent) {
              onEvent({
                type: "NPC_RESCUED",
                npcId: npc.id,
                squadSize: this.rescuedSquad.length,
                multiplier: this.rescueMultiplier
              });
            }
          }
        }
      });

      // Update trailing squad positions (snake formation behind player)
      this.rescuedSquad.forEach((member, idx) => {
        if (!member.mesh) return;
        const targetZ = playerPos.z - (4.0 + idx * 3.2);
        const targetX = playerPos.x + Math.sin(idx + Date.now() * 0.003) * 1.8;
        member.x += (targetX - member.x) * 8.0 * dt;
        member.z += (targetZ - member.z) * 8.0 * dt;
        member.mesh.position.set(member.x, 1.2, member.z);
        member.mesh.visible = true;
      });
    }
  }

  fireFlareGun(playerPos, yetiEntity, audioSystem, sceneManager, onEvent) {
    if (this.flareAmmo <= 0 || this.flareCooldown > 0) return;
    this.flareAmmo--;
    this.flareCooldown = 4.0;

    if (audioSystem && audioSystem.playBigAirWhoosh) audioSystem.playBigAirWhoosh();
    if (sceneManager && sceneManager.addTrauma) sceneManager.addTrauma(0.25);

    // Check hit on Yeti
    let hit = false;
    if (yetiEntity && yetiEntity.hp > 0) {
      const dx = yetiEntity.x - playerPos.x;
      const dz = yetiEntity.z - playerPos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 75 && dz > -5) {
        hit = true;
        // Trigger 3.5s burning panic on Yeti
        yetiEntity.igniteFlareBurn(3.5);
        if (audioSystem && audioSystem.playSkierScream) audioSystem.playSkierScream();
      }
    }

    if (onEvent) {
      onEvent({
        type: "FLARE_FIRED",
        hit,
        remainingFlares: this.flareAmmo,
        message: hit ? "🔥 YETI IGNITED! BURNING PANIC TRIGGERED!" : "FLARE FIRED INTO SKY!"
      });
    }
  }

  findAutoTarget(playerPos, yetiPos) {
    if (yetiPos && yetiPos.hp > 0) {
      const dx = yetiPos.x - playerPos.x;
      const dz = yetiPos.z - playerPos.z;
      const dist = Math.hypot(dx, dz);

      // Forward cone check: Yeti is in front of player within 90m
      if (dz > -5 && dz < 90 && Math.abs(dx) < 40) {
        const isCrit = Math.abs(dx) < 3.5 && dz < 35; // Close center headshot
        return {
          type: "YETI",
          dist,
          x: yetiPos.x,
          y: yetiPos.y || 1.8,
          z: yetiPos.z,
          isCrit,
          damage: isCrit ? 300 : 120
        };
      }
    }
    return null;
  }

  shoot(playerPos, yetiEntity, audioSystem, sceneManager, onEvent) {
    if (this.isReloading) return;
    if (this.ammo <= 0) {
      this.reload(audioSystem, onEvent);
      return;
    }

    this.ammo--;
    if (audioSystem && audioSystem.playShotgunBlast) {
      audioSystem.playShotgunBlast();
    } else if (audioSystem && audioSystem.playGunshot) {
      audioSystem.playGunshot();
    }
    if (sceneManager && sceneManager.addTrauma) {
      sceneManager.addTrauma(0.32);
    }

    const target = this.findAutoTarget(
      playerPos,
      yetiEntity ? { x: yetiEntity.x, y: 1.8, z: yetiEntity.z, hp: yetiEntity.hp } : null
    );

    let hit = false;
    let damage = 0;
    let isCrit = false;

    if (target && target.type === "YETI") {
      hit = true;
      damage = Math.round(target.damage * this.rescueMultiplier); // Squad bonus damage!
      isCrit = target.isCrit;

      if (audioSystem && audioSystem.playHitFlesh) audioSystem.playHitFlesh();
      if (sceneManager && sceneManager.addTrauma) sceneManager.addTrauma(0.18);
      if (yetiEntity) {
        yetiEntity.applyDamage(damage, isCrit);
      }
    }

    if (onEvent) {
      onEvent({
        type: "SHOOT",
        ammo: this.ammo,
        hit,
        damage,
        isCrit,
        targetPos: target ? { x: target.x, y: target.y, z: target.z } : null
      });
    }

    if (this.ammo === 0) {
      this.reload(audioSystem, onEvent);
    }
  }

  dropBait(playerPos, yetiEntity, audioSystem, onEvent) {
    if (this.baitCount <= 0) return false;
    this.baitCount--;

    if (yetiEntity) {
      yetiEntity.distractWithBait(playerPos.x, playerPos.z);
    }

    if (onEvent) {
      onEvent({
        type: "BAIT_DROPPED",
        x: playerPos.x,
        z: playerPos.z,
        remainingBait: this.baitCount
      });
    }
    return true;
  }
}
