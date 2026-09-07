// public/js/HUDManager.js
// DOM HUD Overlays, Health, Nitro, Stunt Tricks, Squad Multipliers & Avalanche Alerts

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
    this.huntStopwatch = document.getElementById("hunt-stopwatch");

    this.hearts = [
      document.getElementById("h1"),
      document.getElementById("h2"),
      document.getElementById("h3")
    ];

    this.ensureExtendedHudElements();
  }

  ensureExtendedHudElements() {
    // 1. Nitro Gauge Bar
    if (!document.getElementById("nitro-hud-panel")) {
      const panel = document.createElement("div");
      panel.id = "nitro-hud-panel";
      panel.style.cssText = "position:absolute; bottom:24px; left:24px; display:flex; flex-direction:column; gap:4px; z-index:100; font-family:'Courier New', monospace; font-size:11px; font-weight:bold; color:#00ffff; text-shadow:0 0 6px #00ffff; pointer-events:none;";
      panel.innerHTML = `
        <div style="display:flex; justify-content:space-between; width:160px;">
          <span>⚡ NITRO [SHIFT]</span>
          <span id="nitro-val">100%</span>
        </div>
        <div style="width:160px; height:8px; background:rgba(0,0,0,0.6); border:1px solid #00f0ff; border-radius:3px; overflow:hidden;">
          <div id="nitro-fill" style="width:100%; height:100%; background:#00f0ff; transition:width 0.1s linear;"></div>
        </div>
        <div id="flare-hud" style="color:#ffaa00; margin-top:2px;">🔥 FLARES: <span id="flare-val">2/3</span> [E]</div>
        <div id="squad-hud" style="color:#39ff14; display:none;">⛷️ SQUAD: <span id="squad-val">0 (x1.0)</span></div>
        <div id="avalanche-hud" style="color:#ff0055; display:none; animation:pulse 0.8s infinite alternate;">⚠️ AVALANCHE: <span id="avalanche-val">120M</span></div>
      `;
      document.body.appendChild(panel);
    }

    // 2. Stunt Trick Combo Banner
    if (!document.getElementById("trick-banner")) {
      const trick = document.createElement("div");
      trick.id = "trick-banner";
      trick.style.cssText = "position:absolute; top:35%; left:50%; transform:translate(-50%, -50%); font-family:'Impact', 'Arial Black', sans-serif; font-size:32px; font-weight:900; letter-spacing:2px; color:#ffff00; text-shadow:0 0 14px #ff5500, 2px 2px 0 #000; pointer-events:none; opacity:0; transition:opacity 0.25s, transform 0.25s; z-index:150;";
      document.body.appendChild(trick);
    }

    // 3. SSX 3 Style Meter & Pack Aggro Banner
    if (!document.getElementById("ssx-style-panel")) {
      const panel = document.createElement("div");
      panel.id = "ssx-style-panel";
      panel.style.cssText = "position:absolute; top:65px; left:50%; transform:translateX(-50%); display:flex; flex-direction:column; align-items:center; gap:4px; z-index:120; font-family:'Courier New', monospace; pointer-events:none;";
      panel.innerHTML = `
        <div id="aggro-banner" style="display:none; padding:4px 14px; border-radius:4px; font-size:12px; font-weight:900; letter-spacing:1px; text-shadow:0 0 8px #ff0033; border:1px solid #ff0033; background:rgba(20,0,5,0.85); color:#ff3355;">
          ⚠️ YOU HOLD AGGRO! ACT AS BAIT & CARVE!
        </div>
        <div id="tethers-gauge" style="font-size:11px; font-weight:bold; color:#00f0ff; text-shadow:0 0 6px #00f0ff; background:rgba(5,15,30,0.8); padding:2px 10px; border-radius:3px; border:1px solid #0088cc;">
          ⛓️ ACTIVE TETHERS: 0/3 (PIN IMMINENT AT 3)
        </div>
        <div style="display:flex; align-items:center; gap:8px; margin-top:2px;">
          <span style="font-size:10px; font-weight:bold; color:#ffcc00;">STYLE</span>
          <div style="width:220px; height:10px; background:rgba(0,0,0,0.7); border:1px solid #ffcc00; border-radius:4px; overflow:hidden;">
            <div id="style-meter-fill" style="width:0%; height:100%; background:linear-gradient(90deg, #ff9900, #ffff00); box-shadow:0 0 10px #ffff00; transition:width 0.1s linear;"></div>
          </div>
          <span id="style-meter-text" style="font-size:10px; font-weight:bold; color:#ffff00;">0%</span>
        </div>
      `;
      document.body.appendChild(panel);
    }
  }

  showTrickBanner(text, color = "#ffff00") {
    const el = document.getElementById("trick-banner");
    if (!el) return;
    el.textContent = text;
    el.style.color = color;
    el.style.opacity = "1";
    el.style.transform = "translate(-50%, -50%) scale(1.15)";
    setTimeout(() => {
      el.style.opacity = "0";
      el.style.transform = "translate(-50%, -50%) scale(0.9)";
    }, 1400);
  }

  update(playerPhysics, combatSystem, yetiPredator, gameMode, raceElapsedSec, currentTrack) {
    // 1. Speedometer & Score
    if (this.speedEl && playerPhysics) {
      const isNitro = playerPhysics.isNitroActive;
      this.speedEl.innerHTML = `${Math.round(playerPhysics.speed)} <span style="font-size:10px;">MPH</span> ${isNitro ? '<span style="color:#00ffff; font-size:11px;">[NITRO]</span>' : ''}`;
    }
    if (this.scoreEl && playerPhysics) {
      this.scoreEl.innerHTML = `${playerPhysics.score.toLocaleString()} <span style="font-size:10px;">PTS</span>`;
    }

    // 2. Shootable Harpoon & Flares
    if (this.ammoEl && combatSystem) {
      this.ammoEl.style.display = 'block';
      if (combatSystem.harpoonCooldown > 0) {
        this.ammoEl.innerHTML = `<span style="color:#00f0ff; font-weight:bold;">🗡️ HARPOON: RELOADING...</span>`;
      } else {
        this.ammoEl.innerHTML = `<span style="color:#39ff14; font-weight:bold;">🗡️ HARPOON: READY [F / CLICK TO SHOOT]</span>`;
      }
    }

    const flareVal = document.getElementById("flare-val");
    if (flareVal && combatSystem) {
      flareVal.textContent = `${combatSystem.flareAmmo}/${combatSystem.maxFlareAmmo}`;
    }

    // 3. Nitro Fuel Gauge
    const nitroFill = document.getElementById("nitro-fill");
    const nitroVal = document.getElementById("nitro-val");
    if (nitroFill && playerPhysics) {
      const fuel = Math.round(playerPhysics.nitroFuel);
      nitroFill.style.width = `${fuel}%`;
      if (playerPhysics.isNitroActive) {
        nitroFill.style.background = "#ffff00";
      } else {
        nitroFill.style.background = fuel >= 25 ? "#00f0ff" : "#ff0055";
      }
      if (nitroVal) nitroVal.textContent = `${fuel}%`;
    }

    // 3b. SSX 3 Style Meter & Pack Aggro Updates
    const styleFill = document.getElementById("style-meter-fill");
    const styleText = document.getElementById("style-meter-text");
    if (styleFill && playerPhysics) {
      const style = Math.round(playerPhysics.styleMeter || 0);
      styleFill.style.width = `${style}%`;
      if (style >= 80) {
        styleFill.style.background = "linear-gradient(90deg, #ff0055, #ffff00)";
        if (styleText) styleText.innerHTML = `<span style="color:#ff0055; animation:pulse 0.5s infinite;">UBER ${style}%</span>`;
      } else {
        styleFill.style.background = "linear-gradient(90deg, #ff9900, #ffff00)";
        if (styleText) styleText.textContent = `${style}%`;
      }
    }

    // Pack-of-Dogs Aggro & Tethers Gauge
    const aggroBanner = document.getElementById("aggro-banner");
    const tethersGauge = document.getElementById("tethers-gauge");
    const whale = window.__frostLeviathan;
    const netSync = window.__networkSync;

    if (whale) {
      if (tethersGauge) {
        const tetherCount = (whale.activeTethers || []).length;
        if (tetherCount >= 3 || whale.isStaggered) {
          tethersGauge.innerHTML = `⛓️ ACTIVE TETHERS: ${tetherCount}/3 <span style="color:#39ff14; font-weight:900;">[BEAST PINNED & STAGGERED! 2.5x CRIT!]</span>`;
        } else if (tetherCount === 2) {
          tethersGauge.innerHTML = `⛓️ ACTIVE TETHERS: 2/3 <span style="color:#ffff00;">[PIN IMMINENT - 20% SLOWED]</span>`;
        } else {
          tethersGauge.innerHTML = `⛓️ ACTIVE TETHERS: ${tetherCount}/3 (PIN AT 3)`;
        }
      }

      if (aggroBanner) {
        if (whale.aggroTargetId) {
          aggroBanner.style.display = "block";
          if (netSync && whale.aggroTargetId === netSync.playerId) {
            aggroBanner.textContent = "⚠️ YOU HOLD AGGRO! ACT AS BAIT & CARVE!";
            aggroBanner.style.borderColor = "#ff0055";
            aggroBanner.style.color = "#ff0055";
          } else {
            aggroBanner.textContent = `🎯 BEAST TARGETING TEAMMATE — PIN IT DOWN!`;
            aggroBanner.style.borderColor = "#ffaa00";
            aggroBanner.style.color = "#ffaa00";
          }
        } else {
          aggroBanner.style.display = "none";
        }
      }
    }

    // 4. Rescued Squad Status
    const squadHud = document.getElementById("squad-hud");
    const squadVal = document.getElementById("squad-val");
    if (squadHud && combatSystem) {
      if (combatSystem.rescuedSquad.length > 0) {
        squadHud.style.display = "block";
        if (squadVal) {
          squadVal.textContent = `${combatSystem.rescuedSquad.length} (x${combatSystem.rescueMultiplier.toFixed(2)})`;
        }
      } else {
        squadHud.style.display = "none";
      }
    }

    // 5. Avalanche Hazard Proximity
    const avaHud = document.getElementById("avalanche-hud");
    const avaVal = document.getElementById("avalanche-val");
    if (avaHud && currentTrack?.id === "avalanche" && playerPhysics) {
      avaHud.style.display = "block";
      if (avaVal) {
        const dist = Math.round(playerPhysics.avalancheDist);
        avaVal.textContent = `${dist}M`;
        if (dist < 40) {
          avaVal.style.color = "#ff0000";
          avaVal.textContent += " [DANGER!]";
        } else {
          avaVal.style.color = "#ffaa00";
        }
      }
    } else if (avaHud) {
      avaHud.style.display = "none";
    }

    // 6. Lives Hearts
    if (playerPhysics) {
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
    }

    // 7. Boss Health & Radar
    if (yetiPredator) {
      if (this.bossHpFill) {
        const hpPercent = Math.max(0, (yetiPredator.hp / yetiPredator.maxHp) * 100);
        this.bossHpFill.style.width = `${hpPercent}%`;
      }
      if (this.bossHpText) {
        this.bossHpText.textContent = `${yetiPredator.hp.toLocaleString()} / ${yetiPredator.maxHp.toLocaleString()} HP`;
      }
      if (this.bossWaveTitle) {
        let stateTag = "";
        if (yetiPredator.state === "BURNING_PANIC") {
          stateTag = " [🔥 BURNING PANIC]";
        } else if (yetiPredator.state === "STAGGERED") {
          stateTag = " [⚡ STAGGERED]";
        }
        this.bossWaveTitle.textContent = `👹 ALPINE YETI (W${yetiPredator.wave})${stateTag}`;
      }

      if (this.radarEl && playerPhysics) {
        const dist = Math.hypot(yetiPredator.x - playerPhysics.x, yetiPredator.z - playerPhysics.z);
        if (dist < 45 && yetiPredator.hp > 0) {
          this.radarEl.style.opacity = "1";
          if (yetiPredator.state === "BAYED_UP") {
            this.radarEl.innerHTML = `<span style="color:#ffff00; font-weight:900;">🐻 YETI BAYED UP! SQUAD PINNING IT • FLANK TO STRIKE!</span>`;
          } else {
            this.radarEl.textContent = `👹 YETI ${Math.round(dist)}M [PURSUING WITH PACK]`;
          }
        } else {
          this.radarEl.style.opacity = "0";
        }
      }
    }

    // 8. Slalom Race Mode HUD vs Hunt Stopwatch
    if (gameMode === "slalom" && this.raceHud && playerPhysics) {
      this.raceHud.style.display = "block";
      if (this.huntStopwatch) this.huntStopwatch.style.display = "none";
      if (this.raceTimeVal) {
        this.raceTimeVal.textContent = (raceElapsedSec || 0).toFixed(1) + "s";
      }
      if (this.raceGatesVal) {
        this.raceGatesVal.textContent = `${playerPhysics.gatesHit}`;
      }
      if (this.raceStreakVal) {
        this.raceStreakVal.textContent = `x${playerPhysics.gateStreak}`;
      }
    } else {
      if (this.raceHud) this.raceHud.style.display = "none";
      if (this.huntStopwatch) {
        this.huntStopwatch.style.display = "block";
        const totalSec = Math.max(0, raceElapsedSec || 0);
        const mins = Math.floor(totalSec / 60);
        const secs = Math.floor(totalSec % 60);
        const tenths = Math.floor((totalSec * 10) % 10);
        const formatted = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${tenths}`;
        this.huntStopwatch.textContent = `⏱️ HUNT TIME: ${formatted}`;
      }
    }

    // 9. Minimap
    if (this.minimapPlayer && playerPhysics) {
      const normX = Math.max(0, Math.min(100, (playerPhysics.x + 65) / 130 * 100));
      const normZ = Math.max(0, Math.min(100, (playerPhysics.z % 1200) / 1200 * 100));
      this.minimapPlayer.style.left = `${normX}%`;
      this.minimapPlayer.style.top = `${normZ}%`;
    }
    if (this.minimapYeti && yetiPredator && playerPhysics) {
      if (yetiPredator.hp > 0) {
        this.minimapYeti.style.display = "block";
        const normYetiX = Math.max(0, Math.min(100, (yetiPredator.x + 65) / 130 * 100));
        const normYetiZ = Math.max(0, Math.min(100, (yetiPredator.z % 1200) / 1200 * 100));
        this.minimapYeti.style.left = `${normYetiX}%`;
        this.minimapYeti.style.top = `${normYetiZ}%`;
      } else {
        this.minimapYeti.style.display = "none";
      }
    }

    // 10. Dedicated On-Screen Harpoon Action Button Dynamic State
    const hudHarpoonBtn = document.getElementById("btn-hud-harpoon");
    const hudHarpoonText = document.getElementById("hud-harpoon-text");
    const hudHarpoonIcon = document.getElementById("hud-harpoon-icon");
    if (hudHarpoonBtn && combatSystem) {
      if (combatSystem.isTethered) {
        hudHarpoonBtn.style.background = "linear-gradient(135deg, rgba(57, 255, 20, 0.95), rgba(0, 170, 85, 0.95))";
        hudHarpoonBtn.style.borderColor = "#39ff14";
        hudHarpoonBtn.style.boxShadow = "0 0 24px rgba(57, 255, 20, 0.75)";
        if (hudHarpoonIcon) hudHarpoonIcon.textContent = "⚡";
        if (hudHarpoonText) hudHarpoonText.textContent = "TETHERED! [CLICK / R TO CUT]";
        hudHarpoonBtn.style.opacity = "1.0";
      } else if (combatSystem.harpoonCooldown > 0) {
        hudHarpoonBtn.style.background = "linear-gradient(135deg, rgba(20, 30, 45, 0.92), rgba(10, 15, 25, 0.95))";
        hudHarpoonBtn.style.borderColor = "#88a0c0";
        hudHarpoonBtn.style.boxShadow = "none";
        if (hudHarpoonIcon) hudHarpoonIcon.textContent = "⏳";
        if (hudHarpoonText) hudHarpoonText.textContent = `RELOADING (${combatSystem.harpoonCooldown.toFixed(1)}s)`;
        hudHarpoonBtn.style.opacity = "0.75";
      } else {
        hudHarpoonBtn.style.background = "linear-gradient(135deg, rgba(0, 240, 255, 0.95), rgba(0, 120, 255, 0.95))";
        hudHarpoonBtn.style.borderColor = "#00f0ff";
        hudHarpoonBtn.style.boxShadow = "0 0 24px rgba(0, 240, 255, 0.65)";
        if (hudHarpoonIcon) hudHarpoonIcon.textContent = "🚀";
        if (hudHarpoonText) hudHarpoonText.textContent = "FIRE HARPOON [SPACE]";
        hudHarpoonBtn.style.opacity = "1.0";
      }
    }
  }

  showFloatingDamage(x, y, damage, isCrit = false) {
    if (!this.floatingDmgContainer) return;
    const el = document.createElement("div");
    el.className = isCrit ? "floating-crit" : "floating-dmg";
    el.textContent = `-${damage}`;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    this.floatingDmgContainer.appendChild(el);

    setTimeout(() => {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 900);
  }

  triggerDamageClawFlash() {
    if (this.damageFlash) {
      this.damageFlash.style.opacity = "0.7";
      setTimeout(() => { this.damageFlash.style.opacity = "0"; }, 200);
    }
    if (this.clawOverlay) {
      this.clawOverlay.style.opacity = "0.9";
      setTimeout(() => { this.clawOverlay.style.opacity = "0"; }, 350);
    }
  }

  addCombatLog(msg, color = "#00f0ff") {
    if (!this.combatFeed) return;
    const line = document.createElement("div");
    line.style.color = color;
    line.style.fontSize = "11px";
    line.style.marginBottom = "3px";
    line.textContent = `> ${msg}`;
    this.combatFeed.appendChild(line);

    if (this.combatFeed.children.length > 5) {
      this.combatFeed.removeChild(this.combatFeed.firstChild);
    }
  }
}
