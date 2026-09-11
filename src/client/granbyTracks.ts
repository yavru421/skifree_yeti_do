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
    fogDensity: 0.0020,
    fogColor: new Color3(0.88, 0.92, 0.98),
    clearColor: new Color3(0.38, 0.64, 0.92), // Bright Colorado bluebird sky
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
    slopeGradeDeg: 15,
    baseElevationFt: 8650,
    trailWidth: 210,
    obstacleCountPerChunk: 24,
    rockRatio: 0.20,
    mogulCountPerChunk: 4,
    gateWidth: 12.0,
    gateIntervalZ: 120,
    baseSpeedMultiplier: 1.2,
    fogDensity: 0.0022,
    fogColor: new Color3(0.82, 0.88, 0.96),
    clearColor: new Color3(0.32, 0.58, 0.88), // Crisp high alpine blue
    snowCorduroyScale: 60,
    pitchDropZ: 0,
    pitchDropAmount: 0,
    turnFrequency: 0.006,
    bankAmplitude: 0.06,
    rollAmplitude: 0.8,
    archTitle: "JACKALOPE • EAST MOUNTAIN",
    archSubtitle: "ELEV 8,650' • 15° PITCH • ROLLING CRUISER",
    description: "Rolling intermediate cruiser off East Mountain Express. High-speed carving corridors and alpine meadows.",
    yetiBehaviorDesc: "Aggressive bounding pursuit • Frost breath bursts at 45 MPH."
  },
  {
    level: 3,
    runName: "RODEO",
    mountainArea: "East Mountain",
    difficulty: "BLACK DIAMOND",
    difficultyBadge: "◆ BLACK DIAMOND",
    slopeGradeDeg: 20,
    baseElevationFt: 9000,
    trailWidth: 150,
    obstacleCountPerChunk: 36,
    rockRatio: 0.32,
    mogulCountPerChunk: 24,
    gateWidth: 9.5,
    gateIntervalZ: 95,
    baseSpeedMultiplier: 1.4,
    fogDensity: 0.0026,
    fogColor: new Color3(0.40, 0.44, 0.56),
    clearColor: new Color3(0.18, 0.22, 0.38), // Twilight alpine dusk
    snowCorduroyScale: 40,
    pitchDropZ: 0,
    pitchDropAmount: 0,
    turnFrequency: 0.009,
    bankAmplitude: 0.09,
    rollAmplitude: 1.4,
    archTitle: "RODEO • EAST MOUNTAIN",
    archSubtitle: "ELEV 9,000' • 20° PITCH • CAUTION: HEAVY MOGULS",
    description: "Steep North-facing fall line. Heavy pine glades, natural rock ledges, and bump fields.",
    yetiBehaviorDesc: "Berserk lunges • Leaping intercepts across gates."
  },
  {
    level: 4,
    runName: "HIGH ROLLER GLADES",
    mountainArea: "Apex Glades",
    difficulty: "DOUBLE BLACK",
    difficultyBadge: "◆◆ DOUBLE BLACK",
    slopeGradeDeg: 25,
    baseElevationFt: 9200,
    trailWidth: 110,
    obstacleCountPerChunk: 46,
    rockRatio: 0.40,
    mogulCountPerChunk: 14,
    gateWidth: 8.5,
    gateIntervalZ: 90,
    baseSpeedMultiplier: 1.6,
    fogDensity: 0.0030,
    fogColor: new Color3(0.28, 0.22, 0.28),
    clearColor: new Color3(0.10, 0.06, 0.14), // Deep alpenglow blizzard
    snowCorduroyScale: 25,
    pitchDropZ: 0,
    pitchDropAmount: 0,
    turnFrequency: 0.012,
    bankAmplitude: 0.12,
    rollAmplitude: 1.8,
    archTitle: "HIGH ROLLER GLADES • APEX PEAK",
    archSubtitle: "ELEV 9,200' • 25° PITCH • EXTREME ALPINE GAUNTLET",
    description: "Extreme tree chute gauntlet on Granby's highest ridge. Narrow corridors, zero margin for error.",
    yetiBehaviorDesc: "Colossus of the Peak • Relentless 58 MPH rampage."
  }
];

export function getGranbyTrack(level: number): GranbyTrackConfig {
  const index = Math.min(Math.max(1, level), GRANBY_TRACKS.length) - 1;
  return GRANBY_TRACKS[index];
}
