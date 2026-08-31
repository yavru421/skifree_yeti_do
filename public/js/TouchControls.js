// public/js/TouchControls.js
// Mobile PWA Virtual Analog Joystick, Action Buttons & Device Haptics

export class TouchControls {
  constructor(playerPhysics, combatSystem, sceneManager, audioSystem) {
    this.playerPhysics = playerPhysics;
    this.combatSystem = combatSystem;
    this.sceneManager = sceneManager;
    this.audioSystem = audioSystem;

    this.isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    this.touchZone = document.getElementById("touch-steer-zone");
    this.stickBase = document.getElementById("touch-stick-base");
    this.stickThumb = document.getElementById("touch-stick-thumb");
    this.actionBar = document.getElementById("mobile-action-bar");

    this.touchId = null;
    this.baseX = 0;
    this.baseY = 0;

    if (this.isTouchDevice) {
      this.init();
    }
  }

  init() {
    if (this.touchZone) this.touchZone.classList.remove("hidden");
    if (this.actionBar) this.actionBar.classList.remove("hidden");

    this.setupJoystick();
    this.setupActionButtons();
  }

  setupJoystick() {
    if (!this.touchZone) return;

    this.touchZone.addEventListener("touchstart", (e) => {
      e.preventDefault();
      if (this.touchId !== null) return;
      const touch = e.changedTouches[0];
      this.touchId = touch.identifier;
      this.baseX = touch.clientX;
      this.baseY = touch.clientY;

      if (this.stickBase && this.stickThumb) {
        this.stickBase.style.left = `${this.baseX}px`;
        this.stickBase.style.top = `${this.baseY}px`;
        this.stickThumb.style.left = `${this.baseX}px`;
        this.stickThumb.style.top = `${this.baseY}px`;
        this.stickBase.style.display = "block";
        this.stickThumb.style.display = "block";
      }
    }, { passive: false });

    this.touchZone.addEventListener("touchmove", (e) => {
      e.preventDefault();
      if (this.touchId === null) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === this.touchId) {
          const dx = touch.clientX - this.baseX;
          const dy = touch.clientY - this.baseY;
          const dist = Math.hypot(dx, dy);
          const maxRadius = 36;
          const angle = Math.atan2(dy, dx);
          const clampedDist = Math.min(dist, maxRadius);

          const thumbX = this.baseX + Math.cos(angle) * clampedDist;
          const thumbY = this.baseY + Math.sin(angle) * clampedDist;

          if (this.stickThumb) {
            this.stickThumb.style.left = `${thumbX}px`;
            this.stickThumb.style.top = `${thumbY}px`;
          }

          // Map joystick to steering:
          // Drag Left (dx < 0) -> Steer Left (steerVal < 0)
          // Drag Right (dx > 0) -> Steer Right (steerVal > 0)
          const steerVal = Math.max(-1, Math.min(1, dx / maxRadius));
          this.playerPhysics.steer = steerVal * 0.65;

          const pitchVal = dy / maxRadius;
          if (pitchVal < -0.3) {
            this.playerPhysics.keys.up = true;
            this.playerPhysics.keys.down = false;
          } else if (pitchVal > 0.3) {
            this.playerPhysics.keys.down = true;
            this.playerPhysics.keys.up = false;
          } else {
            this.playerPhysics.keys.up = false;
            this.playerPhysics.keys.down = false;
          }
          break;
        }
      }
    }, { passive: false });

    const endTouch = (e) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === this.touchId) {
          this.touchId = null;
          if (this.stickBase && this.stickThumb) {
            this.stickBase.style.display = "none";
            this.stickThumb.style.display = "none";
          }
          this.playerPhysics.keys.up = false;
          this.playerPhysics.keys.down = false;
          break;
        }
      }
    };

    this.touchZone.addEventListener("touchend", endTouch);
    this.touchZone.addEventListener("touchcancel", endTouch);
  }

  setupActionButtons() {
    const bindBtn = (id, callback) => {
      const btn = document.getElementById(id);
      if (!btn) return;
      btn.addEventListener("touchstart", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (this.audioSystem) this.audioSystem.unlockAndStart();
        callback();
      }, { passive: false });
    };

    bindBtn("btn-touch-shoot", () => {
      this.triggerHaptic("shoot");
      if (this.combatSystem) {
        this.combatSystem.shoot(
          { x: this.playerPhysics.x, y: 0, z: this.playerPhysics.z },
          window.__yetiEntity,
          this.audioSystem,
          this.sceneManager,
          window.__onGameEvent
        );
      }
    });

    bindBtn("btn-touch-bait", () => {
      this.triggerHaptic("rescue");
      if (this.combatSystem) {
        this.combatSystem.dropBait(
          { x: this.playerPhysics.x, z: this.playerPhysics.z },
          window.__yetiEntity,
          this.audioSystem,
          window.__onGameEvent
        );
      }
    });

    bindBtn("btn-touch-jump", () => {
      this.triggerHaptic("kicker");
      this.playerPhysics.triggerJump();
    });
  }

  triggerHaptic(type) {
    if (!navigator.vibrate) return;
    try {
      switch (type) {
        case 'shoot': navigator.vibrate(18); break;
        case 'gate': navigator.vibrate(20); break;
        case 'rescue': navigator.vibrate([30, 40, 50]); break;
        case 'kicker': navigator.vibrate(35); break;
        case 'damage': navigator.vibrate([60, 40, 60]); break;
        case 'bite': navigator.vibrate([120, 60, 180]); break;
      }
    } catch (e) {}
  }
}
