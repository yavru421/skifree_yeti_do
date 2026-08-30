// public/js/HUDManager.js
// DOM HUD Overlays, Health, Speedometer, Minimap & Arcade Popups

export class HUDManager {
  constructor() {
    this.speedEl = document.getElementById("hud-speed");
    this.scoreEl = document.getElementById("hud-dmg");
    this.ammoEl = document.getElementById("ammo-count");
    this.diffBadge = document.getElementById("diff-badge");
    this.limbStatus = document.getElementById("limb-status");

    this.bossHpFill = document.getElementById("boss-hp-fill");
    this.bossHpText = document.getElementById("boss-hp-text");
    this.bossWaveTitle = document.getElementById("boss-wave-title");
    this.bossTargetBanner = document.getElementById("boss-target-banner");

    this.raceHud = document.getElementById("race-hud");
    this.raceTimeVal = document.getElementById("race-time-val");
    this.raceGatesVal = document.getElementById("race-gates-val");
    this.raceStreakVal = document.getElementById("race-streak-val");

    this.minimapPlayer = document.getElementById("minimap-player");
    this.minimapYeti = document.getElementById("minimap-yeti");

    this.floatingDmgContainer = document.getElementById("floating-dmg-container");
    this.combatFeed = document.getElementById("combat-feed");
    this.damageFlash = document.getElementById("damage-flash");
    this.clawOverlay = document.getElementById("claw-overlay");
    this.radarEl = document.getElementById("yeti-threat-radar");

    this.hearts = [
      document.getElementById("h1"),
      document.getElementById("h2"),
      document.getElementById("h3")
    ];
  }

  update(playerPhysics, combatSystem, yetiPredator, gameMode, raceElapsedSec) {
    // 1. Speedometer & Score
    if (this.speedEl) {
      this.speedEl.innerHTML = `${Math.round(playerPhysics.speed)} <span style="font-size:10px;">MPH</span>`;
    }
    if (this.scoreEl) {
      this.scoreEl.innerHTML = `${playerPhysics.score.toLocaleString()} <span style="font-size:10px;">PTS</span>`;
    }
    if (this.ammoEl) {
      this.ammoEl.style.display = 'none';
    }

    // 2. Lives Hearts
    this.hearts.forEach((heart, idx) => {
      if (heart) {
        if (idx < playerPhysics.lives) {
          heart.classList.remove("heart-lost");
        } else {
          heart.classList.add("heart-lost");
        }
      }
    });

    if (this.limbStatus) {
      if (playerPhysics.lives === 3) {
        this.limbStatus.textContent = "INTACT";
        this.limbStatus.style.color = "#39ff14";
      } else if (playerPhysics.lives === 2) {
        this.limbStatus.textContent = "BRUISED";
        this.limbStatus.style.color = "#ffff00";
      } else if (playerPhysics.lives === 1) {
        this.limbStatus.textContent = "CRITICAL";
        this.limbStatus.style.color = "#ff0033";
      } else {
        this.limbStatus.textContent = "WIPEOUT";
        this.limbStatus.style.color = "#ff0033";
      }
    }

    // 3. Boss Health & Radar
    if (yetiPredator) {
      if (this.bossHpFill) {
        const hpPercent = Math.max(0, (yetiPredator.hp / yetiPredator.maxHp) * 100);
        this.bossHpFill.style.width = `${hpPercent}%`;
      }
      if (this.bossHpText) {
        this.bossHpText.textContent = `${yetiPredator.hp.toLocaleString()} / ${yetiPredator.maxHp.toLocaleString()} HP`;
      }
      if (this.bossWaveTitle) {
        this.bossWaveTitle.textContent = `👹 ALPINE YETI (W${yetiPredator.wave})`;
      }

      if (this.radarEl) {
        const dist = Math.hypot(yetiPredator.x - playerPhysics.x, yetiPredator.z - playerPhysics.z);
        if (dist < 45 && yetiPredator.hp > 0) {
          this.radarEl.style.opacity = "1";
          this.radarEl.textContent = `👹 YETI ${Math.round(dist)}M [AUTO-AIM READY]`;
        } else {
          this.radarEl.style.opacity = "0";
        }
      }
    }

    // 4. Slalom Race HUD
    if (gameMode === "slalom" && this.raceHud) {
      this.raceHud.classList.remove("hidden");
      if (this.raceTimeVal) {
        this.raceTimeVal.textContent = `${raceElapsedSec.toFixed(1)}s`;
      }
      if (this.raceGatesVal) {
        this.raceGatesVal.textContent = `${playerPhysics.gatesHit}/30`;
      }
      if (this.raceStreakVal) {
        this.raceStreakVal.textContent = `${playerPhysics.gateStreak}x`;
      }
    } else if (this.raceHud) {
      this.raceHud.classList.add("hidden");
    }

    // 5. Minimap Progression (0 - 1200m)
    if (this.minimapPlayer) {
      const pRatio = Math.min(1.0, Math.max(0, playerPhysics.z / 1200));
      this.minimapPlayer.style.top = `${pRatio * 85}%`;
    }
    if (this.minimapYeti && yetiPredator) {
      const yRatio = Math.min(1.0, Math.max(0, yetiPredator.z / 1200));
      this.minimapYeti.style.top = `${yRatio * 85}%`;
    }
  }

  showDamageFlash() {
    if (!this.damageFlash) return;
    this.damageFlash.style.opacity = "1";
    setTimeout(() => {
      this.damageFlash.style.opacity = "0";
    }, 180);

    if (this.clawOverlay) {
      this.clawOverlay.style.display = "block";
      this.clawOverlay.classList.add("slash-active");
      setTimeout(() => {
        this.clawOverlay.style.display = "none";
        this.clawOverlay.classList.remove("slash-active");
      }, 450);
    }
  }

  showFloatingDamage(text, isCrit = false, customClass = "") {
    if (!this.floatingDmgContainer) return;
    const el = document.createElement("div");
    el.className = `dmg-popup ${customClass ? customClass : (isCrit ? "dmg-crit" : "dmg-normal")}`;
    el.textContent = text;
    el.style.left = `${window.innerWidth / 2 + (Math.random() - 0.5) * 60}px`;
    el.style.top = `${window.innerHeight / 2 - 20 + (Math.random() - 0.5) * 40}px`;

    this.floatingDmgContainer.appendChild(el);
    setTimeout(() => {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 850);
  }

  addCombatFeedToast(message, color = "#00f0ff") {
    if (!this.combatFeed) return;
    const toast = document.createElement("div");
    toast.className = "feed-toast";
    toast.style.borderLeftColor = color;
    toast.textContent = message;
    this.combatFeed.appendChild(toast);

    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 3500);
  }
}
