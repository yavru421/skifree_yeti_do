// public/js/SceneManager.js
// 3D Alpine Environment, High-Res Snowy Peaks, Cross-Plane Trees, Gondola Lift & Clean Skier

export class SceneManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.textureLoader = new THREE.TextureLoader();

    this.isFPV = false; // Default: Third-Person Chase Cam
    this.cameraOffset = new THREE.Vector3(0, 2.8, -5.5);
    this.cameraLookOffset = new THREE.Vector3(0, 1.2, 14.0);

    this.terrainMesh = null;
    this.snowParticles = null;
    this.skierGroup = null;
    this.rifleMesh = null;

    this.trees = [];
    this.kickers = [];
    this.grindRails = [];
    this.icePatches = [];
    this.slalomGates = [];
    this.gondolaCabins = [];
    this.mountainPeaks = [];
    this.finishLineMesh = null;

    this.currentBiome = "alpine";
    this.init();
  }

  init() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a1020);
    this.scene.fog = new THREE.FogExp2(0x0a1020, 0.007);

    this.camera = new THREE.PerspectiveCamera(
      65,
      window.innerWidth / window.innerHeight,
      0.1,
      800
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
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x445577, 1.0);
    hemiLight.position.set(0, 60, 0);
    this.scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xaaccff, 0.95);
    dirLight.position.set(-30, 50, -40);
    this.scene.add(dirLight);
  }

  buildDistantMountainRange() {
    const rockMat = new THREE.MeshLambertMaterial({ color: 0x2d3a4d });
    const snowCapMat = new THREE.MeshLambertMaterial({ color: 0xffffff });

    for (let i = 0; i < 24; i++) {
      const peakGroup = new THREE.Group();
      const peakHeight = 120 + Math.random() * 100;
      const peakRadius = 70 + Math.random() * 50;

      const rockGeo = new THREE.ConeGeometry(peakRadius, peakHeight, 6);
      const rockMesh = new THREE.Mesh(rockGeo, rockMat);
      peakGroup.add(rockMesh);

      const capGeo = new THREE.ConeGeometry(peakRadius * 0.45, peakHeight * 0.45, 6);
      const capMesh = new THREE.Mesh(capGeo, snowCapMat);
      capMesh.position.y = peakHeight * 0.28;
      peakGroup.add(capMesh);

      const angle = (i / 24) * Math.PI * 1.8 - (Math.PI * 0.9);
      const distance = 540 + Math.random() * 120;
      peakGroup.position.set(Math.sin(angle) * distance, 35 + Math.random() * 30, Math.cos(angle) * distance + 600);
      this.scene.add(peakGroup);
      this.mountainPeaks.push(peakGroup);
    }
  }

  buildSkierMesh() {
    this.skierGroup = new THREE.Group();

    // 1. Curved Racing Skis (Steel Edges, Camber & Upturned Tips)
    const skiBodyGeo = new THREE.BoxGeometry(0.18, 0.04, 2.2);
    const skiMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      metalness: 0.85,
      roughness: 0.18
    });
    const skiEdgeMat = new THREE.MeshStandardMaterial({
      color: 0xcccccc,
      metalness: 0.95,
      roughness: 0.1
    });
    const tipGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.35, 8, 1, false, 0, Math.PI);

    // Left Ski Assembly
    const leftSkiGroup = new THREE.Group();
    const lBody = new THREE.Mesh(skiBodyGeo, skiMat);
    const lTip = new THREE.Mesh(tipGeo, skiEdgeMat);
    lTip.rotation.z = Math.PI / 2;
    lTip.rotation.x = -0.6;
    lTip.position.set(0, 0.12, 1.15);
    leftSkiGroup.add(lBody);
    leftSkiGroup.add(lTip);
    leftSkiGroup.position.set(-0.32, 0.03, 0.1);

    // Right Ski Assembly
    const rightSkiGroup = new THREE.Group();
    const rBody = new THREE.Mesh(skiBodyGeo, skiMat);
    const rTip = new THREE.Mesh(tipGeo, skiEdgeMat);
    rTip.rotation.z = Math.PI / 2;
    rTip.rotation.x = -0.6;
    rTip.position.set(0, 0.12, 1.15);
    rightSkiGroup.add(rBody);
    rightSkiGroup.add(rTip);
    rightSkiGroup.position.set(0.32, 0.03, 0.1);

    this.skierGroup.add(leftSkiGroup);
    this.skierGroup.add(rightSkiGroup);

    // 2. Molded Alpine Racing Boots & Step-in Bindings
    const bootGeo = new THREE.BoxGeometry(0.22, 0.32, 0.5);
    const bootMat = new THREE.MeshStandardMaterial({ color: 0x181828, roughness: 0.4 });
    const bindingGeo = new THREE.BoxGeometry(0.24, 0.08, 0.65);
    const bindingMat = new THREE.MeshStandardMaterial({ color: 0x444455, metalness: 0.8 });

    const leftBinding = new THREE.Mesh(bindingGeo, bindingMat);
    leftBinding.position.set(-0.32, 0.06, 0);
    const leftBoot = new THREE.Mesh(bootGeo, bootMat);
    leftBoot.position.set(-0.32, 0.22, -0.02);
    leftBoot.rotation.x = 0.12; // Forward racing cant
    this.skierGroup.add(leftBinding);
    this.skierGroup.add(leftBoot);

    const rightBinding = new THREE.Mesh(bindingGeo, bindingMat);
    rightBinding.position.set(0.32, 0.06, 0);
    const rightBoot = new THREE.Mesh(bootGeo, bootMat);
    rightBoot.position.set(0.32, 0.22, -0.02);
    rightBoot.rotation.x = 0.12;
    this.skierGroup.add(rightBinding);
    this.skierGroup.add(rightBoot);

    // 3. Slalom Racing Legs (Bent at Knees in Forward Tuck)
    const legGeo = new THREE.CylinderGeometry(0.11, 0.13, 0.65, 8);
    const suitLegMat = new THREE.MeshStandardMaterial({ color: 0x111625, roughness: 0.5 });
    
    const leftLeg = new THREE.Mesh(legGeo, suitLegMat);
    leftLeg.position.set(-0.28, 0.55, -0.06);
    leftLeg.rotation.x = 0.25;
    const rightLeg = new THREE.Mesh(legGeo, suitLegMat);
    rightLeg.position.set(0.28, 0.55, -0.06);
    rightLeg.rotation.x = 0.25;
    this.skierGroup.add(leftLeg);
    this.skierGroup.add(rightLeg);

    // 4. Aerodynamic Racing Torso & Alpine Crimson Jacket
    const torsoGeo = new THREE.CylinderGeometry(0.32, 0.24, 0.85, 8);
    const jacketMat = new THREE.MeshStandardMaterial({
      color: 0xff0055,
      roughness: 0.35,
      metalness: 0.1
    });
    this.skierTorso = new THREE.Mesh(torsoGeo, jacketMat);
    this.skierTorso.position.set(0, 1.05, -0.08);
    this.skierTorso.rotation.x = 0.22; // Forward speed lean
    this.skierGroup.add(this.skierTorso);

    // Spine Racing Stripe
    const stripeGeo = new THREE.BoxGeometry(0.08, 0.75, 0.04);
    const stripeMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const stripe = new THREE.Mesh(stripeGeo, stripeMat);
    stripe.position.set(0, 1.05, -0.22);
    stripe.rotation.x = 0.22;
    this.skierGroup.add(stripe);

    // 5. High-Altitude Racing Helmet & Iridescent Mirrored Visor
    const helmetGeo = new THREE.SphereGeometry(0.26, 16, 14);
    const helmetMat = new THREE.MeshStandardMaterial({
      color: 0x1a1d2e,
      metalness: 0.6,
      roughness: 0.2
    });
    this.skierHead = new THREE.Mesh(helmetGeo, helmetMat);
    this.skierHead.position.set(0, 1.55, 0.05);
    this.skierGroup.add(this.skierHead);

    const visorGeo = new THREE.SphereGeometry(0.265, 16, 14, 0, Math.PI, 0, Math.PI * 0.55);
    const visorMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      metalness: 0.95,
      roughness: 0.05,
      emissive: 0x004466,
      emissiveIntensity: 0.3
    });
    this.skierGoggles = new THREE.Mesh(visorGeo, visorMat);
    this.skierGoggles.rotation.x = -Math.PI / 2;
    this.skierGoggles.rotation.z = Math.PI;
    this.skierGoggles.position.set(0, 1.56, 0.06);
    this.skierGroup.add(this.skierGoggles);

    // 6. Carbon Fiber Ski Poles with Grips & Snow Baskets
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.85 });
    const basketMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const poleGeo = new THREE.CylinderGeometry(0.015, 0.015, 1.5, 6);
    const basketGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.02, 8);

    // Left Pole
    const leftPoleGroup = new THREE.Group();
    const lPole = new THREE.Mesh(poleGeo, poleMat);
    const lBasket = new THREE.Mesh(basketGeo, basketMat);
    lBasket.position.y = -0.55;
    leftPoleGroup.add(lPole);
    leftPoleGroup.add(lBasket);
    leftPoleGroup.position.set(-0.55, 0.85, 0);
    leftPoleGroup.rotation.x = -0.4;
    leftPoleGroup.rotation.z = 0.15;
    this.skierGroup.add(leftPoleGroup);

    // Right Pole
    const rightPoleGroup = new THREE.Group();
    const rPole = new THREE.Mesh(poleGeo, poleMat);
    const rBasket = new THREE.Mesh(basketGeo, basketMat);
    rBasket.position.y = -0.55;
    rightPoleGroup.add(rPole);
    rightPoleGroup.add(rBasket);
    rightPoleGroup.position.set(0.55, 0.85, 0);
    rightPoleGroup.rotation.x = -0.4;
    rightPoleGroup.rotation.z = -0.15;
    this.skierGroup.add(rightPoleGroup);

    // 7. Tactical Hunting Rifle
    const rifleGeo = new THREE.BoxGeometry(0.08, 0.12, 1.3);
    const rifleMat = new THREE.MeshStandardMaterial({ color: 0x111118, metalness: 0.9, roughness: 0.2 });
    this.rifleMesh = new THREE.Mesh(rifleGeo, rifleMat);
    this.rifleMesh.position.set(0.42, 1.05, 0.25);
    this.skierGroup.add(this.rifleMesh);

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

    for (let i = 0; i < 75; i++) {
      const treeGroup = new THREE.Group();
      const p1 = new THREE.Mesh(treeGeo, treeMat);
      p1.position.y = 4.5;
      const p2 = new THREE.Mesh(treeGeo, treeMat);
      p2.position.y = 4.5;
      p2.rotation.y = Math.PI / 2;

      treeGroup.add(p1);
      treeGroup.add(p2);

      const tz = 25 + i * 16 + Math.random() * 8;
      const tx = (Math.random() - 0.5) * 140;
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
      towerGroup.position.set(75, 0, 40 + i * 140);
      this.scene.add(towerGroup);

      const cabin = new THREE.Mesh(new THREE.BoxGeometry(3.5, 3.2, 4.5), cabinMat);
      cabin.position.set(72, 18, 40 + i * 140);
      this.scene.add(cabin);
      this.gondolaCabins.push({ mesh: cabin, zBase: 40 + i * 140 });
    }
  }

  buildSnowKickers() {
    const rampGeo = new THREE.BoxGeometry(6, 1.8, 4);
    const rampMat = new THREE.MeshStandardMaterial({ color: 0x00f0ff, emissive: 0x0066aa, emissiveIntensity: 0.3 });

    for (let i = 0; i < 16; i++) {
      const mesh = new THREE.Mesh(rampGeo, rampMat);
      mesh.rotation.x = -0.35;
      const kz = 80 + i * 75 + Math.random() * 20;
      const kx = Math.sin(i * 1.3) * 35;
      mesh.position.set(kx, 0.8, kz);
      this.scene.add(mesh);
      this.kickers.push(mesh);
    }
  }

  buildGrindableRails() {
    const railGeo = new THREE.CylinderGeometry(0.18, 0.18, 28, 8);
    const railMat = new THREE.MeshStandardMaterial({ color: 0xffcc00, metalness: 0.9, roughness: 0.1 });

    for (let i = 0; i < 9; i++) {
      const mesh = new THREE.Mesh(railGeo, railMat);
      mesh.rotation.x = Math.PI / 2.2;
      const rz = 100 + i * 110;
      const rx = (i % 2 === 0 ? 18 : -18) + (Math.random() - 0.5) * 6;
      mesh.position.set(rx, 1.0, rz);
      this.scene.add(mesh);
      this.grindRails.push(mesh);
    }
  }

  buildIcePatches() {
    const iceGeo = new THREE.PlaneGeometry(22, 38);
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

    for (let i = 0; i < 8; i++) {
      const mesh = new THREE.Mesh(iceGeo, iceMat);
      mesh.rotation.x = -Math.PI / 2;
      const iz = 120 + i * 120;
      const ix = Math.sin(i * 1.8) * 25;
      mesh.position.set(ix, 0.05, iz);
      this.scene.add(mesh);
      this.icePatches.push(mesh);
    }
  }

  buildSlalomGates() {
    const poleGeo = new THREE.CylinderGeometry(0.12, 0.12, 3.8, 8);
    const blueMat = new THREE.MeshStandardMaterial({ color: 0x00f0ff, emissive: 0x0088ff, emissiveIntensity: 0.5 });
    const redMat = new THREE.MeshStandardMaterial({ color: 0xff0055, emissive: 0xff0033, emissiveIntensity: 0.5 });

    for (let i = 0; i < 30; i++) {
      const group = new THREE.Group();
      const isBlue = i % 2 === 0;
      const mat = isBlue ? blueMat : redMat;
      const gateWidth = 10;
      const gateX = Math.sin(i * 0.65) * 35;
      const gateZ = 60 + i * 38;

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
    return this.isFPV ? "FPV" : "TPV (Chase)";
  }

  updateCamera(playerPos, playerSteer, playerPitch, playerAirY, playerAirRoll) {
    // Sync skier mesh position & carving roll
    this.skierGroup.position.set(playerPos.x, playerPos.y + playerAirY, playerPos.z);
    this.skierGroup.rotation.y = playerSteer;
    this.skierGroup.rotation.z = -playerSteer * 0.45 + playerAirRoll;
    this.skierGroup.rotation.x = playerPitch;

    if (this.isFPV) {
      // First-Person View: inside skier helmet
      this.camera.position.set(playerPos.x, playerPos.y + playerAirY + 1.45, playerPos.z + 0.3);
      this.camera.rotation.y = playerSteer * 0.7;
      this.camera.rotation.x = playerPitch - 0.05;
      this.camera.rotation.z = -playerSteer * 0.15;
    } else {
      // Third-Person Chase Cam with dynamic spring lerp
      const targetCamPos = new THREE.Vector3(
        playerPos.x - Math.sin(playerSteer * 0.3) * 1.5,
        playerPos.y + playerAirY + this.cameraOffset.y,
        playerPos.z + this.cameraOffset.z
      );
      this.camera.position.lerp(targetCamPos, 0.18);

      const lookTarget = new THREE.Vector3(
        playerPos.x + Math.sin(playerSteer) * 4.0,
        playerPos.y + playerAirY + this.cameraLookOffset.y,
        playerPos.z + this.cameraLookOffset.z
      );
      this.camera.lookAt(lookTarget);
    }

    // Snow particle loop centered around player
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
