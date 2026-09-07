// public/js/CombatSystem.js
// Steam-Powered Harpoon Cannon, Steel Cable Tethering & Explosive Secondary Ordinance

export class CombatSystem {
  constructor() {
    this.harpoonCooldown = 0.0;
    this.harpoonReloadTime = 0.35; // Snappy pneumatic steam harpoon cycle
    this.isTethered = false;
    this.tetheredSegment = null;
    this.ropeTension = 0;

    // Explosive secondary harpoons (fireable while towed)
    this.explosiveHarpoons = 3;
    this.maxExplosive = 3;

    // Magnesium Flare Gun (Alt-Fire: KeyE)
    this.flareAmmo = 3;
    this.maxFlareAmmo = 3;
    this.flareCooldown = 0;

    // Rescued squad state for HUD and scoring
    this.rescuedSquad = [];
    this.rescueMultiplier = 1.0;

    this.setupControls();
  }

  setupControls() {
    window.addEventListener("keydown", (e) => {
      if (e.repeat) return;
      if (e.code === "KeyF" || e.code === "Space") {
        e.preventDefault();
        if (this.isTethered) {
          this.releaseHarpoon();
        } else {
          this.fireActiveHarpoon();
        }
      } else if (e.code === "KeyE") {
        this.fireFlareGun();
      } else if (e.code === "KeyR") {
        // Unhook / Release Harpoon Cable
        this.releaseHarpoon();
      }
    });

    // Dedicated HUD Harpoon Launch Button listener
    const bindHarpoonBtn = () => {
      const btn = document.getElementById("btn-hud-harpoon");
      if (btn) {
        const handleFire = (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (window.__audioSystem) window.__audioSystem.unlockAndStart();
          if (this.isTethered) {
            this.releaseHarpoon();
          } else {
            this.fireActiveHarpoon();
          }
        };
        btn.addEventListener("pointerdown", handleFire);
        btn.addEventListener("click", handleFire);
      }
    };
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", bindHarpoonBtn);
    } else {
      bindHarpoonBtn();
    }

    // Instant screen tap / pointerdown weapon firing
    window.addEventListener("pointerdown", (e) => {
      if (e.target && (
        e.target.closest("button") ||
        e.target.closest("input") ||
        e.target.closest(".modal") ||
        e.target.closest("#touch-steer-zone") ||
        e.target.closest("#mobile-action-bar") ||
        e.target.closest("#minimap-container") ||
        e.target.closest("#hud-harpoon-container")
      )) {
        return;
      }
      this.fireActiveHarpoon();
    });
  }

  fireActiveHarpoon() {
    if (this.harpoonCooldown > 0) return;
    this.harpoonCooldown = this.harpoonReloadTime;

    const player = window.__playerPhysics;
    const whale = window.__frostLeviathan;
    const netSync = window.__networkSync;
    const audio = window.__audioSystem;

    if (!player) return;

    if (audio && audio.playHarpoonLaunch) {
      audio.playHarpoonLaunch();
    }

    if (this.isTethered) {
      // Secondary explosive harpoon shot while in towed state!
      if (whale) {
        const dmg = Math.floor(250 + Math.random() * 150);
        whale.hp = Math.max(0, whale.hp - dmg);
        if (netSync) {
          netSync.sendLeviathanDamage(dmg, true);
        }
        if (window.__onGameEvent) {
          window.__onGameEvent("EXPLOSIVE_HIT", { damage: dmg, whaleHp: whale.hp });
        }
      }
      return;
    }

    // Firing primary steam harpoon targeting Beast/Yeti
    const sceneMgr = window.__sceneManager;
    let fireDir = new THREE.Vector3(Math.sin(player.steer || 0), 0.05, Math.cos(player.steer || 0)).normalize();
    if (whale && typeof whale.x === "number" && typeof whale.z === "number") {
      const dx = whale.x - player.x;
      const dy = (whale.y || 0) + 2 - player.y;
      const dz = whale.z - player.z;
      if (Math.hypot(dx, dz) > 0.1) {
        fireDir = new THREE.Vector3(dx, dy, dz).normalize();
      }
    }

    if (sceneMgr) {
      if (typeof sceneMgr.fireHarpoon === "function") {
        sceneMgr.fireHarpoon(
          { x: player.x, y: player.y + 1.0, z: player.z },
          fireDir,
          130
        );
      } else if (typeof sceneMgr.spawnHarpoon === "function") {
        sceneMgr.spawnHarpoon(
          { x: player.x, y: player.y + 1.0, z: player.z },
          fireDir,
          130
        );
      }
    }
  }

  handleHarpoonHit(beast, targetSegment = 0) {
    this.isTethered = true;
    this.tetheredSegment = targetSegment;
    this.dragTime = 0;
    this.dragTripAccumulator = 0;
    this.tetherTension = 0.5;

    const player = window.__playerPhysics;
    const netSync = window.__networkSync;
    const sceneMgr = window.__sceneManager;

    if (sceneMgr && typeof sceneMgr.addTrauma === "function") {
      sceneMgr.addTrauma(0.4);
    }

    if (player && typeof player.setTowedState === "function") {
      player.setTowedState(true, { name: "Yeti", id: targetSegment });
    }
    if (netSync && typeof netSync.sendHarpoonHit === "function") {
      netSync.sendHarpoonHit(targetSegment);
    }
    if (window.__onGameEvent) {
      window.__onGameEvent({
        type: "HARPOON_LOCKED",
        segment: targetSegment,
        segmentName: "Frost Yeti",
        message: "⛓️ HARPOON IMPALED! WINCH CABLE LOCKED ON YETI!"
      });
    }
  }

  releaseHarpoon() {
    if (!this.isTethered) return;
    this.isTethered = false;
    this.tetheredSegment = null;

    const player = window.__playerPhysics;
    if (player && typeof player.setTowedState === "function") {
      player.setTowedState(false);
    }

    const netSync = window.__networkSync;
    if (netSync && typeof netSync.sendHarpoonReleased === "function") {
      netSync.sendHarpoonReleased();
    }

    if (window.__onGameEvent) {
      window.__onGameEvent({ type: "CABLE_RELEASED" });
    }
  }

  fireFlareGun() {
    if (this.flareAmmo <= 0 || this.flareCooldown > 0) return;
    this.flareAmmo--;
    this.flareCooldown = 3.0;

    const audio = window.__audioSystem;
    if (audio && audio.playFlare) {
      audio.playFlare();
    }

    if (window.__onGameEvent) {
      window.__onGameEvent("FLARE_FIRED");
    }
  }

  update(dt) {
    if (this.harpoonCooldown > 0) this.harpoonCooldown -= dt;
    if (this.flareCooldown > 0) this.flareCooldown -= dt;

    // ─── ACTIVE YETI DRAG DOWN & TETHER DYNAMICS ─────────────────────────
    if (this.isTethered) {
      const player = window.__playerPhysics;
      const yeti = window.__yetiPredator || window.__yetiEntity;
      const sceneMgr = window.__sceneManager;

      if (player && yeti && yeti.hp > 0) {
        this.dragTime += dt;
        const dx = player.x - yeti.x;
        const dz = player.z - yeti.z;
        const dist = Math.hypot(dx, dz);

        // Calculate Cable Tension (0.0 to 1.0)
        this.tetherTension = Math.min(1.0, Math.max(0.2, dist / 35.0));

        // 1. Momentum Drag: Player pulls Yeti forward / slows downhill runaway
        if (dz > 0) {
          yeti.speed = Math.max(8.0, (yeti.speed || 24.0) - (22.0 * dt));
        }

        // 2. Lateral Carve Flank Drag: Player banks sideways with skis
        const steerForce = Math.abs(player.steer || 0);
        if (steerForce > 0.08) {
          const pullDir = Math.sign(dx);
          yeti.x += pullDir * (steerForce * 18.0 * dt);
          this.dragTripAccumulator += steerForce * dt * 1.6;

          // Continuous friction sawing damage
          const frictionDmg = Math.round(90 * dt);
          yeti.hp = Math.max(0, yeti.hp - frictionDmg);
        }

        // 3. Yeti Thrash Animation & Cable Strain
        if (yeti.state !== "DRAGGED_DOWN") {
          yeti.state = "BAYED_UP";
        }

        // 4. CRITICAL TRIP / DRAG DOWN EVENT:
        // Accumulating enough lateral steer torque trips the beast into the snow!
        if (this.dragTripAccumulator >= 2.0 || this.dragTime >= 4.0) {
          this.dragTripAccumulator = 0;
          this.dragTime = 0;

          // Trip the Yeti!
          yeti.state = "DRAGGED_DOWN";
          yeti.staggerTimer = 4.5;
          const critDmg = 2500;
          yeti.hp = Math.max(0, yeti.hp - critDmg);

          if (sceneMgr && sceneMgr.addTrauma) {
            sceneMgr.addTrauma(0.65); // Massive screen impact
          }

          if (window.__onGameEvent) {
            window.__onGameEvent({
              type: "YETI_DRAGGED_DOWN",
              damage: critDmg,
              message: "💥 YETI DRAGGED DOWN! CRASHED INTO SNOW (-2,500 CRIT)!"
            });
          }
        }
      }
    }
  }
}
