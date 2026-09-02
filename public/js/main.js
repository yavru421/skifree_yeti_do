// public/js/main.js
// SkiFree 2 Master Game Loop, Modular Multi-Track, Stunt Tricks & Edge Telemetry

import { AudioSystem } from './AudioSystem.js';
import { SceneManager } from './SceneManager.js';
import { PlayerPhysics } from './PlayerPhysics.js';
import { YetiPredator } from './YetiPredator.js';
import { CombatSystem } from './CombatSystem.js';
import { TouchControls } from './TouchControls.js';
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
    this.yetiPredator = new YetiPredator(this.sceneManager);
    this.combatSystem = new CombatSystem();
    this.hudManager = new HUDManager();
    this.networkSync = new NetworkSync();
    this.touchControls = new TouchControls(
      this.playerPhysics,
      this.combatSystem,
      this.sceneManager,
      this.audioSystem
    );

    // Global pointers for event delegates
    window.__yetiEntity = this.yetiPredator;
    window.__playerPhysics = this.playerPhysics;
    window.__combatSystem = this.combatSystem;
    window.__sceneManager = this.sceneManager;
    window.__audioSystem = this.audioSystem;
    window.__onGameEvent = (e) => this.handleGameEvent(e);

    this.gameState = "INTRO";
    this.gameMode = "hunt";
    this.lastTime = performance.now();
    this.raceStartTime = 0;
    this.raceElapsedSec = 0;
    this.telemetryTimer = 0;

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

  setupUI() {
    // 1. Difficulty Buttons
    document.querySelectorAll(".diff-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        document.querySelectorAll(".diff-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        const diff = btn.getAttribute("data-diff");
        this.playerPhysics.setDifficulty(diff);
        if (this.hudManager.diffBadge) {
          this.hudManager.diffBadge.textContent = `DIFF: ${diff.toUpperCase()}`;
        }
      });
    });

    // 2. Mode Buttons
    const btnHunt = document.getElementById("btn-mode-hunt");
    const btnSlalom = document.getElementById("btn-mode-slalom");
    if (btnHunt && btnSlalom) {
      btnHunt.addEventListener("click", () => {
        btnHunt.classList.add("active");
        btnSlalom.classList.remove("active");
        this.gameMode = "hunt";
      });
      btnSlalom.addEventListener("click", () => {
        btnSlalom.classList.add("active");
        btnHunt.classList.remove("active");
        this.gameMode = "slalom";
      });
    }

    // 3. Track Selection Buttons
    document.querySelectorAll(".track-select-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        document.querySelectorAll(".track-select-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        const trackId = btn.getAttribute("data-track");
        const newTrack = this.trackManager.setTrack(trackId);
        this.sceneManager.applyTrack(newTrack);
        this.hudManager.addCombatLog(`Track Loaded: ${newTrack.name}`, "#00f0ff");
      });
    });

    // 4. Rider Class Toggle (Skier vs Snowboarder)
    const btnSkier = document.getElementById("btn-class-skier");
    const btnBoarder = document.getElementById("btn-class-boarder");
    if (btnSkier && btnBoarder) {
      btnSkier.addEventListener("click", () => {
        btnSkier.classList.add("active");
        btnBoarder.classList.remove("active");
        this.playerPhysics.setRiderClass("skier");
        this.hudManager.addCombatLog("Rider Class: SKIER (Speed & Slalom)", "#39ff14");
      });
      btnBoarder.addEventListener("click", () => {
        btnBoarder.classList.add("active");
        btnSkier.classList.remove("active");
        this.playerPhysics.setRiderClass("snowboarder");
        this.hudManager.addCombatLog("Rider Class: SNOWBOARDER (Air Pop & Tricks)", "#00f0ff");
      });
    }

    // 5. Ready & Start Buttons
    const btnReady = document.getElementById("btn-ready");
    if (btnReady) {
      btnReady.addEventListener("click", () => {
        this.audioSystem.unlockAndStart();
        this.networkSync.sendReady(true, this.gameMode);
        btnReady.textContent = "READY! 🎿";
        btnReady.style.background = "linear-gradient(135deg, #39ff14, #00aa55)";
      });
    }

    const btnStart = document.getElementById("btn-start");
    if (btnStart) {
      btnStart.addEventListener("click", () => {
        this.audioSystem.unlockAndStart();
        this.startGame();
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
          clearTimeSec: this.raceElapsedSec
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
      this.gameState = "LOBBY";
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
      if (this.gameState === "INTRO" && (e.code === "Space" || e.code === "Escape")) {
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
      this.triggerGondolaRest(msg.killer);
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

    if (startModal) startModal.classList.add("hidden");
    if (backdrop) backdrop.classList.add("hidden");
    if (hudOverlay) hudOverlay.classList.remove("hidden");

    this.playerPhysics.respawn();
    this.yetiPredator.hp = this.yetiPredator.maxHp;
    this.raceStartTime = performance.now();
    this.raceElapsedSec = 0;
    this.gameState = "ACTIVE";
  }

  launchActiveGame() {
    this.startGame();
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
    if (e.type === "SHOOT") {
      if (e.hit) {
        this.playerPhysics.score += e.damage;
        this.hudManager.showFloatingDamage(window.innerWidth / 2, window.innerHeight / 2 - 40, e.damage, e.isCrit);
        this.hudManager.addCombatLog(e.isCrit ? `🎯 Critical Hit! (+${e.damage} PTS)` : `💥 Hit Yeti! (+${e.damage} PTS)`, e.isCrit ? "#ffff00" : "#00f0ff");
      }
    } else if (e.type === "RELOAD_START") {
      this.hudManager.addCombatLog("🔄 Reloading Magazine...", "#88a0c0");
    } else if (e.type === "RELOAD_COMPLETE") {
      this.hudManager.addCombatLog("⚡ Magazine Loaded (8/8)", "#39ff14");
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
    this.gameState = "DEAD";
    const backdrop = document.getElementById("modal-backdrop");
    const deathModal = document.getElementById("death-modal");
    const deathStat = document.getElementById("death-stat");

    if (backdrop) backdrop.classList.remove("hidden");
    if (deathModal) deathModal.classList.remove("hidden");
    if (deathStat) {
      deathStat.textContent = `Track: ${this.trackManager.getTrack().name} • Distance: ${Math.round(this.playerPhysics.z)}m • Score: ${this.playerPhysics.score.toLocaleString()} PTS • Top Speed: ${Math.round(this.playerPhysics.maxSpeedAchieved)} MPH`;
    }

    this.promptScoreClaim();
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
      huntBody.innerHTML = data.leaderboard.map((row, idx) => `
        <tr style="border-bottom: 1px solid #1a2a44;">
          <td style="padding:4px; font-weight:bold; color:#00f0ff;">#${idx + 1}</td>
          <td style="padding:4px;">${this.escapeHtml(row.callsign)}</td>
          <td style="padding:4px; color:#ffff00; font-weight:bold;">${row.score.toLocaleString()}</td>
          <td style="padding:4px;">${Math.round(row.max_speed)} MPH</td>
        </tr>
      `).join('');
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

  loop(currentTime) {
    const dt = Math.min(0.1, (currentTime - this.lastTime) / 1000);
    this.lastTime = currentTime;
    const currentTrack = this.trackManager.getTrack();

    if (this.gameState === "ACTIVE") {
      this.raceElapsedSec += dt;

      // 1. Local Player Physics (Kinematics, 3D Air Tricks, Nitro)
      this.playerPhysics.update(
        dt,
        this.sceneManager,
        this.audioSystem,
        (e) => this.handleGameEvent(e),
        currentTrack
      );

      // 2. Combat System, Flare Gun & NPC Squad Rescue
      this.combatSystem.update(
        dt,
        (e) => this.handleGameEvent(e),
        { x: this.playerPhysics.x, z: this.playerPhysics.z },
        this.yetiPredator.npcs,
        this.audioSystem
      );

      // 3. Yeti Predator AI (with Flare Burn Panic & Avalanche Awareness)
      this.yetiPredator.update(
        dt,
        this.playerPhysics,
        this.audioSystem,
        (e) => this.handleGameEvent(e),
        currentTrack
      );

      // 4. Update Third-Person Chase Camera with 3D Aerial Rotation & Nitro Effects
      this.sceneManager.updateCamera(
        { x: this.playerPhysics.x, y: this.playerPhysics.y, z: this.playerPhysics.z },
        this.playerPhysics.steer,
        this.playerPhysics.pitch,
        this.playerPhysics.airY,
        this.playerPhysics.airRoll,
        this.playerPhysics.airYaw,
        this.playerPhysics.isAirborne,
        this.playerPhysics.isNitroActive,
        this.playerPhysics.avalancheDist
      );

      // 5. Update HUD Overlays
      this.hudManager.update(
        this.playerPhysics,
        this.combatSystem,
        this.yetiPredator,
        this.gameMode,
        this.raceElapsedSec,
        currentTrack
      );

      // 6. 15Hz Telemetry to Cloudflare Durable Object
      this.telemetryTimer += dt;
      if (this.telemetryTimer >= 0.066) {
        this.telemetryTimer = 0;
        this.networkSync.sendTelemetry(
          this.playerPhysics.x,
          this.playerPhysics.z,
          this.playerPhysics.speed,
          this.playerPhysics.steer,
          this.playerPhysics.pitch
        );
      }
    }

    // Single-Pass High Performance 3D WebGL Render
    this.sceneManager.render();

    requestAnimationFrame((t) => this.loop(t));
  }
}

window.addEventListener("DOMContentLoaded", () => {
  new GameApp();
});
