/**
 * MobileTouchController.ts (v4 - Pro Mobile Gaming Edition)
 * High-performance mobile touch overlay featuring:
 * - Dynamic Floating Virtual Joystick on the left half of the screen
 * - Decoupled steering and downhill tucking/braking with smooth deadzone
 * - Touch-drag weapon & camera aiming on the right half of the screen
 * - Window-level touch tracking (no stuck inputs when thumbs slide)
 * - Orientation-aware Gyro tilt steering (landscape & portrait)
 * - Non-blocking calibration feedback (zero JS alerts)
 * - Safe canvas transform matrix scaling without resize accumulation
 */

import { Observable } from '@babylonjs/core';

export interface TouchInputState {
  steerX: number;     // -1.0 (Hard Left) to +1.0 (Hard Right)
  throttleY: number;  // +1.0 (Downhill Tuck / Speed) to -1.0 (Snow Brake)
  isFiring: boolean;
  isRearview: boolean;
  isReloading: boolean;
  controlMode: 'joystick' | 'gyro';
  gyroActive: boolean;
}

export interface TouchAimDelta {
  deltaYaw: number;
  deltaPitch: number;
}

export interface MobileTouchControllerOptions {
  containerId?: string;
  onRearview?: (active: boolean) => void;
  onRearviewToggle?: (active: boolean) => void;
  onShoot?: () => void;
  onFire?: () => void;
  onReload?: () => void;
  onAimDelta?: (delta: TouchAimDelta) => void;
}

export class MobileTouchController {
  private container: HTMLElement;
  private leftZone!: HTMLElement;
  private rightZone!: HTMLElement;
  private joystickCanvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  // Floating Joystick Touch State
  private activeTouchId: number | null = null;
  private basePos = { x: 0, y: 0 };
  private currentPos = { x: 0, y: 0 };
  private maxRadius = 60; // Max displacement pixel radius
  private deadZoneRadius = 8;
  private joystickVisible: boolean = false;

  // Touch Aim Drag State (Right Zone)
  private aimTouchId: number | null = null;
  private lastAimPos = { x: 0, y: 0 };
  private aimSensitivity = 0.0035;

  // Gyro / DeviceOrientation State
  private gyroEnabled: boolean = false;
  private gammaZero: number = 0; // Baseline roll offset
  private betaZero: number = 45;  // Baseline pitch offset
  private gyroSensitivity: number = 0.04;
  private gyroCalibrated: boolean = false;

  // Public state consumed by Babylon Scene update loop
  public state: TouchInputState = {
    steerX: 0,
    throttleY: 0,
    isFiring: false,
    isRearview: false,
    isReloading: false,
    controlMode: 'joystick',
    gyroActive: false
  };

  // Babylon.js Observable pipeline for reactive event binding
  public onInputUpdatedObservable: Observable<TouchInputState> = new Observable<TouchInputState>();
  public onFireObservable: Observable<void> = new Observable<void>();
  public onReloadObservable: Observable<void> = new Observable<void>();
  public onRearviewToggleObservable: Observable<boolean> = new Observable<boolean>();
  public onAimDeltaObservable: Observable<TouchAimDelta> = new Observable<TouchAimDelta>();

  constructor(
    containerIdOrOptions: string | MobileTouchControllerOptions = 'mobile-touch-container',
    maybeOptions?: MobileTouchControllerOptions
  ) {
    let containerId = 'mobile-touch-container';
    let options: MobileTouchControllerOptions | undefined = maybeOptions;

    if (typeof containerIdOrOptions === 'string') {
      containerId = containerIdOrOptions;
    } else if (containerIdOrOptions && typeof containerIdOrOptions === 'object') {
      options = containerIdOrOptions;
      if (options.containerId) containerId = options.containerId;
    }

    let parent = document.getElementById(containerId);
    if (!parent) {
      parent = document.createElement('div');
      parent.id = containerId;
      document.body.appendChild(parent);
    }
    this.container = parent;

    this.joystickCanvas = document.createElement('canvas');
    this.ctx = this.joystickCanvas.getContext('2d')!;

    // Bind legacy options callbacks
    const rearCb = options?.onRearview || options?.onRearviewToggle;
    if (rearCb) {
      this.onRearviewToggleObservable.add((active) => rearCb(active));
    }
    const fireCb = options?.onShoot || options?.onFire;
    if (fireCb) {
      this.onFireObservable.add(() => fireCb());
    }
    if (options?.onReload) {
      this.onReloadObservable.add(() => options!.onReload!());
    }
    if (options?.onAimDelta) {
      this.onAimDeltaObservable.add((delta) => options!.onAimDelta!(delta));
    }

    this.initHUD();
    this.attachTouchListeners();
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
    window.addEventListener('orientationchange', () => {
      setTimeout(() => this.resizeCanvas(), 100);
    });
  }

  /**
   * Initializes the mobile overlay DOM elements.
   */
  private initHUD(): void {
    this.container.innerHTML = '';
    this.container.classList.add('mobile-hud-overlay');

    // Left Control Zone (Floating Joystick Canvas + Gyro Controls)
    this.leftZone = document.createElement('div');
    this.leftZone.className = 'touch-zone left-zone';

    this.joystickCanvas.className = 'joystick-canvas';
    this.leftZone.appendChild(this.joystickCanvas);

    // Gyro Controls Container
    const gyroBar = document.createElement('div');
    gyroBar.className = 'gyro-controls-bar';

    // Gyro Toggle Button
    const gyroBtn = document.createElement('button');
    gyroBtn.className = 'hud-btn gyro-toggle-btn';
    gyroBtn.setAttribute('type', 'button');
    gyroBtn.innerHTML = '📱 TILT: OFF';
    gyroBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleGyroMode(gyroBtn);
    });
    gyroBar.appendChild(gyroBtn);

    // Calibrate Gyro Button
    const calibBtn = document.createElement('button');
    calibBtn.className = 'hud-btn gyro-calib-btn hidden';
    calibBtn.setAttribute('type', 'button');
    calibBtn.innerHTML = '🎯 CALIBRATE';
    calibBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.calibrateGyro(calibBtn);
    });
    gyroBar.appendChild(calibBtn);

    // 1-Tap Camera Mode Toggle Button (Diablo 3rd-Person vs FPV)
    const camBtn = document.createElement('button');
    camBtn.className = 'hud-btn cam-toggle-btn';
    camBtn.setAttribute('type', 'button');
    camBtn.innerHTML = '👁️ CAM: 3RD';
    camBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (typeof (window as any).toggleCameraMode === 'function') {
        const newMode = (window as any).toggleCameraMode();
        camBtn.innerHTML = newMode === 'third_person' ? '👁️ CAM: 3RD' : '👁️ CAM: FPV';
      }
    });
    gyroBar.appendChild(camBtn);

    this.leftZone.appendChild(gyroBar);

    // Right Tactical Action Zone (Aim Drag Area + Action Buttons)
    this.rightZone = document.createElement('div');
    this.rightZone.className = 'touch-zone right-zone';

    // Action Buttons Cluster
    const actionCluster = document.createElement('div');
    actionCluster.className = 'action-cluster';

    // 180° Rearview Button (Toggle on tap for mobile comfort)
    const rearBtn = document.createElement('button');
    rearBtn.className = 'hud-btn rear-btn';
    rearBtn.setAttribute('type', 'button');
    rearBtn.innerHTML = '🔄 REAR 180°';
    rearBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.state.isRearview = !this.state.isRearview;
      if (this.state.isRearview) {
        rearBtn.classList.add('active');
      } else {
        rearBtn.classList.remove('active');
      }
      this.triggerHapticFeedback([20]);
      this.onRearviewToggleObservable.notifyObservers(this.state.isRearview);
      this.notifyStateChange();
    }, { passive: false });
    actionCluster.appendChild(rearBtn);

    // Reload Button
    const reloadBtn = document.createElement('button');
    reloadBtn.className = 'hud-btn reload-btn';
    reloadBtn.setAttribute('type', 'button');
    reloadBtn.innerHTML = '⚡ RELOAD';
    reloadBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      e.stopPropagation();
      reloadBtn.classList.add('active');
      setTimeout(() => reloadBtn.classList.remove('active'), 200);
      this.triggerHapticFeedback([30]);
      this.onReloadObservable.notifyObservers();
    }, { passive: false });
    actionCluster.appendChild(reloadBtn);

    // Fire Target Button
    const fireBtn = document.createElement('button');
    fireBtn.className = 'hud-btn fire-btn';
    fireBtn.setAttribute('type', 'button');
    fireBtn.innerHTML = '🎯 FIRE';
    fireBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.state.isFiring = true;
      fireBtn.classList.add('active');
      this.triggerHapticFeedback([35, 15, 35]);
      this.onFireObservable.notifyObservers();
      this.notifyStateChange();
    }, { passive: false });

    fireBtn.addEventListener('touchend', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.state.isFiring = false;
      fireBtn.classList.remove('active');
      this.notifyStateChange();
    }, { passive: false });

    fireBtn.addEventListener('touchcancel', () => {
      this.state.isFiring = false;
      fireBtn.classList.remove('active');
      this.notifyStateChange();
    });

    actionCluster.appendChild(fireBtn);
    this.rightZone.appendChild(actionCluster);

    this.container.appendChild(this.leftZone);
    this.container.appendChild(this.rightZone);
  }

  /**
   * Attaches window-level touch listeners for floating joystick and touch look.
   * Window-level listeners ensure thumbs never get "lost" when sliding across zones.
   */
  private attachTouchListeners(): void {
    // 1. TOUCH START (Left Zone = Floating Joystick, Right Zone = Touch Aim)
    this.leftZone.addEventListener('touchstart', (e: TouchEvent) => {
      if (this.state.controlMode === 'gyro') return;
      const target = e.target as HTMLElement;
      if (target.closest('.hud-btn')) return; // Ignore gyro buttons

      e.preventDefault();
      if (this.activeTouchId !== null) return;

      const touch = e.changedTouches[0];
      this.activeTouchId = touch.identifier;

      const rect = this.joystickCanvas.getBoundingClientRect();
      const clientX = touch.clientX - rect.left;
      const clientY = touch.clientY - rect.top;

      // Floating joystick: base snaps directly under thumb
      this.basePos = { x: clientX, y: clientY };
      this.currentPos = { x: clientX, y: clientY };
      this.joystickVisible = true;

      this.updateJoystickVector();
      this.drawJoystick();
    }, { passive: false });

    this.rightZone.addEventListener('touchstart', (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('.hud-btn')) return; // Let buttons handle their own touches

      e.preventDefault();
      if (this.aimTouchId !== null) return;

      const touch = e.changedTouches[0];
      this.aimTouchId = touch.identifier;
      this.lastAimPos = { x: touch.clientX, y: touch.clientY };
    }, { passive: false });

    // 2. TOUCH MOVE (Window-level to prevent edge-slip sticking)
    window.addEventListener('touchmove', (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];

        // Process Floating Joystick Movement
        if (touch.identifier === this.activeTouchId && this.state.controlMode !== 'gyro') {
          e.preventDefault();
          const rect = this.joystickCanvas.getBoundingClientRect();
          this.currentPos = {
            x: touch.clientX - rect.left,
            y: touch.clientY - rect.top
          };
          this.updateJoystickVector();
          this.drawJoystick();
        }

        // Process Touch Aim Drag Movement (Right Zone)
        if (touch.identifier === this.aimTouchId) {
          e.preventDefault();
          const dx = touch.clientX - this.lastAimPos.x;
          const dy = touch.clientY - this.lastAimPos.y;
          this.lastAimPos = { x: touch.clientX, y: touch.clientY };

          const deltaYaw = -dx * this.aimSensitivity;
          const deltaPitch = -dy * this.aimSensitivity;
          this.onAimDeltaObservable.notifyObservers({ deltaYaw, deltaPitch });
        }
      }
    }, { passive: false });

    // 3. TOUCH END & CANCEL (Window-level)
    const handleTouchEnd = (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];

        if (touch.identifier === this.activeTouchId) {
          this.activeTouchId = null;
          this.state.steerX = 0;
          this.state.throttleY = 0;
          this.joystickVisible = false;
          this.drawJoystick();
          this.notifyStateChange();
        }

        if (touch.identifier === this.aimTouchId) {
          this.aimTouchId = null;
        }
      }
    };

    window.addEventListener('touchend', handleTouchEnd, { passive: false });
    window.addEventListener('touchcancel', handleTouchEnd, { passive: false });
  }

  /**
   * Calculates decoupled steerX [-1, 1] and throttleY [-1, 1] vectors with deadzone.
   * Decoupling allows full tuck downhill speed even while hard turning!
   */
  private updateJoystickVector(): void {
    const dx = this.currentPos.x - this.basePos.x;
    const dy = this.currentPos.y - this.basePos.y;
    const distance = Math.hypot(dx, dy);

    // Apply deadzone
    if (distance < this.deadZoneRadius) {
      this.state.steerX = 0;
      this.state.throttleY = 0;
      this.notifyStateChange();
      return;
    }

    // Decoupled X steering with smooth progressive curve
    const activeRadius = Math.max(1, this.maxRadius - this.deadZoneRadius);
    const clampedDx = Math.max(-this.maxRadius, Math.min(this.maxRadius, dx));
    const normalizedX = Math.sign(clampedDx) * Math.min(1.0, Math.max(0, (Math.abs(clampedDx) - this.deadZoneRadius) / activeRadius));
    // Apply gentle curve for fine precision at small angles, snappy response at edges
    this.state.steerX = Number((Math.sign(normalizedX) * Math.pow(Math.abs(normalizedX), 1.15)).toFixed(2));

    // Decoupled Y throttle (Up = Tuck / +1.0, Down = Snowplow Brake / -1.0)
    const rawDy = -dy;
    const clampedDy = Math.max(-this.maxRadius, Math.min(this.maxRadius, rawDy));
    const normalizedY = Math.sign(clampedDy) * Math.min(1.0, Math.max(0, (Math.abs(clampedDy) - this.deadZoneRadius) / activeRadius));
    this.state.throttleY = Number(normalizedY.toFixed(2));

    this.notifyStateChange();
  }

  /**
   * Renders the virtual joystick canvas with high-DPI scaling.
   */
  private drawJoystick(): void {
    const rect = this.joystickCanvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    this.ctx.clearRect(0, 0, w, h);

    if (this.state.controlMode === 'gyro') {
      const centerX = w / 2;
      const centerY = h / 2;
      this.ctx.fillStyle = 'rgba(0, 240, 255, 0.12)';
      this.ctx.beginPath();
      this.ctx.arc(centerX, centerY, 52, 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.fillStyle = '#00f0ff';
      this.ctx.font = 'bold 12px monospace';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('📱 TILT STEERING ACTIVE', centerX, centerY - 6);
      this.ctx.font = '10px monospace';
      this.ctx.fillStyle = '#88a0c0';
      this.ctx.fillText(`STEER: ${this.state.steerX.toFixed(2)}  SPEED: ${this.state.throttleY.toFixed(2)}`, centerX, centerY + 14);
      return;
    }

    if (!this.joystickVisible || this.activeTouchId === null) {
      // Draw subtle default resting indicator in bottom-left thumb zone
      const defaultX = Math.min(90, w * 0.35);
      const defaultY = Math.max(h - 90, h * 0.65);

      this.ctx.beginPath();
      this.ctx.arc(defaultX, defaultY, 40, 0, Math.PI * 2);
      this.ctx.fillStyle = 'rgba(0, 240, 255, 0.04)';
      this.ctx.fill();
      this.ctx.lineWidth = 1.5;
      this.ctx.strokeStyle = 'rgba(0, 240, 255, 0.25)';
      this.ctx.setLineDash([4, 4]);
      this.ctx.stroke();
      this.ctx.setLineDash([]);

      this.ctx.font = '10px monospace';
      this.ctx.fillStyle = 'rgba(0, 240, 255, 0.4)';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('TOUCH TO STEER', defaultX, defaultY + 4);
      return;
    }

    const bx = this.basePos.x;
    const by = this.basePos.y;

    // Outer Ring Base
    this.ctx.beginPath();
    this.ctx.arc(bx, by, this.maxRadius, 0, Math.PI * 2);
    this.ctx.fillStyle = 'rgba(10, 20, 35, 0.55)';
    this.ctx.fill();
    this.ctx.lineWidth = 2.5;
    this.ctx.strokeStyle = 'rgba(0, 240, 255, 0.7)';
    this.ctx.shadowColor = '#00f0ff';
    this.ctx.shadowBlur = 10;
    this.ctx.stroke();
    this.ctx.shadowBlur = 0;

    // Center Deadzone Ring
    this.ctx.beginPath();
    this.ctx.arc(bx, by, this.deadZoneRadius, 0, Math.PI * 2);
    this.ctx.strokeStyle = 'rgba(0, 240, 255, 0.25)';
    this.ctx.lineWidth = 1;
    this.ctx.stroke();

    // Inner Active Nub Position
    const dx = this.currentPos.x - bx;
    const dy = this.currentPos.y - by;
    const dist = Math.hypot(dx, dy);
    const clampedDist = Math.min(dist, this.maxRadius);
    const angle = Math.atan2(dy, dx);

    const nubX = bx + Math.cos(angle) * clampedDist;
    const nubY = by + Math.sin(angle) * clampedDist;

    // Connecting Directional Vector Line
    this.ctx.beginPath();
    this.ctx.moveTo(bx, by);
    this.ctx.lineTo(nubX, nubY);
    this.ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
    this.ctx.lineWidth = 2;
    this.ctx.stroke();

    // Inner Joystick Knob
    this.ctx.beginPath();
    this.ctx.arc(nubX, nubY, 26, 0, Math.PI * 2);
    this.ctx.fillStyle = 'rgba(0, 240, 255, 0.85)';
    this.ctx.fill();
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 2;
    this.ctx.shadowColor = '#00f0ff';
    this.ctx.shadowBlur = 12;
    this.ctx.stroke();
    this.ctx.shadowBlur = 0;
  }

  /**
   * Toggles DeviceOrientation gyro motion controls with iOS permission handling.
   */
  public async toggleGyroMode(btn: HTMLButtonElement): Promise<void> {
    if (!this.gyroEnabled) {
      if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
        try {
          const permission = await (DeviceOrientationEvent as any).requestPermission();
          if (permission !== 'granted') {
            btn.innerHTML = '❌ DENIED';
            setTimeout(() => { btn.innerHTML = '📱 TILT: OFF'; }, 2000);
            return;
          }
        } catch (err) {
          console.error('Error requesting DeviceOrientation permission:', err);
          return;
        }
      }

      this.gyroEnabled = true;
      this.gyroCalibrated = false;
      this.state.controlMode = 'gyro';
      this.state.gyroActive = true;
      btn.innerHTML = '📱 TILT: ON';
      btn.classList.add('active');

      const calibBtn = this.container.querySelector('.gyro-calib-btn');
      if (calibBtn) calibBtn.classList.remove('hidden');

      this.attachGyroListener();
      this.triggerHapticFeedback([30]);
    } else {
      this.gyroEnabled = false;
      this.state.controlMode = 'joystick';
      this.state.gyroActive = false;
      btn.innerHTML = '📱 TILT: OFF';
      btn.classList.remove('active');

      const calibBtn = this.container.querySelector('.gyro-calib-btn');
      if (calibBtn) calibBtn.classList.add('hidden');

      window.removeEventListener('deviceorientation', this.handleGyroMotion);
      this.state.steerX = 0;
      this.state.throttleY = 0;
      this.drawJoystick();
      this.notifyStateChange();
      this.triggerHapticFeedback([15]);
    }
  }

  /**
   * Calibrates current holding position as baseline with non-blocking feedback.
   */
  public calibrateGyro(btn?: HTMLButtonElement): void {
    this.gyroCalibrated = false;
    this.triggerHapticFeedback([40, 20, 40]);
    if (btn) {
      const original = btn.innerHTML;
      btn.innerHTML = '✅ CALIBRATED';
      btn.classList.add('active');
      setTimeout(() => {
        btn.innerHTML = original;
        btn.classList.remove('active');
      }, 1500);
    }
  }

  /**
   * Listens to DeviceOrientation events and translates tilt into steering vectors.
   * Accurately handles Landscape vs Portrait orientation coordinate axes!
   */
  private attachGyroListener(): void {
    this.handleGyroMotion = (event: DeviceOrientationEvent) => {
      if (!this.gyroEnabled) return;

      const gamma = event.gamma || 0; // Roll (-90 to 90)
      const beta = event.beta || 0;   // Pitch (-180 to 180)

      if (!this.gyroCalibrated) {
        this.gammaZero = gamma;
        this.betaZero = beta;
        this.gyroCalibrated = true;
      }

      // Check orientation: in landscape mode, beta controls steering and gamma controls pitch!
      const isLandscape = window.innerWidth > window.innerHeight;

      let deltaSteer = 0;
      let deltaThrottle = 0;

      if (isLandscape) {
        // Landscape holding: tilting phone left/right shifts beta
        const rawBetaDelta = beta - this.betaZero;
        const isLandscapeInverted = window.screen && window.screen.orientation && window.screen.orientation.type.includes('secondary');
        deltaSteer = isLandscapeInverted ? -rawBetaDelta : rawBetaDelta;
        deltaThrottle = -(gamma - this.gammaZero);
      } else {
        // Portrait holding: gamma is roll (steering), beta is pitch (tuck/brake)
        deltaSteer = gamma - this.gammaZero;
        deltaThrottle = -(beta - this.betaZero);
      }

      // Map angles to [-1.0, 1.0]
      this.state.steerX = Math.max(-1.0, Math.min(1.0, Number((deltaSteer * this.gyroSensitivity).toFixed(2))));
      this.state.throttleY = Math.max(-1.0, Math.min(1.0, Number((deltaThrottle * this.gyroSensitivity).toFixed(2))));

      this.drawJoystick();
      this.notifyStateChange();
    };

    window.addEventListener('deviceorientation', this.handleGyroMotion, false);
  }

  private handleGyroMotion = (event: DeviceOrientationEvent) => {};

  /**
   * Resizes the joystick canvas dynamically for high-DPI screens without accumulating transform scale.
   */
  private resizeCanvas(): void {
    const rect = this.leftZone.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2); // Cap at 2 to conserve GPU memory

    const w = Math.max(120, Math.floor(rect.width));
    const h = Math.max(120, Math.floor(rect.height));

    this.joystickCanvas.width = w * dpr;
    this.joystickCanvas.height = h * dpr;
    this.joystickCanvas.style.width = `${w}px`;
    this.joystickCanvas.style.height = `${h}px`;

    // CRITICAL: Reset transform before scaling to prevent compounded scale distortions!
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(dpr, dpr);

    this.drawJoystick();
  }

  public triggerHapticFeedback(pattern: number[]): void {
    if ('vibrate' in navigator && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(pattern);
      } catch {
        // Haptics not allowed without user activation
      }
    }
  }

  private notifyStateChange(): void {
    this.onInputUpdatedObservable.notifyObservers(this.state);
  }
}
