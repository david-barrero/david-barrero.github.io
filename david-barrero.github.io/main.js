// 3D penalty kick: pick a target (or drag the ball) to jump to a section.
(function () {
  const stage = document.getElementById('stage');
  const canvas = document.getElementById('goal3d');
  const flash = document.getElementById('goal-flash');
  const buttons = Array.from(document.querySelectorAll('.target'));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const LABELS = { projects: 'Projects', about: 'About me', resume: 'Resume', skills: 'Skills', contact: 'Contact' };

  function goTo(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
    history.replaceState(null, '', '#' + id);
  }

  // Without WebGL the targets become a simple button row.
  let renderer;
  try {
    if (!window.THREE) throw new Error('three.js missing');
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch (e) {
    stage.classList.add('no-3d');
    buttons.forEach(b => b.addEventListener('click', () => goTo(b.dataset.target)));
    return;
  }

  // ---------- scene ----------
  const NIGHT = /[?&]night/.test(location.search);   // day match by default; add ?night for the night version
  if (NIGHT) stage.classList.add('night');
  const BG = NIGHT ? 0x0a0d12 : 0xdcebf5;
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(BG, 30, 80);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const camera = new THREE.PerspectiveCamera(26, 16 / 9, 0.1, 100);
  const CAM_BASE = new THREE.Vector3(0, 1.9, 16);
  const LOOK = new THREE.Vector3(0, 0.9, 0);
  camera.position.copy(CAM_BASE);
  camera.lookAt(LOOK);

  scene.add(NIGHT ? new THREE.HemisphereLight(0x6f86b0, 0x0c1a10, 0.35) : new THREE.HemisphereLight(0xffffff, 0x4f8a3a, 1.25));
  const key = new THREE.DirectionalLight(NIGHT ? 0xeef4ff : 0xfff1d6, NIGHT ? 1.7 : 2.1);
  key.position.set(NIGHT ? 8 : -6, NIGHT ? 16 : 12, NIGHT ? 10 : 6);
  if (NIGHT) {   // second floodlight from the other side
    const fill = new THREE.DirectionalLight(0xeef4ff, 0.8);
    fill.position.set(-10, 16, 10);
    scene.add(fill);
  }
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 40 });
  scene.add(key);

  // pitch: soft mowing stripes that fade into the fog
  const stripes = document.createElement('canvas');
  stripes.width = 16; stripes.height = 256;
  const sctx = stripes.getContext('2d');
  for (let i = 0; i < 8; i++) {
    sctx.fillStyle = i % 2 ? '#3f9a45' : '#4aab50';
    sctx.fillRect(0, i * 32, 16, 32);
  }
  const grassTex = new THREE.CanvasTexture(stripes);
  grassTex.colorSpace = THREE.SRGBColorSpace;
  grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping;
  grassTex.repeat.set(1, 4);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60),
    new THREE.MeshStandardMaterial({ map: grassTex, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  if (NIGHT) ground.material.color.set(0xa9c2ae);
  scene.add(ground);

  // pitch lines
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });
  function paint(x1, z1, x2, z2, w = 0.08) {
    const len = Math.hypot(x2 - x1, z2 - z1);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(len, w), lineMat);
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = -Math.atan2(z2 - z1, x2 - x1);
    m.position.set((x1 + x2) / 2, 0.005, (z1 + z2) / 2);
    scene.add(m);
  }
  paint(-30, 0, 30, 0);                                        // goal line
  paint(-9.16, 0, -9.16, 5.5); paint(9.16, 0, 9.16, 5.5); paint(-9.16, 5.5, 9.16, 5.5);   // 6-yard box
  paint(-20.16, 0, -20.16, 16.5); paint(20.16, 0, 20.16, 16.5); paint(-20.16, 16.5, 20.16, 16.5); // 18-yard box
  const spot = new THREE.Mesh(new THREE.CircleGeometry(0.11, 24), lineMat);
  spot.rotation.x = -Math.PI / 2; spot.position.set(0, 0.006, 8);
  scene.add(spot);

  // ---------- goal ----------
  const W = 7.32, H = 2.44, D = 2.0, R = 0.06;
  const postMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0.1 });
  function bar(a, b, r = R) {
    const dir = new THREE.Vector3().subVectors(b, a);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, dir.length(), 20), postMat);
    m.position.copy(a).addScaledVector(dir, 0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    m.castShadow = true;
    scene.add(m);
  }
  const v = (x, y, z) => new THREE.Vector3(x, y, z);
  bar(v(-W / 2, 0, 0), v(-W / 2, H, 0));
  bar(v(W / 2, 0, 0), v(W / 2, H, 0));
  bar(v(-W / 2 - R, H, 0), v(W / 2 + R, H, 0));
  // thin back frame
  const thin = 0.025;
  bar(v(-W / 2, H, 0), v(-W / 2, H * 0.9, -D * 0.5), thin);
  bar(v(W / 2, H, 0), v(W / 2, H * 0.9, -D * 0.5), thin);
  bar(v(-W / 2, H * 0.9, -D * 0.5), v(-W / 2, 0, -D), thin);
  bar(v(W / 2, H * 0.9, -D * 0.5), v(W / 2, 0, -D), thin);
  bar(v(-W / 2, 0, -D), v(W / 2, 0, -D), thin);

  // net: a grid of lines; the back panel can bulge when the ball hits it
  const netMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 });
  const STEP = 0.16;
  function netPanel(corner, u, w, nu, nw) {
    const pts = [];
    for (let i = 0; i <= nu; i++) for (let j = 0; j < nw; j++) {
      const a = corner.clone().addScaledVector(u, i / nu).addScaledVector(w, j / nw);
      const b = corner.clone().addScaledVector(u, i / nu).addScaledVector(w, (j + 1) / nw);
      pts.push(a, b);
    }
    for (let j = 0; j <= nw; j++) for (let i = 0; i < nu; i++) {
      const a = corner.clone().addScaledVector(w, j / nw).addScaledVector(u, i / nu);
      const b = corner.clone().addScaledVector(w, j / nw).addScaledVector(u, (i + 1) / nu);
      pts.push(a, b);
    }
    const g = new THREE.BufferGeometry().setFromPoints(pts);
    const lines = new THREE.LineSegments(g, netMat);
    scene.add(lines);
    return lines;
  }
  // back panel: slanted from the top-back frame down to the ground
  const backTopL = v(-W / 2, H * 0.9, -D * 0.5);
  const back = netPanel(backTopL, v(W, 0, 0), v(0, -H * 0.9, -D * 0.5), Math.round(W / STEP), Math.round(H / STEP));
  const backBase = back.geometry.attributes.position.array.slice();
  netPanel(v(-W / 2, H, 0), v(W, 0, 0), v(0, -H * 0.1, -D * 0.5), Math.round(W / STEP), 6);          // roof
  [-W / 2, W / 2].forEach(x => {                                                                       // sides
    const pts = [];
    for (let k = 0; k <= 12; k++) {
      const t = k / 12;
      pts.push(v(x, H * (1 - t), 0), v(x, H * 0.9 * (1 - t), -D * 0.5 - D * 0.5 * t));
      pts.push(v(x, H * (1 - t), 0), v(x, H * (1 - t) * 0.92, -D * (0.25 + 0.75 * t)));
    }
    for (let k = 0; k <= 10; k++) {
      const z = -D * k / 10;
      const top = z > -D * 0.5 ? H - (H * 0.1) * (-z / (D * 0.5)) : H * 0.9 * (1 - (-z - D * 0.5) / (D * 0.5));
      pts.push(v(x, 0, z), v(x, top, z));
    }
    scene.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), netMat));
  });

  // ---------- targets ----------
  const ZONES = {
    tl: { x: -2.55, y: 1.78, w: 1.9, h: 1.05 },
    tr: { x: 2.55, y: 1.78, w: 1.9, h: 1.05 },
    bl: { x: -2.55, y: 0.62, w: 1.9, h: 1.05 },
    br: { x: 2.55, y: 0.62, w: 1.9, h: 1.05 },
    c:  { x: 0, y: 1.22, r: 0.62 },
  };
  const targetMeshes = [];
  function roundedRect(w, h, r) {
    const s = new THREE.Shape();
    s.moveTo(-w / 2 + r, -h / 2);
    s.lineTo(w / 2 - r, -h / 2); s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
    s.lineTo(w / 2, h / 2 - r); s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
    s.lineTo(-w / 2 + r, h / 2); s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
    s.lineTo(-w / 2, -h / 2 + r); s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
    return s;
  }
  buttons.forEach(btn => {
    const z = ZONES[btn.dataset.zone];
    const shape = z.r ? new THREE.Shape().absarc(0, 0, z.r, 0, Math.PI * 2) : roundedRect(z.w, z.h, 0.14);
    const fill = new THREE.Mesh(new THREE.ShapeGeometry(shape, 32),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.05, depthWrite: false }));
    const edge = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(shape.getPoints(48)),
      new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45 }));
    const grp = new THREE.Group();
    fill.visible = false; edge.visible = false;   // labels only; shapes stay for hit-testing
    grp.add(fill, edge);
    grp.position.set(z.x, z.y, -0.02);
    grp.userData = { btn, fill, edge, zone: z };
    scene.add(grp);
    targetMeshes.push(grp);
    btn._grp = grp;
  });

  function setHover(grp, on) {
    targetMeshes.forEach(g => {
      const active = on && g === grp;
      g.userData.fill.material.color.set(active ? 0xffd400 : 0xffffff);
      g.userData.fill.material.opacity = active ? 0.28 : 0.05;
      g.userData.edge.material.color.set(active ? 0xffd400 : 0xffffff);
      g.userData.edge.material.opacity = active ? 0.95 : 0.45;
      g.userData.btn.classList.toggle('hot', active);
    });
  }

  // ---------- stands ----------
  // concrete tiers with rows of green seats, a few fans, and a roof
  const STAND_Z = -11, STAND_W = 80, TIERS = 14, TIER_H = 0.42, TIER_D = 0.85, BASE_H = 1.1;
  const concrete = new THREE.MeshStandardMaterial({ color: NIGHT ? 0x6d737a : 0xc9cdd2, roughness: 0.95 });
  // front wall with a thin green band
  const frontWall = new THREE.Mesh(new THREE.BoxGeometry(STAND_W, BASE_H, 0.4), new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 0.8 }));
  frontWall.position.set(0, BASE_H / 2, STAND_Z + 0.4);
  frontWall.receiveShadow = true;
  scene.add(frontWall);
  const band = new THREE.Mesh(new THREE.BoxGeometry(STAND_W, 0.18, 0.02), new THREE.MeshStandardMaterial({ color: 0x1f8f4e }));
  band.position.set(0, BASE_H * 0.55, STAND_Z + 0.61);
  scene.add(band);
  for (let i = 0; i < TIERS; i++) {
    const h = BASE_H + TIER_H * (i + 1);
    const step = new THREE.Mesh(new THREE.BoxGeometry(STAND_W, h, TIER_D), concrete);
    step.position.set(0, h / 2, STAND_Z - i * TIER_D);
    step.receiveShadow = true;
    scene.add(step);
  }
  (function seats() {
    // each seat = a pan + a backrest, in rows with stair aisles every 16 seats
    const SEAT_W = 0.46, GAP = 0.06, PER_BLOCK = 16, AISLE = 1.1;
    const panGeo = new THREE.BoxGeometry(SEAT_W, 0.06, 0.36);
    const backGeo = new THREE.BoxGeometry(SEAT_W, 0.42, 0.05);
    const seatMat = new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0.05 });
    const legMat = new THREE.MeshStandardMaterial({ color: 0x3a3f45, roughness: 0.6 });
    const legGeo = new THREE.BoxGeometry(0.05, 0.22, 0.05);
    const max = TIERS * 200;
    const pans = new THREE.InstancedMesh(panGeo, seatMat, max);
    const backs = new THREE.InstancedMesh(backGeo, seatMat, max);
    const legs = new THREE.InstancedMesh(legGeo, legMat, max);
    const stepMat = new THREE.MeshStandardMaterial({ color: NIGHT ? 0x8a9097 : 0xe2e4e7, roughness: 0.9 });
    const stairGeo = new THREE.BoxGeometry(AISLE - 0.3, 0.04, TIER_D);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1, 1), pos = new THREE.Vector3(), col = new THREE.Color();
    const tilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -0.18);
    const greens = [0x1f8f4e, 0x1c8748, 0x219653];
    let n = 0;
    for (let i = 0; i < TIERS; i++) {
      const y = BASE_H + TIER_H * (i + 1);
      const z = STAND_Z - i * TIER_D;
      let x = -STAND_W / 2 + 0.4, k = 0;
      while (x < STAND_W / 2 - 0.4 && n < max) {
        if (k > 0 && k % PER_BLOCK === 0) {
          // aisle: a lighter stair step
          const stair = new THREE.Mesh(stairGeo, stepMat);
          stair.position.set(x + AISLE / 2 - SEAT_W / 2 - GAP, y + 0.02, z);
          scene.add(stair);
          x += AISLE;
        }
        col.set(greens[(i * 7 + k) % 3]);
        m4.compose(pos.set(x, y + 0.24, z + 0.05), q.identity(), sc); pans.setMatrixAt(n, m4); pans.setColorAt(n, col);
        m4.compose(pos.set(x, y + 0.48, z - 0.14), tilt, sc); backs.setMatrixAt(n, m4); backs.setColorAt(n, col);
        m4.compose(pos.set(x, y + 0.11, z + 0.05), q.identity(), sc); legs.setMatrixAt(n, m4);
        n++; k++;
        x += SEAT_W + GAP;
      }
    }
    pans.count = backs.count = legs.count = n;
    [pans, backs].forEach(m => { m.castShadow = true; m.receiveShadow = true; });
    scene.add(pans, backs, legs);
  })();
  // roof overhang
  const topY = BASE_H + TIER_H * TIERS;
  const roof = new THREE.Mesh(new THREE.BoxGeometry(STAND_W, 0.25, TIER_D * TIERS * 0.7),
    new THREE.MeshStandardMaterial({ color: 0x8d949c, roughness: 0.7 }));
  roof.position.set(0, topY + 2.4, STAND_Z - TIER_D * TIERS * 0.55);
  scene.add(roof);
  for (let x = -36; x <= 36; x += 12) {
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.6, 10), new THREE.MeshStandardMaterial({ color: 0xb3b8be }));
    pillar.position.set(x, topY + 1.15, STAND_Z - TIER_D * (TIERS - 1));
    scene.add(pillar);
  }

  // ---------- ball ----------
  function ballTexture() {
    const c = document.createElement('canvas');
    c.width = 1024; c.height = 512;
    const g = c.getContext('2d');
    g.fillStyle = '#f4f6f8'; g.fillRect(0, 0, 1024, 512);
    // dark patches at the 12 vertices of an icosahedron, drawn in equirectangular space
    const phi = (1 + Math.sqrt(5)) / 2;
    const verts = [[-1, phi, 0], [1, phi, 0], [-1, -phi, 0], [1, -phi, 0], [0, -1, phi], [0, 1, phi],
      [0, -1, -phi], [0, 1, -phi], [phi, 0, -1], [phi, 0, 1], [-phi, 0, -1], [-phi, 0, 1]];
    g.fillStyle = '#1b1f27';
    verts.forEach(([x, y, z]) => {
      const len = Math.hypot(x, y, z);
      const lat = Math.asin(y / len), lon = Math.atan2(z, x);
      const cx = (lon / (2 * Math.PI) + 0.5) * 1024, cy = (0.5 - lat / Math.PI) * 512;
      const ry = 46, rx = Math.min(46 / Math.max(Math.cos(lat), 0.2), 300);
      for (const dx of [-1024, 0, 1024]) {
        g.beginPath();
        for (let k = 0; k < 5; k++) {
          const a = -Math.PI / 2 + k * 2 * Math.PI / 5;
          g.lineTo(cx + dx + rx * Math.cos(a), cy + ry * Math.sin(a));
        }
        g.closePath(); g.fill();
      }
    });
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  const BALL_R = 0.15;
  const ball = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 48, 32),
    new THREE.MeshStandardMaterial({ map: ballTexture(), roughness: 0.45 }));
  ball.castShadow = true;
  const BALL_HOME = v(0, BALL_R, 8);
  ball.position.copy(BALL_HOME);
  scene.add(ball);

  // ---------- sizing + label placement ----------
  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // keep the whole goal in frame on narrow screens
    camera.fov = camera.aspect < 1.2 ? 31 : camera.aspect < 1.6 ? 28 : 26;
    camera.updateProjectionMatrix();
  }
  const tmp = new THREE.Vector3();
  function placeLabels() {
    const w = stage.clientWidth, h = stage.clientHeight;
    targetMeshes.forEach(g => {
      tmp.copy(g.position).project(camera);
      g.userData.btn.style.transform =
        `translate(${(tmp.x * 0.5 + 0.5) * w}px, ${(-tmp.y * 0.5 + 0.5) * h}px) translate(-50%, -50%)`;
    });
  }

  // ---------- interaction ----------
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const goalPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  function pointerToGoal(e) {
    const rect = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = new THREE.Vector3();
    return ray.ray.intersectPlane(goalPlane, hit) ? hit : null;
  }
  function zoneAt(p) {
    if (!p) return null;
    let best = null, bestD = Infinity;
    targetMeshes.forEach(g => {
      const z = g.userData.zone;
      const inside = z.r ? Math.hypot(p.x - z.x, p.y - z.y) < z.r
        : Math.abs(p.x - z.x) < z.w / 2 && Math.abs(p.y - z.y) < z.h / 2;
      const d = Math.hypot(p.x - z.x, p.y - z.y);
      if (inside && d < bestD) { best = g; bestD = d; }
    });
    return best;
  }
  function nearestZone(p) {
    let best = null, bestD = Infinity;
    targetMeshes.forEach(g => {
      const d = Math.hypot(p.x - g.position.x, p.y - g.position.y);
      if (d < bestD) { best = g; bestD = d; }
    });
    return best;
  }

  let dragging = false, hover = null;
  const mouse = { x: 0, y: 0 };

  canvas.addEventListener('pointermove', e => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = (e.clientX - rect.left) / rect.width - 0.5;
    mouse.y = (e.clientY - rect.top) / rect.height - 0.5;
    if (shot) return;
    const p = pointerToGoal(e);
    hover = dragging ? (p && p.y > -0.5 ? nearestZone(p) : null) : zoneAt(p);
    setHover(hover, !!hover);
    canvas.style.cursor = hover || nearBall(e) ? 'pointer' : 'default';
  });
  function nearBall(e) {
    const rect = canvas.getBoundingClientRect();
    tmp.copy(ball.position).project(camera);
    const bx = (tmp.x * 0.5 + 0.5) * rect.width + rect.left;
    const by = (-tmp.y * 0.5 + 0.5) * rect.height + rect.top;
    return Math.hypot(e.clientX - bx, e.clientY - by) < 48;
  }
  canvas.addEventListener('pointerdown', e => {
    if (shot) return;
    if (nearBall(e)) { dragging = true; canvas.setPointerCapture(e.pointerId); }
  });
  canvas.addEventListener('pointerup', e => {
    const p = pointerToGoal(e);
    const target = dragging ? (p && p.y > -0.5 ? nearestZone(p) : null) : zoneAt(p);
    dragging = false;
    if (target) shoot(target);
  });
  canvas.addEventListener('pointerleave', () => { if (!dragging && !shot) setHover(null, false); });

  buttons.forEach(btn => {
    btn.addEventListener('click', () => shoot(btn._grp));
    btn.addEventListener('mouseenter', () => !shot && setHover(btn._grp, true));
    btn.addEventListener('mouseleave', () => !shot && setHover(null, false));
    btn.addEventListener('focus', () => !shot && setHover(btn._grp, true));
    btn.addEventListener('blur', () => !shot && setHover(null, false));
  });

  // ---------- the shot ----------
  let shot = null;          // { from, to, t0, grp }
  let ripple = null;        // { x, y, t0 }

  function shoot(grp) {
    if (shot) return;
    const id = grp.userData.btn.dataset.target;
    if (reduceMotion) { goTo(id); return; }
    setHover(grp, true);
    const to = grp.position.clone();
    to.x += (Math.random() - 0.5) * 0.3;
    to.y += (Math.random() - 0.5) * 0.2;
    shot = { from: BALL_HOME.clone(), to, t0: performance.now(), grp, id, scored: false };
  }

  function updateShot(now) {
    if (!shot) return;
    const FLIGHT = 620, INTO_NET = 260, HOLD = 900;
    const t = now - shot.t0;
    const { from, to } = shot;
    if (t < FLIGHT) {
      const k = t / FLIGHT, e = 1 - Math.pow(1 - k, 2);
      ball.position.set(
        from.x + (to.x - from.x) * e,
        from.y + (to.y - from.y) * e + Math.sin(Math.PI * k) * 0.9,
        from.z + (to.z - from.z) * e);
      ball.rotation.x -= 0.35;
      ball.rotation.y += (to.x > 0 ? 1 : -1) * 0.08;
    } else if (t < FLIGHT + INTO_NET) {
      const k = (t - FLIGHT) / INTO_NET;
      const backZ = -D * 0.5 - (D * 0.5) * (1 - Math.min(to.y / (H * 0.9), 1));
      ball.position.set(to.x, to.y - k * 0.15, to.z + (backZ + 0.25 - to.z) * Math.sin(k * Math.PI / 2));
      ball.rotation.x -= 0.15 * (1 - k);
      if (!shot.scored) {
        shot.scored = true;
        ripple = { x: to.x, y: to.y, t0: now };
        flash.innerHTML = `Goal<small>${LABELS[shot.id]}</small>`;
        flash.classList.add('show');
      }
    } else if (t > FLIGHT + INTO_NET + HOLD) {
      flash.classList.remove('show');
      const id = shot.id;
      shot = null;
      setHover(null, false);
      goTo(id);
      setTimeout(() => { ball.position.copy(BALL_HOME); ball.rotation.set(0, 0, 0); }, 500);
    }
  }

  function updateNet(now) {
    if (!ripple) return;
    const pos = back.geometry.attributes.position;
    const t = (now - ripple.t0) / 1000;
    if (t > 1.6) {
      pos.array.set(backBase); pos.needsUpdate = true; ripple = null; return;
    }
    const amp = 0.55 * Math.exp(-3 * t) * Math.cos(9 * t);
    for (let i = 0; i < pos.count; i++) {
      const bx = backBase[i * 3], by = backBase[i * 3 + 1], bz = backBase[i * 3 + 2];
      const d2 = (bx - ripple.x) ** 2 + (by - ripple.y) ** 2;
      const push = amp * Math.exp(-d2 / 0.6);
      pos.array[i * 3 + 2] = bz - push;
    }
    pos.needsUpdate = true;
  }

  // ---------- loop ----------
  const camTarget = new THREE.Vector3();
  let visible = true;
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; }).observe(stage);

  function frame(now) {
    requestAnimationFrame(frame);
    if (!visible) return;
    if (!reduceMotion) {
      // gentle parallax + idle sway
      const sway = Math.sin(now / 4000) * 0.25;
      camTarget.set(CAM_BASE.x + mouse.x * 1.2 + sway, CAM_BASE.y - mouse.y * 0.4, CAM_BASE.z);
      camera.position.lerp(camTarget, 0.05);
      camera.lookAt(LOOK);
    }
    updateShot(now);
    updateNet(now);
    placeLabels();
    renderer.render(scene, camera);
  }

  window.addEventListener('resize', resize);
  resize();
  requestAnimationFrame(frame);

  document.querySelectorAll('a[href="#top"]').forEach(a => a.addEventListener('click', () => {
    shot = null; ball.position.copy(BALL_HOME); setHover(null, false); flash.classList.remove('show');
  }));
})();
