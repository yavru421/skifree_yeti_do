/**
 * SkiFree Yeti DO - Client Type Definitions
 * 100% Strongly-typed protocol and state machine schemas
 */

export enum YetiAIState {
  CHARGING = "CHARGING",
  POUNCE_CHARGE = "POUNCE_CHARGE",
  CLAW_SWIPE = "CLAW_SWIPE",
  ROAR_STORM = "ROAR_STORM",
  FROST_NOVA = "FROST_NOVA",
  AVALANCHE_TRIGGER = "AVALANCHE_TRIGGER",
  BERSERK = "BERSERK",
  STAGGERED = "STAGGERED",
  RETREATING = "RETREATING",
  DEAD = "DEAD"
}

export enum PowerUpType {
  NITRO_WAX = "NITRO_WAX",
  CRYO_HARPOON = "CRYO_HARPOON",
  SHIELD = "SHIELD"
}

export interface SlalomGateData {
  id: string;
  x: number;
  z: number;
  width: number;
  passed: boolean;
  color: "red" | "blue";
}

export interface PowerUpData {
  id: string;
  x: number;
  z: number;
  type: PowerUpType;
  collected: boolean;
}

export enum LimbStatus {
  FULL = 0,
  LEFT_ARM_LOST = 1,
  BOTH_ARMS_LOST = 2,
  SKELETONIZED = 3
}

export enum DifficultyLevel {
  EASY = 1,
  MEDIUM = 2,
  PRO = 3
}

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface PlayerNetState {
  id: string;
  callsign: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  speed: number;
  angle: number;
  limbStatus: LimbStatus;
  score: number;
  isAlive: boolean;
  lastUpdate: number;
}

export interface YetiNetState {
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
  hp: number;
  maxHp: number;
  state: YetiAIState;
  targetPlayerId: string | null;
  wave: number;
  staggerTimer: number;
}

export interface GameStatePacket {
  type: "state";
  tick: number;
  timestamp: number;
  wave: number;
  yeti: YetiNetState;
  players: Record<string, PlayerNetState>;
  stormIntensity: number;
}

export interface InputPacket {
  type: "input";
  steer: number; // -1 (left) to 1 (right)
  tuck: boolean;
  brake: boolean;
  aimAngle: number;
  aimPitch: number;
  isAiming: boolean;
  seq: number;
}

export interface HitscanPacket {
  type: "hitscan";
  target: "yeti" | "obstacle" | "player";
  hitPart: "head" | "body" | "limb";
  damage?: number;
  isCritical?: boolean;
  distance: number;
  rayOrigin: Vector3D;
  rayDir: Vector3D;
  timestamp: number;
}

export interface LeaderboardEntry {
  rank: number;
  callsign: string;
  score: number;
  distance: number;
  maxSpeed: number;
  survivalTime: number;
  createdAt: string;
}

export interface ClientConfig {
  wsUrl: string;
  callsign: string;
  roomId: string;
  difficulty: DifficultyLevel;
  crtShader: boolean;
}
