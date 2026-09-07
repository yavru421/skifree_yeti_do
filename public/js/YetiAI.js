// public/js/YetiAI.js
// 5-Tier Progressive Yeti Predator AI — Behavior Controller & State Machine

export const YETI_TIERS = [
  {
    id: 1,
    name: "LUMBERING ROOKIE",
    hp: 4000,
    minSpeed: 18,
    maxSpeed: 22,
    strafeAmplitude: 8,
    jukeFreqBase: 0.8,
    jukeNoise: 0,
    leadDistMin: 30,
    leadDistMax: 42,
    snowPlume: 0,
    leapChance: 0,
    staggerDuration: 3.0,
    towSpeedMult: 1.2,
    finishStrikesNeeded: 1,
    cableBreakThreshold: 3.5,   // Seconds in red zone before snap
    reelResistance: 0.6,        // How hard yeti fights reel-in (0-1)
    thrashIntensity: 0.3,       // Lateral jerk violence during tow
    eyeColor: 0xff4444,
    auraColor: null,
    description: "A young, clumsy beast. Lumbers downhill with wide, predictable strides."
  },
  {
    id: 2,
    name: "ALPINE STALKER",
    hp: 6500,
    minSpeed: 26,
    maxSpeed: 32,
    strafeAmplitude: 14,
    jukeFreqBase: 1.6,
    jukeNoise: 0.15,
    leadDistMin: 28,
    leadDistMax: 38,
    snowPlume: 0.3,
    leapChance: 0,
    staggerDuration: 2.5,
    towSpeedMult: 1.3,
    finishStrikesNeeded: 1,
    cableBreakThreshold: 3.0,
    reelResistance: 0.7,
    thrashIntensity: 0.5,
    eyeColor: 0xff2222,
    auraColor: null,
    description: "Hardened mountain predator. Faster slalom and sharper turns."
  },
  {
    id: 3,
    name: "WILD ALPS BERSERKER",
    hp: 9000,
    minSpeed: 35,
    maxSpeed: 42,
    strafeAmplitude: 18,
    jukeFreqBase: 2.8,
    jukeNoise: 0.3,
    leadDistMin: 26,
    leadDistMax: 34,
    snowPlume: 0.6,
    leapChance: 0.08,
    staggerDuration: 2.0,
    towSpeedMult: 1.4,
    finishStrikesNeeded: 2,
    cableBreakThreshold: 2.5,
    reelResistance: 0.8,
    thrashIntensity: 0.7,
    eyeColor: 0xff0033,
    auraColor: 0xff220044,
    description: "Berserker rage. Violent juke reversals and occasional bounding leaps."
  },
  {
    id: 4,
    name: "FROSTFANG APEX",
    hp: 12000,
    minSpeed: 42,
    maxSpeed: 50,
    strafeAmplitude: 22,
    jukeFreqBase: 4.0,
    jukeNoise: 0.45,
    leadDistMin: 24,
    leadDistMax: 30,
    snowPlume: 0.85,
    leapChance: 0.18,
    staggerDuration: 1.8,
    towSpeedMult: 1.5,
    finishStrikesNeeded: 2,
    cableBreakThreshold: 2.2,
    reelResistance: 0.88,
    thrashIntensity: 0.85,
    eyeColor: 0xff0000,
    auraColor: 0xff005588,
    description: "Apex predator. Heavy snow plumes obscure vision. Frequent leap attacks."
  },
  {
    id: 5,
    name: "BLIZZARD LEVIATHAN",
    hp: 16000,
    minSpeed: 50,
    maxSpeed: 55,
    strafeAmplitude: 26,
    jukeFreqBase: 5.5,
    jukeNoise: 0.6,
    leadDistMin: 24,
    leadDistMax: 28,
    snowPlume: 1.0,
    leapChance: 0.28,
    staggerDuration: 1.5,
    towSpeedMult: 1.6,
    finishStrikesNeeded: 3,
    cableBreakThreshold: 2.0,
    reelResistance: 0.95,
    thrashIntensity: 1.0,
    eyeColor: 0xff0000,
    auraColor: 0xcc0088ff,
    description: "The mountain's final wrath. Blinding blizzard plumes, erratic dashes, and devastating leaps."
  }
];

export class YetiAI {
  constructor(tierIndex = 0) {
    this.setTier(tierIndex);
    this.x = 0;
    this.y = 0;
    this.z = 60;
    this.speed = 0;
    this.active = true;
    this.state = "RUNNING_DOWNHILL";

    // Internal timers
    this.staggerTimer = 0;
    this.recoverTimer = 0;
    this.leapTimer = 0;
    this.leapCooldown = 0;
    this.jukeTimer = 0;
    this.jukeDirection = 1;

    // Noise seed for organic movement
    this._noiseSeed = Math.random() * 1000;
    this._lastJukeChange = 0;
  }

  get tierData() {
    return YETI_TIERS[this.tierIndex];
  }

  setTier(tierIndex) {
    this.tierIndex = Math.max(0, Math.min(YETI_TIERS.length - 1, tierIndex));
    const tier = YETI_TIERS[this.tierIndex];
    this.hp = tier.hp;
    this.maxHp = tier.hp;
    this.wave = tier.id;
    this.state = "RUNNING_DOWNHILL";
    this.staggerTimer = 0;
    this.recoverTimer = 0;
    this.leapTimer = 0;
    this.leapCooldown = 0;
  }

  advanceTier() {
    if (this.tierIndex < YETI_TIERS.length - 1) {
      this.setTier(this.tierIndex + 1);
      return true;
    }
    return false; // Already at max tier
  }

  respawnAtTier(playerX, playerZ) {
    const tier = this.tierData;
    this.hp = tier.hp;
    this.maxHp = tier.hp;
    this.x = playerX;
    this.z = playerZ + tier.leadDistMax;
    this.state = "RUNNING_DOWNHILL";
    this.active = true;
    this.staggerTimer = 0;
    this.recoverTimer = 0;
    this.leapTimer = 0;
  }

  // Simple pseudo-noise for organic movement variation
  _noise(t) {
    return Math.sin(t * 1.7 + this._noiseSeed) * 0.5 +
           Math.sin(t * 3.1 + this._noiseSeed * 0.7) * 0.3 +
           Math.sin(t * 7.3 + this._noiseSeed * 1.3) * 0.2;
  }

  enterStagger() {
    this.state = "STAGGERED";
    this.staggerTimer = this.tierData.staggerDuration;
  }

  enterTowedThrashing() {
    this.state = "TOWED_THRASHING";
  }

  enterRecovering() {
    this.state = "RECOVERING";
    this.recoverTimer = 8.0;
    // Heal 15% HP on cable snap
    this.hp = Math.min(this.maxHp, this.hp + Math.floor(this.maxHp * 0.15));
  }

  update(dt, playerPhysics) {
    if (!this.active || this.hp <= 0) return;

    const tier = this.tierData;
    const t = performance.now() * 0.001;
    const playerSpeed = playerPhysics.speed || 28;

    // ─── STATE: STAGGERED ─────────────────────────────────────
    if (this.state === "STAGGERED") {
      this.staggerTimer -= dt;
      // Slow drift while staggered
      this.z += playerSpeed * 0.015 * dt * 60;
      // Wobbly stumble
      this.x += Math.sin(t * 12) * 0.8 * dt;

      if (this.staggerTimer <= 0) {
        // Stagger ends — transition depends on combat system state
        // CombatSystem will transition to TOWED_THRASHING
        if (this.state === "STAGGERED") {
          this.state = "RUNNING_DOWNHILL"; // fallback
        }
      }
      return;
    }

    // ─── STATE: RECOVERING (post cable-snap enrage) ───────────
    if (this.state === "RECOVERING") {
      this.recoverTimer -= dt;
      const enrageSpeedMult = 1.2;
      const baseSpeed = (tier.minSpeed + tier.maxSpeed) / 2;
      const fwdSpeed = baseSpeed * enrageSpeedMult;

      // Sprint forward furiously
      this.z += fwdSpeed * 0.045 * dt * 60;
      // Erratic lateral dashing
      this.x += Math.sin(t * 10) * tier.strafeAmplitude * 0.08 * dt * 60;

      // Ensure stays ahead
      if (this.z < playerPhysics.z + tier.leadDistMin) {
        this.z = playerPhysics.z + tier.leadDistMin;
      }

      if (this.recoverTimer <= 0) {
        this.state = "RUNNING_DOWNHILL";
      }
      return;
    }

    // ─── STATE: TOWED_THRASHING (SKI BOAT TOW ACCELERATION) ───
    if (this.state === "TOWED_THRASHING") {
      // Beast panics and bolts downhill at breakneck speed like a roaring ski boat!
      const boatTowSpeed = Math.max(58, (tier.maxSpeed || 50) * 1.35);
      this.speed = boatTowSpeed;
      // High-frequency, violent wake oscillations like a boat cutting water
      const thrash = tier.thrashIntensity || 0.6;
      this.x += Math.sin(t * 12) * (thrash * 20) * dt;
      // Pull forward downhill with massive forward momentum
      this.z += boatTowSpeed * 0.045 * dt * 60;

      // Ensure beast stays taut on the rope ahead of player based on combat cableLength
      const combat = window.__combatSystem;
      const minDistance = (combat && combat.isTethered && typeof combat.cableLength === "number")
        ? combat.cableLength
        : 22;

      if (this.z < playerPhysics.z + minDistance) {
        this.z = playerPhysics.z + minDistance;
      }
      return;
    }

    // ─── STATE: DRAGGED_DOWN / FALLEN ────────────────────────
    if (this.state === "DRAGGED_DOWN" || this.state === "FALLEN") {
      this.staggerTimer -= dt;
      this.speed = Math.max(0, this.speed - 24 * dt);
      this.z += this.speed * 0.02 * dt * 60;
      return;
    }

    // ─── STATE: RUNNING_DOWNHILL (primary) ────────────────────

    // Forward velocity: scale with player speed and tier
    const tierSpeedRange = tier.maxSpeed - tier.minSpeed;
    const baseYetiSpeed = tier.minSpeed + tierSpeedRange * 0.5 +
      this._noise(t * 0.3) * tierSpeedRange * 0.5;
    this.speed = Math.max(tier.minSpeed, Math.min(tier.maxSpeed, baseYetiSpeed));

    // Forward movement — maintain lead distance
    const targetLeadDist = (tier.leadDistMin + tier.leadDistMax) / 2;
    const currentLead = this.z - playerPhysics.z;
    const leadError = targetLeadDist - currentLead;

    // Accelerate/decelerate to maintain target lead
    let fwdStep = playerSpeed * 0.045 * dt * 60;
    if (leadError > 2) {
      fwdStep *= 1.15; // Speed up if too close to player
    } else if (leadError < -2) {
      fwdStep *= 0.85; // Slow down if too far ahead
    }
    this.z += fwdStep;

    // Clamp minimum lead distance
    if (this.z < playerPhysics.z + tier.leadDistMin) {
      this.z = playerPhysics.z + tier.leadDistMin;
    }

    // ─── LATERAL SLALOM KINEMATICS ────────────────────────────
    const jukeFreq = tier.jukeFreqBase;
    const strafe = tier.strafeAmplitude;
    const noise = tier.jukeNoise;

    // Primary slalom oscillation
    let lateralX = Math.sin(t * jukeFreq) * strafe;

    // Secondary noise harmonics (higher tiers = more unpredictable)
    if (noise > 0) {
      lateralX += Math.sin(t * jukeFreq * 2.3 + 1.7) * strafe * noise * 0.5;
      lateralX += this._noise(t * jukeFreq * 0.7) * strafe * noise * 0.4;
    }

    // Sharp direction reversals for tier 3+ (random juke)
    if (tier.id >= 3) {
      this.jukeTimer += dt;
      const jukeInterval = 2.5 - (tier.id - 3) * 0.5; // More frequent at higher tiers
      if (this.jukeTimer > jukeInterval && Math.random() < 0.3 * dt * 10) {
        this.jukeDirection *= -1;
        this.jukeTimer = 0;
      }
      lateralX += this.jukeDirection * strafe * 0.3 * Math.sin(t * 3.5);
    }

    // Smoothly apply
    this.x += (lateralX - this.x) * Math.min(1, 4.0 * dt);

    // ─── LEAP ATTACKS (Tier 3+) ───────────────────────────────
    this.leapCooldown = Math.max(0, this.leapCooldown - dt);
    if (tier.leapChance > 0 && this.leapCooldown <= 0 && this.state === "RUNNING_DOWNHILL") {
      if (Math.random() < tier.leapChance * dt) {
        this.state = "LEAPING";
        this.leapTimer = 0.8; // Leap duration
        this.leapCooldown = 4.0 + Math.random() * 3.0; // Cooldown between leaps
      }
    }

    if (this.state === "LEAPING") {
      this.leapTimer -= dt;
      // Bound forward and sideways
      this.z += this.speed * 0.08 * dt * 60;
      this.x += this.jukeDirection * 12 * dt;
      // Airborne arc for visual Y
      this.leapAirY = Math.sin((1 - this.leapTimer / 0.8) * Math.PI) * 4.0;

      if (this.leapTimer <= 0) {
        this.state = "RUNNING_DOWNHILL";
        this.leapAirY = 0;
      }
    }

    // Get terrain Y from scene
    const sceneManager = window.__sceneManager;
    if (sceneManager && sceneManager.getTerrainHeight) {
      this.y = sceneManager.getTerrainHeight(this.x, this.z);
    } else {
      this.y = 0;
    }

    // Add leap air Y if leaping
    if (this.state === "LEAPING" && this.leapAirY) {
      this.y += this.leapAirY;
    }
  }
}
