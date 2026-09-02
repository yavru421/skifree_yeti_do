// public/js/PlayerPhysics.js
// Client-Authoritative Skier Kinematics, Carving, Air Tricks & Obstacle Collisions

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

    // Air Physics & Trick State
    this.isAirborne = false;
    this.airY = 0;
    this.airVy = 0;
    this.airRoll = 0;
    this.isGrindingRail = false;
    this.airTime = 0;

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
      jump: false
    };

    // Slalom Race State
    this.gatesHit = 0;
    this.gateStreak = 1;
    this.maxSpeedAchieved = 0;
    this.isRaceFinished = false;

    this.setupKeyboardListeners();
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

  triggerJump() {
    if (!this.isAirborne && !this.isDead) {
      this.isAirborne = true;
      this.airVy = 14.0;
      this.airTime = 0;
    }
  }

  update(dt, sceneManager, audioSystem, onEvent) {
    if (this.isDead) return;

    const diff = this.difficultyPresets[this.currentDifficulty];

    // 1. Steering & Carving Kinematics:
    // When looking down the slope (+Z), +X is Screen-Left and -X is Screen-Right
    // Left (A / ArrowLeft) -> Steer Left (+steer) -> Carve Screen-Left (+X)
    // Right (D / ArrowRight) -> Steer Right (-steer) -> Carve Screen-Right (-X)
    const steerSpeed = 3.2 * dt;
    if (this.keys.left) {
      this.steer = Math.min(0.75, this.steer + steerSpeed);
    } else if (this.keys.right) {
      this.steer = Math.max(-0.75, this.steer - steerSpeed);
    } else {
      // Natural spring back to center
      this.steer *= Math.pow(0.06, dt);
    }

    // 2. Speed Tuck vs Snowplow Brake
    let targetSpeed = diff.cruiseSpeed;
    if (this.keys.up) {
      targetSpeed = diff.tuckSpeed;
      this.pitch = -0.12; // Forward speed tuck
    } else if (this.keys.down) {
      targetSpeed = diff.brakeSpeed;
      this.pitch = 0.08; // Snowplow brake
    } else {
      this.pitch *= 0.85;
    }

    // Smooth speed acceleration
    this.speed += (targetSpeed - this.speed) * (this.keys.down ? 4.5 : 2.2) * dt;
    if (this.speed > this.maxSpeedAchieved) {
      this.maxSpeedAchieved = this.speed;
    }

    // 3. Movement Integration (Left is -X, Right is +X)
    const forwardStep = this.speed * diff.forwardFactor * dt * 60;
    const lateralStep = Math.sin(this.steer) * (this.speed * diff.lateralFactor * dt * 60);

    this.z += forwardStep;
    this.x += lateralStep;
    this.x = Math.max(-65, Math.min(65, this.x)); // Mountain boundaries

    // 4. Air Physics & Tricks
    if (this.isAirborne) {
      this.airTime += dt;
      this.airVy -= 32.0 * dt; // Gravity
      this.airY += this.airVy * dt;

      if (this.keys.left) {
        this.airRoll -= 4.5 * dt;
      } else if (this.keys.right) {
        this.airRoll += 4.5 * dt;
      }

      // Landing check
      if (this.airY <= 0) {
        this.airY = 0;
        this.airVy = 0;
        this.isAirborne = false;

        // Trick evaluation
        const completedRotations = Math.floor(Math.abs(this.airRoll) / (Math.PI * 1.6));
        if (completedRotations > 0) {
          const trickScore = completedRotations * 1500;
          this.score += trickScore;
          if (audioSystem) audioSystem.playRescueFanfare();
          if (onEvent) {
            onEvent({
              type: "TRICK_LANDED",
              score: trickScore,
              rotations: completedRotations
            });
          }
        }
        this.airRoll = 0;
      }
    }

    // 5. Obstacle Collisions & Interactive Rails
    this.checkObstacles(sceneManager, audioSystem, onEvent);

    // 6. Slalom Gate Crossing Check
    this.checkSlalomGates(sceneManager, audioSystem, onEvent);

    // 7. Audio Speed & Carving Feedback
    if (audioSystem) {
      audioSystem.updateSpeed(this.speed, this.steer);
    }
  }

  checkObstacles(sceneManager, audioSystem, onEvent) {
    // A. Kickers
    sceneManager.kickers.forEach((kicker) => {
      const distZ = kicker.position.z - this.z;
      const distX = Math.abs(kicker.position.x - this.x);
      if (distZ > -2.0 && distZ < 2.5 && distX < 2.0 && !this.isAirborne) {
        this.isAirborne = true;
        this.airVy = 20.0; // Mega air
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
      if (distZ < 6.0 && distX < 1.4 && this.airY < 1.5) {
        this.isGrindingRail = true;
        this.airY = 0.8;
        this.airVy = 0;
        this.score += 25;
        if (audioSystem) audioSystem.playRailGrind();
      }
    });

    // C. Trees
    sceneManager.trees.forEach((tree) => {
      const distZ = Math.abs(tree.position.z - this.z);
      const distX = Math.abs(tree.position.x - this.x);
      if (distZ < 1.4 && distX < 1.3 && this.airY < 1.0) {
        // Collision with tree
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
  }

  checkSlalomGates(sceneManager, audioSystem, onEvent) {
    sceneManager.slalomGates.forEach((gate) => {
      if (!gate.cleared && this.z >= gate.z) {
        gate.cleared = true;
        const distFromCenter = Math.abs(this.x - gate.x);
        if (distFromCenter < 3.2) {
          // Gate Cleared!
          this.gatesHit++;
          this.gateStreak = Math.min(5, this.gateStreak + 1);
          const gatePoints = 500 * this.gateStreak;
          this.score += gatePoints;
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

    // Finish Line at 1200m
    if (!this.isRaceFinished && this.z >= 1200) {
      this.isRaceFinished = true;
      if (onEvent) {
        onEvent({
          type: "RACE_FINISHED",
          clearTimeSec: 0,
          gatesHit: this.gatesHit,
          maxSpeed: Math.round(this.maxSpeedAchieved),
          score: this.score
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
    this.airRoll = 0;
    this.gatesHit = 0;
    this.gateStreak = 1;
    this.isRaceFinished = false;
  }
}
