/**
 * SnapshotInterpolation.ts
 * Buffers authoritative 20Hz server physics snapshots from Cloudflare MountainDO
 * and provides smooth Hermite/Lerp interpolation for 60fps+ rendering without jitter.
 */

export interface SnapshotEntityState {
  timestamp: number;
  x: number;
  y: number;
  z: number;
  vx?: number;
  vy?: number;
  vz?: number;
  raw?: any;
}

export class SnapshotInterpolator {
  private buffer: SnapshotEntityState[] = [];
  private maxBufferSize: number = 60; // Keep up to 3 seconds of 20Hz snapshots
  private interpolationDelayMs: number = 100; // 100ms client buffer window (2 ticks at 20Hz)

  constructor(interpolationDelayMs: number = 100, maxBufferSize: number = 60) {
    this.interpolationDelayMs = interpolationDelayMs;
    this.maxBufferSize = maxBufferSize;
  }

  /**
   * Pushes a new server snapshot into the interpolation buffer.
   * Handles various packet shapes: { x, y, z }, { pos: [x, y, z] }, { position: [x, y, z] }.
   */
  public pushSnapshot(snapshot: any): void {
    if (!snapshot) return;

    let x = 0;
    let y = 0;
    let z = 0;
    let timestamp = typeof snapshot.timestamp === 'number' ? snapshot.timestamp : Date.now();

    if (Array.isArray(snapshot.pos)) {
      x = snapshot.pos[0] ?? 0;
      y = snapshot.pos[1] ?? 0;
      z = snapshot.pos[2] ?? 0;
    } else if (Array.isArray(snapshot.position)) {
      x = snapshot.position[0] ?? 0;
      y = snapshot.position[1] ?? 0;
      z = snapshot.position[2] ?? 0;
    } else if (typeof snapshot.x === 'number') {
      x = snapshot.x;
      y = snapshot.y ?? 0;
      z = snapshot.z ?? 0;
    } else if (snapshot.payload) {
      this.pushSnapshot({ ...snapshot.payload, timestamp });
      return;
    }

    const state: SnapshotEntityState = {
      timestamp,
      x,
      y,
      z,
      vx: snapshot.vx,
      vy: snapshot.vy,
      vz: snapshot.vz,
      raw: snapshot
    };

    // Insert into buffer sorted by timestamp
    this.buffer.push(state);
    if (this.buffer.length > 1 && state.timestamp < this.buffer[this.buffer.length - 2].timestamp) {
      this.buffer.sort((a, b) => a.timestamp - b.timestamp);
    }

    // Trim older snapshots beyond max buffer
    while (this.buffer.length > this.maxBufferSize) {
      this.buffer.shift();
    }
  }

  /**
   * Evaluates the interpolated position at the current render time minus buffer delay.
   */
  public getInterpolatedState(renderTimeMs?: number): { x: number; y: number; z: number } | null {
    if (this.buffer.length === 0) return null;
    if (this.buffer.length === 1) {
      const s = this.buffer[0];
      return { x: s.x, y: s.y, z: s.z };
    }

    const now = renderTimeMs !== undefined ? renderTimeMs : Date.now();
    const renderTargetTime = now - this.interpolationDelayMs;

    const oldest = this.buffer[0];
    const newest = this.buffer[this.buffer.length - 1];

    // If target time is older than the oldest buffered snapshot, return oldest
    if (renderTargetTime <= oldest.timestamp) {
      return { x: oldest.x, y: oldest.y, z: oldest.z };
    }

    // If target time is newer than newest snapshot, extrapolate or return newest
    if (renderTargetTime >= newest.timestamp) {
      return { x: newest.x, y: newest.y, z: newest.z };
    }

    // Find bounding snapshots [s0, s1]
    let s0 = this.buffer[0];
    let s1 = this.buffer[1];

    for (let i = 0; i < this.buffer.length - 1; i++) {
      if (this.buffer[i].timestamp <= renderTargetTime && this.buffer[i + 1].timestamp >= renderTargetTime) {
        s0 = this.buffer[i];
        s1 = this.buffer[i + 1];
        break;
      }
    }

    const timeSpan = s1.timestamp - s0.timestamp;
    if (timeSpan <= 0) {
      return { x: s1.x, y: s1.y, z: s1.z };
    }

    const alpha = Math.max(0, Math.min(1, (renderTargetTime - s0.timestamp) / timeSpan));

    // Linear interpolation
    const x = s0.x + alpha * (s1.x - s0.x);
    const y = s0.y + alpha * (s1.y - s0.y);
    const z = s0.z + alpha * (s1.z - s0.z);

    return { x, y, z };
  }

  public getBufferLength(): number {
    return this.buffer.length;
  }

  public clear(): void {
    this.buffer = [];
  }
}
