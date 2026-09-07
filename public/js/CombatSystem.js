// public/js/CombatSystem.js
// Steam-Powered Harpoon Cannon, Cable Tension Tow Management & Tactile Takedown Mechanics

export class CombatSystem {
  constructor() {
    this.harpoonCooldown = 0.0;
    this.harpoonReloadTime = 0.35;
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

    // ─── TACTILE TAKEDOWN STATE ──────────────────────────────
    this.towPhase = "IDLE";         // IDLE | RETRACTING | STAGGER | ACTIVE_TOW | FINISH_WINDOW | CABLE_SNAP
    this.cableTension = 0.5;        // 0.0 to 1.0
    this.cableLength = 30;          // Current cable length in meters
    this.cableMaxLength = 40;       // Max before snap
    this.reelInput = 0;             // -1 (pay out), 0 (neutral), +1 (reel in)
    this.redZoneTimer = 0;          // Accumulated seconds in danger zone
    this.finishStrikesLanded = 0;   // Strikes landed during this tow sequence
    this.staggerTimer = 0;
    this.towTimer = 0;

    // 10-Second Retraction Takedown State
    this.retractionDuration = 10.0;
    this.retractionTimer = 10.0;
    this.initialCableDist = 32.0;

    // Rapid-Tap Takedown Mechanic (User: "rapidly tap a take down glowing button that appears once harpoon hits")
    this.tapTakedownCount = 0;
    this.tapTakedownTarget = 15; // 15 rapid taps to down the beast

    // Drag-down legacy state (still used for visuals)
    this.dragTime = 0;
    this.dragTripAccumulator = 0;
    this.tetherTension = 0.5;

    this.setupControls();
  }

  setupControls() {
    // Dedicated Glowing Takedown Tap Button listener
    const bindTapBtn = () => {
      const btn = document.getElementById("btn-takedown-tap");
      if (btn) {
        const handleTap = (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.handleTakedownTap();
        };
        btn.addEventListener("pointerdown", handleTap);
        btn.addEventListener("click", handleTap);
      }
    };
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", bindTapBtn);
    } else {
      bindTapBtn();
    }

    window.addEventListener("keydown", (e) => {
      if (e.repeat) return;
      if (e.code === "KeyF" || e.code === "Space") {
        e.preventDefault();
        if (this.isTethered) {
          // While tethered, Space also counts as rapid tap takedown!
          this.handleTakedownTap();
        } else {
          this.fireActiveHarpoon();
        }
      } else if (e.code === "KeyE") {
        this.fireFlareGun();
      } else if (e.code === "KeyR") {
        this.releaseHarpoon();
      }
    });

    // Mouse wheel for fine tension control during tow
    window.addEventListener("wheel", (e) => {
      if (this.towPhase === "ACTIVE_TOW" || this.towPhase === "FINISH_WINDOW") {
        e.preventDefault();
        if (e.deltaY < 0) {
          this.reelInput = Math.min(1, this.reelInput + 0.3);
        } else {
          this.reelInput = Math.max(-1, this.reelInput - 0.3);
        }
      }
    }, { passive: false });

    // Dedicated HUD Harpoon Launch Button listener
    const bindHarpoonBtn = () => {
      const btn = document.getElementById("btn-hud-harpoon");
      if (btn) {
        const handleFire = (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (window.__audioSystem) window.__audioSystem.unlockAndStart();
          if (this.towPhase === "FINISH_WINDOW") {
            this.executeFinishStrike();
          } else if (this.isTethered) {
            this.fireExplosiveWhileTowed();
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

    // Right-Click contextmenu prevention & secondary heavy backstab
    window.addEventListener("contextmenu", (e) => {
      if (this.isTethered && (this.cableLength <= 7.0 || this.retractionTimer <= 0.5)) {
        e.preventDefault();
        this.executeKnifeBackstab(true);
      }
    });

    // Instant screen tap / pointerdown weapon firing & takedown tapping
    window.addEventListener("pointerdown", (e) => {
      if (this.isTethered) {
        // While tethered, check if at point-blank for knife strike
        const isRightClick = e.button === 2;
        if (this.cableLength <= 7.0 || this.retractionTimer <= 0.5) {
          this.executeKnifeBackstab(isRightClick);
          return;
        }
        // Otherwise, tap spools the winch
        this.handleTakedownTap();
        return;
      }
      if (e.target && (
        e.target.closest("button") ||
        e.target.closest("input") ||
        e.target.closest(".modal") ||
        e.target.closest("#touch-steer-zone") ||
        e.target.closest("#mobile-action-bar") ||
        e.target.closest("#minimap-container") ||
        e.target.closest("#hud-harpoon-container") ||
        e.target.closest("#tension-gauge-container")
      )) {
        return;
      }
      this.fireActiveHarpoon();
    });
  }

  fireActiveHarpoon() {
    if (this.harpoonCooldown > 0) return;
    if (this.isTethered) return; // Can't fire primary while tethered
    this.harpoonCooldown = this.harpoonReloadTime;

    const player = window.__playerPhysics;
    const audio = window.__audioSystem;

    if (!player) return;

    if (audio && audio.playHarpoonLaunch) {
      audio.playHarpoonLaunch();
    }

    // Firing primary steam harpoon targeting Beast/Yeti with higher alpine ballistic arc
    const sceneMgr = window.__sceneManager;
    const yeti = window.__yetiAI || window.__yetiPredator;
    let fireDir = new THREE.Vector3(Math.sin(player.steer || 0), 0.28, Math.cos(player.steer || 0)).normalize();
    if (yeti && typeof yeti.x === "number" && typeof yeti.z === "number") {
      const dx = yeti.x - player.x;
      const dy = ((yeti.y || 0) + 3.8) - player.y; // Target upper chest/head with elevated arc
      const dz = yeti.z - player.z;
      if (Math.hypot(dx, dz) > 0.1) {
        fireDir = new THREE.Vector3(dx, dy + 2.5, dz).normalize(); // High ballistic arc so it never hits ground early
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

  fireExplosiveWhileTowed() {
    if (this.harpoonCooldown > 0) return;
    this.harpoonCooldown = this.harpoonReloadTime;

    const yeti = window.__yetiAI || window.__yetiPredator;
    const netSync = window.__networkSync;
    const audio = window.__audioSystem;

    if (audio && audio.playHarpoonLaunch) {
      audio.playHarpoonLaunch();
    }

    if (yeti) {
      const dmg = Math.floor(250 + Math.random() * 150);
      yeti.hp = Math.max(0, yeti.hp - dmg);
      if (netSync && netSync.sendLeviathanDamage) {
        netSync.sendLeviathanDamage(dmg, true);
      }
      if (window.__onGameEvent) {
        window.__onGameEvent({
          type: "EXPLOSIVE_HIT",
          damage: dmg,
          message: `💥 EXPLOSIVE HARPOON! (-${dmg} HP)`
        });
      }
    }
  }

  handleHarpoonHit(beast, targetSegment = 0) {
    const player = window.__playerPhysics;
    const netSync = window.__networkSync;
    const sceneMgr = window.__sceneManager;
    const yeti = window.__yetiAI || window.__yetiPredator;
    const audio = window.__audioSystem;

    if (sceneMgr && typeof sceneMgr.addTrauma === "function") {
      sceneMgr.addTrauma(0.75);
    }

    // Measure initial distance between player and yeti
    let curDist = 32;
    if (player && yeti) {
      const dx = player.x - yeti.x;
      const dz = player.z - yeti.z;
      curDist = Math.max(22, Math.min(42, Math.hypot(dx, dz)));
      // Ensure player is safely kept behind the Yeti
      if (player.z > yeti.z - 12) {
        player.z = yeti.z - 12;
      }
    }

    // Initialize 10-Second Ski-Behind Retraction Takedown Sequence
    this.isTethered = true;
    this.towPhase = "RETRACTING";
    this.retractionDuration = 10.0;
    this.retractionTimer = 10.0;
    this.initialCableDist = curDist;
    this.cableLength = curDist;
    this.cableTension = 0.5;
    this.tapTakedownCount = 0;

    // Put player in ski-behind towed state
    if (player && typeof player.setTowedState === "function") {
      player.setTowedState(true, targetSegment, 1.5);
    }

    // Command Yeti to enter frantic downhill thrashing sprint!
    if (yeti) {
      if (typeof yeti.enterTowedThrashing === "function") {
        yeti.enterTowedThrashing();
      } else {
        yeti.state = "TOWED_THRASHING";
      }
    }

    this.showTensionGauge(true);
    this.showTakedownTapButton(true);

    if (audio && audio.playHarpoonLaunch) {
      audio.playHarpoonLaunch();
    }
    if (audio && audio.playBigAirWhoosh) {
      audio.playBigAirWhoosh();
    }

    if (netSync && typeof netSync.sendHarpoonHit === "function") {
      netSync.sendHarpoonHit(targetSegment);
    }

    if (window.__onGameEvent) {
      window.__onGameEvent({
        type: "HARPOON_LATCHED",
        message: "⛓️ HARPOON LOCKED! SKI BEHIND THE BEAST • 10s CABLE RETRACTION ENGAGED!"
      });
    }
  }

  showTakedownTapButton(show) {
    const tapContainer = document.getElementById("takedown-tap-container");
    if (tapContainer) {
      tapContainer.classList.toggle("hidden", !show);
    }
    const prog = document.getElementById("takedown-tap-progress");
    if (prog) {
      prog.textContent = "0%";
    }
  }

  handleTakedownTap() {
    if (!this.isTethered) return;
    const yeti = window.__yetiAI || window.__yetiPredator;
    const sceneMgr = window.__sceneManager;
    const audio = window.__audioSystem;

    // If already in point-blank range or timer expired, execute knife backstab!
    if (this.cableLength <= 7.0 || this.retractionTimer <= 0.5) {
      this.executeKnifeBackstab(true);
      return;
    }

    this.tapTakedownCount++;
    // Rapid tap turbo-spools the winch: shave 0.25s per tap from the 10s timer
    if (this.towPhase === "RETRACTING" && this.retractionTimer > 0.5) {
      this.retractionTimer = Math.max(0.5, this.retractionTimer - 0.25);
    }

    const elapsed = this.retractionDuration - this.retractionTimer;
    const pct = Math.min(100, Math.round((elapsed / this.retractionDuration) * 100));

    // Floating tactile feedback and sound
    const prog = document.getElementById("takedown-tap-progress");
    if (prog) prog.textContent = `${pct}%`;

    const tapBtn = document.getElementById("btn-takedown-tap");
    if (tapBtn) {
      tapBtn.style.transform = "scale(0.88)";
      setTimeout(() => { if (tapBtn) tapBtn.style.transform = "scale(1.0)"; }, 60);
      if (this.cableLength <= 7.0 || this.retractionTimer <= 1.0) {
        tapBtn.innerHTML = "<span>🗡️ BACKSTAB!</span>";
        tapBtn.style.background = "radial-gradient(circle, #ff0055 0%, #aa0022 100%)";
        tapBtn.style.boxShadow = "0 0 35px #ff0055";
      }
    }

    // Small camera shake per tap
    if (sceneMgr && sceneMgr.addTrauma) {
      sceneMgr.addTrauma(0.12);
    }
    if (audio && audio.playSpearDeflect) {
      audio.playSpearDeflect();
    }

    // Chip damage with every rapid tap
    if (yeti) {
      const tapDmg = Math.floor(140 + Math.random() * 80);
      yeti.hp = Math.max(1, yeti.hp - tapDmg);
      if (window.__onGameEvent) {
        window.__onGameEvent({
          type: "SPEAR_HIT",
          damage: tapDmg,
          isCrit: false
        });
      }
    }

    // Complete Takedown if timer expired or taps hit target or point-blank reached
    if (this.retractionTimer <= 0.5 || this.tapTakedownCount >= 30 || this.cableLength <= 7.0) {
      this.executeKnifeBackstab(true);
    }
  }

  executeKnifeBackstab(isHeavy = true) {
    const yeti = window.__yetiAI || window.__yetiPredator;
    const sceneMgr = window.__sceneManager;
    const audio = window.__audioSystem;

    if (sceneMgr && sceneMgr.triggerKnifeSlash) {
      sceneMgr.triggerKnifeSlash(isHeavy);
    }
    if (sceneMgr && sceneMgr.addTrauma) {
      sceneMgr.addTrauma(isHeavy ? 1.0 : 0.6);
    }

    if (audio) {
      if (audio.playKnifeSlash) audio.playKnifeSlash();
      if (audio.playFleshImpactThud) audio.playFleshImpactThud();
    }

    // Trigger kinetic screen slash cut overlay
    const slashOverlay = document.getElementById("knife-slash-overlay");
    if (slashOverlay) {
      slashOverlay.classList.remove("active");
      void slashOverlay.offsetWidth;
      slashOverlay.classList.add("active");
      setTimeout(() => { if (slashOverlay) slashOverlay.classList.remove("active"); }, 400);
    }

    const tierData = yeti && yeti.tierData ? yeti.tierData : { id: 1, name: "YETI PRIME" };
    const callsign = (window.__gameApp && window.__gameApp.callsign) || "HUNTER";

    // CS:GO Style Killfeed Entry
    const killfeed = document.getElementById("killfeed");
    if (killfeed) {
      const row = document.createElement("div");
      row.className = "killfeed-entry";
      row.style.cssText = "background: rgba(10,15,25,0.85); border-left: 3px solid #00f0ff; padding: 4px 8px; margin-bottom: 4px; font-family: monospace; font-size: 13px; color: #fff; text-shadow: 0 0 6px #00f0ff; border-radius: 2px;";
      row.innerHTML = `<span style="color:#00f0ff; font-weight:bold;">${callsign}</span> <span style="color:#ffff00; font-weight:900; margin: 0 4px;">🗡️ [${isHeavy ? "BACKSTAB" : "KNIFE"}]</span> <span style="color:#ff0055; font-weight:bold;">${tierData.name}</span>`;
      killfeed.appendChild(row);
      setTimeout(() => { if (row.parentNode) row.parentNode.removeChild(row); }, 5000);
    }

    if (window.__onGameEvent) {
      window.__onGameEvent({
        type: "KNIFE_BACKSTAB",
        isHeavy: isHeavy,
        damage: 5000,
        message: `⚔️ CS:GO ${isHeavy ? "HEAVY BACKSTAB" : "KNIFE SLASH"}! CRITICAL TAKEDOWN!`
      });
    }

    this.executeFullTakedown();
  }

  executeFullTakedown() {
    const yeti = window.__yetiAI || window.__yetiPredator;
    const sceneMgr = window.__sceneManager;
    const audio = window.__audioSystem;
    const main = window.__gameApp;

    this.showTakedownTapButton(false);
    this.showTensionGauge(false);

    if (sceneMgr && sceneMgr.addTrauma) {
      sceneMgr.addTrauma(1.0);
    }
    if (audio) {
      if (audio.playYetiDeathGroan) audio.playYetiDeathGroan();
      if (audio.playRescueFanfare) audio.playRescueFanfare();
    }

    const tierData = yeti && yeti.tierData ? yeti.tierData : { id: 1, name: "YETI" };

    if (yeti) {
      // Massive crit takedown: beast dragged down face first into the snow!
      const critDmg = 5000;
      yeti.hp = 0;
      yeti.speed = 0;
      yeti.state = "FALLEN";
      yeti.staggerTimer = 5.0;

      if (typeof yeti.enterFallen === "function") {
        yeti.enterFallen();
      }

      if (window.__onGameEvent) {
        window.__onGameEvent({
          type: "YETI_DRAGGED_DOWN",
          damage: critDmg,
          message: `🏆 CS:GO KNIFE TAKEDOWN! ${tierData.name} FELLED! LEVEL COMPLETE!`
        });
      }
    }

    // Trigger level victory & advance to next harder level
    if (main && typeof main.handleYetiDefeated === "function") {
      main.handleYetiDefeated("HUNTER", main.raceElapsedSec, 0);
    }

    // Release tether after grand takedown
    setTimeout(() => {
      this.releaseHarpoon();
    }, 1500);
  }

  releaseHarpoon() {
    if (!this.isTethered) return;
    this.isTethered = false;
    this.tetheredSegment = null;
    this.towPhase = "IDLE";
    this.cableTension = 0.5;
    this.reelInput = 0;
    this.showTensionGauge(false);
    this.showTakedownTapButton(false);

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

  executeFinishStrike() {
    if (this.towPhase !== "FINISH_WINDOW") return;

    const yeti = window.__yetiAI || window.__yetiPredator;
    const sceneMgr = window.__sceneManager;
    const audio = window.__audioSystem;

    if (!yeti) return;

    this.finishStrikesLanded++;

    // Massive finish strike damage
    const strikeDmg = 2500;
    yeti.hp = Math.max(0, yeti.hp - strikeDmg);

    if (sceneMgr && sceneMgr.addTrauma) {
      sceneMgr.addTrauma(0.75);
    }
    if (audio && audio.playBigAirWhoosh) {
      audio.playBigAirWhoosh();
    }

    const tierData = yeti.tierData || { finishStrikesNeeded: 1 };

    if (window.__onGameEvent) {
      window.__onGameEvent({
        type: "FINISH_STRIKE",
        damage: strikeDmg,
        strikesLanded: this.finishStrikesLanded,
        strikesNeeded: tierData.finishStrikesNeeded,
        message: `🗡️ SKI-THRUST IMPALE! (-${strikeDmg} CRIT)`
      });
    }

    // Check if enough strikes landed for this tier
    if (this.finishStrikesLanded >= tierData.finishStrikesNeeded || yeti.hp <= 0) {
      // Yeti is taken down! (or will be via hp check)
      if (yeti.hp > 0) {
        yeti.hp = 0; // Ensure death
      }
      this.releaseHarpoon();
    } else {
      // Yeti breaks free after strike — must re-harpoon
      if (window.__onGameEvent) {
        window.__onGameEvent({
          type: "YETI_BROKE_FREE",
          message: `⚡ YETI TORE FREE! ${tierData.finishStrikesNeeded - this.finishStrikesLanded} MORE STRIKES NEEDED!`
        });
      }
      this.cableSnap(false); // Silent snap — no heal, yeti just broke free
    }
  }

  cableSnap(doHeal = true) {
    const yeti = window.__yetiAI || window.__yetiPredator;
    const sceneMgr = window.__sceneManager;

    if (sceneMgr && sceneMgr.addTrauma) {
      sceneMgr.addTrauma(0.6);
    }

    // Tell yeti to enter recovering state
    if (doHeal && yeti && typeof yeti.enterRecovering === "function") {
      yeti.enterRecovering();
    } else if (yeti) {
      yeti.state = "RECOVERING";
      yeti.recoverTimer = 6.0;
    }

    if (doHeal && window.__onGameEvent) {
      window.__onGameEvent({
        type: "CABLE_SNAPPED",
        message: "💔 CABLE SNAPPED! YETI BROKE FREE AND HEALED!"
      });
    }

    this.releaseHarpoon();
  }

  showTensionGauge(show) {
    const gauge = document.getElementById("tension-gauge-container");
    if (gauge) {
      gauge.classList.toggle("hidden", !show);
    }
    const prompt = document.getElementById("tow-action-prompt");
    if (prompt) {
      prompt.classList.toggle("hidden", !show);
    }
  }

  updateTensionHUD() {
    const fill = document.getElementById("tension-fill");
    const label = document.getElementById("tension-label");
    const prompt = document.getElementById("tow-action-prompt");

    if (this.towPhase === "RETRACTING") {
      const timeLeft = Math.max(0, this.retractionTimer);
      const elapsed = this.retractionDuration - timeLeft;
      const pct = Math.min(100, Math.round((elapsed / this.retractionDuration) * 100));

      if (fill) {
        fill.style.width = `${pct}%`;
        fill.style.background = "linear-gradient(90deg, #00f0ff 0%, #39ff14 50%, #ffff00 85%, #ff0055 100%)";
      }
      if (label) {
        label.textContent = `⏱️ ${timeLeft.toFixed(1)}s (${pct}%)`;
      }
      if (prompt) {
        prompt.textContent = `⛓️ WINCH RETRACTING: ${timeLeft.toFixed(1)}s • SKI IN WAKE • CARVE FOR TAKEDOWN!`;
        prompt.style.color = "#00f0ff";
      }
      return;
    }

    if (fill) {
      const pct = Math.round(this.cableTension * 100);
      fill.style.width = `${pct}%`;

      // Color zones
      if (this.cableTension < 0.20) {
        fill.style.background = "linear-gradient(to top, #ff0033, #ff3355)";
      } else if (this.cableTension < 0.35) {
        fill.style.background = "linear-gradient(to top, #ffaa00, #ffcc33)";
      } else if (this.cableTension <= 0.65) {
        fill.style.background = "linear-gradient(to top, #00ff88, #39ff14)";
      } else if (this.cableTension <= 0.80) {
        fill.style.background = "linear-gradient(to top, #ffaa00, #ffcc33)";
      } else {
        fill.style.background = "linear-gradient(to top, #ff0033, #ff3355)";
      }
    }

    if (label) {
      label.textContent = `${Math.round(this.cableTension * 100)}%`;
    }

    if (prompt) {
      if (this.towPhase === "FINISH_WINDOW") {
        prompt.textContent = "⚔️ STRIKE NOW! [SPACE / CLICK]";
        prompt.style.color = "#ffff00";
        prompt.style.animation = "pulse-glow 0.4s infinite";
      } else if (this.cableTension < 0.20) {
        prompt.textContent = "⚠️ REEL IN! [W / SCROLL UP]";
        prompt.style.color = "#ff0033";
        prompt.style.animation = "";
      } else if (this.cableTension > 0.80) {
        prompt.textContent = "⚠️ PAY OUT! [S / SCROLL DOWN]";
        prompt.style.color = "#ff0033";
        prompt.style.animation = "";
      } else if (this.cableTension >= 0.35 && this.cableTension <= 0.65) {
        prompt.textContent = `✅ TENSION GOOD — REELING ${Math.round(this.cableLength)}m`;
        prompt.style.color = "#39ff14";
        prompt.style.animation = "";
      } else {
        prompt.textContent = `⚡ CABLE: ${Math.round(this.cableLength)}m`;
        prompt.style.color = "#ffaa00";
        prompt.style.animation = "";
      }
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

    // ─── TACTILE TAKEDOWN STATE MACHINE ──────────────────────
    if (!this.isTethered || this.towPhase === "IDLE") return;

    const player = window.__playerPhysics;
    const yeti = window.__yetiAI || window.__yetiPredator;
    const sceneMgr = window.__sceneManager;

    if (!player || !yeti || yeti.hp <= 0) {
      if (this.isTethered && yeti && yeti.hp <= 0) {
        this.releaseHarpoon();
      }
      return;
    }

    // ─── PHASE: RETRACTING (10-Second Ski-Behind Takedown Sequence) ───
    if (this.towPhase === "RETRACTING") {
      this.retractionTimer -= dt;
      const timeLeft = Math.max(0, this.retractionTimer);
      const progress = Math.min(1.0, Math.max(0, 1.0 - (timeLeft / this.retractionDuration)));

      // Smooth cable retraction from initial distance down to 6m point-blank
      this.cableLength = 6 + (this.initialCableDist - 6) * (timeLeft / this.retractionDuration);

      // Tension stays lively in the green sweet spot (0.45 to 0.58)
      this.cableTension = 0.5 + Math.sin(performance.now() * 0.009) * 0.08;

      // Progressive wear down of Yeti HP during the 10-second tow
      if (yeti && yeti.maxHp) {
        yeti.hp = Math.max(1, Math.round(yeti.maxHp * (1 - progress * 0.95)));
      }

      // Update HUD elements
      this.updateTensionHUD();

      // Check if 10-second countdown reached
      if (this.retractionTimer <= 0) {
        this.executeFullTakedown();
        return;
      }
      return;
    }

    // ─── PHASE: STAGGER ──────────────────────────────────────
    if (this.towPhase === "STAGGER") {
      this.staggerTimer -= dt;

      if (this.staggerTimer <= 0) {
        // Transition to active tow phase
        this.towPhase = "ACTIVE_TOW";
        this.towTimer = 0;

        // Tell Yeti to enter towed thrashing
        if (typeof yeti.enterTowedThrashing === "function") {
          yeti.enterTowedThrashing();
        }

        if (window.__onGameEvent) {
          window.__onGameEvent({
            type: "TOW_PHASE_START",
            message: "⛓️ YETI RECOVERS! MANAGE CABLE TENSION! [W: REEL / S: PAY OUT]"
          });
        }
      }
      this.updateTensionHUD();
      return;
    }

    // ─── PHASE: ACTIVE_TOW ───────────────────────────────────
    if (this.towPhase === "ACTIVE_TOW" || this.towPhase === "FINISH_WINDOW") {
      this.towTimer += dt;

      // Calculate actual distance
      const dx = player.x - yeti.x;
      const dz = player.z - yeti.z;
      const actualDist = Math.hypot(dx, dz);

      // ─── REEL INPUT FROM KEYBOARD ─────────────────────────
      if (player.keys) {
        if (player.keys.up) {
          this.reelInput = Math.min(1, this.reelInput + 3.0 * dt);
        } else if (player.keys.down) {
          this.reelInput = Math.max(-1, this.reelInput - 3.0 * dt);
        } else {
          // Decay reel input toward neutral
          this.reelInput *= Math.pow(0.1, dt);
        }
      }

      // ─── TENSION DYNAMICS ─────────────────────────────────
      const tierData = yeti.tierData || { reelResistance: 0.7, thrashIntensity: 0.5, cableBreakThreshold: 3.0 };

      // Base tension from distance ratio
      const distRatio = actualDist / this.cableMaxLength;

      // Yeti thrashing applies random tension spikes
      const thrashNoise = Math.sin(performance.now() * 0.008 * (1 + tierData.thrashIntensity * 2)) *
                          tierData.thrashIntensity * 0.2;

      // Reel input shifts tension
      const reelEffect = this.reelInput * 0.4 * dt * (1 - tierData.reelResistance * 0.5);

      // Compute target tension
      let targetTension = distRatio * 0.8 + thrashNoise + reelEffect;

      // Reel-in increases tension, pay-out decreases
      if (this.reelInput > 0.1) {
        targetTension += 0.15 * this.reelInput;
      } else if (this.reelInput < -0.1) {
        targetTension -= 0.15 * Math.abs(this.reelInput);
      }

      // Smooth transition
      this.cableTension += (targetTension - this.cableTension) * Math.min(1, 3.0 * dt);
      this.cableTension = Math.max(0, Math.min(1, this.cableTension));

      // ─── CABLE LENGTH / REEL-IN PROGRESS ──────────────────
      if (this.cableTension >= 0.35 && this.cableTension <= 0.65) {
        // GREEN ZONE: Reel in cable
        const reelSpeed = 3.0 - tierData.reelResistance * 2.0; // 1.1 to 2.4 m/s
        this.cableLength = Math.max(0, this.cableLength - reelSpeed * dt);
      } else if (this.cableTension < 0.20 || this.cableTension > 0.80) {
        // RED ZONE: Cable stretching / going slack
        this.cableLength += 1.5 * dt; // Cable drifts longer
      }

      // Sync cable length with actual distance
      this.cableLength = Math.max(this.cableLength, actualDist * 0.5);
      this.cableLength = Math.min(this.cableLength, this.cableMaxLength);

      // ─── RED ZONE SNAP TIMER ──────────────────────────────
      if (this.cableTension < 0.20 || this.cableTension > 0.80) {
        this.redZoneTimer += dt;
        if (this.redZoneTimer >= tierData.cableBreakThreshold) {
          // CABLE SNAPS!
          this.cableSnap(true);
          return;
        }
      } else {
        // Decay red zone timer when in safe zone
        this.redZoneTimer = Math.max(0, this.redZoneTimer - dt * 0.5);
      }

      // ─── FINISH STRIKE WINDOW ─────────────────────────────
      if (this.cableLength <= 8 || actualDist <= 10) {
        if (this.towPhase !== "FINISH_WINDOW") {
          this.towPhase = "FINISH_WINDOW";
          if (window.__onGameEvent) {
            window.__onGameEvent({
              type: "FINISH_STRIKE_READY",
              message: "⚔️ IN RANGE! STRIKE NOW! [SPACE / CLICK]"
            });
          }
        }
      } else if (this.towPhase === "FINISH_WINDOW") {
        this.towPhase = "ACTIVE_TOW"; // Dropped out of range
      }

      // ─── CONTINUOUS TETHER DAMAGE ─────────────────────────
      // Lateral carving still does friction damage during tow
      const steerForce = Math.abs(player.steer || 0);
      if (steerForce > 0.08) {
        const frictionDmg = Math.round(45 * dt); // Reduced from 90 — takedown is now the main damage
        yeti.hp = Math.max(0, yeti.hp - frictionDmg);
      }

      // ─── LATERAL PULL ON YETI ─────────────────────────────
      if (steerForce > 0.08 && this.cableTension >= 0.30) {
        const pullDir = Math.sign(dx);
        yeti.x += pullDir * (steerForce * 10.0 * dt);
      }

      this.updateTensionHUD();
    }
  }
}
