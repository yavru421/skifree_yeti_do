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

    this.isFPV = false;
    this.cameraOffset = new THREE.Vector3(0, 6.0, -9.2);
    this.cameraLookOffset = new THREE.Vector3(0, 1.0, 9.5);

    this.terrainMesh = null;
    this.snowParticles = null;
    this.skierGroup = null;
    this.skierSprite = null;
    this.skierTexture = null;

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
    this.trauma = 0;

    this.hemiLight = null;
    this.dirLight = null;
    this.currentTrack = null;

    this.init();
  }

  init() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x89b6dc);
    this.scene.fog = new THREE.FogExp2(0x9fc0e2, 0.0035);

    this.camera = new THREE.PerspectiveCamera(
      65,
      window.innerWidth / window.innerHeight,
      0.1,
      1200
    );

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: "high-performance"
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.setupLighting();
    this.buildDistantMountainRange();
    this.buildSkierMesh();
    this.buildContinuousSnowTerrain();
    this.buildSkiLiftSystem();
    this.buildSnowParticles();
    this.buildCarveSpraySystem();
    this.buildNitroJetsSystem();

    window.addEventListener("resize", () => this.onWindowResize());
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
    const treeTex = this.textureLoader.load('/assets/pine_tree.png');
    const treeGeo = new THREE.PlaneGeometry(6.5, 9.0);
    const isNeon = track.features?.trees?.neonTint;
    
    const treeMat = new THREE.MeshStandardMaterial({
      map: treeTex,
      transparent: true,
      alphaTest: 0.15,
      roughness: 0.8,
      side: THREE.DoubleSide,
      color: isNeon ? 0x00ffff : 0xffffff,
      emissive: isNeon ? 0x003366 : 0x000000,
      emissiveIntensity: isNeon ? 0.6 : 0
    });

    const count = track.features?.trees?.count || 75;
    const maxZ = track.features?.trees?.maxZ || 1180;
    const minZ = track.features?.trees?.minZ || 40;

    for (let i = 0; i < count; i++) {
      const treeGroup = new THREE.Group();
      const p1 = new THREE.Mesh(treeGeo, treeMat);
      p1.position.y = 4.5;
      const p2 = new THREE.Mesh(treeGeo, treeMat);
      p2.position.y = 4.5;
      p2.rotation.y = Math.PI / 2;

      treeGroup.add(p1);
      treeGroup.add(p2);

      const tz = minZ + (i / count) * (maxZ - minZ) + (Math.random() - 0.5) * 15;
      let tx;
      if (tz < 350) {
        const side = Math.random() > 0.5 ? 1 : -1;
        tx = side * (32 + Math.random() * 35);
      } else {
        tx = (Math.random() - 0.5) * 100;
      }

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
      const kx = Math.sin(i * 1.4) * 24;
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
      const rx = (i % 2 === 0 ? 15 : -15) + (Math.random() - 0.5) * 6;
      mesh.position.set(rx, 1.0, rz);
      this.scene.add(mesh);
      this.grindRails.push(mesh);
    }
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
      const gateX = Math.sin(i * 0.58) * 22;
      const gateZ = minZ + i * spacing;

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

  buildSkierMesh() {
    this.skierGroup = new THREE.Group();

    loadChromaKeyTexture('/assets/skier.jpg?v=' + Date.now(), 215, (texture) => {
      this.skierTexture = texture;
      this.skierTexture.repeat.set(1 / 8, 1 / 6);
      this.skierTexture.offset.set(0.0, 5 / 6);

      const spriteMat = new THREE.SpriteMaterial({
        map: this.skierTexture,
        transparent: true,
        alphaTest: 0.05
      });
      this.skierSprite = new THREE.Sprite(spriteMat);
      this.skierSprite.scale.set(3.2, 3.2, 1);
      this.skierSprite.position.set(0, 1.4, 0);
      this.skierSprite.visible = !this.isFPV;
      this.skierGroup.add(this.skierSprite);
    });

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
    this.isFPV = !this.isFPV;
    if (this.skierSprite) {
      this.skierSprite.visible = !this.isFPV;
    }
    return this.isFPV ? "FPV (Goggles)" : "TPV (Chase)";
  }

  updateCamera(playerPos, playerSteer, playerPitch, playerAirY, playerAirRoll, playerAirYaw, isAirborne, isNitroActive, avalancheDist) {
    this.camera.up.set(0, 1, 0);

    // 1. Sync skier sprite world position & 3D rotation
    this.skierGroup.position.set(playerPos.x, playerPos.y + playerAirY, playerPos.z);
    
    // Airborne 3D Rotation
    if (isAirborne) {
      this.skierGroup.rotation.y = playerAirYaw || 0;
      this.skierGroup.rotation.z = playerAirRoll || 0;
    } else {
      this.skierGroup.rotation.y = 0;
      this.skierGroup.rotation.z = 0;
    }

    if (this.skierSprite) {
      this.skierSprite.visible = !this.isFPV;
    }

    // 2. Nitro Flames
    if (isNitroActive) {
      this.emitNitroParticles(playerPos);
    } else if (this.nitroJetsMesh) {
      this.nitroJetsMesh.visible = false;
    }

    // 3. Avalanche Snow Wall positioning
    if (this.avalancheWallMesh && typeof avalancheDist === "number") {
      this.avalancheWallMesh.position.set(playerPos.x, 12, playerPos.z - avalancheDist);
      // Tremor shake when avalanche is close
      if (avalancheDist < 45) {
        this.addTrauma(0.08);
      }
    }

    if (this.isFPV) {
      this.camera.position.set(playerPos.x, playerPos.y + playerAirY + 1.75, playerPos.z + 0.2);
      const fpvLookTarget = new THREE.Vector3(
        playerPos.x + Math.sin(playerSteer) * 12.0,
        playerPos.y + playerAirY - 1.8 + playerPitch * 3.5,
        playerPos.z + 50.0
      );
      this.camera.lookAt(fpvLookTarget);
      this.camera.rotation.z = playerSteer * 0.22;
    } else {
      // Third-Person View (TPV Chase Cam)
      if (this.skierTexture && this.skierSprite) {
        if (playerAirY > 0.4) {
          this.skierTexture.offset.set(2 * 0.125, 0.1667);
          this.skierSprite.material.rotation = playerAirRoll || 0;
        } else if (playerSteer > 0.35) {
          this.skierTexture.offset.set(3 * 0.125, 0.5000);
          this.skierSprite.material.rotation = -0.08;
        } else if (playerSteer > 0.08) {
          this.skierTexture.offset.set(1 * 0.125, 0.5000);
          this.skierSprite.material.rotation = -0.04;
        } else if (playerSteer < -0.35) {
          this.skierTexture.offset.set(3 * 0.125, 0.6667);
          this.skierSprite.material.rotation = 0.08;
        } else if (playerSteer < -0.08) {
          this.skierTexture.offset.set(1 * 0.125, 0.6667);
          this.skierSprite.material.rotation = 0.04;
        } else if (playerPitch < -0.05) {
          this.skierTexture.offset.set(2 * 0.125, 0.3333);
          this.skierSprite.material.rotation = 0;
        } else {
          this.skierTexture.offset.set(0.0, 0.8333);
          this.skierSprite.material.rotation = 0;
        }
      }

      const targetCamPos = new THREE.Vector3(
        playerPos.x,
        playerPos.y + playerAirY * 0.5 + this.cameraOffset.y,
        playerPos.z + this.cameraOffset.z
      );
      this.camera.position.lerp(targetCamPos, 0.25);

      const lookTarget = new THREE.Vector3(
        playerPos.x + Math.sin(playerSteer) * 1.5,
        playerPos.y + playerAirY * 0.3 + this.cameraLookOffset.y,
        playerPos.z + this.cameraLookOffset.z
      );
      this.camera.lookAt(lookTarget);
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
