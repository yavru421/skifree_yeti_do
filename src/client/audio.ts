/**
 * SkiFree Yeti DO - Spatial Audio & Sound System
 * Manages background waltz music stream and WebAudio synthesized SFX:
 * ski snow carving, rifle report, Yeti growl/roar, limb bite impacts, and wipeout crashes.
 */

export class AudioSystem {
  private ctx: AudioContext | null = null;
  private bgmAudio: HTMLAudioElement | null = null;
  private isMuted: boolean = false;

  constructor() {
    // Initialized on first user interaction
  }

  public init(): void {
    if (this.ctx) return;
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      this.ctx = new AudioContextClass();
    }

    // Background Waltz Stream
    this.bgmAudio = new Audio("/assets/media/waltz_on_the_slope.mp3");
    this.bgmAudio.loop = true;
    this.bgmAudio.volume = 0.35;
  }

  public startBGM(): void {
    if (this.bgmAudio && !this.isMuted) {
      this.bgmAudio.play().catch(() => {
        // Autoplay policy: wait for click
      });
    }
  }

  private lastCarveTime: number = 0;

  public playSkiCarve(speedRatio: number): void {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    if (now - this.lastCarveTime < 0.08) return; // Throttle to max 12.5Hz to prevent WebAudio node flooding
    this.lastCarveTime = now;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      filter.type = "bandpass";
      filter.frequency.value = 450 + speedRatio * 350;
      filter.Q.value = 1.8;

      osc.type = "sawtooth";
      osc.frequency.value = 65 + speedRatio * 40;

      gain.gain.setValueAtTime(0.04 * speedRatio, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(now + 0.18);
    } catch {
      // Ignore WebAudio dropouts
    }
  }

  public playRifleShot(): void {
    if (!this.ctx || this.isMuted) return;
    try {
      // White noise blast + low resonant thump
      const bufferSize = this.ctx.sampleRate * 0.35;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.05));
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(2200, this.ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(180, this.ctx.currentTime + 0.3);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.4, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.35);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      noise.start();
    } catch {
      // Audio fallback
    }
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
      // Traditional Alpine Horn / Mountain Starting Horn Brass Fanfare
      // Natural harmonic series: C4 (261.63Hz), E4 (329.63Hz), G4 (392.00Hz), C5 (523.25Hz)
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
