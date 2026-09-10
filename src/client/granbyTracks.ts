/**
 * SkiFree Yeti DO - Granby Ranch Colorado Real Ski Run Catalog
 * Ground-truth declarative specifications modeled directly after
 * Granby Ranch Ski Resort (Granby, CO) trail maps and topography.
 */

import { Color3 } from "@babylonjs/core";

export interface GranbyTrackConfig {
  level: number;
  runName: string;
  mountainArea: "East Mountain" | "West Mountain" | "Apex Glades";
  difficulty: "GREEN CIRCLE" | "BLUE SQUARE" | "BLACK DIAMOND" | "DOUBLE BLACK";
  difficultyBadge: string;
  slopeGradeDeg: number;       // Physical incline (degrees)
  baseElevationFt: number;     // Granby elevation reference (8,200' - 9,200')
  trailWidth: number;          // Lateral skiable corridor in scene units
  obstacleCountPerChunk: number; // Density of trees and boulders
  rockRatio: number;           // Probability of rock vs pine tree
  mogulCountPerChunk: number;  // Density of sculpted 3D snow moguls
  gateWidth: number;           // Width between slalom poles
  gateIntervalZ: number;       // Spacing between slalom gates
  baseSpeedMultiplier: number; // Gravity acceleration multiplier from slope pitch
  fogDensity: number;
  fogColor: Color3;
  clearColor: Color3;
  snowCorduroyScale: number;
  archTitle: string;
  archSubtitle: string;
  pitchDropZ: number;          // Z-interval for sudden elevation pitch drops
  pitchDropAmount: number;     // Vertical height drop of the fall-line roll
  turnFrequency: number;       // S-curve frequency (multiplier for Z)
  bankAmplitude: number;       // Lateral bank amplitude multiplier
  rollAmplitude: number;       // Contour ridges amplitude
  description: string;
  yetiBehaviorDesc: string;
}

export const GRANBY_TRACKS: GranbyTrackConfig[] = [
  {
    level: 1,
    runName: "QUICK DRAW",
    mountainArea: "West Mountain",
    difficulty: "GREEN CIRCLE",
    difficultyBadge: "🟢 GREEN CIRCLE",
    slopeGradeDeg: 12,
    baseElevationFt: 8200,
    trailWidth: 260,
    obstacleCountPerChunk: 16,
    rockRatio: 0.12,
    mogulCountPerChunk: 0,
    gateWidth: 14.0,
    gateIntervalZ: 140,
    baseSpeedMultiplier: 1.0,
    fogDensity: 0.003,
    fogColor: new Color3(0.92, 0.95, 1.0),
    clearColor: new Color3(0.65, 0.82, 0.98), // Bright Colorado bluebird sky
    snowCorduroyScale: 80,
    pitchDropZ: 0,
    pitchDropAmount: 0,
    turnFrequency: 0.005,
    bankAmplitude: 0.05,
    rollAmplitude: 0.5,
    archTitle: "QUICK DRAW • WEST MOUNTAIN",
    archSubtitle: "ELEV 8,200' • 12° PITCH • BEGINNER GROOMER",
    description: "Wide, sweeping beginner run off Quick Draw Express. Gentle pitch, open aspen meadows.",
    yetiBehaviorDesc: "Stalking in peripheral tree lines at 38 MPH."
  },
  {
    level: 2,
    runName: "JACKALOPE",
    mountainArea: "East Mountain",
    difficulty: "BLUE SQUARE",
    difficultyBadge: "🟦 BLUE SQUARE",
    slopeGradeDeg: 22,
    baseElevationFt: 8650,
    trailWidth: 190,
    obstacleCountPerChunk: 28,
    rockRatio: 0.28,
    mogulCountPerChunk: 6,
    gateWidth: 10.5,
    gateIntervalZ: 110,
    baseSpeedMultiplier: 1.25,
    fogDensity: 0.010,
    fogColor: new Color3(0.85, 0.89, 0.96),
    clearColor: new Color3(0.48, 0.65, 0.85), // Drifting snow squall
    snowCorduroyScale: 50,
    pitchDropZ: 250,
    pitchDropAmount: 6.0,
    turnFrequency: 0.008,
    bankAmplitude: 0.15,
    rollAmplitude: 2.0,
    archTitle: "JACKALOPE • EAST MOUNTAIN",
    archSubtitle: "ELEV 8,650' • 22° PITCH • ROLLING CRUISER",
    description: "Rolling intermediate cruiser with sudden elevation drops and high-vis orange safety netting.",
    yetiBehaviorDesc: "Erratic flanking charges • Frost breath barrages."
  },
  {
    level: 3,
    runName: "RODEO",
    mountainArea: "East Mountain",
    difficulty: "BLACK DIAMOND",
    difficultyBadge: "◆ BLACK DIAMOND",
    slopeGradeDeg: 32,
    baseElevationFt: 9000,
    trailWidth: 130,
    obstacleCountPerChunk: 40,
    rockRatio: 0.42,
    mogulCountPerChunk: 42, // Heavy 3D mogul field!
    gateWidth: 8.0,
    gateIntervalZ: 85,
    baseSpeedMultiplier: 1.55,
    fogDensity: 0.009,
    fogColor: new Color3(0.18, 0.22, 0.35),
    clearColor: new Color3(0.12, 0.15, 0.28), // Twilight alpine storm
    snowCorduroyScale: 30,
    pitchDropZ: 140,
    pitchDropAmount: 9.5,
    turnFrequency: 0.012,
    bankAmplitude: 0.28,
    rollAmplitude: 3.5,
    archTitle: "RODEO • EAST MOUNTAIN",
    archSubtitle: "ELEV 9,000' • 32° PITCH • CAUTION: HEAVY MOGULS",
    description: "Steep North-facing fall line. Heavy pine glades, natural rock ledges, and punishing bump fields.",
    yetiBehaviorDesc: "Berserk lunges • Leaping intercepts across gates."
  },
  {
    level: 4,
    runName: "HIGH ROLLER GLADES",
    mountainArea: "Apex Glades",
    difficulty: "DOUBLE BLACK",
    difficultyBadge: "◆◆ DOUBLE BLACK",
    slopeGradeDeg: 40,
    baseElevationFt: 9200,
    trailWidth: 85,
    obstacleCountPerChunk: 56,
    rockRatio: 0.55,
    mogulCountPerChunk: 18,
    gateWidth: 8.5,
    gateIntervalZ: 90,
    baseSpeedMultiplier: 1.9,
    fogDensity: 0.013,
    fogColor: new Color3(0.15, 0.05, 0.10),
    clearColor: new Color3(0.08, 0.02, 0.06), // Whiteout blizzard abyss
    snowCorduroyScale: 20,
    pitchDropZ: 80,
    pitchDropAmount: 14.0,
    turnFrequency: 0.018,
    bankAmplitude: 0.45,
    rollAmplitude: 5.5,
    archTitle: "HIGH ROLLER GLADES • APEX PEAK",
    archSubtitle: "ELEV 9,200' • 40° PITCH • EXTREME BLIZZARD GAUNTLET",
    description: "Extreme tree chute gauntlet on Granby's highest ridge. Narrow corridors, zero margin for error.",
    yetiBehaviorDesc: "Colossus of the Peak • Relentless 65 MPH rampage."
  }
];

export function getGranbyTrack(level: number): GranbyTrackConfig {
  const index = Math.min(Math.max(1, level), GRANBY_TRACKS.length) - 1;
  return GRANBY_TRACKS[index];
}
