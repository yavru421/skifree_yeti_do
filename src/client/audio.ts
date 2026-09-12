/**
 * SkiFree Yeti DO - Spatial Audio & Sound System
 * Manages background waltz music stream and WebAudio synthesized SFX:
 * ski snow carving, rifle report, Yeti growl/roar, limb bite impacts,
 * CS:GO & Fortnite high-impact audio punches, hitmarker chimes, and wipeout crashes.
 */

export class AudioSystem {
  private ctx: AudioContext | null = null;
  private bgmAudio: HTMLAudioElement | null = null;
  private isMuted: boolean = false;
  private windGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private windSource: AudioBufferSourceNode | null = null;
  private lastFootfallTime: number = 0;

  constructor() {
    // Initialized on first user interaction
  }

  public init(): void {
    if (this.ctx) return;
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      this.ctx = new AudioContextClass();
      this.initWindRush();
    }

    // Background Waltz Stream (optional graceful fallback)
    try {
      this.bgmAudio = new Audio("/assets/media/waltz_on_the_slope.mp3");
      this.bgmAudio.loop = true;
      this.bgmAudio.volume = 0.35;
    } catch {}
  }

  private initWindRush(): void {
    if (!this.ctx) return;
    try {
      // 2-second procedural pink noise loop for dynamic downhill wind rush
      const bufferSize = this.ctx.sampleRate * 2;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        data[i] = (b0 + b1 + b2 + white * 0.5362) * 0.12;
      }

      this.windSource = this.ctx.createBufferSource();
      this.windSource.buffer = noiseBuffer;
      this.windSource.loop = true;

      this.windFilter = this.ctx.createBiquadFilter();
      this.windFilter.type = "lowpass";
      this.windFilter.frequency.value = 160;
      this.windFilter.Q.value = 1.2;

      this.windGain = this.ctx.createGain();
      this.windGain.gain.value = 0.0;

      this.windSource.connect(this.windFilter);
      this.windFilter.connect(this.windGain);
      this.windGain.connect(this.ctx.destination);

      this.windSource.start();
    } catch {
      // Ignore initial autoplay restrictions
    }
  }

  public updateWindRush(speedMph: number): void {
    if (!this.ctx || !this.windGain || !this.windFilter || this.isMuted) return;
    const now = this.ctx.currentTime;
    const normSpeed = Math.max(0, Math.min(1.0, (speedMph - 18) / 62));
    const targetGain = Math.pow(normSpeed, 1.25) * 0.32;
    const targetFreq = 160 + normSpeed * 750;

    this.windGain.gain.setTargetAtTime(targetGain, now, 0.08);
    this.windFilter.frequency.setTargetAtTime(targetFreq, now, 0.08);
  }

  public startBGM(): void {
    if (this.bgmAudio && !this.isMuted) {
      this.bgmAudio.play().catch(() => {
        // Autoplay policy: wait for click
      });
    }
  }

  private lastCarveTime: number = 0;

  /**
   * Procedural Alpine Snow Carve:
   * Bandpass-filtered white noise where center frequency dynamically pitches up
   * during sharp carves ($550Hz -> 2200Hz).
   */
  public playSkiCarve(speedRatio: number, sharpness: number = 1.0): void {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    if (now - this.lastCarveTime < 0.07) return; // Max ~14Hz
    this.lastCarveTime = now;
    try {
      const bufferSize = Math.floor(this.ctx.sampleRate * 0.16);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.04));
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 520 + speedRatio * 850 + sharpness * 650;
      filter.Q.value = 2.2;

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.09 * speedRatio * Math.max(0.6, sharpness), now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      noise.start(now);
      noise.stop(now + 0.16);
    } catch {
      // Ignore WebAudio dropouts
    }
  }

  /**
   * Sub-Bass Resonant Rumble when the Yeti lands heavy footfalls nearby:
   * 54Hz -> 22Hz bass punch + snow compaction transient.
   */
  public playYetiFootfall(distMeters: number): void {
    if (!this.ctx || this.isMuted || distMeters > 45) return;
    const now = this.ctx.currentTime;
    if (now - this.lastFootfallTime < 0.28) return;
    this.lastFootfallTime = now;

    try {
      const proximity = Math.max(0, 1 - distMeters / 45);
      const volume = Math.pow(proximity, 1.3) * 0.65;

      const subOsc = this.ctx.createOscillator();
      const subGain = this.ctx.createGain();
      subOsc.type = "sine";
      subOsc.frequency.setValueAtTime(54, now);
      subOsc.frequency.exponentialRampToValueAtTime(22, now + 0.26);

      subGain.gain.setValueAtTime(volume, now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

      subOsc.connect(subGain);
      subGain.connect(this.ctx.destination);
      subOsc.start(now);
      subOsc.stop(now + 0.28);
    } catch {}
  }

  public playJumpWhoosh(): void {
    if (!this.ctx || this.isMuted) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      filter.type = "bandpass";
      filter.frequency.setValueAtTime(320, now);
      filter.frequency.exponentialRampToValueAtTime(950, now + 0.12);
      filter.frequency.exponentialRampToValueAtTime(300, now + 0.35);
      filter.Q.value = 1.5;

      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(80, now);
      osc.frequency.exponentialRampToValueAtTime(220, now + 0.15);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.35);
    } catch {}
  }

  public playJumpLanding(): void {
    if (!this.ctx || this.isMuted) return;
    try {
      const now = this.ctx.currentTime;
      const subOsc = this.ctx.createOscillator();
      const subGain = this.ctx.createGain();
      subOsc.type = "sine";
      subOsc.frequency.setValueAtTime(75, now);
      subOsc.frequency.exponentialRampToValueAtTime(32, now + 0.18);
      subGain.gain.setValueAtTime(0.45, now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      subOsc.connect(subGain);
      subGain.connect(this.ctx.destination);
      subOsc.start(now);
      subOsc.stop(now + 0.2);
    } catch {}
  }

  /**
   * High-Impact Rifle Report Punch:
   * Layered CS:GO / Fortnite style weapon discharge with sub-bass kick,
   * supersonic crack, and mechanical chamber transient.
   */
  public playRifleShot(): void {
    if (!this.ctx || this.isMuted) return;
    try {
      const now = this.ctx.currentTime;

      // 1. Low-end Sub-Bass Punch (58Hz -> 24Hz thump)
      const subOsc = this.ctx.createOscillator();
      const subGain = this.ctx.createGain();
      subOsc.type = "sine";
      subOsc.frequency.setValueAtTime(62, now);
      subOsc.frequency.exponentialRampToValueAtTime(26, now + 0.22);
      subGain.gain.setValueAtTime(0.65, now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      subOsc.connect(subGain);
      subGain.connect(this.ctx.destination);
      subOsc.start(now);
      subOsc.stop(now + 0.25);

      // 2. Supersonic Crack / Noise Blast
      const bufferSize = Math.floor(this.ctx.sampleRate * 0.3);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.045));
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(2800, now);
      filter.frequency.exponentialRampToValueAtTime(160, now + 0.28);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.55, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      noise.start(now);

      // 3. Metallic Chamber Transient
      const metalOsc = this.ctx.createOscillator();
      const metalGain = this.ctx.createGain();
      metalOsc.type = "triangle";
      metalOsc.frequency.setValueAtTime(1600, now);
      metalOsc.frequency.exponentialRampToValueAtTime(320, now + 0.08);
      metalGain.gain.setValueAtTime(0.25, now);
      metalGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      metalOsc.connect(metalGain);
      metalGain.connect(this.ctx.destination);
      metalOsc.start(now);
      metalOsc.stop(now + 0.08);
    } catch {
      // Audio fallback
    }
  }

  /**
   * Crisp Competitive Hitmarker Chime:
   * Body hit = Crisp high-frequency 2400Hz acoustic tick
   * Headshot = Distinctive dual-harmonic gold chime (3200Hz + 4800Hz)
   */
  public playHitmarker(isHeadshot: boolean = false): void {
    if (!this.ctx || this.isMuted) return;
    try {
      const now = this.ctx.currentTime;
      if (isHeadshot) {
        // Gold Headshot: Resonant dual ping
        [3200, 4800].forEach((freq) => {
          const osc = this.ctx!.createOscillator();
          const gain = this.ctx!.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, now);
          gain.gain.setValueAtTime(0.35, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
          osc.connect(gain);
          gain.connect(this.ctx!.destination);
          osc.start(now);
          osc.stop(now + 0.14);
        });
      } else {
        // White Body Hit: Sharp crisp click
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(2400, now);
        osc.frequency.exponentialRampToValueAtTime(1200, now + 0.05);
        gain.gain.setValueAtTime(0.38, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.05);
      }
    } catch {}
  }

  /**
   * Weapon Reload SFX (mechanical latch click and bolt rack)
   */
  public playReload(): void {
    if (!this.ctx || this.isMuted) return;
    try {
      const now = this.ctx.currentTime;
      // 1. Initial magazine eject latch click
      const clickOsc = this.ctx.createOscillator();
      const clickGain = this.ctx.createGain();
      clickOsc.type = "triangle";
      clickOsc.frequency.setValueAtTime(800, now);
      clickOsc.frequency.exponentialRampToValueAtTime(200, now + 0.08);
      clickGain.gain.setValueAtTime(0.3, now);
      clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      clickOsc.connect(clickGain);
      clickGain.connect(this.ctx.destination);
      clickOsc.start(now);
      clickOsc.stop(now + 0.08);

      // 2. Final chamber rack at +1.2s
      const rackTime = now + 1.2;
      const rackOsc = this.ctx.createOscillator();
      const rackGain = this.ctx.createGain();
      rackOsc.type = "sawtooth";
      rackOsc.frequency.setValueAtTime(1400, rackTime);
      rackOsc.frequency.exponentialRampToValueAtTime(450, rackTime + 0.12);
      rackGain.gain.setValueAtTime(0.35, rackTime);
      rackGain.gain.exponentialRampToValueAtTime(0.001, rackTime + 0.14);
      rackOsc.connect(rackGain);
      rackGain.connect(this.ctx.destination);
      rackOsc.start(rackTime);
      rackOsc.stop(rackTime + 0.14);
    } catch {}
  }

  public playWipeout(): void {
    if (!this.ctx || this.isMuted) return;
    try {
      // Heavy crunch / physical impact noise
      const bufferSize = Math.floor(this.ctx.sampleRate * 0.45);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.08));
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(850, this.ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(75, this.ctx.currentTime + 0.4);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.65, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.45);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      noise.start();
    } catch {
      // Audio fallback
    }
  }

  public playYetiRoar(): void {
    if (!this.ctx || this.isMuted) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(140, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(45, this.ctx.currentTime + 0.8);

      gain.gain.setValueAtTime(0.35, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.85);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.85);
    } catch {
      // Audio fallback
    }
  }

  public playArmorDeflect(): void {
    if (!this.ctx || this.isMuted) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(1800, now);
      osc.frequency.exponentialRampToValueAtTime(600, now + 0.15);
      gain.gain.setValueAtTime(0.45, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.18);
    } catch {}
  }

  public playAlpineHorn(): void {
    if (!this.ctx || this.isMuted) return;
    try {
      const now = this.ctx.currentTime;
      const notes = [
        { freq: 261.63, start: 0.0, dur: 0.22, gain: 0.32 },
        { freq: 329.63, start: 0.18, dur: 0.22, gain: 0.35 },
        { freq: 392.00, start: 0.36, dur: 0.25, gain: 0.38 },
        { freq: 523.25, start: 0.58, dur: 0.65, gain: 0.45 },
      ];

      for (const n of notes) {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(n.freq, now + n.start);

        filter.type = "lowpass";
        filter.frequency.setValueAtTime(n.freq * 4.5, now + n.start);
        filter.frequency.exponentialRampToValueAtTime(n.freq * 1.5, now + n.start + n.dur);
        filter.Q.value = 2.5;

        g.gain.setValueAtTime(0.001, now + n.start);
        g.gain.linearRampToValueAtTime(n.gain, now + n.start + 0.04);
        g.gain.exponentialRampToValueAtTime(0.001, now + n.start + n.dur);

        osc.connect(filter);
        filter.connect(g);
        g.connect(this.ctx.destination);

        osc.start(now + n.start);
        osc.stop(now + n.start + n.dur);
      }
    } catch {
      // Audio fallback
    }
  }

  public playDropIn(): void {
    if (!this.ctx || this.isMuted) return;
    this.playAlpineHorn();
    try {
      const now = this.ctx.currentTime;
      [0, 0.14, 0.28].forEach((t, i) => {
        const osc = this.ctx!.createOscillator();
        const g = this.ctx!.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(i === 2 ? 1400 : 880, now + t);
        g.gain.setValueAtTime(0.22, now + t);
        g.gain.exponentialRampToValueAtTime(0.001, now + t + 0.1);
        osc.connect(g);
        g.connect(this.ctx!.destination);
        osc.start(now + t);
        osc.stop(now + t + 0.1);
      });

      const whooshOsc = this.ctx.createOscillator();
      const whooshGain = this.ctx.createGain();
      whooshOsc.type = "sawtooth";
      whooshOsc.frequency.setValueAtTime(320, now + 0.38);
      whooshOsc.frequency.exponentialRampToValueAtTime(70, now + 0.9);
      whooshGain.gain.setValueAtTime(0.35, now + 0.38);
      whooshGain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
      whooshOsc.connect(whooshGain);
      whooshGain.connect(this.ctx.destination);
      whooshOsc.start(now + 0.38);
      whooshOsc.stop(now + 0.9);
    } catch {}
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.bgmAudio) {
      this.bgmAudio.muted = this.isMuted;
    }
    return this.isMuted;
  }
}
