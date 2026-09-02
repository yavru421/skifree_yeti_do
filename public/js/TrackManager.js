// public/js/TrackManager.js
// Modular Mountain Biomes & Procedural Track Manifests for SkiFree 2

export const TRACK_MANIFESTS = {
  alpine: {
    id: "alpine",
    name: "ALPS CLASSIC 1991",
    subtitle: "Sun-drenched Granby peak, retro pine slalom corridor & wild yetis.",
    skyColor: 0x89b6dc,
    fogColor: 0x9fc0e2,
    fogDensity: 0.0035,
    snowColor: 0xffffff,
    finishDistance: 1200,
    slopeIncline: 0.0,
    ambientLight: 0xffffff,
    ambientIntensity: 0.85,
    sunLight: 0xfff0dd,
    sunIntensity: 1.1,
    hazards: ["yeti", "trees", "ice"],
    features: {
      trees: { count: 320, minZ: 30, maxZ: 1180, spreadX: 65 },
      kickers: { count: 14, minZ: 300, spacing: 85 },
      rails: { count: 7, minZ: 450, spacing: 120 },
      icePatches: { count: 6, minZ: 500, spacing: 140 },
      slalomGates: { count: 28, minZ: 220, spacing: 35, width: 14 },
      crevasses: []
    }
  },

  avalanche: {
    id: "avalanche",
    name: "BLACK DIAMOND AVALANCHE",
    subtitle: "Blizzard whiteout survival run. A massive snow wall is descending behind you!",
    skyColor: 0x3a4856,
    fogColor: 0x47586a,
    fogDensity: 0.0075,
    snowColor: 0xe0e8f0,
    finishDistance: 1500,
    slopeIncline: -0.15,
    ambientLight: 0x8899aa,
    ambientIntensity: 0.65,
    sunLight: 0xaaccff,
    sunIntensity: 0.6,
    hazards: ["avalanche_wall", "tumbling_boulders", "yeti_frenzy"],
    avalancheSpeed: 44, // Initial MPH of descending snow wall
    features: {
      trees: { count: 180, minZ: 40, maxZ: 1480, spreadX: 75 },
      kickers: { count: 18, minZ: 200, spacing: 70 },
      rails: { count: 4, minZ: 600, spacing: 200 },
      icePatches: { count: 12, minZ: 250, spacing: 90 },
      slalomGates: { count: 14, minZ: 300, spacing: 80, width: 16 },
      boulders: { count: 35, minZ: 100, spacing: 40 },
      crevasses: []
    }
  },

  neon_glacier: {
    id: "neon_glacier",
    name: "NEON GLACIER GAUNTLET",
    subtitle: "Midnight twilight crevasse sprint with bioluminescent gates & black ice chutes.",
    skyColor: 0x050814,
    fogColor: 0x090f24,
    fogDensity: 0.0045,
    snowColor: 0x6688aa,
    finishDistance: 1400,
    slopeIncline: -0.05,
    ambientLight: 0x00f0ff,
    ambientIntensity: 0.55,
    sunLight: 0xff0077,
    sunIntensity: 0.9,
    hazards: ["glacier_crevasses", "black_ice", "yeti"],
    features: {
      trees: { count: 240, minZ: 50, maxZ: 1350, spreadX: 70, neonTint: true },
      kickers: { count: 20, minZ: 180, spacing: 60, neonGlow: true },
      rails: { count: 10, minZ: 300, spacing: 100, neonGlow: true },
      icePatches: { count: 16, minZ: 200, spacing: 75, blackIce: true },
      slalomGates: { count: 32, minZ: 150, spacing: 38, width: 13, neonGlow: true },
      crevasses: [
        { z: 420, width: 18, depth: 15 },
        { z: 750, width: 22, depth: 20 },
        { z: 1050, width: 25, depth: 22 }
      ]
    }
  },

  terrain_park: {
    id: "terrain_park",
    name: "X-GAMES FREESTYLE PARK",
    subtitle: "Continuous kicker ramps, halfpipes, rainbow grind rails & mega trick combos.",
    skyColor: 0x5e9cd4,
    fogColor: 0x82b8ea,
    fogDensity: 0.0025,
    snowColor: 0xf4f8ff,
    finishDistance: 1300,
    slopeIncline: 0.0,
    ambientLight: 0xffffff,
    ambientIntensity: 0.95,
    sunLight: 0xffeebb,
    sunIntensity: 1.2,
    hazards: ["yeti"],
    features: {
      trees: { count: 110, minZ: 100, maxZ: 1250, spreadX: 80 },
      kickers: { count: 26, minZ: 120, spacing: 45, megaBoost: true },
      rails: { count: 18, minZ: 180, spacing: 60, rainbowRails: true },
      icePatches: { count: 4, minZ: 600, spacing: 150 },
      slalomGates: { count: 16, minZ: 200, spacing: 65, width: 18 },
      halfpipe: { enabled: true, startZ: 350, endZ: 850, width: 28, height: 5.5 },
      crevasses: []
    }
  }
};

export class TrackManager {
  constructor() {
    this.currentTrackId = "alpine";
    this.track = TRACK_MANIFESTS.alpine;
  }

  setTrack(trackId) {
    if (TRACK_MANIFESTS[trackId]) {
      this.currentTrackId = trackId;
      this.track = TRACK_MANIFESTS[trackId];
      return this.track;
    }
    return this.track;
  }

  getTrack() {
    return this.track;
  }

  listTracks() {
    return Object.values(TRACK_MANIFESTS);
  }
}
