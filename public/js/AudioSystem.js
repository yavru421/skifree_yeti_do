// public/js/AudioSystem.js
// Autonomous WebAudio Alpine SFX Engine & MP3 Soundtrack Layer

export class AudioSystem {
  constructor() {
    this.ctx = null;
    this.windGain = null;
    this.windFilter = null;
    this.carveGain = null;
    this.isInitialized = false;
    this.isSoundOn = true;
    this.bgMusic = null;
  }

  unlockAndStart() {
    if (!this.isInitialized) this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    if (this.bgMusic && this.isSoundOn && this.bgMusic.paused) {
      this.bgMusic.play().catch(() => {});
    }
  }

  init() {
    if (this.isInitialized) {
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
      if (this.bgMusic && this.isSoundOn && this.bgMusic.paused) {
        this.bgMusic.play().catch(() => {});
      }
      return;
    }
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();

      const bufferSize = this.ctx.sampleRate * 2;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = (Math.random() * 2 - 1) * 0.5;
      }

      // Wind stream
      const whiteNoise = this.ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;
      whiteNoise.loop = true;
      this.windFilter = this.ctx.createBiquadFilter();
      this.windFilter.type = 'bandpass';
      this.windFilter.frequency.value = 450;
      this.windFilter.Q.value = 3.0;
      this.windGain = this.ctx.createGain();
      this.windGain.gain.value = 0.08;
      whiteNoise.connect(this.windFilter);
      this.windFilter.connect(this.windGain);
      this.windGain.connect(this.ctx.destination);
      whiteNoise.start();

      // Ski Carve crunch stream
      const carveNoise = this.ctx.createBufferSource();
      carveNoise.buffer = noiseBuffer;
      carveNoise.loop = true;
      const carveFilter = this.ctx.createBiquadFilter();
      carveFilter.type = 'highpass';
      carveFilter.frequency.value = 1400;
      this.carveGain = this.ctx.createGain();
      this.carveGain.gain.value = 0.02;
      carveNoise.connect(carveFilter);
      carveFilter.connect(this.carveGain);
      this.carveGain.connect(this.ctx.destination);
      carveNoise.start();

      // Load & Stream the Authentic Recorded Soundtrack
      this.bgMusic = new Audio('/assets/media/waltz_on_the_slope.mp3');
      this.bgMusic.loop = true;
      this.bgMusic.volume = 0.45;
      if (this.isSoundOn) {
        this.bgMusic.play().catch(() => {
          // Will unlock on first click/touch
        });
      }

      this.isInitialized = true;
    } catch (e) {
      console.warn("AudioContext init error:", e);
    }
  }

  toggleSound() {
    this.isSoundOn = !this.isSoundOn;
    if (this.bgMusic) {
      if (this.isSoundOn) {
        this.bgMusic.play().catch(() => {});
      } else {
        this.bgMusic.pause();
      }
    }
    return this.isSoundOn;
  }

  playGunshot() {
    if (!this.ctx || !this.isSoundOn) return;
    this.unlockAndStart();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(480, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(75, this.ctx.currentTime + 0.16);
    gain.gain.setValueAtTime(0.95, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.18);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.18);
  }

  playReload() {
    if (!this.ctx || !this.isSoundOn) return;
    this.unlockAndStart();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(350, this.ctx.currentTime);
    osc.frequency.setValueAtTime(600, this.ctx.currentTime + 0.15);
    osc.frequency.setValueAtTime(900, this.ctx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.4);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.4);
  }

  playBiteChomp() {
    if (!this.ctx || !this.isSoundOn) return;
    this.unlockAndStart();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(350, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(35, this.ctx.currentTime + 0.28);
    gain.gain.setValueAtTime(1.0, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.32);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.32);
  }

  playYetiRoar() {
    if (!this.ctx || !this.isSoundOn) return;
    this.unlockAndStart();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(110, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(260, this.ctx.currentTime + 0.2);
    osc.frequency.exponentialRampToValueAtTime(45, this.ctx.currentTime + 0.6);
    gain.gain.setValueAtTime(1.0, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.65);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.65);
  }

  playSkierScream() {
    if (!this.ctx || !this.isSoundOn) return;
    this.unlockAndStart();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(750, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(220, this.ctx.currentTime + 0.35);
    gain.gain.setValueAtTime(0.7, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.4);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.4);
  }

  playRescueFanfare() {
    if (!this.ctx || !this.isSoundOn) return;
    this.unlockAndStart();
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const t = this.ctx.currentTime + idx * 0.08;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.8, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.25);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.26);
    });
  }

  playHitFlesh() {
    if (!this.ctx || !this.isSoundOn) return;
    this.unlockAndStart();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(280, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(55, this.ctx.currentTime + 0.14);
    gain.gain.setValueAtTime(0.9, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.16);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.16);
  }

  playGateChime() {
    if (!this.ctx || !this.isSoundOn) return;
    this.unlockAndStart();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(650, this.ctx.currentTime);
    osc.frequency.setValueAtTime(1050, this.ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.8, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.3);
  }

  playBigAirWhoosh() {
    if (!this.ctx || !this.isSoundOn) return;
    this.unlockAndStart();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(650, this.ctx.currentTime + 0.35);
    gain.gain.setValueAtTime(0.9, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.4);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.4);
  }

  playRailGrind() {
    if (!this.ctx || !this.isSoundOn) return;
    this.unlockAndStart();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(700, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(850, this.ctx.currentTime + 0.25);
    gain.gain.setValueAtTime(0.45, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.28);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.28);
  }

  playTreeThud() {
    if (!this.ctx || !this.isSoundOn) return;
    this.unlockAndStart();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(150, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(25, this.ctx.currentTime + 0.32);
    gain.gain.setValueAtTime(1.0, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.38);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.38);
  }

  updateSpeed(speedMph, carveAngleRad) {
    if (!this.ctx || !this.isSoundOn) return;
    const ratio = Math.min(1.0, speedMph / 60);
    if (this.windFilter && this.windGain) {
      this.windFilter.frequency.setTargetAtTime(300 + ratio * 1600, this.ctx.currentTime, 0.05);
      this.windGain.gain.setTargetAtTime(0.04 + ratio * 0.35, this.ctx.currentTime, 0.05);
    }
    if (this.carveGain) {
      const sidewaysFactor = Math.abs(Math.sin(carveAngleRad));
      const carveVolume = Math.min(0.45, (sidewaysFactor * 0.35) + (speedMph / 50 * 0.1));
      this.carveGain.gain.setTargetAtTime(carveVolume, this.ctx.currentTime, 0.05);
    }
  }

  toggleSound() {
    this.isSoundOn = !this.isSoundOn;
    if (this.ctx) {
      if (this.isSoundOn) {
        this.ctx.resume();
      } else {
        this.ctx.suspend();
      }
    }
    return this.isSoundOn;
  }
}
