// public/js/SceneManager.js
// Authentic 2.5D Animated Character Engine, Dynamic Biomes & Procedural Track Manifests

import { loadChromaKeyTexture } from './SpriteUtils.js';

export class SceneManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.textureLoader = new THREE.TextureLoader();

    this.isFPV = true;
    this.headBobTimer = 0;
    this.baseFov = 75;
    this.cameraOffset = new THREE.Vector3(0, 1.75, 0.2);
    this.cameraLookOffset = new THREE.Vector3(0, 1.0, 9.5);

    this.terrainMesh = null;
    this.snowParticles = null;
    this.skierGroup = null;
    this.skierSprite = null;
    this.skierTexture = null;
    this.yetiSprite = null;
    this.yetiTexture = null;

    // Track Feature Collections
    this.trees = [];
    this.kickers = [];
    this.grindRails = [];
    this.icePatches = [];
    this.slalomGates = [];
    this.crevasses = [];
    this.gondolaCabins = [];
    this.mountainPeaks = [];
    this.finishLineMesh = null;
    this.avalancheWallMesh = null;
    this.halfpipeMeshes = [];
    this.ghostSkiers = new Map();
    this.npcSkiers = [];
    this.trauma = 0;
    this.activeHarpoons = [];

    this.hemiLight = null;
    this.dirLight = null;
    this.currentTrack = null;

    this.init();
  }

  init() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x7eb0d5);
    this.scene.fog = new THREE.FogExp2(0xa4c8e8, 0.0030);

    this.camera = new THREE.PerspectiveCamera(
      65,
      window.innerWidth / window.innerHeight,
      0.1,
      1200
    );

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance"
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x7eb0d5, 1.0);

    this.scene.add(this.camera);

    this.setupLighting();
    this.buildDistantMountainRange();
    this.buildSkierMesh();
    this.buildFpvHarpoonLauncher();
    this.buildFpvKnifeViewmodel();
    this.buildContinuousSnowTerrain();
    this.buildSkiLiftSystem();
    this.buildSnowParticles();
    this.buildCarveSpraySystem();
    this.buildNitroJetsSystem();
    this.buildTetherLine();
    this.loadYetiSprite();
    this.buildNpcSkiers();

    window.addEventListener("resize", () => this.onWindowResize());
  }

  buildTetherLine() {
    // 3D Volumetric Heavy-Duty Winch Cable (Never dips under snow!)
    const cableGeo = new THREE.CylinderGeometry(0.08, 0.08, 1, 8);
    cableGeo.rotateX(Math.PI / 2); // Align with Z axis for natural lookAt orientation

    const cableMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00f0ff,
      emissiveIntensity: 2.8,
      roughness: 0.15,
      metalness: 0.85
    });

    this.tetherCableMesh = new THREE.Mesh(cableGeo, cableMat);
    this.tetherCableMesh.visible = false;
    this.scene.add(this.tetherCableMesh);

    // Keep legacy alias
    this.tetherLineMesh = this.tetherCableMesh;
  }

  updateTether(playerPos, targetPos, isTethered, isStaggered) {
    if (!this.tetherCableMesh) return;
    if (!isTethered || !playerPos || !targetPos) {
      this.tetherCableMesh.visible = false;
      return;
    }

    this.tetherCableMesh.visible = true;

    // Anchor p0 at weapon muzzle in FPV, or chest in TPV — always ABOVE the snow
    let p0;
    if (this.isFPV && this.harpoonMuzzleAnchor) {
      const muzzleWorld = new THREE.Vector3();
      this.harpoonMuzzleAnchor.getWorldPosition(muzzleWorld);
      p0 = muzzleWorld;
    } else if (this.isFPV) {
      p0 = new THREE.Vector3(playerPos.x + 0.28, (playerPos.y || 0) + 1.35, playerPos.z + 0.75);
    } else {
      p0 = new THREE.Vector3(playerPos.x, (playerPos.y || 0) + 1.15, playerPos.z + 0.35);
    }

    // Anchor p1 into Yeti's back socket if available, or elevated at 2.4m above ground
    let p1;
    if (this.yetiTetherSocket) {
      const sockWorld = new THREE.Vector3();
      this.yetiTetherSocket.getWorldPosition(sockWorld);
      p1 = sockWorld;
    } else {
      p1 = new THREE.Vector3(targetPos.x, (targetPos.y || 0) + 2.4, targetPos.z - 0.4);
    }

    const dist = p0.distanceTo(p1);
    if (dist < 0.2) {
      this.tetherCableMesh.visible = false;
      return;
    }

    // Midpoint positioning & lookAt orientation
    const mid = new THREE.Vector3().addVectors(p0, p1).multiplyScalar(0.5);
    // Guarantee mid.y is never under the snow plane!
    const groundY = this.getTerrainHeight ? this.getTerrainHeight(mid.x, mid.z) : 0;
    mid.y = Math.max(groundY + 0.45, mid.y);

    this.tetherCableMesh.position.copy(mid);
    this.tetherCableMesh.lookAt(p1);
    this.tetherCableMesh.scale.set(1.4, 1.4, dist);

    // Read tension for dynamic color coding
    const combat = window.__combatSystem;
    const tension = combat ? combat.cableTension : 0.5;

    let cableColor = 0x00f0ff;
    if (tension < 0.20 || tension > 0.80) {
      cableColor = 0xff0033; // Red Danger
    } else if (tension < 0.35 || tension > 0.65) {
      cableColor = 0xffaa00; // Yellow Warning
    } else {
      cableColor = 0x39ff14; // Neon Green Sweet Spot
    }

    if (isStaggered) cableColor = 0xff0055;

    this.tetherCableMesh.material.color.setHex(cableColor);
    this.tetherCableMesh.material.emissive.setHex(cableColor);
    this.tetherCableMesh.material.emissiveIntensity = 2.4 + Math.sin(performance.now() * 0.015) * 0.8;
  }

  setupLighting() {
    this.hemiLight = new THREE.HemisphereLight(0xffffff, 0x4a709c, 1.2);
    this.hemiLight.position.set(0, 80, 0);
    this.scene.add(this.hemiLight);

    this.dirLight = new THREE.DirectionalLight(0xfffaed, 1.6);
    this.dirLight.position.set(-50, 90, -60);
    this.scene.add(this.dirLight);
  }

  applyTrack(trackConfig) {
    if (!trackConfig) return;
    this.currentTrack = trackConfig;

    // 1. Sky & Fog
    this.scene.background.setHex(trackConfig.skyColor || 0x89b6dc);
    this.scene.fog.color.setHex(trackConfig.fogColor || 0x9fc0e2);
    this.scene.fog.density = trackConfig.fogDensity || 0.0035;

    // 2. Lighting
    if (this.hemiLight) {
      this.hemiLight.color.setHex(trackConfig.ambientLight || 0xffffff);
      this.hemiLight.intensity = trackConfig.ambientIntensity || 1.0;
    }
    if (this.dirLight) {
      this.dirLight.color.setHex(trackConfig.sunLight || 0xfffaed);
      this.dirLight.intensity = trackConfig.sunIntensity || 1.4;
    }

    // 3. Clear existing procedural features
    this.clearTrackFeatures();

    // 4. Rebuild features per manifest
    this.buildTrackTrees(trackConfig);
    this.buildTrackKickers(trackConfig);
    this.buildTrackRails(trackConfig);
    this.buildTrackIce(trackConfig);
    this.buildTrackSlalomGates(trackConfig);
    this.buildTrackFinishLine(trackConfig);

    // Optional Track Hazards & Structures
    if (trackConfig.features?.crevasses?.length > 0) {
      this.buildCrevasses(trackConfig.features.crevasses);
    }
    if (trackConfig.features?.halfpipe?.enabled) {
      this.buildHalfpipe(trackConfig.features.halfpipe);
    }
    if (trackConfig.id === "avalanche") {
      this.buildAvalancheWall();
    }
  }

  clearTrackFeatures() {
    this.trees.forEach(t => this.scene.remove(t));
    this.trees = [];

    this.kickers.forEach(k => this.scene.remove(k));
    this.kickers = [];

    this.grindRails.forEach(r => this.scene.remove(r));
    this.grindRails = [];

    this.icePatches.forEach(i => this.scene.remove(i));
    this.icePatches = [];

    this.slalomGates.forEach(g => this.scene.remove(g.group));
    this.slalomGates = [];

    this.crevasses.forEach(c => this.scene.remove(c.mesh));
    this.crevasses = [];

    this.halfpipeMeshes.forEach(h => this.scene.remove(h));
    this.halfpipeMeshes = [];

    if (this.finishLineMesh) {
      this.scene.remove(this.finishLineMesh);
      this.finishLineMesh = null;
    }
    if (this.avalancheWallMesh) {
      this.scene.remove(this.avalancheWallMesh);
      this.avalancheWallMesh = null;
    }
  }

  buildTrackTrees(track) {
    const isNeon = track.features?.trees?.neonTint;
    
    // Realistic multi-tier volumetric spruce pine tree
    const trunkMat = new THREE.MeshStandardMaterial({
      color: 0x3d2817,
      roughness: 0.95,
      metalness: 0.05
    });
    const needleColor = isNeon ? 0x00ffcc : 0x1b3b22;
    const foliageMat = new THREE.MeshStandardMaterial({
      color: needleColor,
      roughness: 0.85,
      metalness: 0.05,
      emissive: isNeon ? 0x004433 : 0x000000,
      emissiveIntensity: isNeon ? 0.4 : 0
    });
    const snowCapMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.9
    });

    const trunkGeo = new THREE.CylinderGeometry(0.35, 0.55, 3.2, 7);
    const cone1Geo = new THREE.ConeGeometry(2.4, 3.2, 7);
    const cone2Geo = new THREE.ConeGeometry(1.8, 2.6, 7);
    const cone3Geo = new THREE.ConeGeometry(1.2, 2.0, 7);
    const snowCapGeo = new THREE.ConeGeometry(0.65, 1.1, 7);

    const count = Math.max(150, track.features?.trees?.count || 140);
    const maxZ = track.features?.trees?.maxZ || 1850;
    const minZ = 25; // Starts immediately at 25m!

    for (let i = 0; i < count; i++) {
      const treeGroup = new THREE.Group();

      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = 1.6;
      treeGroup.add(trunk);

      const tier1 = new THREE.Mesh(cone1Geo, foliageMat);
      tier1.position.y = 3.6;
      treeGroup.add(tier1);

      const tier2 = new THREE.Mesh(cone2Geo, foliageMat);
      tier2.position.y = 5.2;
      treeGroup.add(tier2);

      const tier3 = new THREE.Mesh(cone3Geo, foliageMat);
      tier3.position.y = 6.6;
      treeGroup.add(tier3);

      const snowCap = new THREE.Mesh(snowCapGeo, snowCapMat);
      snowCap.position.y = 7.3;
      treeGroup.add(snowCap);

      // Distribute trees across the curving mountain corridor relative to track spine
      const tz = minZ + (i / count) * (maxZ - minZ) + (Math.random() - 0.5) * 12;
      const spineX = (window.__trackManager && window.__trackManager.getTrackSpineX)
        ? window.__trackManager.getTrackSpineX(tz)
        : (Math.sin(tz * 0.0078) * 18.0 + Math.sin(tz * 0.026) * 7.5);
      
      let tx;
      if (i % 3 === 0) {
        // Direct central slope slalom tree hazards (-22m to +22m)
        tx = spineX + (Math.random() - 0.5) * 44;
      } else if (i % 3 === 1) {
        // Mid-slope flanking clusters (-38m to +38m)
        const s = Math.random() > 0.5 ? 1 : -1;
        tx = spineX + s * (14 + Math.random() * 26);
      } else {
        // Outer forest borders
        const s = Math.random() > 0.5 ? 1 : -1;
        tx = spineX + s * (32 + Math.random() * 32);
      }

      const sScale = 0.85 + Math.random() * 0.45;
      treeGroup.scale.set(sScale, sScale, sScale);
      treeGroup.position.set(tx, 0, tz);
      this.trees.push(treeGroup);
      this.scene.add(treeGroup);
    }
  }

  buildTrackKickers(track) {
    const rampGeo = new THREE.BoxGeometry(6.2, 1.9, 4.2);
    const isNeon = track.features?.kickers?.neonGlow;
    const isMega = track.features?.kickers?.megaBoost;

    const rampMat = new THREE.MeshStandardMaterial({
      color: isNeon ? 0xff00ff : (isMega ? 0xffaa00 : 0x00f0ff),
      emissive: isNeon ? 0xaa00aa : (isMega ? 0x884400 : 0x0066aa),
      emissiveIntensity: 0.5
    });

    const count = track.features?.kickers?.count || 14;
    const minZ = track.features?.kickers?.minZ || 250;
    const spacing = track.features?.kickers?.spacing || 80;

    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(rampGeo, rampMat);
      mesh.rotation.x = -0.35;
      const kz = minZ + i * spacing + Math.random() * 15;
      const spineX = (window.__trackManager && window.__trackManager.getTrackSpineX)
        ? window.__trackManager.getTrackSpineX(kz)
        : (Math.sin(kz * 0.0078) * 18.0 + Math.sin(kz * 0.026) * 7.5);
      const kx = spineX + Math.sin(i * 1.4) * 20;
      mesh.position.set(kx, 0.85, kz);
      this.scene.add(mesh);
      this.kickers.push(mesh);
    }
  }

  buildTrackRails(track) {
    const railGeo = new THREE.CylinderGeometry(0.2, 0.2, 28, 8);
    const isRainbow = track.features?.rails?.rainbowRails;
    const isNeon = track.features?.rails?.neonGlow;

    const railMat = new THREE.MeshStandardMaterial({
      color: isNeon ? 0x00ffff : (isRainbow ? 0xff0055 : 0xffcc00),
      metalness: 0.85,
      roughness: 0.15,
      emissive: isNeon ? 0x0088cc : 0x000000,
      emissiveIntensity: isNeon ? 0.5 : 0
    });

    const count = track.features?.rails?.count || 7;
    const minZ = track.features?.rails?.minZ || 400;
    const spacing = track.features?.rails?.spacing || 110;

    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(railGeo, railMat);
      mesh.rotation.x = Math.PI / 2.2;
      const rz = minZ + i * spacing;
      const spineX = (window.__trackManager && window.__trackManager.getTrackSpineX)
        ? window.__trackManager.getTrackSpineX(rz)
        : (Math.sin(rz * 0.0078) * 18.0 + Math.sin(rz * 0.026) * 7.5);
      const rx = spineX + (i % 2 === 0 ? 14 : -14) + (Math.random() - 0.5) * 6;
      mesh.position.set(rx, 1.0, rz);
      this.scene.add(mesh);
      this.grindRails.push(mesh);
    }
  }

  buildTrackSequoiaLogs(track) {
    if (!track.features?.sequoiaLogs) return;
    this.sequoiaLogs = [];

    const barkMat = new THREE.MeshStandardMaterial({
      color: 0x5a2d0c, // Deep redwood bark
      roughness: 0.85,
      metalness: 0.1
    });

    const snowTopMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.2,
      metalness: 0.1
    });

    track.features.sequoiaLogs.forEach((log) => {
      const group = new THREE.Group();
      const trunkGeo = new THREE.CylinderGeometry(log.radius, log.radius * 1.15, log.length, 12);
      const trunkMesh = new THREE.Mesh(trunkGeo, barkMat);
      trunkMesh.rotation.x = Math.PI / 2 + (log.angle || 0);
      group.add(trunkMesh);

      // Top snow frosting / grind lip
      const snowGeo = new THREE.BoxGeometry(log.radius * 1.2, 0.4, log.length);
      const snowMesh = new THREE.Mesh(snowGeo, snowTopMat);
      snowMesh.position.set(0, log.radius + 0.2, 0);
      snowMesh.rotation.x = log.angle || 0;
      group.add(snowMesh);

      group.position.set(log.x, log.radius * 0.7, log.z);
      this.scene.add(group);
      this.sequoiaLogs.push({ group, ...log });
    });
  }

  buildTrackHalfpipes(track) {
    if (!track.features?.halfpipes) return;
    this.halfpipeMeshes = [];

    const iceWallMat = new THREE.MeshStandardMaterial({
      color: 0xb0e8ff,
      roughness: 0.1,
      metalness: 0.6,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide
    });

    track.features.halfpipes.forEach((hp) => {
      const len = hp.endZ - hp.startZ;
      const wallGeo = new THREE.CylinderGeometry(hp.wallHeight, hp.wallHeight, len, 16, 1, true, 0, Math.PI * 0.5);

      // Left Quarterpipe
      const leftWall = new THREE.Mesh(wallGeo, iceWallMat);
      leftWall.rotation.x = Math.PI / 2;
      leftWall.position.set(-hp.width * 0.5, hp.wallHeight * 0.5, hp.startZ + len * 0.5);
      this.scene.add(leftWall);
      this.halfpipeMeshes.push(leftWall);

      // Right Quarterpipe
      const rightWall = new THREE.Mesh(wallGeo, iceWallMat);
      rightWall.rotation.x = Math.PI / 2;
      rightWall.rotation.z = Math.PI;
      rightWall.position.set(hp.width * 0.5, hp.wallHeight * 0.5, hp.startZ + len * 0.5);
      this.scene.add(rightWall);
      this.halfpipeMeshes.push(rightWall);
    });
  }

  buildTrackIce(track) {
    const iceGeo = new THREE.PlaneGeometry(22, 34);
    const isBlackIce = track.features?.icePatches?.blackIce;

    const iceMat = new THREE.MeshStandardMaterial({
      color: isBlackIce ? 0x112233 : 0x99eeff,
      transparent: true,
      opacity: isBlackIce ? 0.95 : 0.85,
      roughness: 0.04,
      metalness: 0.9,
      side: THREE.DoubleSide
    });

    const count = track.features?.icePatches?.count || 6;
    const minZ = track.features?.icePatches?.minZ || 350;
    const spacing = track.features?.icePatches?.spacing || 120;

    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(iceGeo, iceMat);
      mesh.rotation.x = -Math.PI / 2;
      const iz = minZ + i * spacing;
      const ix = Math.sin(i * 1.8) * 20;
      mesh.position.set(ix, 0.05, iz);
      this.scene.add(mesh);
      this.icePatches.push(mesh);
    }
  }

  buildTrackSlalomGates(track) {
    const poleGeo = new THREE.CylinderGeometry(0.12, 0.12, 3.8, 8);
    const isNeon = track.features?.slalomGates?.neonGlow;

    const blueMat = new THREE.MeshStandardMaterial({
      color: isNeon ? 0x00f0ff : 0x0088ff,
      emissive: 0x00f0ff,
      emissiveIntensity: isNeon ? 0.85 : 0.4
    });
    const redMat = new THREE.MeshStandardMaterial({
      color: isNeon ? 0xff0055 : 0xff2200,
      emissive: 0xff0055,
      emissiveIntensity: isNeon ? 0.85 : 0.4
    });

    const count = track.features?.slalomGates?.count || 24;
    const minZ = track.features?.slalomGates?.minZ || 200;
    const spacing = track.features?.slalomGates?.spacing || 40;
    const width = track.features?.slalomGates?.width || 14;

    for (let i = 0; i < count; i++) {
      const group = new THREE.Group();
      const isBlue = i % 2 === 0;
      const mat = isBlue ? blueMat : redMat;
      const gateZ = minZ + i * spacing;
      const spineX = (window.__trackManager && window.__trackManager.getTrackSpineX)
        ? window.__trackManager.getTrackSpineX(gateZ)
        : (Math.sin(gateZ * 0.0078) * 18.0 + Math.sin(gateZ * 0.026) * 7.5);
      const gateX = spineX + Math.sin(i * 0.58) * 16;

      const leftPole = new THREE.Mesh(poleGeo, mat);
      leftPole.position.set(-width / 2, 1.9, 0);
      const rightPole = new THREE.Mesh(poleGeo, mat);
      rightPole.position.set(width / 2, 1.9, 0);

      const banner = new THREE.Mesh(new THREE.BoxGeometry(width, 0.35, 0.05), mat);
      banner.position.set(0, 3.2, 0);

      group.add(leftPole);
      group.add(rightPole);
      group.add(banner);
      group.position.set(gateX, 0, gateZ);

      this.scene.add(group);
      this.slalomGates.push({
        id: i,
        z: gateZ,
        x: gateX,
        cleared: false,
        group
      });
    }
  }

  buildTrackFinishLine(track) {
    const finishDist = track.finishDistance || 1200;
    const finishGroup = new THREE.Group();
    const finishMat = new THREE.MeshStandardMaterial({ color: 0xffff00, emissive: 0xffff00, emissiveIntensity: 0.7 });

    const fLeft = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 6.0, 8), finishMat);
    fLeft.position.set(-14, 3.0, 0);
    const fRight = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 6.0, 8), finishMat);
    fRight.position.set(14, 3.0, 0);

    const fBanner = new THREE.Mesh(new THREE.BoxGeometry(28, 1.4, 0.12), finishMat);
    fBanner.position.set(0, 5.0, 0);

    finishGroup.add(fLeft);
    finishGroup.add(fRight);
    finishGroup.add(fBanner);
    finishGroup.position.set(0, 0, finishDist);

    this.scene.add(finishGroup);
    this.finishLineMesh = finishGroup;
  }

  buildCrevasses(crevasseList) {
    const chasmMat = new THREE.MeshBasicMaterial({ color: 0x01030a }); // Deep black void
    crevasseList.forEach((c) => {
      const geo = new THREE.BoxGeometry(120, c.depth || 18, c.width || 20);
      const mesh = new THREE.Mesh(geo, chasmMat);
      mesh.position.set(0, -(c.depth || 18) / 2, c.z);
      this.scene.add(mesh);
      this.crevasses.push({ mesh, z: c.z, width: c.width || 20 });
    });
  }

  buildHalfpipe(pipeConfig) {
    const wallGeo = new THREE.BoxGeometry(4, pipeConfig.height || 5.5, (pipeConfig.endZ - pipeConfig.startZ));
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xeef4fa, roughness: 0.3 });

    const leftWall = new THREE.Mesh(wallGeo, wallMat);
    leftWall.position.set(-pipeConfig.width / 2, (pipeConfig.height || 5.5) / 2, (pipeConfig.startZ + pipeConfig.endZ) / 2);
    leftWall.rotation.z = -0.3;

    const rightWall = new THREE.Mesh(wallGeo, wallMat);
    rightWall.position.set(pipeConfig.width / 2, (pipeConfig.height || 5.5) / 2, (pipeConfig.startZ + pipeConfig.endZ) / 2);
    rightWall.rotation.z = 0.3;

    this.scene.add(leftWall);
    this.scene.add(rightWall);
    this.halfpipeMeshes.push(leftWall, rightWall);
  }

  buildAvalancheWall() {
    // Tumbling snow wall mesh
    const wallGeo = new THREE.BoxGeometry(140, 24, 8);
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.9,
      transparent: true,
      opacity: 0.9
    });
    this.avalancheWallMesh = new THREE.Mesh(wallGeo, wallMat);
    this.avalancheWallMesh.position.set(0, 12, -100);
    this.scene.add(this.avalancheWallMesh);
  }

  buildDistantMountainRange() {
    const rockMat = new THREE.MeshLambertMaterial({ color: 0x243242 });
    const snowCapMat = new THREE.MeshLambertMaterial({ color: 0xffffff });

    for (let i = 0; i < 28; i++) {
      const peakGroup = new THREE.Group();
      const peakHeight = 130 + Math.random() * 120;
      const peakRadius = 80 + Math.random() * 60;

      const rockMesh = new THREE.Mesh(new THREE.ConeGeometry(peakRadius, peakHeight, 6), rockMat);
      peakGroup.add(rockMesh);

      const capMesh = new THREE.Mesh(new THREE.ConeGeometry(peakRadius * 0.46, peakHeight * 0.46, 6), snowCapMat);
      capMesh.position.y = peakHeight * 0.27;
      peakGroup.add(capMesh);

      const angle = (i / 28) * Math.PI * 1.85 - (Math.PI * 0.92);
      const distance = 560 + Math.random() * 140;
      peakGroup.position.set(Math.sin(angle) * distance, 40 + Math.random() * 30, Math.cos(angle) * distance + 650);
      this.scene.add(peakGroup);
      this.mountainPeaks.push(peakGroup);
    }
  }

  buildFpvHarpoonLauncher() {
    this.fpvLauncherGroup = new THREE.Group();

    // 1. Heavy Industrial Rifled Cannon Barrel (Machined Gunmetal Carbon-Titanium)
    const barrelGeo = new THREE.CylinderGeometry(0.075, 0.092, 1.25, 16);
    barrelGeo.rotateX(-Math.PI / 2);
    const barrelMat = new THREE.MeshStandardMaterial({
      color: 0x141a24,
      metalness: 0.94,
      roughness: 0.18,
      bumpScale: 0.05
    });
    const barrel = new THREE.Mesh(barrelGeo, barrelMat);
    barrel.position.set(0, 0, -0.42);
    this.fpvLauncherGroup.add(barrel);

    // Fluted heat ventilation shroud over barrel
    const shroudGeo = new THREE.CylinderGeometry(0.105, 0.105, 0.65, 12, 1, true);
    shroudGeo.rotateX(-Math.PI / 2);
    const shroudMat = new THREE.MeshStandardMaterial({
      color: 0x222a36,
      metalness: 0.88,
      roughness: 0.35,
      wireframe: false
    });
    const shroud = new THREE.Mesh(shroudGeo, shroudMat);
    shroud.position.set(0, 0, -0.4);
    this.fpvLauncherGroup.add(shroud);

    // Muzzle anchor point for world projectile spawn
    this.harpoonMuzzleAnchor = new THREE.Object3D();
    this.harpoonMuzzleAnchor.position.set(0, 0.04, -1.05);
    this.fpvLauncherGroup.add(this.harpoonMuzzleAnchor);

    // 2. High-Pressure Steampunk Brass Steam Cylinder with Reinforcing Rings
    const chamberGeo = new THREE.CylinderGeometry(0.108, 0.108, 0.72, 16);
    chamberGeo.rotateX(-Math.PI / 2);
    const brassMat = new THREE.MeshStandardMaterial({
      color: 0xdfa038,
      metalness: 0.9,
      roughness: 0.16
    });
    const chamber = new THREE.Mesh(chamberGeo, brassMat);
    chamber.position.set(0, -0.075, -0.16);
    this.fpvLauncherGroup.add(chamber);

    // Brass reinforcing bands
    for (let b = -0.4; b <= 0.1; b += 0.22) {
      const ringGeo = new THREE.TorusGeometry(0.114, 0.014, 8, 20);
      const ringMat = new THREE.MeshStandardMaterial({ color: 0xffcc44, metalness: 0.95, roughness: 0.1 });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.set(0, -0.075, b);
      this.fpvLauncherGroup.add(ring);
    }

    // 3. Glowing Analog Dial Steam Pressure Gauge
    const gaugeFrameGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.04, 16);
    gaugeFrameGeo.rotateZ(Math.PI / 2);
    const gaugeFrameMat = new THREE.MeshStandardMaterial({ color: 0xd49b38, metalness: 0.9, roughness: 0.2 });
    const gaugeFrame = new THREE.Mesh(gaugeFrameGeo, gaugeFrameMat);
    gaugeFrame.position.set(0.1, 0.04, -0.22);
    this.fpvLauncherGroup.add(gaugeFrame);

    const gaugeFaceGeo = new THREE.CircleGeometry(0.046, 16);
    gaugeFaceGeo.rotateY(Math.PI / 2);
    const gaugeFaceMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const gaugeFace = new THREE.Mesh(gaugeFaceGeo, gaugeFaceMat);
    gaugeFace.position.set(0.121, 0.04, -0.22);
    this.fpvLauncherGroup.add(gaugeFace);

    // 4. Heavy Steel Winch Cable Spool with High-Tension Wire
    const spoolGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.18, 16);
    spoolGeo.rotateZ(Math.PI / 2);
    const spoolMat = new THREE.MeshStandardMaterial({
      color: 0x2b3848,
      metalness: 0.85,
      roughness: 0.25
    });
    const spool = new THREE.Mesh(spoolGeo, spoolMat);
    spool.position.set(0, -0.135, 0.12);
    this.fpvLauncherGroup.add(spool);
    this.fpvLauncherGroup.add(spool);

    // 5. THE VISIBLE LOADED HOOK / SPEARHEAD STICKING PROMINENTLY OUT OF THE BARREL
    this.loadedHookMesh = new THREE.Group();

    // Shaft protruding from barrel
    const loadedShaftGeo = new THREE.CylinderGeometry(0.028, 0.028, 0.75, 8);
    loadedShaftGeo.rotateX(-Math.PI / 2);
    const loadedShaftMat = new THREE.MeshStandardMaterial({
      color: 0xccddff,
      metalness: 0.95,
      roughness: 0.15
    });
    const loadedShaft = new THREE.Mesh(loadedShaftGeo, loadedShaftMat);
    loadedShaft.position.set(0, 0, -0.82);
    this.loadedHookMesh.add(loadedShaft);

    // Wicked Barbed Glowing Cyan Spearhead Tip protruding out of the muzzle
    const tipGeo = new THREE.ConeGeometry(0.09, 0.38, 8);
    tipGeo.rotateX(-Math.PI / 2);
    const tipMat = new THREE.MeshStandardMaterial({
      color: 0x00ffff,
      emissive: 0x00ffff,
      emissiveIntensity: 3.2,
      metalness: 0.95,
      roughness: 0.08
    });
    const tip = new THREE.Mesh(tipGeo, tipMat);
    tip.position.set(0, 0, -1.22);
    this.loadedHookMesh.add(tip);

    // Reverse lateral barbs on the Hook Tip
    const barbMat = new THREE.MeshStandardMaterial({
      color: 0x00ffff,
      emissive: 0x0099cc,
      emissiveIntensity: 2.2,
      metalness: 0.9
    });
    const barbGeo = new THREE.BoxGeometry(0.025, 0.08, 0.15);

    const barbL = new THREE.Mesh(barbGeo, barbMat);
    barbL.position.set(-0.065, 0, -1.12);
    barbL.rotation.y = 0.45;
    this.loadedHookMesh.add(barbL);

    const barbR = new THREE.Mesh(barbGeo, barbMat);
    barbR.position.set(0.065, 0, -1.12);
    barbR.rotation.y = -0.45;
    this.loadedHookMesh.add(barbR);

    // Glowing cyan pointlight on hook tip
    const hookLight = new THREE.PointLight(0x00ffff, 1.8, 5);
    hookLight.position.set(0, 0, -1.18);
    this.loadedHookMesh.add(hookLight);

    this.fpvLauncherGroup.add(this.loadedHookMesh);

    // Position cleanly in FPV lower right screen viewport (right hand weapon hold)
    this.fpvLauncherBasePos = new THREE.Vector3(0.24, -0.22, -0.52);
    this.fpvLauncherGroup.position.copy(this.fpvLauncherBasePos);
    this.fpvLauncherGroup.rotation.set(0.04, -0.03, 0);
    this.fpvLauncherGroup.scale.set(0.55, 0.55, 0.55);

    // Attach directly to camera
    this.camera.add(this.fpvLauncherGroup);

    return this.fpvLauncherGroup;
  }

  buildFpvKnifeViewmodel() {
    this.fpvKnifeGroup = new THREE.Group();

    // CS:GO Style Tactical Combat Knife / Ski-Pole Dagger
    const knifeMat = new THREE.MeshStandardMaterial({
      color: 0x18202c,
      metalness: 0.96,
      roughness: 0.14
    });
    const edgeMat = new THREE.MeshStandardMaterial({
      color: 0xe0f0ff,
      metalness: 0.98,
      roughness: 0.08,
      emissive: 0x00f0ff,
      emissiveIntensity: 0.4
    });
    const gripMat = new THREE.MeshStandardMaterial({
      color: 0x0d1117,
      roughness: 0.75,
      metalness: 0.3
    });

    // 1. Blade Body (Sleek tactical Bowie / Karambit curve)
    const bladeGeo = new THREE.BoxGeometry(0.016, 0.075, 0.38);
    const blade = new THREE.Mesh(bladeGeo, knifeMat);
    blade.position.set(0, 0.02, -0.26);
    this.fpvKnifeGroup.add(blade);

    // Razor Sharp Edge with Cyan Glint
    const edgeGeo = new THREE.ConeGeometry(0.045, 0.18, 5);
    edgeGeo.rotateX(-Math.PI / 2);
    const edge = new THREE.Mesh(edgeGeo, edgeMat);
    edge.position.set(0, 0.02, -0.48);
    this.fpvKnifeGroup.add(edge);

    // Glowing Plasma Fuller Groove
    const grooveGeo = new THREE.BoxGeometry(0.02, 0.015, 0.28);
    const grooveMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
    const groove = new THREE.Mesh(grooveGeo, grooveMat);
    groove.position.set(0, 0.025, -0.26);
    this.fpvKnifeGroup.add(groove);

    // 2. Crossguard
    const guardGeo = new THREE.BoxGeometry(0.035, 0.14, 0.025);
    const guard = new THREE.Mesh(guardGeo, knifeMat);
    guard.position.set(0, 0.01, -0.07);
    this.fpvKnifeGroup.add(guard);

    // 3. Ergonomic Tactical Grip
    const gripGeo = new THREE.CylinderGeometry(0.025, 0.028, 0.22, 10);
    gripGeo.rotateX(-Math.PI / 2);
    const grip = new THREE.Mesh(gripGeo, gripMat);
    grip.position.set(0, 0, 0.05);
    this.fpvKnifeGroup.add(grip);

    // 4. Skull-Crusher Pommel Ring
    const pommelGeo = new THREE.TorusGeometry(0.032, 0.008, 8, 16);
    const pommel = new THREE.Mesh(pommelGeo, knifeMat);
    pommel.position.set(0, 0, 0.17);
    this.fpvKnifeGroup.add(pommel);

    // Poised Base Position (Lower right screen, held ready)
    this.fpvKnifeBasePos = new THREE.Vector3(0.25, -0.20, -0.42);
    this.fpvKnifeGroup.position.copy(this.fpvKnifeBasePos);
    this.fpvKnifeGroup.rotation.set(0.2, -0.25, 0.1);
    this.fpvKnifeGroup.scale.set(0.85, 0.85, 0.85);

    this.fpvKnifeGroup.visible = false;
    this.camera.add(this.fpvKnifeGroup);

    this.knifeAnim = {
      active: false,
      timer: 0,
      duration: 0.18,
      type: "SLASH"
    };

    return this.fpvKnifeGroup;
  }

  triggerKnifeSlash(isHeavyBackstab = false) {
    if (!this.fpvKnifeGroup) return;
    this.fpvKnifeGroup.visible = true;
    const duration = isHeavyBackstab ? 0.32 : 0.18;
    this.knifeAnim = {
      active: true,
      timer: duration,
      duration: duration,
      type: isHeavyBackstab ? "BACKSTAB" : "SLASH"
    };

    // Camera trauma shake
    this.addTrauma(isHeavyBackstab ? 0.85 : 0.45);

    // Trigger visual screen slash overlay
    const overlay = document.getElementById("knife-slash-overlay");
    if (overlay) {
      overlay.className = isHeavyBackstab ? "slash-backstab-active" : "slash-quick-active";
      setTimeout(() => {
        if (overlay) overlay.className = "";
      }, isHeavyBackstab ? 350 : 200);
    }
  }

  buildSkierMesh() {
    this.skierGroup = new THREE.Group();

    const skiMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      metalness: 0.85,
      roughness: 0.2,
      emissive: 0x003355,
      emissiveIntensity: 0.5
    });
    const bootMat = new THREE.MeshStandardMaterial({
      color: 0x111827,
      roughness: 0.4,
      metalness: 0.6
    });

    // 1. FPV Skis and Bindings (Directly visible under the player's goggles in FPV)
    this.fpvSkisGroup = new THREE.Group();
    const skiTipMat = new THREE.MeshStandardMaterial({
      color: 0xff0055,
      roughness: 0.3,
      metalness: 0.7,
      emissive: 0x660022,
      emissiveIntensity: 0.6
    });

    // Left Ski (Body + Upturned Tip + Boot Toe)
    const leftSkiGroup = new THREE.Group();
    const leftSkiBody = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.04, 2.2), skiMat);
    leftSkiGroup.add(leftSkiBody);
    const leftSkiTip = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.04, 0.35), skiTipMat);
    leftSkiTip.position.set(0, 0.07, -1.2);
    leftSkiTip.rotation.x = -0.38; // Upturned alpine tip
    leftSkiGroup.add(leftSkiTip);
    const leftBoot = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.16, 0.38), bootMat);
    leftBoot.position.set(0, 0.10, 0.15);
    leftSkiGroup.add(leftBoot);
    leftSkiGroup.position.set(-0.28, -0.42, -0.85);
    this.leftSkiMesh = leftSkiGroup;
    this.fpvSkisGroup.add(leftSkiGroup);

    // Right Ski (Body + Upturned Tip + Boot Toe)
    const rightSkiGroup = new THREE.Group();
    const rightSkiBody = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.04, 2.2), skiMat);
    rightSkiGroup.add(rightSkiBody);
    const rightSkiTip = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.04, 0.35), skiTipMat);
    rightSkiTip.position.set(0, 0.07, -1.2);
    rightSkiTip.rotation.x = -0.38; // Upturned alpine tip
    rightSkiGroup.add(rightSkiTip);
    const rightBoot = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.16, 0.38), bootMat);
    rightBoot.position.set(0, 0.10, 0.15);
    rightSkiGroup.add(rightBoot);
    rightSkiGroup.position.set(0.28, -0.42, -0.85);
    this.rightSkiMesh = rightSkiGroup;
    this.fpvSkisGroup.add(rightSkiGroup);

    this.fpvSkisGroup.visible = true;
    this.camera.add(this.fpvSkisGroup); // Attached directly to FPV camera viewport

    // 2. Volumetric 3D Skier Avatar (Hidden in FPV so it never blocks camera)
    this.skier3DModel = new THREE.Group();
    const jacketMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.7 });
    const pantsMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.85 });
    const helmetMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2, metalness: 0.2 });
    const visorMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00ffff,
      emissiveIntensity: 1.4,
      roughness: 0.1
    });

    // Torso
    const torsoMesh = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.1, 0.55), jacketMat);
    torsoMesh.position.y = 1.35;
    this.skier3DModel.add(torsoMesh);

    // Helmet & Visor
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 2.15, 0);
    const helmetMesh = new THREE.Mesh(new THREE.SphereGeometry(0.36, 12, 12), helmetMat);
    headGroup.add(helmetMesh);
    const visorMesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.22), visorMat);
    visorMesh.position.set(0, 0.05, 0.28);
    headGroup.add(visorMesh);
    this.skier3DModel.add(headGroup);

    // Legs & Boots
    const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.14, 0.9, 8), pantsMat);
    legL.position.set(-0.25, 0.55, 0);
    const legR = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.14, 0.9, 8), pantsMat);
    legR.position.set(0.25, 0.55, 0);
    this.skier3DModel.add(legL);
    this.skier3DModel.add(legR);

    // Full 3D Skis for TPV
    const tpvSkiL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, 2.4), skiMat);
    tpvSkiL.position.set(-0.28, 0.04, 0.2);
    const tpvSkiR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, 2.4), skiMat);
    tpvSkiR.position.set(0.28, 0.04, 0.2);
    this.skier3DModel.add(tpvSkiL);
    this.skier3DModel.add(tpvSkiR);

    // Ski Poles
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x8899aa, metalness: 0.8 });
    const poleL = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.4, 6), poleMat);
    poleL.position.set(-0.65, 0.9, 0.1);
    poleL.rotation.x = -0.2;
    const poleR = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.4, 6), poleMat);
    poleR.position.set(0.65, 0.9, 0.1);
    poleR.rotation.x = -0.2;
    this.skier3DModel.add(poleL);
    this.skier3DModel.add(poleR);

    this.skier3DModel.visible = !this.isFPV;
    this.skierGroup.add(this.skier3DModel);

    this.scene.add(this.skierGroup);
  }

  buildContinuousSnowTerrain() {
    const terrainGeo = new THREE.PlaneGeometry(1600, 2600, 32, 32);
    terrainGeo.rotateX(-Math.PI / 2);

    const snowTex = this.textureLoader.load('/assets/snow_texture.jpg');
    snowTex.wrapS = THREE.RepeatWrapping;
    snowTex.wrapT = THREE.RepeatWrapping;
    snowTex.repeat.set(32, 64);

    const terrainMat = new THREE.MeshStandardMaterial({
      map: snowTex,
      color: 0xffffff,
      roughness: 0.85,
      metalness: 0.02
    });
    this.terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
    this.terrainMesh.position.set(0, 0, 1200);
    this.scene.add(this.terrainMesh);
  }

  buildSkiLiftSystem() {
    const towerMat = new THREE.MeshStandardMaterial({ color: 0x556677, metalness: 0.7 });
    const cabinMat = new THREE.MeshStandardMaterial({ color: 0xff0055, roughness: 0.3 });

    for (let i = 0; i < 9; i++) {
      const towerGroup = new THREE.Group();
      const pylon = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.9, 24, 8), towerMat);
      pylon.position.y = 12;
      const arm = new THREE.Mesh(new THREE.BoxGeometry(10, 0.8, 0.8), towerMat);
      arm.position.set(-3, 23, 0);
      towerGroup.add(pylon);
      towerGroup.add(arm);
      towerGroup.position.set(75, 0, 100 + i * 140);
      this.scene.add(towerGroup);

      const cabin = new THREE.Mesh(new THREE.BoxGeometry(3.5, 3.2, 4.5), cabinMat);
      cabin.position.set(72, 18, 100 + i * 140);
      this.scene.add(cabin);
      this.gondolaCabins.push({ mesh: cabin, zBase: 100 + i * 140 });
    }
  }

  buildSnowParticles() {
    const count = 500;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count * 3; i += 3) {
      pos[i] = (Math.random() - 0.5) * 35;
      pos[i + 1] = Math.random() * 8 - 1;
      pos[i + 2] = Math.random() * 40;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.16, transparent: true, opacity: 0.85 });
    this.snowParticles = new THREE.Points(geo, mat);
    this.scene.add(this.snowParticles);
  }

  buildNitroJetsSystem() {
    const count = 40;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: 0x00ffff, size: 0.55, transparent: true, opacity: 0.9 });
    this.nitroJetsMesh = new THREE.Points(geo, mat);
    this.nitroJetsMesh.visible = false;
    this.scene.add(this.nitroJetsMesh);
  }

  emitNitroParticles(playerPos) {
    if (!this.nitroJetsMesh) return;
    this.nitroJetsMesh.visible = true;
    const pos = this.nitroJetsMesh.geometry.attributes.position.array;
    for (let i = 0; i < pos.length; i += 3) {
      pos[i] = playerPos.x + (Math.random() - 0.5) * 0.6;
      pos[i + 1] = playerPos.y + 0.3 + Math.random() * 0.4;
      pos[i + 2] = playerPos.z - 0.5 - Math.random() * 1.8;
    }
    this.nitroJetsMesh.geometry.attributes.position.needsUpdate = true;
  }

  toggleCameraMode() {
    this.isFPV = true; // PERMANENT FPV MANDATE
    if (this.fpvSkisGroup) {
      this.fpvSkisGroup.visible = true;
    }
    if (this.skier3DModel) {
      this.skier3DModel.visible = false;
    }
    return "FPV (Goggles Only)";
  }

  updateCamera(playerPos, playerSteer, playerPitch, playerAirY, playerAirRoll, playerAirYaw, isAirborne, isNitroActive, avalancheDist) {
    this.camera.up.set(0, 1, 0);

    // 1. AUTHENTIC ALPINE SKIING GLIDE MOTION & SUSPENSION DYNAMICS
    const playerSpeed = window.__playerPhysics?.speed || 28;
    const speedRatio = Math.min(1.8, Math.max(0.2, playerSpeed / 28));

    // Smooth 2.6Hz vertical terrain slope glide & knee suspension
    this.glideTimer = (this.glideTimer || 0) + (0.016 * 2.6 * speedRatio);
    const skiGlideY = !isAirborne ? Math.sin(this.glideTimer) * 0.022 : 0;
    const skiGlideX = !isAirborne ? Math.cos(this.glideTimer * 0.5) * 0.012 : 0;

    // Carve knee compression: body sinks into snow on sharp carving turns
    const carveKneeDrop = !isAirborne ? -Math.abs(playerSteer || 0) * 0.045 : 0;

    // Subtle high-speed snow surface texture micro-chatter (not jarring steps)
    const snowChatter = (!isAirborne && playerSpeed > 6) ? Math.sin(performance.now() * 0.06) * 0.0025 : 0;

    // Dynamic Speed FOV Warp
    const targetFov = 75 + Math.min(18, (playerSpeed - 20) * 0.35) + (isNitroActive ? 6 : 0);
    this.camera.fov += (targetFov - this.camera.fov) * 0.12;
    this.camera.updateProjectionMatrix();

    // 2. Sync skier world position & 3D rotation
    this.skierGroup.position.set(playerPos.x, playerPos.y + playerAirY, playerPos.z);
    
    // Airborne 3D Rotation
    if (isAirborne) {
      this.skierGroup.rotation.y = playerAirYaw || 0;
      this.skierGroup.rotation.z = playerAirRoll || 0;
    } else {
      this.skierGroup.rotation.y = 0;
      this.skierGroup.rotation.z = 0;
    }

    // FPV Skis: Visibly carve in lower screen attached to FPV camera
    if (this.fpvSkisGroup) {
      this.fpvSkisGroup.visible = true;
      const skiBankZ = -playerSteer * 0.35;
      const skiTurnY = playerSteer * 0.22;
      const skiDipY = -0.40 + (skiGlideY * 0.35) + (carveKneeDrop * 0.5);
      this.fpvSkisGroup.position.set(0, skiDipY, -0.85);
      this.fpvSkisGroup.rotation.set(0.08, skiTurnY, skiBankZ);

      // Slide inside ski back slightly during carving turns
      if (this.leftSkiMesh && this.rightSkiMesh) {
        this.leftSkiMesh.position.z = -0.85 + (playerSteer > 0 ? playerSteer * 0.12 : 0);
        this.rightSkiMesh.position.z = -0.85 + (playerSteer < 0 ? -playerSteer * 0.12 : 0);
      }
    }

    // Avatar model strictly hidden in FPV (never blocks camera view)
    if (this.skier3DModel) {
      this.skier3DModel.visible = false;
    }

    // 3. FPV Harpoon Launcher Viewmodel Sway & Recoil Recovery
    if (this.fpvLauncherGroup && this.fpvLauncherBasePos) {
      this.fpvLauncherGroup.visible = this.isFPV;

      // Gentle weapon sway matching ski carving momentum and low-frequency terrain glide
      const swayX = -playerSteer * 0.045 + Math.cos((this.glideTimer || 0) * 0.5) * 0.008;
      const swayY = Math.sin(this.glideTimer || 0) * 0.012 - Math.abs(playerSteer) * 0.02;

      this.fpvLauncherGroup.position.x += (this.fpvLauncherBasePos.x + swayX - this.fpvLauncherGroup.position.x) * 0.22;
      this.fpvLauncherGroup.position.y += (this.fpvLauncherBasePos.y + swayY - this.fpvLauncherGroup.position.y) * 0.22;
      this.fpvLauncherGroup.position.z += (this.fpvLauncherBasePos.z - this.fpvLauncherGroup.position.z) * 0.22;

      this.fpvLauncherGroup.rotation.x += (0.04 - this.fpvLauncherGroup.rotation.x) * 0.22;
      this.fpvLauncherGroup.rotation.z += (-playerSteer * 0.18 - this.fpvLauncherGroup.rotation.z) * 0.22;

      // Reload animation: smoothly slide hook back into barrel
      if (typeof this.harpoonReloadTimer === "number" && this.harpoonReloadTimer > 0) {
        this.harpoonReloadTimer -= 0.016;
        if (this.harpoonReloadTimer <= 0) {
          if (this.loadedHookMesh) this.loadedHookMesh.visible = true;
        }
      }
    }

    // 4. Nitro Flames
    if (isNitroActive) {
      this.emitNitroParticles(playerPos);
    } else if (this.nitroJetsMesh) {
      this.nitroJetsMesh.visible = false;
    }

    // 5. Avalanche Snow Wall positioning
    if (this.avalancheWallMesh && typeof avalancheDist === "number") {
      this.avalancheWallMesh.position.set(playerPos.x, 12, playerPos.z - avalancheDist);
      if (avalancheDist < 45) {
        this.addTrauma(0.08);
      }
    }

    // Safe NaN guards
    const steer = typeof playerSteer === "number" && !isNaN(playerSteer) ? playerSteer : 0;
    const pitch = typeof playerPitch === "number" && !isNaN(playerPitch) ? playerPitch : 0;
    const airRoll = typeof playerAirRoll === "number" && !isNaN(playerAirRoll) ? playerAirRoll : 0;
    const airYaw = typeof playerAirYaw === "number" && !isNaN(playerAirYaw) ? playerAirYaw : 0;

    if (this.isFPV) {
      if (this.fpvSkisGroup) this.fpvSkisGroup.visible = true;
      if (this.skier3DModel) this.skier3DModel.visible = false;
      if (this.fpvLauncherGroup) this.fpvLauncherGroup.visible = true;

      // Place camera at exact skier eye level with smooth ski suspension
      const eyeY = (playerPos.y || 0) + (playerAirY || 0) + 1.68 + skiGlideY + carveKneeDrop + snowChatter;
      const eyeX = (playerPos.x || 0) + skiGlideX;
      const eyeZ = (playerPos.z || 0) + 0.15;
      this.camera.position.set(eyeX, eyeY, eyeZ);

      // PERMANENT RIGHT-SIDE UP DOWNHILL CAMERA ORIENTATION (order = 'YXZ')
      this.camera.rotation.order = 'YXZ';
      const pitchAngle = -0.08 + (pitch * 0.5); // Looking slightly downward along slope
      const yawAngle = Math.PI + (steer * 0.72) + (airYaw || 0); // Downhill (+Z) and natural carve turning
      const rollAngle = steer * 0.25 + (airRoll || 0) * 0.5; // Ski carve body lean / bank roll

      this.camera.rotation.set(pitchAngle, yawAngle, rollAngle);
    } else {
      if (this.fpvSkisGroup) this.fpvSkisGroup.visible = false;
      if (this.skier3DModel) this.skier3DModel.visible = true;
      if (this.fpvLauncherGroup) this.fpvLauncherGroup.visible = false;

      // Third-Person Chase Cam behind player looking downhill
      const chaseDist = 6.8;
      const chaseHeight = 3.2;
      const camX = (playerPos.x || 0) - Math.sin(steer * 0.5) * 1.8;
      const camY = (playerPos.y || 0) + (playerAirY || 0) * 0.5 + chaseHeight;
      const camZ = (playerPos.z || 0) - chaseDist;
      this.camera.position.set(camX, camY, camZ);

      this.camera.rotation.order = 'YXZ';
      const pitchAngle = -0.16 + (pitch * 0.3);
      const yawAngle = Math.PI + (steer * 0.5) + (airYaw || 0);
      const rollAngle = (airRoll || 0) * 0.3;
      this.camera.rotation.set(pitchAngle, yawAngle, rollAngle);
    }

    // Camera Trauma Screen Shake decay
    if (this.trauma > 0) {
      const shake = this.trauma * this.trauma;
      this.camera.position.x += (Math.random() - 0.5) * shake * 1.6;
      this.camera.position.y += (Math.random() - 0.5) * shake * 1.0;
      this.trauma = Math.max(0, this.trauma - 0.04);
    }

    // Dynamic ski carving spray emission
    if (Math.abs(playerSteer) > 0.08 && !isAirborne) {
      this.emitCarveSpray(playerPos, playerSteer);
    }

    if (this.snowParticles) {
      const pos = this.snowParticles.geometry.attributes.position.array;
      for (let i = 0; i < pos.length; i += 3) {
        pos[i + 2] -= 0.6;
        if (pos[i + 2] < playerPos.z - 10) {
          pos[i + 2] = playerPos.z + 30;
          pos[i] = playerPos.x + (Math.random() - 0.5) * 35;
        }
      }
      this.snowParticles.geometry.attributes.position.needsUpdate = true;
    }

    // CS:GO Knife Viewmodel Animation & Visibility
    if (this.fpvKnifeGroup) {
      const yeti = window.__yetiAI || window.__yetiPredator;
      const combat = window.__combatSystem;
      let inPointBlank = false;
      if (yeti && playerPos) {
        const dx = (playerPos.x || 0) - yeti.x;
        const dz = (playerPos.z || 0) - yeti.z;
        const dist = Math.hypot(dx, dz);
        if (dist <= 6.8 || (combat && combat.towPhase === "FINISH_WINDOW")) {
          inPointBlank = true;
        }
      }

      if (this.knifeAnim && this.knifeAnim.active) {
        this.knifeAnim.timer -= 0.016;
        const progress = Math.min(1.0, Math.max(0, 1.0 - (this.knifeAnim.timer / this.knifeAnim.duration)));
        if (this.knifeAnim.type === "SLASH") {
          // Quick visceral diagonal swipe across screen
          const swipe = Math.sin(progress * Math.PI);
          this.fpvKnifeGroup.position.x = this.fpvKnifeBasePos.x - swipe * 0.45;
          this.fpvKnifeGroup.position.y = this.fpvKnifeBasePos.y + swipe * 0.18;
          this.fpvKnifeGroup.position.z = this.fpvKnifeBasePos.z - swipe * 0.16;
          this.fpvKnifeGroup.rotation.z = 0.1 - swipe * 1.8;
          this.fpvKnifeGroup.rotation.y = -0.25 - swipe * 0.8;
        } else {
          // Heavy CS:GO Backstab: draw back then violent lunge into screen center
          if (progress < 0.28) {
            const windup = progress / 0.28;
            this.fpvKnifeGroup.position.z = this.fpvKnifeBasePos.z + windup * 0.14;
            this.fpvKnifeGroup.rotation.x = 0.2 + windup * 0.45;
          } else {
            const thrust = (progress - 0.28) / 0.72;
            const thrustPeak = Math.sin(thrust * Math.PI * 0.5);
            this.fpvKnifeGroup.position.x = this.fpvKnifeBasePos.x - thrustPeak * 0.22;
            this.fpvKnifeGroup.position.z = this.fpvKnifeBasePos.z - thrustPeak * 0.42;
            this.fpvKnifeGroup.rotation.x = 0.65 - thrustPeak * 0.9;
          }
        }

        if (this.knifeAnim.timer <= 0) {
          this.knifeAnim.active = false;
          this.fpvKnifeGroup.position.copy(this.fpvKnifeBasePos);
          this.fpvKnifeGroup.rotation.set(0.2, -0.25, 0.1);
        }
      }

      // Visible when in point-blank range or during animation in FPV
      this.fpvKnifeGroup.visible = this.isFPV && (inPointBlank || (this.knifeAnim && this.knifeAnim.active));
    }

    // Dynamic NPC Skiers update
    this.updateNpcSkiers(0.016, playerPos.z);
  }

  updateGhostSkiers(remotePlayers, localPlayerId) {
    if (!remotePlayers || !Array.isArray(remotePlayers)) return;
    const activeIds = new Set();

    remotePlayers.forEach((p) => {
      if (p.id === localPlayerId) return;
      activeIds.add(p.id);

      let ghost = this.ghostSkiers.get(p.id);
      if (!ghost) {
        const group = new THREE.Group();
        if (this.skierTexture) {
          const ghostMat = new THREE.SpriteMaterial({
            map: this.skierTexture.clone(),
            transparent: true,
            opacity: 0.55,
            color: 0x88ddff
          });
          const sprite = new THREE.Sprite(ghostMat);
          sprite.scale.set(3.2, 3.2, 1);
          sprite.position.set(0, 1.4, 0);
          group.add(sprite);
        }
        group.position.set(p.x, 0, p.z);
        this.scene.add(group);
        ghost = { group, x: p.x, z: p.z, steer: p.steer || 0 };
        this.ghostSkiers.set(p.id, ghost);
      }

      ghost.group.position.x += (p.x - ghost.group.position.x) * 0.35;
      ghost.group.position.z += (p.z - ghost.group.position.z) * 0.35;
      ghost.group.rotation.y = p.steer || 0;
      ghost.group.rotation.z = -(p.steer || 0) * 0.45;
    });

    for (const [id, ghost] of this.ghostSkiers.entries()) {
      if (!activeIds.has(id)) {
        this.scene.remove(ghost.group);
        this.ghostSkiers.delete(id);
      }
    }
  }

  buildNpcSkiers() {
    this.npcSkiers = [];
    const colors = [0xff3355, 0x00f0ff, 0x39ff14, 0xffaa00, 0xcc00ff, 0xffff00, 0x0088ff, 0xff00aa];
    for (let i = 0; i < 8; i++) {
      const npcGroup = new THREE.Group();
      const suitMat = new THREE.MeshStandardMaterial({ color: colors[i % colors.length], roughness: 0.5 });
      const darkMat = new THREE.MeshStandardMaterial({ color: 0x111118, roughness: 0.8 });
      const skiMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });

      // Torso
      const torso = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.45), suitMat);
      torso.position.y = 1.0;
      npcGroup.add(torso);

      // Head with goggles
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 8), darkMat);
      head.position.y = 1.6;
      npcGroup.add(head);

      // Skis
      const skiL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.04, 1.8), skiMat);
      skiL.position.set(-0.24, 0.04, 0.1);
      const skiR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.04, 1.8), skiMat);
      skiR.position.set(0.24, 0.04, 0.1);
      npcGroup.add(skiL);
      npcGroup.add(skiR);

      const spawnX = (Math.random() - 0.5) * 55;
      const spawnZ = 60 + i * 40;
      npcGroup.position.set(spawnX, 0, spawnZ);
      this.scene.add(npcGroup);

      this.npcSkiers.push({
        group: npcGroup,
        x: spawnX,
        z: spawnZ,
        speed: 22 + Math.random() * 8,
        freq: 1.0 + Math.random() * 0.8,
        phase: Math.random() * Math.PI * 2,
        amp: 6 + Math.random() * 8
      });
    }
  }

  updateNpcSkiers(dt, playerZ) {
    if (!this.npcSkiers) return;
    const t = performance.now() * 0.001;

    for (const npc of this.npcSkiers) {
      npc.z += npc.speed * 0.045 * dt * 60;
      npc.x += Math.sin(t * npc.freq + npc.phase) * npc.amp * dt;
      const groundY = this.getTerrainHeight ? this.getTerrainHeight(npc.x, npc.z) : 0;
      npc.group.position.set(npc.x, groundY, npc.z);
      npc.group.rotation.y = Math.cos(t * npc.freq + npc.phase) * 0.35;

      // Recycle ahead down the mountain if player passes them by 30 meters
      if (playerZ && npc.z < playerZ - 30) {
        npc.z = playerZ + 140 + Math.random() * 120;
        npc.x = (Math.random() - 0.5) * 55;
      }
    }
  }

  addTrauma(amount) {
    this.trauma = Math.min(1.0, this.trauma + amount);
  }

  buildCarveSpraySystem() {
    const count = 60;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    const opacities = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      positions[i * 3] = 0;
      positions[i * 3 + 1] = -100;
      positions[i * 3 + 2] = 0;
      velocities[i * 3] = 0;
      velocities[i * 3 + 1] = 0;
      velocities[i * 3 + 2] = 0;
      opacities[i] = 0;
    }

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("velocity", new THREE.BufferAttribute(velocities, 3));
    geometry.setAttribute("opacity", new THREE.BufferAttribute(opacities, 1));

    const material = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.45,
      transparent: true,
      opacity: 0.85
    });

    this.carveParticlesMesh = new THREE.Points(geometry, material);
    this.scene.add(this.carveParticlesMesh);
    this.carveSprayIndex = 0;
  }

  emitCarveSpray(playerPos, steer) {
    if (!this.carveParticlesMesh) return;
    const pos = this.carveParticlesMesh.geometry.attributes.position.array;
    const count = pos.length / 3;
    const idx = (this.carveSprayIndex % count) * 3;

    pos[idx] = playerPos.x + (Math.random() - 0.5) * 0.4;
    pos[idx + 1] = playerPos.y + 0.1 + Math.random() * 0.25;
    pos[idx + 2] = playerPos.z - 0.4 - Math.random() * 0.8;

    this.carveSprayIndex++;
    this.carveParticlesMesh.geometry.attributes.position.needsUpdate = true;
  }

  buildFpvKnifeViewmodel() {
    this.fpvKnifeGroup = new THREE.Group();
    this.fpvKnifeBasePos = new THREE.Vector3(0.28, -0.22, -0.45);
    this.fpvKnifeGroup.position.copy(this.fpvKnifeBasePos);
    this.fpvKnifeGroup.rotation.set(0.15, -0.22, 0.12);

    // Tactical CS:GO Combat Knife / Ski-Dagger Mesh
    // 1. Double-edged titanium blade with drop point and serrated spine
    const bladeGeo = new THREE.BoxGeometry(0.038, 0.28, 0.008);
    const bladeMat = new THREE.MeshStandardMaterial({
      color: 0xccddee,
      metalness: 0.95,
      roughness: 0.18
    });
    const blade = new THREE.Mesh(bladeGeo, bladeMat);
    blade.position.set(0, 0.16, 0);
    this.fpvKnifeGroup.add(blade);

    // Blade Tip (triangular point)
    const tipGeo = new THREE.ConeGeometry(0.024, 0.08, 4);
    const tip = new THREE.Mesh(tipGeo, bladeMat);
    tip.position.set(0, 0.34, 0);
    tip.rotation.y = Math.PI / 4;
    this.fpvKnifeGroup.add(tip);

    // Crossguard (blackened hardened steel)
    const guardMat = new THREE.MeshStandardMaterial({
      color: 0x18181f,
      metalness: 0.8,
      roughness: 0.4
    });
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 0.03), guardMat);
    guard.position.set(0, 0.02, 0);
    this.fpvKnifeGroup.add(guard);

    // Handle Grip (carbon-composite textured tactical handle)
    const handleMat = new THREE.MeshStandardMaterial({
      color: 0x22252a,
      metalness: 0.2,
      roughness: 0.7
    });
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.18, 8), handleMat);
    handle.position.set(0, -0.08, 0);
    this.fpvKnifeGroup.add(handle);

    // Pommel (steel skull-crusher butt)
    const pommel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.024, 0.03, 8), guardMat);
    pommel.position.set(0, -0.18, 0);
    this.fpvKnifeGroup.add(pommel);

    this.fpvKnifeGroup.visible = false;
    this.camera.add(this.fpvKnifeGroup);
    this.knifeAnimationTimer = 0;
    this.isKnifeAttacking = false;
    this.knifeAttackType = "none";
  }

  triggerKnifeSlash(isHeavy = true) {
    if (!this.fpvKnifeGroup) return;
    this.fpvKnifeGroup.visible = true;
    this.isKnifeAttacking = true;
    this.knifeAttackType = isHeavy ? "backstab" : "slash";
    this.knifeAnimationTimer = isHeavy ? 0.36 : 0.20;
    if (this.fpvLauncherGroup) {
      this.fpvLauncherGroup.visible = false;
    }
  }

  updateFpvKnifeViewmodel(dt) {
    if (!this.fpvKnifeGroup) return;
    const combat = window.__combatSystem;
    const isTethered = combat && combat.isTethered;
    const isClose = combat && (combat.cableLength <= 7.0 || combat.retractionTimer <= 0.5);

    if (this.isFPV && (this.isKnifeAttacking || (isTethered && isClose))) {
      this.fpvKnifeGroup.visible = true;
      if (this.fpvLauncherGroup && !this.isKnifeAttacking) {
        this.fpvLauncherGroup.visible = false;
      }
    } else {
      if (!this.isKnifeAttacking) {
        this.fpvKnifeGroup.visible = false;
        if (this.isFPV && this.fpvLauncherGroup) {
          this.fpvLauncherGroup.visible = true;
        }
      }
    }

    if (!this.fpvKnifeGroup.visible) return;

    if (this.isKnifeAttacking && this.knifeAnimationTimer > 0) {
      this.knifeAnimationTimer -= dt;
      if (this.knifeAttackType === "backstab") {
        const progress = 1 - (this.knifeAnimationTimer / 0.36);
        if (progress < 0.4) {
          const p = progress / 0.4;
          this.fpvKnifeGroup.position.set(0.25 - p * 0.1, -0.15 + p * 0.12, -0.38 + p * 0.08);
          this.fpvKnifeGroup.rotation.set(0.1 - p * 0.5, -0.2, 0.15 + p * 0.3);
        } else if (progress < 0.75) {
          const p = (progress - 0.4) / 0.35;
          this.fpvKnifeGroup.position.set(0.15 - p * 0.12, -0.03 - p * 0.22, -0.30 - p * 0.35);
          this.fpvKnifeGroup.rotation.set(-0.4 + p * 1.1, -0.2 - p * 0.1, 0.45 - p * 0.6);
        } else {
          const p = (progress - 0.75) / 0.25;
          this.fpvKnifeGroup.position.lerp(this.fpvKnifeBasePos, p * 0.5);
        }
      } else {
        const progress = 1 - (this.knifeAnimationTimer / 0.20);
        const slashX = 0.35 - progress * 0.65;
        const slashY = -0.18 + Math.sin(progress * Math.PI) * 0.15;
        this.fpvKnifeGroup.position.set(slashX, slashY, -0.42);
        this.fpvKnifeGroup.rotation.set(0.2, -0.4 + progress * 0.8, -0.3 + progress * 0.6);
      }

      if (this.knifeAnimationTimer <= 0) {
        this.isKnifeAttacking = false;
        this.fpvKnifeGroup.position.copy(this.fpvKnifeBasePos);
        this.fpvKnifeGroup.rotation.set(0.15, -0.22, 0.12);
      }
    } else {
      const t = performance.now() * 0.002;
      this.fpvKnifeGroup.position.x = this.fpvKnifeBasePos.x + Math.sin(t * 1.8) * 0.004;
      this.fpvKnifeGroup.position.y = this.fpvKnifeBasePos.y + Math.cos(t * 3.2) * 0.006;
      this.fpvKnifeGroup.position.z = this.fpvKnifeBasePos.z;
    }
  }

  spawnHarpoon(startPos, dir, speed = 88) {
    // 1. Physical weapon recoil kick & reload trigger on FPV launcher viewmodel
    if (this.fpvLauncherGroup) {
      this.fpvLauncherGroup.position.z += 0.14; // Kick backward into screen
      this.fpvLauncherGroup.rotation.x -= 0.08; // Muzzle kick upward
      if (this.loadedHookMesh) {
        this.loadedHookMesh.visible = false; // Loaded hook visibly leaves the barrel!
      }
      this.harpoonReloadTimer = 0.45; // Smooth reload timer
    }

    // 2. Trajectory: Fire exactly from the barrel muzzle in the forward direction of the barrel/camera
    let actualStart = startPos;
    let actualDir = dir;

    if (this.harpoonMuzzleAnchor) {
      const muzzleWorld = new THREE.Vector3();
      this.harpoonMuzzleAnchor.getWorldPosition(muzzleWorld);
      actualStart = muzzleWorld;
    }
    if (this.camera) {
      const camDir = new THREE.Vector3();
      this.camera.getWorldDirection(camDir);
      actualDir = camDir.normalize();
    }

    const group = new THREE.Group();

    // 1. Heavy Reinforced Steel / Titanium Spear Shaft
    const shaftGeo = new THREE.CylinderGeometry(0.14, 0.14, 3.2, 10);
    shaftGeo.rotateX(Math.PI / 2);
    const shaftMat = new THREE.MeshStandardMaterial({
      color: 0xccddee,
      metalness: 0.92,
      roughness: 0.15
    });
    const shaft = new THREE.Mesh(shaftGeo, shaftMat);
    group.add(shaft);

    // Cyan glowing energy tracer rings along spear shaft
    for (let r = -1.0; r <= 1.0; r += 0.6) {
      const ringGeo = new THREE.TorusGeometry(0.16, 0.035, 8, 16);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.z = r;
      group.add(ring);
    }

    // 2. Barbed Harpoon Spearhead with high-intensity glowing cyan tip
    const headGeo = new THREE.ConeGeometry(0.42, 1.1, 10);
    const headMat = new THREE.MeshStandardMaterial({
      color: 0x00ffff,
      emissive: 0x00ffff,
      emissiveIntensity: 2.8,
      metalness: 0.95,
      roughness: 0.1
    });
    const head = new THREE.Mesh(headGeo, headMat);
    head.rotation.x = -Math.PI / 2;
    head.position.z = 1.85;
    group.add(head);

    // Wicked Lateral Reverse Barbs
    const barbGeo = new THREE.BoxGeometry(0.08, 0.28, 0.55);
    const barbMat = new THREE.MeshStandardMaterial({
      color: 0x00ffff,
      emissive: 0x00aacc,
      emissiveIntensity: 2.0,
      metalness: 0.9
    });
    const barbLeft = new THREE.Mesh(barbGeo, barbMat);
    barbLeft.position.set(-0.25, 0, 1.45);
    barbLeft.rotation.y = 0.45;
    group.add(barbLeft);

    const barbRight = new THREE.Mesh(barbGeo, barbMat);
    barbRight.position.set(0.25, 0, 1.45);
    barbRight.rotation.y = -0.45;
    group.add(barbRight);

    // Illuminating dynamic PointLight attached directly to projectile
    const spearLight = new THREE.PointLight(0x00ffff, 3.8, 22);
    spearLight.position.set(0, 0, 1.8);
    group.add(spearLight);

    // 3. Trailing High-Tension Neon Cable Line
    const lineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(actualStart.x, actualStart.y, actualStart.z),
      new THREE.Vector3(actualStart.x, actualStart.y, actualStart.z)
    ]);
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x00ffff,
      linewidth: 4,
      transparent: true,
      opacity: 0.95
    });
    const cableLine = new THREE.Line(lineGeo, lineMat);
    this.scene.add(cableLine);

    // Initial position & orientation
    group.position.copy(actualStart);
    
    // Rotate to face trajectory
    const targetPoint = new THREE.Vector3().copy(group.position).add(actualDir);
    group.lookAt(targetPoint);

    this.scene.add(group);

    const harpoon = {
      mesh: group,
      line: cableLine,
      startPos: new THREE.Vector3().copy(actualStart),
      dir: new THREE.Vector3().copy(actualDir).normalize(),
      speed: speed || 120,
      traveled: 0,
      maxDist: 150,
      life: 2.0
    };

    this.activeHarpoons.push(harpoon);
    return harpoon;
  }

  fireHarpoon(startPos, dir, speed) {
    return this.spawnHarpoon(startPos, dir, speed);
  }

  buildYeti3DModel() {
    this.yetiGroup = new THREE.Group();

    // Procedural High-Fidelity Organic Fur Shaders & PBR Beast Textures
    const furMat = new THREE.MeshStandardMaterial({
      color: 0xf0f6fc,
      roughness: 0.96,
      metalness: 0.08,
      flatShading: true // Gives authentic faceted shaggy fur silhouette
    });
    const iceFrostMat = new THREE.MeshStandardMaterial({
      color: 0x88ccff,
      roughness: 0.22,
      metalness: 0.45,
      emissive: 0x004488,
      emissiveIntensity: 0.35
    });
    const darkMuzzleMat = new THREE.MeshStandardMaterial({
      color: 0x0e131d,
      roughness: 0.85,
      metalness: 0.2
    });
    const clawMat = new THREE.MeshStandardMaterial({
      color: 0x080c14,
      roughness: 0.18,
      metalness: 0.85
    });
    const eyeMat = new THREE.MeshStandardMaterial({
      color: 0xff0044,
      emissive: 0xff0033,
      emissiveIntensity: 4.5,
      roughness: 0.1
    });
    const fangMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.12,
      metalness: 0.25
    });

    // 1. Heavy Hunched Torso & Muscular Chest
    const torsoGeo = new THREE.BoxGeometry(3.6, 4.4, 2.6);
    this.yetiTorso = new THREE.Mesh(torsoGeo, furMat);
    this.yetiTorso.position.y = 3.6;
    this.yetiGroup.add(this.yetiTorso);

    // Hunched Back & Massive Traps
    const backHumpGeo = new THREE.BoxGeometry(3.8, 2.6, 2.2);
    const backHump = new THREE.Mesh(backHumpGeo, furMat);
    backHump.position.set(0, 4.8, -0.6);
    this.yetiGroup.add(backHump);

    // 2. Yeti Head & Snarling Fanged Jaw
    this.yetiHead = new THREE.Group();
    this.yetiHead.position.set(0, 5.7, 0.8);

    const skullGeo = new THREE.BoxGeometry(2.2, 2.0, 2.2);
    const skull = new THREE.Mesh(skullGeo, furMat);
    this.yetiHead.add(skull);

    // Dark Sunken Muzzle
    const muzzleGeo = new THREE.BoxGeometry(1.6, 1.1, 1.2);
    const muzzle = new THREE.Mesh(muzzleGeo, darkMuzzleMat);
    muzzle.position.set(0, -0.3, 1.2);
    this.yetiHead.add(muzzle);

    // Glowing Menacing Eyes
    const eyeGeo = new THREE.SphereGeometry(0.18, 8, 8);
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(-0.55, 0.25, 1.05);
    const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
    eyeR.position.set(0.55, 0.25, 1.05);
    this.yetiHead.add(eyeL);
    this.yetiHead.add(eyeR);

    // Sharp Carnivore Fangs (Top & Bottom)
    const fangGeo = new THREE.ConeGeometry(0.12, 0.45, 6);
    for (let f = -0.5; f <= 0.5; f += 0.5) {
      const topFang = new THREE.Mesh(fangGeo, fangMat);
      topFang.rotation.x = Math.PI;
      topFang.position.set(f, -0.1, 1.6);
      this.yetiHead.add(topFang);

      const botFang = new THREE.Mesh(fangGeo, fangMat);
      botFang.position.set(f * 0.8, -0.65, 1.55);
      this.yetiHead.add(botFang);
    }
    this.yetiGroup.add(this.yetiHead);

    // 3. Articulated Long Primal Arms & Claws
    // Left Arm
    this.yetiArmL = new THREE.Group();
    this.yetiArmL.position.set(-2.2, 4.8, 0.2);
    const armGeo = new THREE.CylinderGeometry(0.65, 0.55, 3.6, 8);
    const armMeshL = new THREE.Mesh(armGeo, furMat);
    armMeshL.position.y = -1.6;
    this.yetiArmL.add(armMeshL);

    // Left Paw & Claws
    const pawL = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.6, 1.2), furMat);
    pawL.position.set(0, -3.4, 0.2);
    this.yetiArmL.add(pawL);
    for (let c = -0.35; c <= 0.35; c += 0.24) {
      const claw = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.48, 6), clawMat);
      claw.rotation.x = -Math.PI / 2;
      claw.position.set(c, -3.4, 0.85);
      this.yetiArmL.add(claw);
    }
    this.yetiGroup.add(this.yetiArmL);

    // Right Arm
    this.yetiArmR = new THREE.Group();
    this.yetiArmR.position.set(2.2, 4.8, 0.2);
    const armMeshR = new THREE.Mesh(armGeo, furMat);
    armMeshR.position.y = -1.6;
    this.yetiArmR.add(armMeshR);

    // Right Paw & Claws
    const pawR = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.6, 1.2), furMat);
    pawR.position.set(0, -3.4, 0.2);
    this.yetiArmR.add(pawR);
    for (let c = -0.35; c <= 0.35; c += 0.24) {
      const claw = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.48, 6), clawMat);
      claw.rotation.x = -Math.PI / 2;
      claw.position.set(c, -3.4, 0.85);
      this.yetiArmR.add(claw);
    }
    this.yetiGroup.add(this.yetiArmR);

    // 4. Heavy Muscular Legs
    const legGeo = new THREE.CylinderGeometry(0.8, 0.65, 3.2, 8);
    // Left Leg
    this.yetiLegL = new THREE.Group();
    this.yetiLegL.position.set(-1.1, 2.2, 0);
    const legMeshL = new THREE.Mesh(legGeo, furMat);
    legMeshL.position.y = -1.4;
    this.yetiLegL.add(legMeshL);
    const footL = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.6, 2.0), furMat);
    footL.position.set(0, -2.8, 0.4);
    this.yetiLegL.add(footL);
    this.yetiGroup.add(this.yetiLegL);

    // Right Leg
    this.yetiLegR = new THREE.Group();
    this.yetiLegR.position.set(1.1, 2.2, 0);
    const legMeshR = new THREE.Mesh(legGeo, furMat);
    legMeshR.position.y = -1.4;
    this.yetiLegR.add(legMeshR);
    const footR = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.6, 2.0), furMat);
    footR.position.set(0, -2.8, 0.4);
    this.yetiLegR.add(footR);
    this.yetiGroup.add(this.yetiLegR);

    // 5. Harpoon Embedded Socket Marker (Glowing Cyan Wound)
    const woundGeo = new THREE.TorusGeometry(0.35, 0.08, 8, 16);
    const woundMat = new THREE.MeshStandardMaterial({
      color: 0x00ffff,
      emissive: 0x00ffff,
      emissiveIntensity: 2.2
    });
    this.yetiTetherSocket = new THREE.Mesh(woundGeo, woundMat);
    this.yetiTetherSocket.position.set(0, 4.4, -1.35);
    this.yetiTetherSocket.rotation.x = Math.PI / 2;
    this.yetiGroup.add(this.yetiTetherSocket);

    this.yetiGroup.position.set(0, 0, 60);
    this.scene.add(this.yetiGroup);
  }

  loadYetiSprite() {
    this.buildYeti3DModel();
  }

  updateYeti(yetiData, dt) {
    if (!yetiData) {
      if (this.yetiGroup) this.yetiGroup.visible = false;
      return;
    }
    if (!this.yetiGroup) return;

    const state = yetiData.state || "RUNNING_DOWNHILL";

    if (typeof yetiData.hp === "number" && yetiData.hp <= 0 && state !== "FALLEN" && state !== "DRAGGED_DOWN") {
      this.yetiGroup.visible = false;
      return;
    }

    this.yetiGroup.visible = true;
    this.yetiGroup.position.x = yetiData.x || 0;
    this.yetiGroup.position.z = yetiData.z || 0;

    const t = performance.now() * 0.001;

    // Tier-based snow plume emission
    const tierData = yetiData.tierData;
    if (tierData && tierData.snowPlume > 0 && state !== "DRAGGED_DOWN" && state !== "FALLEN") {
      if (Math.random() < tierData.snowPlume * 0.3) {
        this.emitCarveSpray({ x: yetiData.x, y: (yetiData.y || 0), z: yetiData.z }, 0.4 * tierData.snowPlume);
      }
    }

    if (state === "DRAGGED_DOWN" || state === "FALLEN") {
      // 💥 REALISTIC 3D DRAG-DOWN / FALLEN: Tumbled flat face-first into snow
      this.yetiGroup.position.y = (yetiData.y || 0) + 0.6;
      this.yetiGroup.rotation.x = Math.PI / 2 - 0.15;
      this.yetiGroup.rotation.y = (yetiData.steer || 0) * 0.6 + Math.sin(t * 14) * 0.1;
      this.yetiGroup.rotation.z = Math.sin(t * 10) * 0.15;

      if (this.yetiArmL) this.yetiArmL.rotation.x = 2.4;
      if (this.yetiArmR) this.yetiArmR.rotation.x = 2.4;
      if (this.yetiLegL) this.yetiLegL.rotation.x = 0.2;
      if (this.yetiLegR) this.yetiLegR.rotation.x = -0.2;

      this.emitCarveSpray(this.yetiGroup.position, 0.5);

    } else if (state === "STAGGERED") {
      // ⚡ STAGGERED: Stumbling backward, arms flailing wildly
      this.yetiGroup.position.y = (yetiData.y || 0);
      this.yetiGroup.rotation.x = -0.45 + Math.sin(t * 6) * 0.15;
      this.yetiGroup.rotation.y = Math.sin(t * 8) * 0.35;
      this.yetiGroup.rotation.z = Math.sin(t * 5) * 0.2;

      // Arms flailing outward in shock
      if (this.yetiArmL) this.yetiArmL.rotation.x = -2.0 + Math.sin(t * 12) * 0.8;
      if (this.yetiArmR) this.yetiArmR.rotation.x = -2.0 - Math.sin(t * 12) * 0.8;
      if (this.yetiLegL) this.yetiLegL.rotation.x = -0.3 + Math.sin(t * 6) * 0.2;
      if (this.yetiLegR) this.yetiLegR.rotation.x = 0.3 - Math.sin(t * 6) * 0.2;

      // Snow spray from stumble
      this.emitCarveSpray(this.yetiGroup.position, 0.3);

    } else if (state === "TOWED_THRASHING") {
      // ⛓️ TOWED & THRASHING: Fighting the cable violently
      this.yetiGroup.position.y = (yetiData.y || 0);
      const thrashIntensity = tierData ? tierData.thrashIntensity : 0.5;
      this.yetiGroup.rotation.x = -0.25 + Math.sin(t * 10 * thrashIntensity) * 0.12;
      this.yetiGroup.rotation.y = Math.sin(t * (12 + thrashIntensity * 8)) * (0.15 + thrashIntensity * 0.2);
      this.yetiGroup.rotation.z = Math.sin(t * 7) * 0.1;

      // Arms reaching backward trying to grab cable
      if (this.yetiArmL) this.yetiArmL.rotation.x = -1.5 + Math.sin(t * 16) * 0.6 * thrashIntensity;
      if (this.yetiArmR) this.yetiArmR.rotation.x = -1.5 - Math.sin(t * 16) * 0.6 * thrashIntensity;
      // Legs still running forward
      if (this.yetiLegL) this.yetiLegL.rotation.x = -Math.sin(t * 9) * 0.65;
      if (this.yetiLegR) this.yetiLegR.rotation.x = Math.sin(t * 9) * 0.65;

      // Heavy snow spray from thrashing
      this.emitCarveSpray(this.yetiGroup.position, 0.4 + thrashIntensity * 0.3);

    } else if (state === "RECOVERING") {
      // 🔥 RECOVERING: Enraged sprint — leaning far forward, arms pumping furiously
      this.yetiGroup.position.y = (yetiData.y || 0);
      this.yetiGroup.rotation.x = 0.35; // Aggressive forward lean
      this.yetiGroup.rotation.y = Math.sin(t * 5) * 0.08;
      this.yetiGroup.rotation.z = 0;

      // Furious pumping stride
      const rageStride = Math.sin(t * 12);
      if (this.yetiArmL) this.yetiArmL.rotation.x = rageStride * 1.3;
      if (this.yetiArmR) this.yetiArmR.rotation.x = -rageStride * 1.3;
      if (this.yetiLegL) this.yetiLegL.rotation.x = -rageStride * 1.0;
      if (this.yetiLegR) this.yetiLegR.rotation.x = rageStride * 1.0;
      if (this.yetiTorso) this.yetiTorso.position.y = 3.6 + Math.abs(rageStride) * 0.5;

      // Aggressive snow plume
      this.emitCarveSpray(this.yetiGroup.position, 0.7);

    } else if (state === "LEAPING") {
      // 🦘 LEAPING: Airborne bound with arms spread
      this.yetiGroup.position.y = (yetiData.y || 0);
      this.yetiGroup.rotation.x = 0.3;
      this.yetiGroup.rotation.y = Math.sin(t * 3) * 0.1;
      this.yetiGroup.rotation.z = 0;

      // Arms spread wide in mid-air
      if (this.yetiArmL) this.yetiArmL.rotation.x = -1.2;
      if (this.yetiArmR) this.yetiArmR.rotation.x = -1.2;
      // Legs tucked for leap
      if (this.yetiLegL) this.yetiLegL.rotation.x = 0.5;
      if (this.yetiLegR) this.yetiLegR.rotation.x = 0.5;

    } else if (state === "BAYED_UP" || state === "DEFENSIVE") {
      // ⚡ TETHERED & THRASHING (legacy): Straining back against cable
      this.yetiGroup.position.y = (yetiData.y || 0);
      this.yetiGroup.rotation.x = -0.32;
      this.yetiGroup.rotation.y = Math.sin(t * 16) * 0.22;
      this.yetiGroup.rotation.z = Math.sin(t * 8) * 0.08;

      if (this.yetiArmL) this.yetiArmL.rotation.x = -1.3 + Math.sin(t * 14) * 0.45;
      if (this.yetiArmR) this.yetiArmR.rotation.x = -1.3 - Math.sin(t * 14) * 0.45;
      if (this.yetiLegL) this.yetiLegL.rotation.x = -0.4;
      if (this.yetiLegR) this.yetiLegR.rotation.x = 0.4;
    } else {
      // 🎿 RUNNING DOWNHILL / STALKING (default)
      this.yetiGroup.position.y = (yetiData.y || 0);
      this.yetiGroup.rotation.x = 0.18;
      this.yetiGroup.rotation.y = Math.sin(t * 4) * 0.06;
      this.yetiGroup.rotation.z = 0;

      const stride = Math.sin(t * 8.5);
      if (this.yetiArmL) this.yetiArmL.rotation.x = stride * 0.9;
      if (this.yetiArmR) this.yetiArmR.rotation.x = -stride * 0.9;
      if (this.yetiLegL) this.yetiLegL.rotation.x = -stride * 0.75;
      if (this.yetiLegR) this.yetiLegR.rotation.x = stride * 0.75;
      if (this.yetiTorso) this.yetiTorso.position.y = 3.6 + Math.abs(stride) * 0.3;
    }
  }

  updateHarpoons(dt, yetiEntity, playerPos, onHitCallback) {
    if (!this.activeHarpoons || this.activeHarpoons.length === 0) {
      // Ensure hook is loaded and visible in the barrel when no projectile is flying
      if (this.loadedHookMesh) this.loadedHookMesh.visible = true;
      return;
    }

    for (let i = this.activeHarpoons.length - 1; i >= 0; i--) {
      const h = this.activeHarpoons[i];
      h.life -= dt;

      if (h.state === "RETRACTING") {
        // High-speed winch cable retraction pulling hook back to launcher
        const retractTarget = new THREE.Vector3(playerPos.x + 0.35, playerPos.y + 0.9, playerPos.z + 0.5);
        h.mesh.position.lerp(retractTarget, 0.28);

        if (h.line && playerPos) {
          const positions = h.line.geometry.attributes.position.array;
          positions[0] = playerPos.x;
          positions[1] = playerPos.y + 0.8;
          positions[2] = playerPos.z;
          positions[3] = h.mesh.position.x;
          positions[4] = h.mesh.position.y;
          positions[5] = h.mesh.position.z;
          h.line.geometry.attributes.position.needsUpdate = true;
        }

        if (h.mesh.position.distanceTo(retractTarget) < 1.8 || h.life <= 0) {
          if (h.mesh) this.scene.remove(h.mesh);
          if (h.line) this.scene.remove(h.line);
          this.activeHarpoons.splice(i, 1);
          // Hook is fully winched back into the chamber - reload ready!
          if (this.loadedHookMesh) this.loadedHookMesh.visible = true;
        }
        continue;
      }

      const step = h.speed * dt;
      h.traveled += step;
      h.mesh.position.addScaledVector(h.dir, step);

      // Update trailing cable line
      if (h.line && playerPos) {
        const positions = h.line.geometry.attributes.position.array;
        positions[0] = playerPos.x;
        positions[1] = playerPos.y + 0.8;
        positions[2] = playerPos.z;
        positions[3] = h.mesh.position.x;
        positions[4] = h.mesh.position.y;
        positions[5] = h.mesh.position.z;
        h.line.geometry.attributes.position.needsUpdate = true;
      }

      // Proximity check to Yeti or target
      let hit = false;
      const target = yetiEntity || (this.yetiSprite && this.yetiSprite.visible ? { x: this.yetiSprite.position.x, y: this.yetiSprite.position.y, z: this.yetiSprite.position.z, hp: 1000 } : null);
      if (target && (typeof target.hp !== "number" || target.hp > 0)) {
        const dx = h.mesh.position.x - target.x;
        const dz = h.mesh.position.z - target.z;
        const dist = Math.hypot(dx, dz);

        if (dist < 6.5) {
          hit = true;
          if (onHitCallback) {
            onHitCallback(h, dist, dx, dz);
          }
          if (window.__combatSystem && typeof window.__combatSystem.handleHarpoonHit === "function") {
            window.__combatSystem.handleHarpoonHit(target, 0);
          }
        }
      }

      if (hit || h.traveled >= h.maxDist || h.life <= 0) {
        // Begin rapid cable winch retraction back to player
        h.state = "RETRACTING";
        h.life = 0.35; // Fast snappy winch back
      }
    }
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  onWindowResize() {
    if (!this.camera || !this.renderer) return;
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}
