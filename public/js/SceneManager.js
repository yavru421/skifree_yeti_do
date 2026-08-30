// public/js/SceneManager.js
// Authentic 2.5D Animated Sprite Character Engine & Granby Colorado Alpine Slope

import { loadChromaKeyTexture } from './SpriteUtils.js';

export class SceneManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.textureLoader = new THREE.TextureLoader();

    this.isFPV = true; // Default: First-Person View (FPV)
    this.cameraOffset = new THREE.Vector3(0, 2.8, -5.5);
    this.cameraLookOffset = new THREE.Vector3(0, 1.2, 14.0);

    this.terrainMesh = null;
    this.snowParticles = null;
    this.skierGroup = null;
    this.skierSprite = null;
    this.skierTexture = null;

    this.trees = [];
    this.kickers = [];
    this.grindRails = [];
    this.icePatches = [];
    this.slalomGates = [];
    this.gondolaCabins = [];
    this.mountainPeaks = [];
    this.finishLineMesh = null;
    this.ghostSkiers = new Map();

    this.currentBiome = "alpine";
    this.init();
  }

  init() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x89b6dc); // Colorado blue sky
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
    this.buildCleanCrossPlaneTrees();
    this.buildSkiLiftSystem();
    this.buildSnowKickers();
    this.buildGrindableRails();
    this.buildIcePatches();
    this.buildSlalomGates();
    this.buildSnowParticles();

    window.addEventListener("resize", () => this.onWindowResize());
  }

  setupLighting() {
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x4a709c, 1.2);
    hemiLight.position.set(0, 80, 0);
    this.scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xfffaed, 1.6);
    dirLight.position.set(-50, 90, -60);
    this.scene.add(dirLight);
  }

  buildDistantMountainRange() {
    const rockMat = new THREE.MeshLambertMaterial({ color: 0x243242 });
    const snowCapMat = new THREE.MeshLambertMaterial({ color: 0xffffff });

    for (let i = 0; i < 28; i++) {
      const peakGroup = new THREE.Group();
      const peakHeight = 130 + Math.random() * 120;
      const peakRadius = 80 + Math.random() * 60;

      const rockGeo = new THREE.ConeGeometry(peakRadius, peakHeight, 6);
      const rockMesh = new THREE.Mesh(rockGeo, rockMat);
      peakGroup.add(rockMesh);

      const capGeo = new THREE.ConeGeometry(peakRadius * 0.46, peakHeight * 0.46, 6);
      const capMesh = new THREE.Mesh(capGeo, snowCapMat);
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

    // Load Authentic Chroma-Key Skier Sprite (6 Rows x 8 Columns)
    loadChromaKeyTexture('/assets/skier.jpg', 215, (texture) => {
      this.skierTexture = texture;
      // Grid: 8 columns (width: 1/8 = 0.125), 6 rows (height: 1/6 = 0.1667)
      this.skierTexture.repeat.set(1 / 8, 1 / 6);
      this.skierTexture.offset.set(0.0, 5 / 6); // Row 0 (offset.y = 0.8333): Downhill glide

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
    const terrainGeo = new THREE.PlaneGeometry(1600, 2400, 32, 32);
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
    this.terrainMesh.position.set(0, 0, 1100);
    this.scene.add(this.terrainMesh);
  }

  buildCleanCrossPlaneTrees() {
    const treeTex = this.textureLoader.load('/assets/pine_tree.png');
    const treeGeo = new THREE.PlaneGeometry(6.5, 9.0);
    const treeMat = new THREE.MeshStandardMaterial({
      map: treeTex,
      transparent: true,
      alphaTest: 0.15,
      roughness: 0.8,
      side: THREE.DoubleSide
    });

    // Granby Ranch Colorado Groomer Corridor:
    // 0 - 450m: Peaceful open groomer (trees strictly along the outer edges |tx| > 35)
    // 450 - 900m: Mid-mountain cruiser (side tree lines |tx| > 24)
    // 900m+: Backcountry dense forest (free trees)
    for (let i = 0; i < 75; i++) {
      const treeGroup = new THREE.Group();
      const p1 = new THREE.Mesh(treeGeo, treeMat);
      p1.position.y = 4.5;
      const p2 = new THREE.Mesh(treeGeo, treeMat);
      p2.position.y = 4.5;
      p2.rotation.y = Math.PI / 2;

      treeGroup.add(p1);
      treeGroup.add(p2);

      const tz = 80 + i * 16 + Math.random() * 8;
      let tx;
      if (tz < 450) {
        // Safe beginner groomer runway: trees only far on the edges
        const side = Math.random() > 0.5 ? 1 : -1;
        tx = side * (36 + Math.random() * 45);
      } else if (tz < 900) {
        // Mid-mountain cruiser
        const side = Math.random() > 0.5 ? 1 : -1;
        tx = side * (24 + Math.random() * 40);
      } else {
        // Backcountry tree lines
        tx = (Math.random() - 0.5) * 110;
      }

      treeGroup.position.set(tx, 0, tz);
      this.trees.push(treeGroup);
      this.scene.add(treeGroup);
    }
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

  buildSnowKickers() {
    const rampGeo = new THREE.BoxGeometry(6, 1.8, 4);
    const rampMat = new THREE.MeshStandardMaterial({ color: 0x00f0ff, emissive: 0x0066aa, emissiveIntensity: 0.3 });

    // Kickers start after 300m for big air
    for (let i = 0; i < 14; i++) {
      const mesh = new THREE.Mesh(rampGeo, rampMat);
      mesh.rotation.x = -0.35;
      const kz = 320 + i * 85 + Math.random() * 20;
      const kx = Math.sin(i * 1.3) * 26;
      mesh.position.set(kx, 0.8, kz);
      this.scene.add(mesh);
      this.kickers.push(mesh);
    }
  }

  buildGrindableRails() {
    const railGeo = new THREE.CylinderGeometry(0.18, 0.18, 28, 8);
    const railMat = new THREE.MeshStandardMaterial({ color: 0xffcc00, metalness: 0.9, roughness: 0.1 });

    // Rails start after 450m
    for (let i = 0; i < 7; i++) {
      const mesh = new THREE.Mesh(railGeo, railMat);
      mesh.rotation.x = Math.PI / 2.2;
      const rz = 480 + i * 120;
      const rx = (i % 2 === 0 ? 16 : -16) + (Math.random() - 0.5) * 6;
      mesh.position.set(rx, 1.0, rz);
      this.scene.add(mesh);
      this.grindRails.push(mesh);
    }
  }

  buildIcePatches() {
    const iceGeo = new THREE.PlaneGeometry(20, 32);
    const iceTex = this.textureLoader.load('/assets/ice_texture.jpg');
    iceTex.wrapS = THREE.RepeatWrapping;
    iceTex.wrapT = THREE.RepeatWrapping;
    iceTex.repeat.set(2, 3);

    const iceMat = new THREE.MeshStandardMaterial({
      map: iceTex,
      color: 0x99eeff,
      transparent: true,
      opacity: 0.85,
      roughness: 0.08,
      metalness: 0.75,
      side: THREE.DoubleSide
    });

    // Ice starts after 500m
    for (let i = 0; i < 6; i++) {
      const mesh = new THREE.Mesh(iceGeo, iceMat);
      mesh.rotation.x = -Math.PI / 2;
      const iz = 520 + i * 140;
      const ix = Math.sin(i * 1.8) * 22;
      mesh.position.set(ix, 0.05, iz);
      this.scene.add(mesh);
      this.icePatches.push(mesh);
    }
  }

  buildSlalomGates() {
    const poleGeo = new THREE.CylinderGeometry(0.12, 0.12, 3.8, 8);
    const blueMat = new THREE.MeshStandardMaterial({ color: 0x00f0ff, emissive: 0x0088ff, emissiveIntensity: 0.5 });
    const redMat = new THREE.MeshStandardMaterial({ color: 0xff0055, emissive: 0xff0033, emissiveIntensity: 0.5 });

    // Slalom gates start after 220m with generous width (14m)
    for (let i = 0; i < 28; i++) {
      const group = new THREE.Group();
      const isBlue = i % 2 === 0;
      const mat = isBlue ? blueMat : redMat;
      const gateWidth = i < 8 ? 14 : 10;
      const gateX = Math.sin(i * 0.6) * (i < 8 ? 18 : 28);
      const gateZ = 240 + i * 38;

      const leftPole = new THREE.Mesh(poleGeo, mat);
      leftPole.position.set(-gateWidth / 2, 1.9, 0);
      const rightPole = new THREE.Mesh(poleGeo, mat);
      rightPole.position.set(gateWidth / 2, 1.9, 0);

      const bannerGeo = new THREE.BoxGeometry(gateWidth, 0.35, 0.05);
      const banner = new THREE.Mesh(bannerGeo, mat);
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

    // Finish Line at 1200m
    const finishGroup = new THREE.Group();
    const finishMat = new THREE.MeshStandardMaterial({ color: 0xffff00, emissive: 0xffff00, emissiveIntensity: 0.6 });
    const fLeft = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 5.0, 8), finishMat);
    fLeft.position.set(-12, 2.5, 0);
    const fRight = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 5.0, 8), finishMat);
    fRight.position.set(12, 2.5, 0);
    const fBanner = new THREE.Mesh(new THREE.BoxGeometry(24, 1.2, 0.1), finishMat);
    fBanner.position.set(0, 4.2, 0);
    finishGroup.add(fLeft);
    finishGroup.add(fRight);
    finishGroup.add(fBanner);
    finishGroup.position.set(0, 0, 1200);
    this.scene.add(finishGroup);
    this.finishLineMesh = finishGroup;
  }

  buildSnowParticles() {
    const count = 500;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count * 3; i += 3) {
      pos[i] = (Math.random() - 0.5) * 25;
      pos[i + 1] = Math.random() * 6 - 1;
      pos[i + 2] = Math.random() * 30;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.14, transparent: true, opacity: 0.85 });
    this.snowParticles = new THREE.Points(geo, mat);
    this.scene.add(this.snowParticles);
  }

  toggleCameraMode() {
    this.isFPV = !this.isFPV;
    if (this.skierSprite) {
      this.skierSprite.visible = !this.isFPV;
    }
    return this.isFPV ? "FPV (Goggles)" : "TPV (Chase)";
  }

  updateCamera(playerPos, playerSteer, playerPitch, playerAirY, playerAirRoll) {
    // 1. Sync skier sprite world position
    this.skierGroup.position.set(playerPos.x, playerPos.y + playerAirY, playerPos.z);
    if (this.skierSprite) {
      this.skierSprite.visible = !this.isFPV;
    }

    if (this.isFPV) {
      // First-Person View (FPV): Inside the Skier Goggles / Helmet
      this.camera.position.set(playerPos.x, playerPos.y + playerAirY + 1.40, playerPos.z + 0.2);
      this.camera.rotation.y = -playerSteer * 0.45; // Smooth head turn into carve
      this.camera.rotation.x = playerPitch - 0.04;   // Tuck downhill / brake
      this.camera.rotation.z = -playerSteer * 0.18;  // Natural body roll bank into turn
    } else {
      // Third-Person View (TPV Chase Cam)
      if (this.skierTexture && this.skierSprite) {
        if (playerAirY > 0.4) {
          this.skierTexture.offset.set(2 * 0.125, 0.1667);
          this.skierSprite.material.rotation = playerAirRoll;
        } else if (playerSteer < -0.35) {
          this.skierTexture.offset.set(4 * 0.125, 0.5000);
          this.skierSprite.material.rotation = -0.15;
        } else if (playerSteer < -0.10) {
          this.skierTexture.offset.set(1 * 0.125, 0.5000);
          this.skierSprite.material.rotation = -0.06;
        } else if (playerSteer > 0.35) {
          this.skierTexture.offset.set(4 * 0.125, 0.6667);
          this.skierSprite.material.rotation = 0.15;
        } else if (playerSteer > 0.10) {
          this.skierTexture.offset.set(1 * 0.125, 0.6667);
          this.skierSprite.material.rotation = 0.06;
        } else if (playerPitch < -0.05) {
          this.skierTexture.offset.set(2 * 0.125, 0.3333);
          this.skierSprite.material.rotation = 0;
        } else {
          this.skierTexture.offset.set(0.0, 0.8333);
          this.skierSprite.material.rotation = 0;
        }
      }

      const targetCamPos = new THREE.Vector3(
        playerPos.x - Math.sin(playerSteer * 0.25) * 1.2,
        playerPos.y + playerAirY + this.cameraOffset.y,
        playerPos.z + this.cameraOffset.z
      );
      this.camera.position.lerp(targetCamPos, 0.22);

      const lookTarget = new THREE.Vector3(
        playerPos.x + Math.sin(playerSteer) * 3.0,
        playerPos.y + playerAirY + this.cameraLookOffset.y,
        playerPos.z + this.cameraLookOffset.z
      );
      this.camera.lookAt(lookTarget);
    }

    // Snow particle loop centered around camera / player
    if (this.snowParticles) {
      const pos = this.snowParticles.geometry.attributes.position.array;
      for (let i = 0; i < pos.length; i += 3) {
        pos[i + 2] -= 0.5;
        if (pos[i + 2] < playerPos.z - 10) {
          pos[i + 2] = playerPos.z + 25;
          pos[i] = playerPos.x + (Math.random() - 0.5) * 25;
        }
      }
      this.snowParticles.geometry.attributes.position.needsUpdate = true;
    }
  }

  updateGhostSkiers(remotePlayers, localPlayerId) {
    if (!remotePlayers || !Array.isArray(remotePlayers)) return;
    const activeIds = new Set();

    remotePlayers.forEach((p) => {
      if (p.id === localPlayerId) return; // Skip self
      activeIds.add(p.id);

      let ghost = this.ghostSkiers.get(p.id);
      if (!ghost) {
        // Create new ghost skier sprite
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

      // Smooth position interpolation
      ghost.group.position.x += (p.x - ghost.group.position.x) * 0.35;
      ghost.group.position.z += (p.z - ghost.group.position.z) * 0.35;
      ghost.group.rotation.y = p.steer || 0;
      ghost.group.rotation.z = -(p.steer || 0) * 0.45;
    });

    // Remove disconnected ghost skiers
    for (const [id, ghost] of this.ghostSkiers.entries()) {
      if (!activeIds.has(id)) {
        this.scene.remove(ghost.group);
        this.ghostSkiers.delete(id);
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
