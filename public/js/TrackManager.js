// public/js/TrackManager.js
// SSX 3 Multi-Tier Glacial Tracks, Massive Airtime Kickers & Sequoia Grind Logs

export const TRACK_MANIFESTS = {
  peak_backcountry: {
    id: "peak_backcountry",
    name: "PEAK BACKCOUNTRY",
    subtitle: "SSX 3 High-Alpine Glacier: Monster natural kickers, vertical halfpipe walls & fallen ancient sequoia grind logs.",
    skyColor: 0x7eb0d5,
    fogColor: 0xa4c8e8,
    fogDensity: 0.0030,
    snowColor: 0xffffff,
    finishDistance: 1800,
    slopeIncline: -0.08,
    ambientLight: 0xffffff,
    ambientIntensity: 0.90,
    sunLight: 0xfff2e0,
    sunIntensity: 1.15,
    hazards: ["frost_leviathan", "crevasses", "crags", "pine_trees"],
    tier: "tier_1",
    features: {
      trees: { count: 160, minZ: 40, maxZ: 1750, spreadX: 68 },
      // Massive SSX 3 Natural Kickers with Mega Air Pop
      kickers: { count: 32, minZ: 100, spacing: 50, megaBoost: true },
      // Fallen Ancient Sequoia Grind Logs
      sequoiaLogs: [
        { id: "seq_1", z: 280, x: -14, length: 48, radius: 2.2, angle: 0.08 },
        { id: "seq_2", z: 620, x: 18, length: 55, radius: 2.5, angle: -0.06 },
        { id: "seq_3", z: 1050, x: -6, length: 65, radius: 2.8, angle: 0.04 },
        { id: "seq_4", z: 1480, x: 12, length: 70, radius: 3.0, angle: -0.05 }
      ],
      // Steel Rigged Grind Rails
      rails: { count: 14, minZ: 200, spacing: 90, rainbowRails: true },
      // Vertical Halfpipe Glaciers
      halfpipes: [
        { startZ: 380, endZ: 580, width: 34, wallHeight: 7.5 },
        { startZ: 1150, endZ: 1420, width: 38, wallHeight: 8.5 }
      ],
      crevasses: [
        { z: 490, width: 22, depth: 25 },
        { z: 920, width: 28, depth: 30 },
        { z: 1360, width: 32, depth: 35 }
      ]
    }
  },

  neon_ruins: {
    id: "neon_ruins",
    name: "NEON GLACIER RUINS",
    subtitle: "Bioluminescent ice chutes, ancient electrified temple pillars & high-tension cable grinds.",
    skyColor: 0x050a18,
    fogColor: 0x0a1428,
    fogDensity: 0.0040,
    snowColor: 0x4a7a9a,
    finishDistance: 2000,
    slopeIncline: -0.12,
    ambientLight: 0x00f0ff,
    ambientIntensity: 0.70,
    sunLight: 0xff0088,
    sunIntensity: 0.95,
    hazards: ["frost_leviathan", "plasma_arcs", "black_ice", "ancient_pillars"],
    tier: "tier_2",
    features: {
      trees: { count: 180, minZ: 50, maxZ: 1950, spreadX: 72, neonTint: true },
      kickers: { count: 36, minZ: 120, spacing: 48, neonGlow: true, megaBoost: true },
      sequoiaLogs: [
        { id: "petrified_1", z: 320, x: 10, length: 50, radius: 2.2, neonGlow: true },
        { id: "petrified_2", z: 780, x: -16, length: 60, radius: 2.6, neonGlow: true },
        { id: "petrified_3", z: 1220, x: 8, length: 65, radius: 2.8, neonGlow: true },
        { id: "petrified_4", z: 1680, x: -12, length: 75, radius: 3.2, neonGlow: true }
      ],
      rails: { count: 20, minZ: 180, spacing: 75, neonGlow: true },
      halfpipes: [
        { startZ: 250, endZ: 520, width: 32, wallHeight: 9.0, neonLines: true },
        { startZ: 950, endZ: 1280, width: 36, wallHeight: 10.0, neonLines: true },
        { startZ: 1550, endZ: 1850, width: 40, wallHeight: 11.0, neonLines: true }
      ],
      crevasses: [
        { z: 410, width: 20, depth: 25 },
        { z: 860, width: 26, depth: 32 },
        { z: 1440, width: 30, depth: 38 }
      ]
    }
  },

  alpine_hunt: {
    id: "alpine_hunt",
    name: "VALLEY RUN 1991",
    subtitle: "Classic ski resort run retrofitted with heavy kicker ramps & open glacier chase routes.",
    skyColor: 0x89b6dc,
    fogColor: 0x9fc0e2,
    fogDensity: 0.0035,
    snowColor: 0xffffff,
    finishDistance: 1500,
    slopeIncline: -0.05,
    ambientLight: 0xffffff,
    ambientIntensity: 0.85,
    sunLight: 0xfff0dd,
    sunIntensity: 1.1,
    hazards: ["frost_leviathan", "pine_trees", "crags"],
    tier: "tier_1",
    features: {
      trees: { count: 260, minZ: 30, maxZ: 1450, spreadX: 65 },
      kickers: { count: 22, minZ: 150, spacing: 60, megaBoost: true },
      sequoiaLogs: [
        { id: "log_1", z: 340, x: -8, length: 45, radius: 2.0 },
        { id: "log_2", z: 820, x: 12, length: 55, radius: 2.4 }
      ],
      rails: { count: 10, minZ: 250, spacing: 110 },
      halfpipes: [
        { startZ: 500, endZ: 750, width: 30, wallHeight: 6.5 }
      ],
      crevasses: []
    }
  }
};

export class TrackManager {
  constructor() {
    this.currentTrackId = "peak_backcountry";
    this.track = TRACK_MANIFESTS.peak_backcountry;
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
