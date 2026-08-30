// public/js/CombatSystem.js
// Directional Auto-Target Hip-Fire, Recoil, Tracers & Floating Arcade Damage

export class CombatSystem {
  constructor() {
    this.ammo = 8;
    this.maxAmmo = 8;
    this.isReloading = false;
    this.reloadDuration = 1.2; // Seconds
    this.reloadTimer = 0;

    this.baitCount = 1;
    this.maxBait = 3;

    this.setupControls();
  }

  setupControls() {
    window.addEventListener("keydown", (e) => {
      if (e.code === "KeyR") {
        this.reload();
      }
    });

    window.addEventListener("pointerdown", (e) => {
      // Prevent clicks on UI buttons from triggering shoot
      if (e.target && (e.target.closest("button") || e.target.closest("input") || e.target.closest("#modal-backdrop"))) {
        return;
      }
      this.shoot();
    });
  }

  reload(audioSystem, onEvent) {
    if (this.isReloading || this.ammo === this.maxAmmo) return;
    this.isReloading = true;
    this.reloadTimer = this.reloadDuration;
    if (audioSystem) audioSystem.playReload();
    if (onEvent) onEvent({ type: "RELOAD_START" });
  }

  update(dt, onEvent) {
    if (this.isReloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        this.isReloading = false;
        this.ammo = this.maxAmmo;
        if (onEvent) onEvent({ type: "RELOAD_COMPLETE", ammo: this.ammo });
      }
    }
  }

  findAutoTarget(playerPos, yetiPos, npcs = []) {
    // 1. Check Yeti
    if (yetiPos && yetiPos.hp > 0) {
      const dx = yetiPos.x - playerPos.x;
      const dz = yetiPos.z - playerPos.z;
      const dist = Math.hypot(dx, dz);

      // Forward cone check (within 65m forward and within 30m lateral)
      if (dz > -5 && dz < 65 && Math.abs(dx) < 32) {
        const isCrit = Math.abs(dx) < 2.5 && dz < 25; // Dead-center close headshot
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
    if (audioSystem) audioSystem.playGunshot();

    const target = this.findAutoTarget(
      playerPos,
      yetiEntity ? { x: yetiEntity.x, y: 1.8, z: yetiEntity.z, hp: yetiEntity.hp } : null
    );

    let hit = false;
    let damage = 0;
    let isCrit = false;

    if (target && target.type === "YETI") {
      hit = true;
      damage = target.damage;
      isCrit = target.isCrit;

      if (audioSystem) audioSystem.playHitFlesh();
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
