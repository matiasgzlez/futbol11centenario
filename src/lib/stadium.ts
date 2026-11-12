// Fondo del Home: un estadio de noche inspirado en el Centenario de Resistencia.
// Cancha con franjas de corte, cuatro tribunas con la hinchada rojo y amarilla
// de Sarmiento, torres de luz y una cámara que gira despacio.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

const PITCH_L = 105, PITCH_W = 68, PX = 10; // metros y píxeles por metro de la textura

function pitchTexture() {
  const c = document.createElement("canvas");
  const W = 120, H = 82; // la textura cubre la cancha y un margen de césped
  c.width = W * PX; c.height = H * PX;
  const g = c.getContext("2d")!;
  const bands = 14;
  for (let k = 0; k < bands; k++) { g.fillStyle = k % 2 ? "#1f6a36" : "#24773d"; g.fillRect(k * c.width / bands, 0, c.width / bands + 1, c.height); }
  const ox = (W - PITCH_L) / 2 * PX, oy = (H - PITCH_W) / 2 * PX, m = (v: number) => v * PX;
  g.strokeStyle = "rgba(255,255,255,.92)"; g.lineWidth = m(.14);
  g.strokeRect(ox, oy, m(PITCH_L), m(PITCH_W));
  g.beginPath(); g.moveTo(ox + m(PITCH_L / 2), oy); g.lineTo(ox + m(PITCH_L / 2), oy + m(PITCH_W)); g.stroke();
  g.beginPath(); g.arc(ox + m(PITCH_L / 2), oy + m(PITCH_W / 2), m(9.15), 0, Math.PI * 2); g.stroke();
  for (const side of [0, 1]) {
    const x = side ? ox + m(PITCH_L) : ox, dir = side ? -1 : 1;
    g.strokeRect(side ? x - m(16.5) : x, oy + m(PITCH_W / 2 - 20.15), m(16.5), m(40.3));
    g.strokeRect(side ? x - m(5.5) : x, oy + m(PITCH_W / 2 - 9.15), m(5.5), m(18.3));
    g.beginPath(); g.arc(x + dir * m(11), oy + m(PITCH_W / 2), m(9.15), side ? Math.PI - .93 : -.93, side ? Math.PI + .93 : .93); g.stroke();
    g.fillStyle = "#fff"; g.beginPath(); g.arc(x + dir * m(11), oy + m(PITCH_W / 2), m(.22), 0, Math.PI * 2); g.fill();
  }
  // Luz de los reflectores pintada en la textura (sin luces dinámicas: mucho más liviano).
  g.globalCompositeOperation = "lighter";
  for (const [cx, cy] of [[.12, .1], [.88, .1], [.12, .9], [.88, .9], [.5, .5]]) {
    const r = g.createRadialGradient(cx * c.width, cy * c.height, 0, cx * c.width, cy * c.height, c.width * .55);
    r.addColorStop(0, "rgba(255,250,215,.16)"); r.addColorStop(1, "rgba(255,250,215,0)");
    g.fillStyle = r; g.fillRect(0, 0, c.width, c.height);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return { texture: t, w: W, h: H };
}

/** Franjas verticales rojo y amarillo, como la camiseta de Sarmiento. */
function stripeTexture(repeat: number) {
  const c = document.createElement("canvas"); c.width = 64; c.height = 8;
  const g = c.getContext("2d")!;
  g.fillStyle = "#c8141b"; g.fillRect(0, 0, 64, 8); g.fillStyle = "#f2c200"; g.fillRect(0, 0, 32, 8);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping; t.repeat.set(repeat, 1); return t;
}
function glowTexture() {
  const c = document.createElement("canvas"); c.width = c.height = 128;
  const g = c.getContext("2d")!, r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, "rgba(255,255,240,1)"); r.addColorStop(.2, "rgba(255,250,220,.55)"); r.addColorStop(1, "rgba(255,250,220,0)");
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

export function mountStadium(canvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance", stencil: false });
  let quality = Math.min(devicePixelRatio || 1, 1);
  renderer.setPixelRatio(quality);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#050b0d");
  scene.fog = new THREE.FogExp2("#071216", .0062);
  const camera = new THREE.PerspectiveCamera(40, 1, .5, 700);
  const disposables: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(x: T) => { disposables.push(x); return x; };

  // Luces: noche con reflectores
  scene.add(new THREE.HemisphereLight("#cfe0ff", "#13261a", 1.6));
  const moon = new THREE.DirectionalLight("#fff4dc", 1.2); moon.position.set(-40, 80, 30); scene.add(moon);

  // Terreno y cancha
  const ground = new THREE.Mesh(keep(new THREE.PlaneGeometry(600, 600)), keep(new THREE.MeshLambertMaterial({ color: "#0b1410" })));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -.05; scene.add(ground);
  const pt = pitchTexture(); keep(pt.texture);
  const pitch = new THREE.Mesh(keep(new THREE.PlaneGeometry(pt.w, pt.h)), keep(new THREE.MeshLambertMaterial({ map: pt.texture })));
  pitch.rotation.x = -Math.PI / 2; scene.add(pitch);

  // Arcos
  const white = keep(new THREE.MeshLambertMaterial({ color: "#f4f4f4" }));
  const post = keep(new THREE.BoxGeometry(.12, 2.44, .12)), bar = keep(new THREE.BoxGeometry(.12, .12, 7.32));
  for (const s of [-1, 1]) {
    const x = s * PITCH_L / 2;
    for (const z of [-3.66, 3.66]) { const m = new THREE.Mesh(post, white); m.position.set(x, 1.22, z); scene.add(m); }
    const b = new THREE.Mesh(bar, white); b.position.set(x, 2.44, 0); scene.add(b);
  }

  // Tribunas escalonadas con la baranda pintada a franjas
  const concrete = keep(new THREE.MeshLambertMaterial({ color: "#2f3438" }));
  const STEPS = 16, STEP_D = 1.15, STEP_H = .62;
  const stands = [
    { len: 112, dist: PITCH_W / 2 + 6, rot: 0 }, { len: 112, dist: PITCH_W / 2 + 6, rot: Math.PI },
    { len: 76, dist: PITCH_L / 2 + 7, rot: Math.PI / 2 }, { len: 76, dist: PITCH_L / 2 + 7, rot: -Math.PI / 2 },
  ];
  const seats: { pos: THREE.Vector3; rot: number }[] = [];
  for (const st of stands) {
    const group = new THREE.Group(); group.rotation.y = st.rot;
    const parts: THREE.BufferGeometry[] = [];
    for (let k = 0; k < STEPS; k++) {
      const g = new THREE.BoxGeometry(st.len, STEP_H * (k + 1), STEP_D);
      g.translate(0, STEP_H * (k + 1) / 2, st.dist + k * STEP_D); parts.push(g);
      for (let x = -st.len / 2 + .5; x < st.len / 2; x += .9) {
        if (Math.random() < .25) continue;
        const local = new THREE.Vector3(x, STEP_H * (k + 1) + .35, st.dist + k * STEP_D);
        seats.push({ pos: local.applyAxisAngle(new THREE.Vector3(0, 1, 0), st.rot), rot: st.rot });
      }
    }
    const roofG = new THREE.BoxGeometry(st.len, .3, 9); roofG.translate(0, STEP_H * STEPS + 6, st.dist + STEPS * STEP_D - 4.5); parts.push(roofG);
    group.add(new THREE.Mesh(keep(mergeGeometries(parts)), concrete)); parts.forEach(g => g.dispose());
    const wall = new THREE.Mesh(keep(new THREE.PlaneGeometry(st.len, 1.3)), keep(new THREE.MeshLambertMaterial({ map: keep(stripeTexture(st.len / 2.4)), emissive: new THREE.Color("#200303"), emissiveIntensity: .4 })));
    wall.position.set(0, .65, st.dist - STEP_D / 2 - .01); wall.rotation.y = Math.PI; group.add(wall);
    scene.add(group);
  }

  // Hinchada: instancias con colores del club; saltan con un shader barato
  const fanGeo = keep(new THREE.BoxGeometry(.6, .72, .32));
  const fanMat = keep(new THREE.MeshLambertMaterial({}));
  const time = { value: 0 };
  fanMat.onBeforeCompile = shader => {
    shader.uniforms.uTime = time;
    shader.vertexShader = "uniform float uTime;\n" + shader.vertexShader.replace("#include <begin_vertex>",
      "#include <begin_vertex>\nfloat ph = float(gl_InstanceID) * 0.6180339;\nfloat wave = sin(uTime * 2.2 - float(gl_InstanceID) * 0.004);\ntransformed.y += max(0.0, sin(uTime * 6.0 + ph * 6.2831)) * 0.22 * step(0.55, wave);");
  };
  const fans = new THREE.InstancedMesh(fanGeo, fanMat, seats.length);
  const palette = [new THREE.Color("#8f1015"), new THREE.Color("#b8900f"), new THREE.Color("#8d8a84"), new THREE.Color("#15181c")];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
  seats.forEach((s, k) => {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), s.rot);
    m4.compose(s.pos, q, new THREE.Vector3(1, .85 + Math.random() * .3, 1)); fans.setMatrixAt(k, m4);
    const r = Math.random(); fans.setColorAt(k, palette[r < .42 ? 0 : r < .78 ? 1 : r < .88 ? 2 : 3]);
  });
  scene.add(fans);

  // Torres de luz en las esquinas
  const glow = keep(glowTexture());
  const towerGeo = keep(new THREE.CylinderGeometry(.5, .8, 38, 8)), panelGeo = keep(new THREE.BoxGeometry(7, 3.5, .6));
  const panelMat = keep(new THREE.MeshLambertMaterial({ color: "#fffbe8", emissive: new THREE.Color("#fffbe8"), emissiveIntensity: 2.2 }));
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const x = sx * (PITCH_L / 2 + 14), z = sz * (PITCH_W / 2 + 14);
    const tower = new THREE.Mesh(towerGeo, concrete); tower.position.set(x, 19, z); scene.add(tower);
    const panel = new THREE.Mesh(panelGeo, panelMat); panel.position.set(x, 39, z); panel.lookAt(0, 0, 0); scene.add(panel);
    const sprite = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: glow, color: "#fff6d8", transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })));
    sprite.scale.set(34, 34, 1); sprite.position.copy(panel.position); scene.add(sprite);
  }

  // Cámara: vuelta lenta alrededor del estadio con un poco de paralaje del mouse
  let active = true, raf = 0, last = performance.now(), angle = .6, slow = 0;
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const mouse = { x: 0, y: 0 };
  const onMove = (e: PointerEvent) => { mouse.x = e.clientX / innerWidth - .5; mouse.y = e.clientY / innerHeight - .5; };
  addEventListener("pointermove", onMove);
  const resize = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false); camera.aspect = w / Math.max(1, h);
    camera.fov = camera.aspect < 1 ? 64 : 46; camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize); ro.observe(canvas); resize();
  const frame = (now: number) => {
    if (!active || document.hidden) { raf = 0; return; } // el loop se detiene; setActive/visibilidad lo reanudan
    raf = requestAnimationFrame(frame);
    if (now - last < 1000 / 30 - 2) return; // el fondo se mueve lento: 30 fps alcanzan
    const dt = Math.min(.1, (now - last) / 1000); last = now;
    // Si el equipo no llega a 24 fps sostenidos, baja la resolución del fondo.
    slow = dt > 1 / 24 ? slow + 1 : Math.max(0, slow - 1);
    if (slow > 20 && quality > .55) { quality = Math.max(.55, quality - .15); renderer.setPixelRatio(quality); resize(); slow = 0; }
    if (!still) { angle += dt * .035; time.value += dt; }
    // Plano tipo transmisión: dentro del anillo de torres, por encima de las tribunas.
    const r = camera.aspect < 1 ? 64 : 60;
    camera.position.set(Math.cos(angle) * r + mouse.x * 5, 30 - mouse.y * 3, Math.sin(angle) * r * .74);
    camera.lookAt(Math.cos(angle) * -6, 0, Math.sin(angle) * -4);
    renderer.render(scene, camera);
  };
  const start = () => { if (!raf && active && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(frame); } };
  const onVis = () => start();
  document.addEventListener("visibilitychange", onVis);
  start();
  return {
    setActive(v: boolean) { active = v; if (v) start(); else { cancelAnimationFrame(raf); raf = 0; } },
    dispose() {
      cancelAnimationFrame(raf); raf = 0; ro.disconnect(); removeEventListener("pointermove", onMove); document.removeEventListener("visibilitychange", onVis);
      disposables.forEach(d => d.dispose()); fans.dispose(); renderer.dispose(); renderer.forceContextLoss();
    },
  };
}
