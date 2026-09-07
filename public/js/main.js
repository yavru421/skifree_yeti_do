// public/js/main.js
// SkiFree 2 Master Game Loop, Modular Multi-Track, Stunt Tricks & Edge Telemetry

import { AudioSystem } from './AudioSystem.js';
import { SceneManager } from './SceneManager.js';
import { PlayerPhysics } from './PlayerPhysics.js';
import { FrostLeviathan } from './FrostLeviathan.js';
import { CombatSystem } from './CombatSystem.js';
import { HUDManager } from './HUDManager.js';
import { NetworkSync } from './NetworkSync.js';
import { TrackManager } from './TrackManager.js';

class GameApp {
  constructor() {
    this.canvas = document.getElementById("game-canvas");
    this.audioSystem = new AudioSystem();
    this.trackManager = new TrackManager();
    this.sceneManager = new SceneManager(this.canvas);
    this.playerPhysics = new PlayerPhysics();
    this.frostLeviathan = new FrostLeviathan();
    this.yetiPredator = {
      x: 0,
      y: 0,
      z: 60,
      hp: 8000,
      maxHp: 8000,
      state: "STALKING_NPCS",
      active: true,
      wave: 1
    };
    this.combatSystem = new CombatSystem();
    this.hudManager = new HUDManager();
    this.networkSync = new NetworkSync();
    this.touchControls = null;

    // Desktop Pointer Lock State
    this.isPointerLocked = false;
    this.physicsAccumulator = 0;

    // Global pointers for event delegates
    window.__frostLeviathan = this.frostLeviathan;
    window.__yetiEntity = this.yetiPredator; // Authoritative Yeti entity for combat
    window.__yetiPredator = this.yetiPredator;
    window.__playerPhysics = this.playerPhysics;
    window.__combatSystem = this.combatSystem;
    window.__sceneManager = this.sceneManager;
    window.__audioSystem = this.audioSystem;
    window.__networkSync = this.networkSync;
    window.__onGameEvent = (e) => this.handleGameEvent(e);

    this.gameState = "ACTIVE"; // Immediate active slope entry
    this.gameMode = "hunt";
    this.lastTime = performance.now();
    this.raceStartTime = performance.now();
    this.raceElapsedSec = 0;
    this.telemetryTimer = 0;
    this.lastTakedownTimeSec = 0;

    // Apply Default Alpine Track
    this.sceneManager.applyTrack(this.trackManager.getTrack());

    this.setupUI();
    this.setupIntro();
    this.initNetwork();

    // Start 60-144 FPS Loop
    requestAnimationFrame((t) => this.loop(t));
  }

  escapeHtml(str) {
    if (!str) return "";
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  setupPointerLock() {
    this.canvas.addEventListener("click", () => {
      if (document.pointerLockElement !== this.canvas) {
        this.canvas.requestPointerLock();
      }
    });

    document.addEventListener("pointerlockchange", () => {
      this.isPointerLocked = document.pointerLockElement === this.canvas;
      const modal = document.getElementById("start-modal");
      const backdrop = document.getElementById("modal-backdrop");
      if (this.isPointerLocked) {
        if (modal) modal.classList.add("hidden");
        if (backdrop) backdrop.classList.add("hidden");
        this.audioSystem.unlockAndStart();
        this.gameState = "ACTIVE";
      }
    });

    document.addEventListener("mousemove", (e) => {
      if (this.isPointerLocked && this.playerPhysics) {
        if (this.playerPhysics.applyMouseLook) {
          this.playerPhysics.applyMouseLook(e.movementX, e.movementY);
        }
      }
    });

    window.addEventListener("mousedown", (e) => {
      if (e.button === 0 && this.isPointerLocked) {
        if (this.combatSystem && this.combatSystem.fireActiveHarpoon) {
          this.combatSystem.fireActiveHarpoon();
        }
      }
    });
  }

  setupUI() {
    this.setupPointerLock();

    // 1. Ready & Start Buttons
    const btnStart = document.getElementById("btn-start");
    if (btnStart) {
      btnStart.addEventListener("click", () => {
        if (document.pointerLockElement !== this.canvas) {
          this.canvas.requestPointerLock();
        }
        this.audioSystem.unlockAndStart();
        this.startGame();
      });
    }

    const btnReady = document.getElementById("btn-ready");
    if (btnReady) {
      btnReady.addEventListener("click", () => {
        this.audioSystem.unlockAndStart();
        this.networkSync.sendReady(true, this.gameMode);
        btnReady.textContent = "READY! 🎿";
        btnReady.style.background = "linear-gradient(135deg, #39ff14, #00aa55)";
      });
    }

    // 6. Sound Toggle
    const btnSound = document.getElementById("btn-sound-toggle");
    if (btnSound) {
      btnSound.addEventListener("click", () => {
        const isOn = this.audioSystem.toggleSound();
        btnSound.textContent = isOn ? "🔊 AUDIO: ON" : "🔇 AUDIO: OFF";
        btnSound.style.borderColor = isOn ? "#39ff14" : "#ff0033";
        btnSound.style.color = isOn ? "#39ff14" : "#ff0033";
      });
    }

    // 7. Camera Toggle Key (V)
    window.addEventListener("keydown", (e) => {
      if (e.code === "KeyV") {
        const mode = this.sceneManager.toggleCameraMode();
        this.hudManager.addCombatLog(`Camera: ${mode}`, "#00f0ff");
      }
    });

    // 8. Menu / Pause
    const btnMenuOpen = document.getElementById("btn-menu-open");
    const btnMenuClose = document.getElementById("btn-menu-close");
    const btnResume = document.getElementById("btn-resume-game");
    const menuModal = document.getElementById("menu-modal");
    const backdrop = document.getElementById("modal-backdrop");

    if (btnMenuOpen && menuModal) {
      btnMenuOpen.addEventListener("click", async () => {
        menuModal.classList.remove("hidden");
        if (backdrop) backdrop.classList.remove("hidden");
        const data = await this.networkSync.fetchLeaderboard();
        this.renderLeaderboard(data);
      });
    }
    const closeMenu = () => {
      if (menuModal) menuModal.classList.add("hidden");
      if (backdrop && this.gameState === "ACTIVE") backdrop.classList.add("hidden");
    };
    if (btnMenuClose) btnMenuClose.addEventListener("click", closeMenu);
    if (btnResume) btnResume.addEventListener("click", closeMenu);

    // 9. Fullscreen Toggle
    const btnFs = document.getElementById("btn-toggle-fullscreen");
    if (btnFs) {
      btnFs.addEventListener("click", () => {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        } else {
          document.exitFullscreen().catch(() => {});
        }
      });
    }

    // 10. Respawn & Race Again
    const btnRespawn = document.getElementById("btn-respawn");
    if (btnRespawn) {
      btnRespawn.addEventListener("click", () => {
        const deathModal = document.getElementById("death-modal");
        if (deathModal) deathModal.classList.add("hidden");
        this.startGame();
      });
    }

    const btnRaceAgain = document.getElementById("btn-race-again");
    if (btnRaceAgain) {
      btnRaceAgain.addEventListener("click", () => {
        const raceOverlay = document.getElementById("race-complete-overlay");
        if (raceOverlay) raceOverlay.classList.add("hidden");
        this.startGame();
      });
    }

    // 10b. Yeti Takedown Victory Modal Handlers
    const btnTakedownClaim = document.getElementById("btn-takedown-claim");
    if (btnTakedownClaim) {
      btnTakedownClaim.addEventListener("click", () => {
        const takedownModal = document.getElementById("takedown-modal");
        if (takedownModal) takedownModal.classList.add("hidden");
        this.promptScoreClaim(true);
      });
    }

    const btnHuntAgain = document.getElementById("btn-hunt-again");
    if (btnHuntAgain) {
      btnHuntAgain.addEventListener("click", () => {
        const takedownModal = document.getElementById("takedown-modal");
        if (takedownModal) takedownModal.classList.add("hidden");
        this.startGame();
      });
    }

    // 11. PIN High Score Claim
    const btnSubmitClaim = document.getElementById("btn-submit-claim");
    const btnSkipClaim = document.getElementById("btn-skip-claim");
    if (btnSubmitClaim) {
      btnSubmitClaim.addEventListener("click", async () => {
        const callsignInput = document.getElementById("claim-callsign-input");
        const pinInput = document.getElementById("claim-pin-input");
        const feedbackEl = document.getElementById("claim-feedback-msg");
        const callsign = callsignInput ? callsignInput.value.trim() : "Hunter";
        const pin = pinInput ? pinInput.value.trim() : "0000";

        if (feedbackEl) feedbackEl.textContent = "Publishing to Edge SQLite...";
        const res = await this.networkSync.publishScore(callsign, pin, {
          mode: this.gameMode,
          trackId: this.trackManager.currentTrackId,
          riderClass: this.playerPhysics.riderClass,
          score: this.playerPhysics.score,
          maxSpeed: Math.round(this.playerPhysics.maxSpeedAchieved),
          maxDistance: Math.round(this.playerPhysics.z),
          gatesHit: this.playerPhysics.gatesHit,
          clearTimeSec: this.raceElapsedSec,
          takedownTimeSec: this.lastTakedownTimeSec || 0
        });

        if (res.success) {
          if (feedbackEl) {
            feedbackEl.textContent = `🏆 Score Verified & Saved under "${callsign}"!`;
            feedbackEl.style.color = "#39ff14";
          }
          setTimeout(() => {
            const claimModal = document.getElementById("claim-score-modal");
            if (claimModal) claimModal.classList.add("hidden");
          }, 1400);
        } else {
          if (feedbackEl) {
            feedbackEl.textContent = res.error || "Claim error. Check PIN.";
            feedbackEl.style.color = "#ff0033";
          }
        }
      });
    }

    if (btnSkipClaim) {
      btnSkipClaim.addEventListener("click", () => {
        const claimModal = document.getElementById("claim-score-modal");
        if (claimModal) claimModal.classList.add("hidden");
      });
    }
  }

  setupIntro() {
    const skipIntro = () => {
      const introOverlay = document.getElementById("intro-overlay");
      const introVideo = document.getElementById("intro-video");
      if (introOverlay) introOverlay.classList.add("hidden");
      if (introVideo) introVideo.pause();
      const startModal = document.getElementById("start-modal");
      const backdrop = document.getElementById("modal-backdrop");
      if (startModal) startModal.classList.add("hidden");
      if (backdrop) backdrop.classList.add("hidden");
      this.audioSystem.unlockAndStart();
      this.startGame();
    };

    const btnSkip = document.getElementById("btn-skip-intro");
    if (btnSkip) btnSkip.addEventListener("click", skipIntro);

    const btnUnmute = document.getElementById("btn-unmute-intro");
    if (btnUnmute) {
      btnUnmute.addEventListener("click", () => {
        const vid = document.getElementById("intro-video");
        if (vid) {
          vid.muted = false;
          vid.volume = 1.0;
        }
        btnUnmute.style.display = "none";
      });
    }

    window.addEventListener("keydown", (e) => {
      if (this.gameState === "INTRO" && (e.code === "Space" || e.code === "Escape" || e.code === "Enter")) {
        skipIntro();
      }
    });
  }

  initNetwork() {
    const callsignInput = document.getElementById("player-callsign");
    const callsign = callsignInput ? callsignInput.value.trim() : "YetiSlayer";
    this.networkSync.connect("main-alps", callsign, this.gameMode, (msg) => {
      this.handleNetworkMessage(msg);
    });
  }

  handleNetworkMessage(msg) {
    if (msg.type === "FRAME") {
      if (msg.skiers && this.sceneManager && this.sceneManager.updateGhostSkiers) {
        this.sceneManager.updateGhostSkiers(msg.skiers, this.networkSync.playerId);
      }
      if (msg.yeti && this.yetiPredator) {
        if (typeof msg.yeti.x === "number") this.yetiPredator.x = msg.yeti.x;
        if (typeof msg.yeti.z === "number") this.yetiPredator.z = msg.yeti.z;
        if (msg.yeti.state) this.yetiPredator.state = msg.yeti.state;
        if (typeof msg.yeti.hp === "number") {
          this.yetiPredator.hp = msg.yeti.hp;
          this.yetiPredator.maxHp = msg.yeti.maxHp || 8000;
        }
        if (msg.wave) {
          this.yetiPredator.wave = msg.wave;
        }
      }
    } else if (msg.type === "COUNTDOWN_START") {
      this.triggerCountdown(msg.countdownSeconds || 3);
    } else if (msg.type === "MATCH_LAUNCH") {
      this.launchActiveGame();
    } else if (msg.type === "YETI_DEFEATED") {
      this.handleYetiDefeated(msg.killer, msg.takedownTimeSec, msg.squadSize);
    } else if (msg.type === "NEXT_WAVE") {
      this.yetiPredator.wave = msg.wave;
      this.yetiPredator.hp = msg.yetiHp;
      this.yetiPredator.maxHp = msg.yetiMaxHp;
      this.gameState = "ACTIVE";
      const gondolaOverlay = document.getElementById("gondola-overlay");
      if (gondolaOverlay) gondolaOverlay.classList.add("hidden");
    }
  }

  triggerCountdown(seconds = 3) {
    this.gameState = "COUNTDOWN";
    const overlay = document.getElementById("countdown-overlay");
    const numEl = document.getElementById("countdown-number");
    if (overlay) overlay.classList.remove("hidden");

    let count = seconds;
    if (numEl) numEl.textContent = count;
    const interval = setInterval(() => {
      count--;
      if (numEl) numEl.textContent = count;
      if (count <= 0) {
        clearInterval(interval);
        if (overlay) overlay.classList.add("hidden");
        this.launchActiveGame();
      }
    }, 1000);
  }

  startGame() {
    const startModal = document.getElementById("start-modal");
    const backdrop = document.getElementById("modal-backdrop");
    const hudOverlay = document.getElementById("hud-overlay");
    const introOverlay = document.getElementById("intro-overlay");
    const introVideo = document.getElementById("intro-video");

    if (introOverlay) introOverlay.classList.add("hidden");
    if (introVideo) introVideo.pause();
    if (startModal) startModal.classList.add("hidden");
    if (backdrop) backdrop.classList.add("hidden");
    if (hudOverlay) hudOverlay.classList.remove("hidden");

    this.playerPhysics.respawn();
    this.yetiPredator.hp = this.yetiPredator.maxHp;
    this.yetiPredator.z = this.playerPhysics.z + 28;
    this.yetiPredator.x = this.playerPhysics.x;
    this.yetiPredator.state = "RUNNING_DOWNHILL";
    this.raceStartTime = performance.now();
    this.raceElapsedSec = 0;
    this.gameState = "ACTIVE";
    this.audioSystem.unlockAndStart();
  }

  launchActiveGame() {
    this.startGame();
  }

  handleYetiDefeated(killerCallsign, takedownTimeSec, squadSize) {
    if (this.gameState === "YETI_DEFEATED") return;
    this.gameState = "YETI_DEFEATED";
    this.lastTakedownTimeSec = takedownTimeSec || this.raceElapsedSec;

    const totalSec = Math.max(0, this.lastTakedownTimeSec);
    const mins = Math.floor(totalSec / 60);
    const secs = Math.floor(totalSec % 60);
    const tenths = Math.floor((totalSec * 10) % 10);
    const timeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${tenths}`;

    const takedownModal = document.getElementById("takedown-modal");
    const takedownTime = document.getElementById("takedown-time");
    const takedownDist = document.getElementById("takedown-dist");
    const takedownSquad = document.getElementById("takedown-squad");
    const takedownScore = document.getElementById("takedown-score");
    const takedownSpeed = document.getElementById("takedown-speed");
    const backdrop = document.getElementById("modal-backdrop");

    if (takedownTime) takedownTime.textContent = timeStr;
    if (takedownDist) takedownDist.textContent = `${Math.round(this.playerPhysics.z)}m`;
    const houndCount = typeof squadSize === "number" ? squadSize : this.combatSystem.rescuedSquad.length;
    if (takedownSquad) takedownSquad.textContent = `${houndCount} Hound Skiers`;
    if (takedownScore) takedownScore.textContent = `${this.playerPhysics.score.toLocaleString()} PTS`;
    if (takedownSpeed) takedownSpeed.textContent = `${Math.round(this.playerPhysics.maxSpeedAchieved)} MPH`;

    if (backdrop) backdrop.classList.remove("hidden");
    if (takedownModal) takedownModal.classList.remove("hidden");
    this.audioSystem.playRescueFanfare();
  }

  triggerGondolaRest(killerCallsign) {
    this.gameState = "GONDOLA_REST";
    const overlay = document.getElementById("gondola-overlay");
    const sub = document.getElementById("gondola-sub");
    if (overlay) overlay.classList.remove("hidden");
    if (sub) sub.textContent = `YETI RETREATING! ADVANCING TO NEXT BIOME SECTOR...`;
    this.audioSystem.playRescueFanfare();
  }

  handleGameEvent(e) {
    if (e.type === "SPEAR_HIT" || e.type === "SHOOT") {
      if (e.hit !== false && e.damage) {
        this.playerPhysics.score += e.damage;
        this.hudManager.showFloatingDamage(window.innerWidth / 2, window.innerHeight / 2 - 40, e.damage, e.isCrit);
        this.hudManager.addCombatLog(e.isCrit ? `🗡️ CRITICAL HARPOON IMPALE! (+${e.damage} PTS)` : `🗡️ Impaled Yeti! (+${e.damage} PTS)`, e.isCrit ? "#ffff00" : "#00f0ff");
      }
    } else if (e.type === "SPEAR_DEFLECTED") {
      this.hudManager.triggerDamageClawFlash();
      this.hudManager.addCombatLog(e.message, "#ffaa00");
    } else if (e.type === "SPEAR_WHIFF") {
      this.hudManager.addCombatLog(e.message, "#ff0055");
    } else if (e.type === "SPEAR_CHARGE_START") {
      this.hudManager.addCombatLog("⚔️ Charging Spear Thrust... [RELEASE TO STRIKE]", "#ffff00");
    } else if (e.type === "FLARE_FIRED") {
      this.hudManager.addCombatLog(e.message, e.hit ? "#ff5500" : "#ffaa00");
    } else if (e.type === "YETI_BITE") {
      this.hudManager.triggerDamageClawFlash();
      const remainingLives = this.playerPhysics.takeDamage(1);
      this.hudManager.addCombatLog("🩸 Yeti Bite! (-1 Heart)", "#ff0033");
      if (remainingLives <= 0) {
        this.handlePlayerDeath();
      }
    } else if (e.type === "TRICK_LANDED") {
      this.hudManager.showTrickBanner(e.trickName, "#ffff00");
      this.hudManager.addCombatLog(`🚀 ${e.trickName} (+${e.score} PTS)`, "#ffff00");
    } else if (e.type === "TRICK_WIPEOUT") {
      this.hudManager.showTrickBanner(e.message, "#ff0033");
      this.hudManager.addCombatLog(e.message, "#ff0033");
    } else if (e.type === "NITRO_ACTIVATED") {
      this.hudManager.addCombatLog("⚡ NITRO BOOST ENGAGED (+26 MPH)!", "#00ffff");
    } else if (e.type === "NPC_RESCUED") {
      this.hudManager.addCombatLog(`⛷️ Skier Rescued! Squad: ${e.squadSize} (x${e.multiplier.toFixed(2)})`, "#39ff14");
    } else if (e.type === "GATE_CLEARED") {
      this.hudManager.showFloatingDamage(window.innerWidth / 2, window.innerHeight / 2 - 80, e.points, false);
    } else if (e.type === "RACE_FINISHED") {
      this.handleRaceFinished();
    } else if (e.type === "BAIT_DROPPED") {
      this.networkSync.sendDropBait();
      this.hudManager.addCombatLog("🥩 Meat Bait Dropped! Yeti Distracted.", "#ff007f");
    } else if (e.type === "AVALANCHE_ENGULFED") {
      this.handlePlayerDeath();
    }
  }

  handlePlayerDeath() {
    this.triggerHorrorJumpscareDeath("Yeti Consumed Camera");
  }

  triggerHorrorJumpscareDeath(reason) {
    if (this.gameState === "DEAD" || this.gameState === "JUMPSCARE") return;
    this.gameState = "JUMPSCARE";

    // 1. Lock physics to halt motion immediately
    this.playerPhysics.speed = 0;
    this.playerPhysics.isBraking = true;

    // 2. Position Yeti directly in front of camera at point-blank range
    if (this.yetiPredator) {
      this.yetiPredator.x = this.playerPhysics.x;
      this.yetiPredator.z = this.playerPhysics.z + 1.2;
      this.yetiPredator.state = "SPRINTING";
    }

    // 3. Trigger maximum screen trauma shudder and audio jumpscare
    if (this.sceneManager && this.sceneManager.addTrauma) {
      this.sceneManager.addTrauma(1.0);
    }
    if (this.audioSystem) {
      if (this.audioSystem.playJumpscareDeath) {
        this.audioSystem.playJumpscareDeath();
      } else if (this.audioSystem.playYetiRoar) {
        this.audioSystem.playYetiRoar();
      }
    }

    // 4. Activate bloody cracked lens overlay
    const jumpscareOverlay = document.getElementById("jumpscare-overlay");
    const blackout = document.getElementById("jumpscare-blackout");
    if (jumpscareOverlay) {
      jumpscareOverlay.classList.add("active");
    }

    // 5. Blackout after 650ms, then display death modal
    setTimeout(() => {
      if (blackout) blackout.classList.add("blacked-out");
    }, 650);

    setTimeout(() => {
      this.gameState = "DEAD";
      if (jumpscareOverlay) jumpscareOverlay.classList.remove("active");
      if (blackout) blackout.classList.remove("blacked-out");

      const backdrop = document.getElementById("modal-backdrop");
      const deathModal = document.getElementById("death-modal");
      const deathStat = document.getElementById("death-stat");

      if (backdrop) backdrop.classList.remove("hidden");
      if (deathModal) deathModal.classList.remove("hidden");
      if (deathStat) {
        deathStat.textContent = `[${reason || "YETI MAULED"}] • Track: ${this.trackManager.getTrack().name} • Distance: ${Math.round(this.playerPhysics.z)}m • Score: ${this.playerPhysics.score.toLocaleString()} PTS • Top Speed: ${Math.round(this.playerPhysics.maxSpeedAchieved)} MPH`;
      }

      this.promptScoreClaim();
    }, 1100);
  }

  handleRaceFinished() {
    this.gameState = "RACE_COMPLETE";
    const raceOverlay = document.getElementById("race-complete-overlay");
    const finishTime = document.getElementById("finish-time");
    const finishGates = document.getElementById("finish-gates");
    const finishSpeed = document.getElementById("finish-speed");
    const finishScore = document.getElementById("finish-score");

    if (raceOverlay) raceOverlay.classList.remove("hidden");
    if (finishTime) finishTime.textContent = `${this.raceElapsedSec.toFixed(2)}s`;
    if (finishGates) finishGates.textContent = `${this.playerPhysics.gatesHit} Gates`;
    if (finishSpeed) finishSpeed.textContent = `${Math.round(this.playerPhysics.maxSpeedAchieved)} MPH`;
    if (finishScore) finishScore.textContent = `${this.playerPhysics.score.toLocaleString()} PTS`;

    this.audioSystem.playRescueFanfare();
    this.promptScoreClaim();
  }

  promptScoreClaim() {
    const claimModal = document.getElementById("claim-score-modal");
    const summary = document.getElementById("claim-stat-summary");
    if (claimModal && summary) {
      summary.textContent = `Score: ${this.playerPhysics.score.toLocaleString()} PTS • Max Speed: ${Math.round(this.playerPhysics.maxSpeedAchieved)} MPH • Class: ${this.playerPhysics.riderClass.toUpperCase()}`;
      claimModal.classList.remove("hidden");
    }
  }

  renderLeaderboard(data) {
    const huntBody = document.getElementById("hunt-leaderboard-rows");
    const raceBody = document.getElementById("race-leaderboard-rows");

    if (huntBody && data.leaderboard) {
      huntBody.innerHTML = data.leaderboard.map((row, idx) => {
        let scoreDisplay = `${row.score.toLocaleString()} PTS`;
        if (row.takedown_time_sec && Number(row.takedown_time_sec) > 0) {
          const t = Number(row.takedown_time_sec);
          const m = Math.floor(t / 60);
          const s = Math.floor(t % 60);
          const tenths = Math.floor((t * 10) % 10);
          const timeStr = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${tenths}`;
          scoreDisplay = `<span style="color:#39ff14; font-weight:900;">⏱️ ${timeStr}</span><br><span style="font-size:9px; color:#88a0c0;">${row.score.toLocaleString()} PTS</span>`;
        }
        return `
          <tr style="border-bottom: 1px solid #1a2a44;">
            <td style="padding:4px; font-weight:bold; color:#00f0ff;">#${idx + 1}</td>
            <td style="padding:4px;">${this.escapeHtml(row.callsign)}</td>
            <td style="padding:4px;">${scoreDisplay}</td>
            <td style="padding:4px;">${Math.round(row.max_speed)} MPH</td>
          </tr>
        `;
      }).join('');
    }

    if (raceBody && data.raceLeaderboard) {
      raceBody.innerHTML = data.raceLeaderboard.map((row, idx) => `
        <tr style="border-bottom: 1px solid #1a2a44;">
          <td style="padding:4px; font-weight:bold; color:#39ff14;">#${idx + 1}</td>
          <td style="padding:4px;">${this.escapeHtml(row.callsign)}</td>
          <td style="padding:4px; color:#00f0ff; font-weight:bold;">${row.clear_time_sec.toFixed(2)}s</td>
          <td style="padding:4px;">${row.gates_hit}/30</td>
        </tr>
      `).join('');
    }
  }

  physicsTick(dt, currentTrack) {
    // 1. Local Player Physics (CS:GO Source Kinematics & Air Strafing)
    this.playerPhysics.update(
      dt,
      this.sceneManager,
      this.audioSystem,
      (e) => this.handleGameEvent(e),
      currentTrack
    );

    // 2. Combat System (Steam Harpoon Gun, Secondary Explosives)
    this.combatSystem.update(dt);

    // Update active 3D flying harpoons & trailing cables
    if (this.sceneManager && this.sceneManager.updateHarpoons) {
      this.sceneManager.updateHarpoons(
        dt,
        this.yetiPredator,
        { x: this.playerPhysics.x, y: this.playerPhysics.y, z: this.playerPhysics.z },
        (harpoon, dist) => {
          if (this.combatSystem && this.combatSystem.handleHarpoonHit) {
            this.combatSystem.handleHarpoonHit(this.yetiPredator, 0);
          }
        }
      );
    }

    // 3. Yeti & Frost Leviathan State Update
    if (this.sceneManager && this.sceneManager.updateYeti) {
      this.sceneManager.updateYeti(this.yetiPredator, dt);
    }
    this.frostLeviathan.update(dt, this.networkSync.whaleState);

    // 4. Update FPV Camera (Safe with fallback guards)
    try {
      this.sceneManager.updateCamera(
        { x: this.playerPhysics.x, y: this.playerPhysics.y, z: this.playerPhysics.z },
        this.playerPhysics.steer || 0,
        this.playerPhysics.pitch || 0,
        this.playerPhysics.airY || 0,
        this.playerPhysics.airRoll || 0,
        this.playerPhysics.airYaw || 0,
        !!this.playerPhysics.isAirborne,
        !!this.playerPhysics.isNitroActive,
        this.playerPhysics.avalancheDist || 120
      );
    } catch (camErr) {
      console.warn("updateCamera error guard:", camErr);
    }

    // 5. Update 3D Dynamic Towing Rope Mesh
    if (this.sceneManager && this.sceneManager.updateTether) {
      const isTethered = this.combatSystem.isTethered || this.playerPhysics.isTowed;
      const targetPos = {
        x: this.yetiPredator.x,
        y: (this.sceneManager.getTerrainHeight ? this.sceneManager.getTerrainHeight(this.yetiPredator.x, this.yetiPredator.z) : 0) + 1.8,
        z: this.yetiPredator.z
      };
      this.sceneManager.updateTether(
        { x: this.playerPhysics.x, y: this.playerPhysics.y, z: this.playerPhysics.z },
        targetPos,
        isTethered,
        this.yetiPredator.state === "BAYED_UP" || this.frostLeviathan.isStaggered
      );
    }

    // 6. 10Hz Authoritative Telemetry to Cloudflare Durable Object
    this.telemetryTimer += dt;
    if (this.telemetryTimer >= 0.1) {
      this.telemetryTimer = 0;
      this.networkSync.sendPositionUpdate(
        this.playerPhysics.x,
        this.playerPhysics.airY || 0,
        this.playerPhysics.z,
        this.playerPhysics.pitch,
        this.playerPhysics.steer,
        this.playerPhysics.airRoll || 0,
        this.playerPhysics.speed,
        (this.combatSystem.isTethered || this.playerPhysics.isTowed) ? "TOWED" : "IDLE"
      );
    }
  }

  updateVisuals(dt, currentTrack) {
    // Update Legacy HUD
    this.hudManager.update(
      this.playerPhysics,
      this.combatSystem,
      this.frostLeviathan,
      this.gameMode,
      this.raceElapsedSec,
      currentTrack
    );

    // Update CS:GO Tactical HUD
    const hpVal = document.getElementById("csgo-hp-val");
    if (hpVal) hpVal.textContent = Math.max(0, this.playerPhysics.lives * 34);

    const ammoVal = document.getElementById("csgo-ammo-val");
    if (ammoVal) ammoVal.textContent = this.combatSystem.activeHarpoonInFlight ? "0" : "1";

    // Dynamic Crosshair Bloom based on Speed & Air
    const spread = Math.min(24, Math.max(0, (this.playerPhysics.speed - 20) * 0.35 + (this.playerPhysics.isAirborne ? 14 : 0)));
    const chTop = document.getElementById("ch-top");
    const chBottom = document.getElementById("ch-bottom");
    const chLeft = document.getElementById("ch-left");
    const chRight = document.getElementById("ch-right");
    if (chTop) chTop.style.transform = `translateY(-${spread}px)`;
    if (chBottom) chBottom.style.transform = `translateY(${spread}px)`;
    if (chLeft) chLeft.style.transform = `translateX(-${spread}px)`;
    if (chRight) chRight.style.transform = `translateX(${spread}px)`;
  }

  loop(currentTime) {
    const dt = Math.min(0.1, (currentTime - this.lastTime) / 1000);
    this.lastTime = currentTime;
    const currentTrack = this.trackManager.getTrack();

    if (this.gameState === "ACTIVE") {
      this.raceElapsedSec += dt;

      // Check Frost Leviathan / Yeti Defeat in Hunt Mode
      if (this.gameMode === "hunt" && ((this.yetiPredator && this.yetiPredator.hp <= 0) || this.frostLeviathan.hp <= 0)) {
        this.handleYetiDefeated("You & Squad", this.raceElapsedSec, 1);
      }

      // Check Mountain Bottom Horror Failure
      const finishDist = (currentTrack && currentTrack.finishDistance) || 1800;
      if (this.gameMode === "hunt" && this.playerPhysics.z >= finishDist && this.yetiPredator && this.yetiPredator.hp > 0) {
        this.triggerHorrorJumpscareDeath("YETI OVERTOOK AT BASE OF MOUNTAIN");
      }

      // 128Hz Fixed Physics Timestep Accumulator (7.8125ms per tick)
      const TICK_SEC = 1 / 128;
      this.physicsAccumulator = (this.physicsAccumulator || 0) + dt;
      let safetyTicks = 0;
      while (this.physicsAccumulator >= TICK_SEC && safetyTicks < 16) {
        this.physicsTick(TICK_SEC, currentTrack);
        this.physicsAccumulator -= TICK_SEC;
        safetyTicks++;
      }

      this.updateVisuals(dt, currentTrack);
    }

    // 8. UNCONDITIONAL 3D RENDER
    try {
      this.sceneManager.render();
    } catch (renderErr) {
      console.error("Three.js render exception caught:", renderErr);
    }

    requestAnimationFrame((t) => this.loop(t));
  }
}

window.addEventListener("DOMContentLoaded", () => {
  new GameApp();
});
