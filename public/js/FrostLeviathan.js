// public/js/FrostLeviathan.js
// The Colossal Breaching Frost-Whale (Leviathan) Entity with Pack-of-Dogs Aggro & Pinned Stagger Mechanics

export class FrostLeviathan {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.z = 900;
    this.hp = 15000;
    this.maxHp = 15000;
    this.speed = 65.0;
    this.baseSpeed = 65.0;
    this.speedModifier = 1.0;
    this.breachState = "CRESTING"; // "SUBMERGED" | "EMERGING" | "CRESTING" | "DIVING" | "STAGGERED"
    this.isStaggered = false;
    this.aggroTargetId = null;
    this.activeTethers = [];
    this.splineT = 0;

    // 8 Articulated body segments for cable attachment and collision
    this.segments = [];
    for (let i = 0; i < 8; i++) {
      this.segments.push({
        id: i,
        x: 0,
        y: 0,
        z: 900 - i * 35,
        radius: i === 0 ? 18 : (i < 5 ? 24 : 14),
        isWeakSpot: (i === 1 || i === 3 || i === 5), // Critical core rings
        name: i === 0 ? "Bore-Snout" : (i === 1 ? "Weak Spot: Runic Crown" : (i === 3 ? "Weak Spot: Dorsal Keel" : (i === 5 ? "Weak Spot: Ventral Core" : (i === 7 ? "Glacial Fluke" : `Chassis Ring ${i}`))))
      });
    }

    this.snowPlumes = [];
    this.plasmaBolts = [];
  }

  update(dt, serverWhaleState) {
    if (serverWhaleState) {
      this.x = this.lerp(this.x, serverWhaleState.x, dt * 10);
      this.y = this.lerp(this.y, serverWhaleState.y, dt * 10);
      this.z = this.lerp(this.z, serverWhaleState.z, dt * 10);
      this.hp = serverWhaleState.hp ?? this.hp;
      this.maxHp = serverWhaleState.maxHp ?? this.maxHp;
      this.speed = serverWhaleState.speed ?? this.speed;
      this.speedModifier = serverWhaleState.speedModifier ?? 1.0;
      this.breachState = serverWhaleState.breachState ?? this.breachState;
      this.isStaggered = !!serverWhaleState.isStaggered;
      this.aggroTargetId = serverWhaleState.yeti_target_id ?? null;
      this.activeTethers = serverWhaleState.active_tethers ?? [];

      if (serverWhaleState.segments && serverWhaleState.segments.length > 0) {
        for (let i = 0; i < Math.min(this.segments.length, serverWhaleState.segments.length); i++) {
          const s = serverWhaleState.segments[i];
          this.segments[i].x = this.lerp(this.segments[i].x, s.x, dt * 12);
          this.segments[i].y = this.lerp(this.segments[i].y, s.y, dt * 12);
          this.segments[i].z = this.lerp(this.segments[i].z, s.z, dt * 12);
        }
      }
    } else {
      // Offline fallback
      if (this.isStaggered) {
        this.y = -2.0;
        this.splineT += dt * 0.15;
      } else {
        this.splineT += dt * 0.45;
        const breachCycle = (this.splineT * 0.6) % (Math.PI * 2);
        if (breachCycle < Math.PI) {
          this.y = Math.sin(breachCycle) * 35.0;
          this.breachState = breachCycle < Math.PI * 0.5 ? "EMERGING" : "CRESTING";
        } else {
          this.y = -Math.sin(breachCycle - Math.PI) * 15.0;
          this.breachState = breachCycle > Math.PI * 1.5 ? "DIVING" : "SUBMERGED";
        }
      }

      this.z += this.speed * this.speedModifier * 1.467 * dt * 5.0;
      this.x = Math.sin(this.splineT * 0.8) * 140.0;

      for (let i = 0; i < this.segments.length; i++) {
        const segLag = (i + 1) * 32.0;
        const segSplineT = this.splineT - (i + 1) * 0.12;
        this.segments[i].x = Math.sin(segSplineT * 0.8) * 140.0;
        this.segments[i].y = this.isStaggered ? -2.0 : this.y * Math.max(0.2, 1.0 - i * 0.1);
        this.segments[i].z = this.z - segLag;
      }
    }

    if (this.breachState === "EMERGING" || this.breachState === "DIVING" || this.isStaggered) {
      this.spawnBreachFX();
    }

    // Update snow plumes
    for (let i = this.snowPlumes.length - 1; i >= 0; i--) {
      const p = this.snowPlumes[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.life -= dt;
      p.scale += dt * 25;
      if (p.life <= 0) this.snowPlumes.splice(i, 1);
    }

    // Update plasma lightning bolts (Line Charge)
    for (let i = this.plasmaBolts.length - 1; i >= 0; i--) {
      const b = this.plasmaBolts[i];
      b.progress += dt * 3.5;
      if (b.progress >= 1.0) this.plasmaBolts.splice(i, 1);
    }
  }

  triggerLineChargeVisual(startX, startY, startZ, targetSegIndex = 1) {
    const seg = this.segments[targetSegIndex] || this.segments[0];
    this.plasmaBolts.push({
      startX, startY, startZ,
      endX: seg.x, endY: seg.y, endZ: seg.z,
      progress: 0.0,
      color: "#00f0ff"
    });
  }

  spawnBreachFX() {
    for (let k = 0; k < 2; k++) {
      this.snowPlumes.push({
        x: this.x + (Math.random() - 0.5) * 60,
        y: Math.max(0, this.y) + Math.random() * 10,
        z: this.z + (Math.random() - 0.5) * 60,
        vx: (Math.random() - 0.5) * 45,
        vy: 20 + Math.random() * 50,
        vz: (Math.random() - 0.5) * 45,
        life: 0.8 + Math.random() * 0.5,
        scale: 12 + Math.random() * 18,
        alpha: 0.85
      });
    }
  }

  lerp(a, b, t) {
    return a + (b - a) * Math.min(1.0, t);
  }

  checkHarpoonHit(projX, projY, projZ, radius = 10) {
    for (let i = 0; i < this.segments.length; i++) {
      const seg = this.segments[i];
      const dx = projX - seg.x;
      const dy = projY - seg.y;
      const dz = projZ - seg.z;
      const distSq = dx * dx + dy * dy + dz * dz;
      const hitR = seg.radius + radius;
      if (distSq <= hitR * hitR) {
        return { hit: true, segmentIndex: i, segment: seg, isWeakSpot: seg.isWeakSpot };
      }
    }
    return { hit: false };
  }

  render(ctx, camera) {
    // Render snow plumes
    for (const p of this.snowPlumes) {
      const screenPos = camera.project(p.x, p.y, p.z);
      if (screenPos && screenPos.visible) {
        ctx.save();
        ctx.fillStyle = `rgba(220, 240, 255, ${Math.max(0, p.life * 0.9)})`;
        ctx.beginPath();
        ctx.arc(screenPos.x, screenPos.y, p.scale * screenPos.scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // Render Plasma Line Charge bolts
    for (const b of this.plasmaBolts) {
      const curX = b.startX + (b.endX - b.startX) * b.progress;
      const curY = b.startY + (b.endY - b.startY) * b.progress;
      const curZ = b.startZ + (b.endZ - b.startZ) * b.progress;
      const screenPos = camera.project(curX, curY, curZ);
      if (screenPos && screenPos.visible) {
        ctx.save();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 4;
        ctx.shadowColor = "#00f0ff";
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.arc(screenPos.x, screenPos.y, 14 * screenPos.scale, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    // Render 8 Articulated Whale Segments
    for (let i = this.segments.length - 1; i >= 0; i--) {
      const seg = this.segments[i];
      const screenPos = camera.project(seg.x, Math.max(-10, seg.y), seg.z);
      if (!screenPos || !screenPos.visible) continue;

      const r = seg.radius * screenPos.scale * 1.5;

      ctx.save();

      // Pinned / Staggered visual feedback (beast chained to snow bed)
      if (this.isStaggered) {
        ctx.strokeStyle = "#ff0055";
        ctx.lineWidth = Math.max(2, 4 * screenPos.scale);
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.arc(screenPos.x, screenPos.y, r * 1.3, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      const grad = ctx.createRadialGradient(
        screenPos.x - r * 0.3, screenPos.y - r * 0.3, r * 0.1,
        screenPos.x, screenPos.y, r
      );

      if (i === 0) {
        grad.addColorStop(0, "#c0e8ff");
        grad.addColorStop(0.4, "#2a6888");
        grad.addColorStop(1, "#0d2638");
      } else if (seg.isWeakSpot && this.isStaggered) {
        // Glowing critical weak spot exposed during staggered anchor
        grad.addColorStop(0, "#ffffff");
        grad.addColorStop(0.3, "#ff0055");
        grad.addColorStop(1, "#440011");
      } else {
        grad.addColorStop(0, "#60c0f0");
        grad.addColorStop(0.6, "#1a4660");
        grad.addColorStop(1, "#0a1e2d");
      }

      ctx.fillStyle = grad;
      ctx.shadowColor = (seg.isWeakSpot && this.isStaggered) ? "#ff0055" : "#00d4ff";
      ctx.shadowBlur = (seg.isWeakSpot && this.isStaggered) ? 30 : 14;

      ctx.beginPath();
      ctx.arc(screenPos.x, screenPos.y, Math.max(4, r), 0, Math.PI * 2);
      ctx.fill();

      // Target Aggro indicator on head
      if (i === 0 && this.aggroTargetId) {
        ctx.fillStyle = "#ff0033";
        ctx.beginPath();
        ctx.arc(screenPos.x - r * 0.3, screenPos.y - r * 0.2, 4, 0, Math.PI * 2);
        ctx.arc(screenPos.x + r * 0.3, screenPos.y - r * 0.2, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Segment Tag
      if (screenPos.scale > 0.008) {
        ctx.fillStyle = (seg.isWeakSpot && this.isStaggered) ? "#ffff00" : "#ffffff";
        ctx.font = `bold ${Math.max(9, Math.floor(12 * screenPos.scale * 10))}px monospace`;
        ctx.textAlign = "center";
        const tagText = (seg.isWeakSpot && this.isStaggered) ? `⚡ WEAK SPOT 2.5x!` : seg.name;
        ctx.fillText(tagText, screenPos.x, screenPos.y - r - 4);
      }

      ctx.restore();
    }
  }
}
