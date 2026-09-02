// public/js/PlayerPhysics.js
// Client-Authoritative Skier/Snowboarder Kinematics, 3D Airborne Trick Rotations, Nitro & Stunts

export class PlayerPhysics {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.z = 0;
    this.speed = 28; // MPH
    this.steer = 0; // Radians
    this.pitch = 0;
    this.lives = 3;
    this.isDead = false;
    this.score = 0;

    // Rider Class & Specialty
    this.riderClass = "skier"; // "skier" | "snowboarder"

    // Air Physics & 3D Stunt Rotation State
    this.isAirborne = false;
    this.airY = 0;
    this.airVy = 0;
    this.airYaw = 0;   // Spin around vertical axis (360, 720, 1080)
    this.airPitch = 0; // Flip around lateral axis (Backflip, Frontflip)
    this.airRoll = 0;  // Corkscrew tilt
    this.isGrindingRail = false;
    this.airTime = 0;

    // Nitro Boost State
    this.nitroFuel = 100; // 0 to 100%
    this.isNitroActive = false;
    this.nitroTimer = 0;

    // Avalanche Hazard State
    this.avalancheDist = 120; // Meters behind player

    // Difficulty Calibration
    this.difficultyPresets = {
      easy: { name: "EASY", cruiseSpeed: 20, tuckSpeed: 42, brakeSpeed: 12, lateralFactor: 0.045, forwardFactor: 0.030 },
      medium: { name: "MED", cruiseSpeed: 28, tuckSpeed: 58, brakeSpeed: 16, lateralFactor: 0.055, forwardFactor: 0.038 },
      pro: { name: "PRO", cruiseSpeed: 38, tuckSpeed: 82, brakeSpeed: 20, lateralFactor: 0.068, forwardFactor: 0.046 }
    };
    this.currentDifficulty = "medium";

    // Input States
    this.keys = {
      left: false,
      right: false,
      up: false,
      down: false,
      jump: false,
      nitro: false
    };

    // Slalom Race State
    this.gatesHit = 0;
    this.gateStreak = 1;
    this.maxSpeedAchieved = 0;
    this.isRaceFinished = false;

    this.setupKeyboardListeners();
  }

  setRiderClass(rClass) {
    if (rClass === "snowboarder" || rClass === "skier") {
      this.riderClass = rClass;
    }
  }

  setupKeyboardListeners() {
    window.addEventListener("keydown", (e) => {
      if (e.repeat) return;
      switch (e.code) {
        case "KeyA":
        case "ArrowLeft":
          this.keys.left = true;
          break;
        case "KeyD":
        case "ArrowRight":
          this.keys.right = true;
          break;
        case "KeyW":
        case "ArrowUp":
          this.keys.up = true;
          break;
        case "KeyS":
        case "ArrowDown":
          this.keys.down = true;
          break;
        case "Space":
          this.keys.jump = true;
          this.triggerJump();
          break;
        case "KeyN":
        case "ShiftLeft":
        case "ShiftRight":
          this.activateNitro();
          break;
      }
    });

    window.addEventListener("keyup", (e) => {
      switch (e.code) {
        case "KeyA":
        case "ArrowLeft":
          this.keys.left = false;
          break;
        case "KeyD":
        case "ArrowRight":
          this.keys.right = false;
          break;
        case "KeyW":
        case "ArrowUp":
          this.keys.up = false;
          break;
        case "KeyS":
        case "ArrowDown":
          this.keys.down = false;
          break;
        case "Space":
          this.keys.jump = false;
          break;
      }
    });
  }

  setDifficulty(diffKey) {
    if (this.difficultyPresets[diffKey]) {
      this.currentDifficulty = diffKey;
    }
  }

  activateNitro() {
    if (this.nitroFuel >= 25 && !this.isNitroActive && !this.isDead) {
      this.isNitroActive = true;
      this.nitroTimer = 2.4; // 2.4 seconds surge
      this.nitroFuel = Math.max(0, this.nitroFuel - 30);
      if (window.__audioSystem && window.__audioSystem.playBigAirWhoosh) {
        window.__audioSystem.playBigAirWhoosh();
      }
      if (window.__onGameEvent) {
        window.__onGameEvent({ type: "NITRO_ACTIVATED", speedBoost: 26 });
      }
    }
  }

  triggerJump() {
    if (!this.isAirborne && !this.isDead) {
      this.isAirborne = true;
      // Snowboarders get +25% jump pop
      const jumpPop = this.riderClass === "snowboarder" ? 17.5 : 14.0;
      this.airVy = jumpPop;
      this.airTime = 0;
      this.airYaw = 0;
      this.airPitch = 0;
    }
  }

  update(dt, sceneManager, audioSystem, onEvent, currentTrack) {
    if (this.isDead) return;

    // Fixed Sub-Step Clamp
    dt = Math.min(0.033, Math.max(0.005, dt));

    const diff = this.difficultyPresets[this.currentDifficulty];

    // Class Modifiers
    const isBoarder = this.riderClass === "snowboarder";
    const lateralMod = isBoarder ? 1.15 : 1.0;
    const topSpeedMod = isBoarder ? 0.95 : 1.08;

    // Nitro Countdown & Passive Recharge
    if (this.isNitroActive) {
      this.nitroTimer -= dt;
      if (this.nitroTimer <= 0) {
        this.isNitroActive = false;
      }
    } else {
      this.nitroFuel = Math.min(100, this.nitroFuel + 8.0 * dt);
    }

    // 1. Steering & Ground Carving vs Airborne Stunt Rotations
    if (this.isAirborne) {
      // AIR TRICKS: Spins and Flips
      const spinSpeed = 6.8 * dt;
      const flipSpeed = 5.8 * dt;

      if (this.keys.left) {
        this.airYaw += spinSpeed;
        this.airRoll += spinSpeed * 0.4;
      } else if (this.keys.right) {
        this.airYaw -= spinSpeed;
        this.airRoll -= spinSpeed * 0.4;
      }

      if (this.keys.up) {
        this.airPitch += flipSpeed; // Frontflip
      } else if (this.keys.down) {
        this.airPitch -= flipSpeed; // Backflip
      }

    } else {
      // GROUND CARVING
      const steerSpeed = (3.2 * (isBoarder ? 1.25 : 1.0)) * dt;
      if (this.keys.left) {
        this.steer = Math.min(0.75, this.steer + steerSpeed);
      } else if (this.keys.right) {
        this.steer = Math.max(-0.75, this.steer - steerSpeed);
      } else {
        this.steer *= Math.pow(0.06, dt);
      }
    }

    // 2. Speed Tuck vs Snowplow Brake & Nitro Surge
    let targetSpeed = diff.cruiseSpeed;
    if (this.keys.up && !this.isAirborne) {
      targetSpeed = diff.tuckSpeed * topSpeedMod;
      this.pitch = -0.12;
    } else if (this.keys.down && !this.isAirborne) {
      targetSpeed = diff.brakeSpeed;
      this.pitch = 0.08;
    } else {
      this.pitch *= 0.85;
    }

    // Nitro Surge
    if (this.isNitroActive) {
      targetSpeed += 26.0;
    }

    // Avalanche Speed Floor (Forces high velocity)
    if (currentTrack?.id === "avalanche") {
      targetSpeed = Math.max(34, targetSpeed);
    }

    // Smooth speed acceleration
    this.speed += (targetSpeed - this.speed) * (this.keys.down ? 4.8 : 2.4) * dt;
    if (this.speed > this.maxSpeedAchieved) {
      this.maxSpeedAchieved = this.speed;
    }

    // 3. Movement Integration
    const forwardStep = this.speed * diff.forwardFactor * dt * 60;
    const lateralStep = Math.sin(this.steer) * (this.speed * diff.lateralFactor * lateralMod * dt * 60);

    this.z += forwardStep;
    this.x += lateralStep;
    this.x = Math.max(-65, Math.min(65, this.x));

    // 4. Air Physics & Landing Trick Stomp Evaluation
    if (this.isAirborne) {
      this.airTime += dt;
      const gravity = isBoarder ? 28.0 : 32.0;
      this.airVy -= gravity * dt;
      this.airY += this.airVy * dt;

      // Landing check
      if (this.airY <= 0) {
        this.airY = 0;
        this.airVy = 0;
        this.isAirborne = false;

        this.evaluateLanding(audioSystem, onEvent, sceneManager);
      }
    }

    // 5. Track Hazards, Obstacles & Rails
    this.checkObstacles(sceneManager, audioSystem, onEvent, currentTrack);

    // 6. Slalom Gate Crossing Check
    this.checkSlalomGates(sceneManager, audioSystem, onEvent, currentTrack);

    // 7. Avalanche Proximity Progression
    if (currentTrack?.id === "avalanche") {
      const avaSpeed = currentTrack.avalancheSpeed || 44;
      const distDelta = (this.speed - avaSpeed) * 0.4 * dt;
      this.avalancheDist = Math.max(0, Math.min(180, this.avalancheDist + distDelta));
      if (this.avalancheDist <= 0.5) {
        // Engulfed by avalanche
        this.takeDamage(3);
        if (audioSystem) audioSystem.playTreeThud();
        if (onEvent) onEvent({ type: "AVALANCHE_ENGULFED" });
      }
    }

    // 8. Audio Speed & Carving Feedback
    if (audioSystem) {
      audioSystem.updateSpeed(this.speed, this.steer);
    }
  }

  evaluateLanding(audioSystem, onEvent, sceneManager) {
    // Check rotation angles for clean stomp vs wipeout tumble
    // Wrap to [-PI, PI]
    const normYaw = Math.abs(Math.atan2(Math.sin(this.airYaw), Math.cos(this.airYaw)));
    const normPitch = Math.abs(Math.atan2(Math.sin(this.airPitch), Math.cos(this.airPitch)));

    const isBoarder = this.riderClass === "snowboarder";
    // Bad landing threshold: more than 52 degrees from forward
    const badLanding = normPitch > 0.92 || normYaw > 0.95;

    if (badLanding) {
      // Tumble Wipeout!
      this.speed = Math.max(6, this.speed * 0.25);
      this.takeDamage(1);
      if (audioSystem) audioSystem.playTreeThud();
      if (sceneManager && sceneManager.addTrauma) sceneManager.addTrauma(0.45);
      if (onEvent) {
        onEvent({
          type: "TRICK_WIPEOUT",
          message: "⚠️ WIPEOUT! BAD LANDING ANGLE!"
        });
      }
    } else {
      // CLEAN STOMP! Calculate tricks
      const totalSpins = Math.round(Math.abs(this.airYaw) / (Math.PI * 2));
      const totalFlips = Math.round(Math.abs(this.airPitch) / (Math.PI * 2));
      const halfSpins = Math.round(Math.abs(this.airYaw) / Math.PI);

      let trickName = "";
      let trickScore = 0;

      if (totalFlips >= 1 && totalSpins >= 1) {
        trickName = `RODEO ${totalSpins * 360}° FLIP!`;
        trickScore = 3500 + totalSpins * 1000;
      } else if (totalFlips >= 1) {
        trickName = totalFlips === 1 ? "CLEAN BACKFLIP!" : `DOUBLE FLIP x${totalFlips}!`;
        trickScore = 2400 * totalFlips;
      } else if (totalSpins >= 1) {
        trickName = `${totalSpins * 360}° HELICOPTER SPIN!`;
        trickScore = 1200 * totalSpins;
      } else if (halfSpins === 1) {
        trickName = isBoarder ? "180° SWITCH SHIFTY!" : "180° REVERSE CARVE!";
        trickScore = 600;
      }

      if (trickScore > 0) {
        if (isBoarder) trickScore = Math.round(trickScore * 1.4); // Boarder trick bonus
        this.score += trickScore;
        this.nitroFuel = Math.min(100, this.nitroFuel + 25); // Bonus nitro on trick
        if (audioSystem) audioSystem.playRescueFanfare();
        if (sceneManager && sceneManager.addTrauma) sceneManager.addTrauma(0.12);
        if (onEvent) {
          onEvent({
            type: "TRICK_LANDED",
            score: trickScore,
            trickName,
            isBoarder
          });
        }
      }
    }

    this.airYaw = 0;
    this.airPitch = 0;
    this.airRoll = 0;
  }

  checkObstacles(sceneManager, audioSystem, onEvent, currentTrack) {
    if (!sceneManager) return;

    // A. Kickers (Big Air Launch)
    sceneManager.kickers.forEach((kicker) => {
      const distZ = kicker.position.z - this.z;
      const distX = Math.abs(kicker.position.x - this.x);
      if (distZ > -2.0 && distZ < 2.5 && distX < 2.2 && !this.isAirborne) {
        this.isAirborne = true;
        const megaBoost = currentTrack?.id === "terrain_park" ? 25.0 : 21.0;
        this.airVy = megaBoost;
        this.airTime = 0;
        if (audioSystem) audioSystem.playBigAirWhoosh();
        if (onEvent) onEvent({ type: "KICKER_LAUNCH" });
      }
    });

    // B. Grind Rails
    this.isGrindingRail = false;
    sceneManager.grindRails.forEach((rail) => {
      const distZ = Math.abs(rail.position.z - this.z);
      const distX = Math.abs(rail.position.x - this.x);
      if (distZ < 7.0 && distX < 1.6 && this.airY < 1.8) {
        this.isGrindingRail = true;
        this.airY = 0.85;
        this.airVy = 0;
        const pts = this.riderClass === "snowboarder" ? 45 : 30;
        this.score += pts;
        if (audioSystem) audioSystem.playRailGrind();
      }
    });

    // C. Trees
    sceneManager.trees.forEach((tree) => {
      const distZ = Math.abs(tree.position.z - this.z);
      const distX = Math.abs(tree.position.x - this.x);
      if (distZ < 1.4 && distX < 1.3 && this.airY < 1.0) {
        this.speed = Math.max(8, this.speed * 0.35);
        if (audioSystem) audioSystem.playTreeThud();
        if (onEvent) {
          onEvent({
            type: "TREE_HIT",
            x: this.x,
            z: this.z
          });
        }
      }
    });

    // D. Crevasses (Glacier chasms)
    if (sceneManager.crevasses) {
      sceneManager.crevasses.forEach((crev) => {
        const distZ = Math.abs(crev.z - this.z);
        if (distZ < crev.width * 0.5 && this.airY < 0.6) {
          // Fallen into chasm!
          this.speed = Math.max(4, this.speed * 0.2);
          this.takeDamage(1);
          if (audioSystem) audioSystem.playTreeThud();
          if (onEvent) onEvent({ type: "CREVASSE_FALL", z: crev.z });
        }
      });
    }
  }

  checkSlalomGates(sceneManager, audioSystem, onEvent, currentTrack) {
    if (!sceneManager || !sceneManager.slalomGates) return;

    sceneManager.slalomGates.forEach((gate) => {
      if (!gate.cleared && this.z >= gate.z) {
        gate.cleared = true;
        const distFromCenter = Math.abs(this.x - gate.x);
        const passWidth = (currentTrack?.features?.slalomGates?.width || 14) * 0.25;
        if (distFromCenter < passWidth) {
          // Gate Cleared!
          this.gatesHit++;
          this.gateStreak = Math.min(5, this.gateStreak + 1);
          const gatePoints = 500 * this.gateStreak;
          this.score += gatePoints;
          this.nitroFuel = Math.min(100, this.nitroFuel + 12);
          if (audioSystem) audioSystem.playGateChime();
          if (onEvent) {
            onEvent({
              type: "GATE_CLEARED",
              gateId: gate.id,
              streak: this.gateStreak,
              points: gatePoints
            });
          }
        } else {
          // Gate Missed
          this.gateStreak = 1;
          if (onEvent) {
            onEvent({
              type: "GATE_MISSED",
              gateId: gate.id
            });
          }
        }
      }
    });

    // Dynamic Finish Line based on currentTrack
    const finishDist = currentTrack?.finishDistance || 1200;
    if (!this.isRaceFinished && this.z >= finishDist) {
      this.isRaceFinished = true;
      if (onEvent) {
        onEvent({
          type: "RACE_FINISHED",
          clearTimeSec: 0,
          gatesHit: this.gatesHit,
          maxSpeed: Math.round(this.maxSpeedAchieved),
          score: this.score,
          trackId: currentTrack?.id || "alpine",
          riderClass: this.riderClass
        });
      }
    }
  }

  takeDamage(amount = 1) {
    this.lives = Math.max(0, this.lives - amount);
    if (this.lives <= 0) {
      this.isDead = true;
    }
    return this.lives;
  }

  respawn() {
    this.z = 0;
    this.x = 0;
    this.speed = 28;
    this.steer = 0;
    this.pitch = 0;
    this.lives = 3;
    this.isDead = false;
    this.score = 0;
    this.maxSpeedAchieved = 0;
    this.isAirborne = false;
    this.airY = 0;
    this.airVy = 0;
    this.airYaw = 0;
    this.airPitch = 0;
    this.airRoll = 0;
    this.gatesHit = 0;
    this.gateStreak = 1;
    this.isRaceFinished = false;
    this.nitroFuel = 100;
    this.isNitroActive = false;
    this.avalancheDist = 120;
  }
}
