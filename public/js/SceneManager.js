// public/js/SceneManager.js
// 3D Three.js WebGL Scene, Terrain Generation, Biomes & Dynamic Chase Cam

export class SceneManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = null;
    this.camera = null;
    this.renderer = null;

    this.isFPV = false; // Default: Third-Person Chase-Cam (TPV)
    this.cameraOffset = new THREE.Vector3(0, 3.2, -6.5); // Behind and above skier
    this.cameraLookOffset = new THREE.Vector3(0, 1.0, 12.0); // Downhill look target

    this.terrainMesh = null;
    this.snowParticles = null;
    this.skierGroup = null;
    this.leftSki = null;
    this.rightSki = null;
    this.skierBody = null;
    this.rifleMesh = null;

    this.trees = [];
    this.kickers = [];
    this.grindRails = [];
    this.icePatches = [];
    this.slalomGates = [];
    this.finishLineMesh = null;

    this.currentBiome = "alpine"; // alpine (0-400m) -> glacier (400-800m) -> gorge (800-1200m)
    this.init();
  }

  init() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a1020);
    this.scene.fog = new THREE.FogExp2(0x0a1020, 0.008);

    this.camera = new THREE.PerspectiveCamera(
      65,
      window.innerWidth / window.innerHeight,
      0.1,
      600
    );

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: "high-performance"
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = false; // Fast unshadowed mobile rendering

    this.setupLighting();
    this.buildSkierMesh();
    this.buildProceduralTerrain();
    this.buildSnowParticles();
    this.buildObstaclesAndGates();

    window.addEventListener("resize", () => this.onWindowResize());
  }

  setupLighting() {
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x334466, 0.85);
    hemiLight.position.set(0, 50, 0);
    this.scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xaaccff, 0.9);
    dirLight.position.set(-20, 40, -30);
    this.scene.add(dirLight);
  }

  buildSkierMesh() {
    this.skierGroup = new THREE.Group();

    // Skis
    const skiGeo = new THREE.BoxGeometry(0.18, 0.05, 2.2);
    const skiMat = new THREE.MeshLambertMaterial({ color: 0x00f0ff });
    this.leftSki = new THREE.Mesh(skiGeo, skiMat);
    this.leftSki.position.set(-0.35, 0.03, 0);
    this.rightSki = new THREE.Mesh(skiGeo, skiMat);
    this.rightSki.position.set(0.35, 0.03, 0);
    this.skierGroup.add(this.leftSki);
    this.skierGroup.add(this.rightSki);

    // Skier Torso / Jacket (visible in TPV)
    const torsoGeo = new THREE.BoxGeometry(0.7, 0.9, 0.45);
    const torsoMat = new THREE.MeshLambertMaterial({ color: 0xff0055 });
    this.skierBody = new THREE.Mesh(torsoGeo, torsoMat);
    this.skierBody.position.set(0, 0.85, 0);
    this.skierGroup.add(this.skierBody);

    // Helmet & Goggles
    const headGeo = new THREE.SphereGeometry(0.28, 12, 12);
    const headMat = new THREE.MeshLambertMaterial({ color: 0x222233 });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.set(0, 1.45, 0);
    this.skierGroup.add(head);

    const goggleGeo = new THREE.BoxGeometry(0.35, 0.12, 0.15);
    const goggleMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const goggles = new THREE.Mesh(goggleGeo, goggleMat);
    goggles.position.set(0, 1.45, 0.22);
    this.skierGroup.add(goggles);

    // Hunting Rifle slung / aimed forward
    const rifleGeo = new THREE.BoxGeometry(0.12, 0.15, 1.3);
    const rifleMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
    this.rifleMesh = new THREE.Mesh(rifleGeo, rifleMat);
    this.rifleMesh.position.set(0.45, 0.9, 0.35);
    this.skierGroup.add(this.rifleMesh);

    this.scene.add(this.skierGroup);
  }

  buildProceduralTerrain() {
    const terrainGeo = new THREE.PlaneGeometry(160, 2400, 32, 160);
    terrainGeo.rotateX(-Math.PI / 2);

    // Add subtle procedural slope roll
    const pos = terrainGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const y = Math.sin(x * 0.08) * 1.5 + Math.cos(z * 0.03) * 2.0;
      pos.setY(i, y);
    }
    terrainGeo.computeVertexNormals();

    const terrainMat = new THREE.MeshLambertMaterial({
      color: 0xe8f0ff,
      wireframe: false
    });
    this.terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
    this.terrainMesh.position.set(0, -0.1, 1100);
    this.scene.add(this.terrainMesh);
  }

  buildSnowParticles() {
    const particleCount = 750;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount * 3; i += 3) {
      positions[i] = (Math.random() - 0.5) * 80;
      positions[i + 1] = Math.random() * 25;
      positions[i + 2] = Math.random() * 120;
    }

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.35,
      transparent: true,
      opacity: 0.75
    });

    this.snowParticles = new THREE.Points(geometry, material);
    this.scene.add(this.snowParticles);
  }

  buildObstaclesAndGates() {
    // 1. Procedural Trees
    const trunkGeo = new THREE.CylinderGeometry(0.3, 0.4, 1.8, 6);
    const foliageGeo = new THREE.ConeGeometry(1.8, 4.5, 6);
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x4a2e18 });
    const foliageMat = new THREE.MeshLambertMaterial({ color: 0x0f4024 });

    for (let i = 0; i < 90; i++) {
      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = 0.9;
      const foliage = new THREE.Mesh(foliageGeo, foliageMat);
      foliage.position.y = 3.5;
      tree.add(trunk);
      tree.add(foliage);

      const zPos = 20 + i * 13 + Math.random() * 8;
      const xPos = (Math.random() - 0.5) * 65;
      tree.position.set(xPos, 0, zPos);
      this.trees.push(tree);
      this.scene.add(tree);
    }

    // 2. Big Air Kickers
    const kickerGeo = new THREE.BoxGeometry(3.5, 1.2, 3.0);
    const kickerMat = new THREE.MeshLambertMaterial({ color: 0xffff00 });
    for (let i = 0; i < 18; i++) {
      const kicker = new THREE.Mesh(kickerGeo, kickerMat);
      kicker.position.set((Math.random() - 0.5) * 40, 0.6, 60 + i * 65);
      kicker.rotation.x = -0.15;
      this.kickers.push(kicker);
      this.scene.add(kicker);
    }

    // 3. Grind Rails
    const railGeo = new THREE.CylinderGeometry(0.12, 0.12, 12, 8);
    railGeo.rotateX(Math.PI / 2);
    const railMat = new THREE.MeshLambertMaterial({ color: 0xff00ff });
    for (let i = 0; i < 14; i++) {
      const rail = new THREE.Mesh(railGeo, railMat);
      rail.position.set((Math.random() - 0.5) * 40, 0.8, 90 + i * 85);
      this.grindRails.push(rail);
      this.scene.add(rail);
    }

    // 4. Slalom Race Gates (30 gates up to 1200m)
    const poleGeo = new THREE.CylinderGeometry(0.08, 0.08, 3.2, 6);
    const redMat = new THREE.MeshBasicMaterial({ color: 0xff0033 });
    const blueMat = new THREE.MeshBasicMaterial({ color: 0x0088ff });

    for (let i = 0; i < 30; i++) {
      const zPos = 40 + i * 38;
      const xOffset = Math.sin(i * 0.7) * 16;
      const isRed = i % 2 === 0;
      const mat = isRed ? redMat : blueMat;

      const leftPole = new THREE.Mesh(poleGeo, mat);
      leftPole.position.set(xOffset - 3.2, 1.6, zPos);
      const rightPole = new THREE.Mesh(poleGeo, mat);
      rightPole.position.set(xOffset + 3.2, 1.6, zPos);

      this.scene.add(leftPole);
      this.scene.add(rightPole);
      this.slalomGates.push({
        id: i,
        z: zPos,
        x: xOffset,
        cleared: false,
        leftPole,
        rightPole
      });
    }

    // 5. Finish Line at 1200m
    const bannerGeo = new THREE.BoxGeometry(22, 1.5, 0.2);
    const bannerMat = new THREE.MeshBasicMaterial({ color: 0x39ff14 });
    this.finishLineMesh = new THREE.Mesh(bannerGeo, bannerMat);
    this.finishLineMesh.position.set(0, 3.5, 1200);
    this.scene.add(this.finishLineMesh);
  }

  updateBiomes(playerZ) {
    if (playerZ < 400 && this.currentBiome !== "alpine") {
      this.currentBiome = "alpine";
      this.scene.fog.color.setHex(0x0a1020);
      this.renderer.setClearColor(0x0a1020);
    } else if (playerZ >= 400 && playerZ < 800 && this.currentBiome !== "glacier") {
      this.currentBiome = "glacier";
      this.scene.fog.color.setHex(0x051828);
      this.renderer.setClearColor(0x051828);
    } else if (playerZ >= 800 && this.currentBiome !== "gorge") {
      this.currentBiome = "gorge";
      this.scene.fog.color.setHex(0x1a0a10);
      this.renderer.setClearColor(0x1a0a10);
    }
  }

  toggleCameraMode() {
    this.isFPV = !this.isFPV;
    if (this.skierBody) {
      this.skierBody.visible = !this.isFPV;
    }
    return this.isFPV ? "FPV" : "TPV (Chase)";
  }

  updateCamera(playerPos, playerSteer, playerPitch, playerAirY, playerAirRoll) {
    // Sync skier mesh position & carving roll
    this.skierGroup.position.set(playerPos.x, playerPos.y + playerAirY, playerPos.z);
    this.skierGroup.rotation.y = playerSteer;
    this.skierGroup.rotation.z = -playerSteer * 0.45 + playerAirRoll;
    this.skierGroup.rotation.x = playerPitch;

    if (this.isFPV) {
      // First-Person View
      this.camera.position.set(playerPos.x, playerPos.y + playerAirY + 1.45, playerPos.z + 0.2);
      this.camera.rotation.y = playerSteer * 0.7;
      this.camera.rotation.x = playerPitch - 0.05;
      this.camera.rotation.z = -playerSteer * 0.15;
    } else {
      // Third-Person Chase Cam with dynamic spring lerp
      const targetCamPos = new THREE.Vector3(
        playerPos.x - Math.sin(playerSteer * 0.4) * 2.0,
        playerPos.y + playerAirY + this.cameraOffset.y,
        playerPos.z + this.cameraOffset.z
      );
      this.camera.position.lerp(targetCamPos, 0.15);

      const lookTarget = new THREE.Vector3(
        playerPos.x + Math.sin(playerSteer) * 5.0,
        playerPos.y + playerAirY + this.cameraLookOffset.y,
        playerPos.z + this.cameraLookOffset.z
      );
      this.camera.lookAt(lookTarget);
    }

    // Snow particle loop centered around player
    if (this.snowParticles) {
      const pos = this.snowParticles.geometry.attributes.position.array;
      for (let i = 0; i < pos.length; i += 3) {
        pos[i + 2] -= 0.6;
        if (pos[i + 2] < playerPos.z - 20) {
          pos[i + 2] = playerPos.z + 100;
          pos[i] = playerPos.x + (Math.random() - 0.5) * 80;
        }
      }
      this.snowParticles.geometry.attributes.position.needsUpdate = true;
    }

    this.updateBiomes(playerPos.z);
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
