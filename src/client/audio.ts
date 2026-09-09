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

  public playSkiCarve(speedRatio: number): void {
    if (!this.ctx || this.isMuted) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      filter.type = "bandpass";
      filter.frequency.value = 450 + speedRatio * 350;
      filter.Q.value = 1.8;

      osc.type = "sawtooth";
      osc.frequency.value = 65 + speedRatio * 40;

      gain.gain.setValueAtTime(0.04 * speedRatio, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.18);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.18);
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

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.bgmAudio) {
      this.bgmAudio.muted = this.isMuted;
    }
    return this.isMuted;
  }
}
