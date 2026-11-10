// Landing-page scenes: small isometric models of how an organisation is designed.
// Each scene is built once and assembled by apply(anims, t): objects rise through the plate,
// pop, draw or move into place, then the scene keeps a steady loop of activity.
// Colour code across the page: exploration is ember, exploitation is ice, white is neutral.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { LineSegments2 } from "three/addons/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";

// ------------------------------------------------------------- palettes
const CLAY = { top: 0xf7f4f1, a: 0xdcd6d0, b: 0xb3aca5 };
const DIMC = { top: 0x7c7671, a: 0x625d59, b: 0x4d4946 };
const EMBER = { top: 0xffb48f, a: 0xff7a45, b: 0xc4501d, line: 0xff8a57, glow: 0xff6326 };
const ICE = { top: 0xeef7ff, a: 0xbce1ff, b: 0x7fb3e2, line: 0xaed8ff, glow: 0x6fb8ff };
const GOLD = { top: 0xffe4a6, a: 0xf7c35c, b: 0xc58f2c, line: 0xffd27a, glow: 0xffb340 };
const ROSE = { top: 0xffc9d3, a: 0xf59aab, b: 0xbf6a7c };
const WHITE_DOT = { line: 0xffffff, glow: 0xffffff };
const PLATE = { top: 0x2c2826, a: 0x221e1d, b: 0x191615 };
const INK = 0x15110f;

let T = EMBER, RES = new THREE.Vector2(800, 600), VIEW = "iso", ANIM = [];
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const clamp = (v) => Math.min(1, Math.max(0, v));
const EASE = {
  out: (p) => 1 - Math.pow(1 - p, 3),
  back: (p) => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); },
  io: (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2),
};
const as = (pal, fn) => { const prev = T; T = pal; const r = fn(); T = prev; return r; };

// ------------------------------------------------------------- shared textures
let GLOW, SHADOW;
function radial(stops) {
  const c = document.createElement("canvas"); c.width = c.height = 128;
  const g = c.getContext("2d"), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  stops.forEach(([o, col]) => gr.addColorStop(o, col)); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.userData.shared = true; return t;
}
const glowTex = () => (GLOW ??= radial([[0, "rgba(255,255,255,1)"], [0.22, "rgba(255,255,255,.5)"], [0.55, "rgba(255,255,255,.12)"], [1, "rgba(255,255,255,0)"]]));
const shadowTex = () => (SHADOW ??= radial([[0, "rgba(0,0,0,.7)"], [0.5, "rgba(0,0,0,.35)"], [1, "rgba(0,0,0,0)"]]));

// ------------------------------------------------------------- drawing primitives
function shade(geo, pal) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  g.computeVertexNormals();
  const n = g.attributes.normal, cols = [];
  const C = [new THREE.Color(pal.top), new THREE.Color(pal.a), new THREE.Color(pal.b), new THREE.Color(pal.b).multiplyScalar(0.8)];
  const face = VIEW !== "iso";
  for (let i = 0; i < n.count; i++) {
    const x = n.getX(i), y = n.getY(i), z = n.getZ(i);
    const wy = Math.max(y, 0), wx = Math.max(x, 0), wz = Math.max(z, 0), wn = Math.max(-y, 0) + Math.max(-x, 0) * 0.5 + Math.max(-z, 0) * 0.5;
    const s = wy + wx + wz + wn || 1, k = face ? [wy / s, wz / s, wx / s, wn / s] : [wy / s, wx / s, wz / s, wn / s];
    cols.push(C.reduce((t, c, j) => t + c.r * k[j], 0), C.reduce((t, c, j) => t + c.g * k[j], 0), C.reduce((t, c, j) => t + c.b * k[j], 0));
  }
  g.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
  return g;
}
function lineMat(color, width = 1.1, opacity = 1) {
  const m = new LineMaterial({ color, linewidth: width * 2, transparent: opacity < 1, opacity }); m.resolution = RES; return m;
}
function solid(parent, geo, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, accent = false, pal, edges = true, hull = false, ink, opacity = 1, edgeOpacity, thr = 30 } = {}) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.set(rx, ry, rz);
  const p = pal || (accent ? T : CLAY);
  g.add(new THREE.Mesh(shade(geo, p), new THREE.MeshBasicMaterial({ vertexColors: true, transparent: opacity < 1, opacity, depthWrite: opacity >= 1, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 })));
  const inkC = ink ?? INK;
  if (edges) g.add(new LineSegments2(new LineSegmentsGeometry().fromEdgesGeometry(new THREE.EdgesGeometry(geo, thr)), lineMat(inkC, 1.1, edgeOpacity ?? (opacity < 1 ? Math.max(opacity, 0.5) : 1))));
  if (hull) { const h = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: inkC, side: THREE.BackSide })); h.scale.setScalar(typeof hull === "number" ? hull : 1.07); g.add(h); }
  parent.add(g); return g;
}
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const rbox = (w, h, d, r = 0.06) => new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2, h / 2, d / 2));
function lines(parent, pts, color, width = 1.4, opacity = 1) {
  const g = new LineSegmentsGeometry(); g.setPositions(pts.flatMap((p) => [p.x, p.y, p.z]));
  const l = new LineSegments2(g, lineMat(color, width, opacity)); parent.add(l); l.userData.n = pts.length / 2; return l;
}
function polyline(parent, pts, color, width = 1.6, opacity = 1) { const s = []; for (let i = 0; i < pts.length - 1; i++) s.push(pts[i], pts[i + 1]); return lines(parent, s, color, width, opacity); }
function dashed(parent, curve, color, n = 40, width = 1.5, opacity = 1) { const p = curve.getPoints(n), s = []; for (let i = 0; i < p.length - 1; i += 2) s.push(p[i], p[i + 1]); return lines(parent, s, color, width, opacity); }
function grp(parent, x = 0, y = 0, z = 0) { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; }
function path(pts) { const c = new THREE.CurvePath(); for (let i = 0; i < pts.length - 1; i++) c.add(new THREE.LineCurve3(pts[i], pts[i + 1])); return c; }
const arc = (a, b, lift = 1.2) => new THREE.QuadraticBezierCurve3(a, V((a.x + b.x) / 2, Math.max(a.y, b.y) + lift, (a.z + b.z) / 2), b);

function glow(parent, color, size = 0.6, opacity = 0.85) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity }));
  s.scale.setScalar(size); parent.add(s); return s;
}
function pool(parent, color, x, z, w, d, opacity = 0.2) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: glowTex(), color, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity }));
  m.rotation.x = -Math.PI / 2; m.scale.set(w, d, 1); m.position.set(x, 0.006, z); parent.add(m); return m;
}
function shadow(parent, r = 0.4, opacity = 0.55) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: shadowTex(), transparent: true, depthWrite: false, opacity }));
  m.rotation.x = -Math.PI / 2; m.scale.set(r * 2, r * 2, 1); m.position.y = 0.008; parent.add(m); return m;
}

// ------------------------------------------------------------- timeline
function anim(obj, mode, t0, dur = 0.6, opts = {}) { ANIM.push({ obj, mode, t0, dur, base: obj.position.clone(), sc: obj.scale.clone(), ...opts }); return obj; }
function every(fn) { ANIM.push({ mode: "fn", fn }); }
function dim(obj, t0, dur = 0.5, to = 0.36) {
  const mats = []; obj.traverse((m) => { if (m.isMesh && m.material.vertexColors) mats.push(m.material); });
  ANIM.push({ mode: "dim", obj, t0, dur, mats, to });
}
export function apply(anims, t) {
  for (const a of anims) {
    if (a.mode === "fn") { a.fn(t); continue; }
    const p = clamp((t - a.t0) / a.dur), o = a.obj;
    if (a.mode === "move") {
      if (p > 0) { o.position.lerpVectors(a.base, a.to, EASE.io(p)); if (p < 1 && a.bob) o.position.y += Math.abs(Math.sin(p * Math.PI * a.bob)) * 0.07; }
      else o.position.copy(a.base);
      continue;
    }
    if (a.mode === "sink") { if (p >= 1) o.visible = false; else if (p > 0) o.position.y = a.base.y - (a.h ?? 2) * EASE.io(p); continue; }
    if (a.mode === "dim") { const k = 1 - (1 - a.to) * EASE.io(p); a.mats.forEach((m) => m.color.setScalar(k)); continue; }
    o.visible = p > 0; if (!o.visible) continue;
    if (a.mode === "rise") o.position.y = a.base.y - (a.h ?? 3) * (1 - EASE.out(p));
    else if (a.mode === "drop") o.position.y = a.base.y + (a.h ?? 1.2) * (1 - EASE.out(p));
    else if (a.mode === "grow") o.scale.y = a.sc.y * Math.max(0.001, EASE.out(p));
    else if (a.mode === "pop") { const e = Math.max(0.001, EASE.back(p)); o.scale.set(a.sc.x * e, a.sc.y * e, a.sc.z * e); }
    else if (a.mode === "draw") o.geometry.instanceCount = Math.max(1, Math.ceil(EASE.io(p) * o.userData.n));
  }
}
// Tokens that travel along a curve on a loop once t passes t0.
function flow(parent, curve, { t0 = 2, speed = 0.5, n = 3, r = 0.075, pal, make } = {}) {
  const items = Array.from({ length: n }, () => { const o = make ? make(parent) : dotObj(parent, r, pal); o.userData.noFit = true; return o; });
  every((t) => items.forEach((it, i) => {
    it.visible = t > t0; if (!it.visible) return;
    const u = (((t - t0) * speed + i / n) % 1 + 1) % 1; it.position.copy(curve.getPoint(u));
  }));
  return items;
}
function dotObj(parent, r = 0.075, pal) {
  const p = pal ?? T, g = new THREE.Group(); parent.add(g); g.userData.noFit = true;
  g.add(new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), new THREE.MeshBasicMaterial({ color: p.line })));
  glow(g, p.glow, r * 9, 0.75);
  return g;
}
// Moves along stations with a pause at each one: returns the position at time tau, or null once past the end.
function along(stations, tau, move, dwell) {
  const P = move + dwell, k = Math.floor(tau / P), s = tau - k * P;
  if (tau < 0 || k >= stations.length - 1) return null;
  const u = s < move ? EASE.io(s / move) : 1;
  return { pos: stations[k].clone().lerp(stations[k + 1], u), at: s < move ? k : k + 1, moving: s < move, s };
}

// ------------------------------------------------------------- kit
const facing = () => (VIEW === "iso" ? Math.PI / 4 : 0.18);

function plate(parent, w, d, { pools = [[T, 0, 0, 1]], rim = T } = {}) {
  solid(parent, new RoundedBoxGeometry(w, 0.22, d, 4, 0.1), { y: -0.11, pal: PLATE, ink: 0x4a4440, thr: 40 });
  const pts = [], step = 0.8;
  for (let x = -w / 2 + step; x < w / 2 - 0.1; x += step) pts.push(V(x, 0.003, -d / 2 + 0.14), V(x, 0.003, d / 2 - 0.14));
  for (let z = -d / 2 + step; z < d / 2 - 0.1; z += step) pts.push(V(-w / 2 + 0.14, 0.003, z), V(w / 2 - 0.14, 0.003, z));
  lines(parent, pts, 0x3b3633, 0.7);
  pools.forEach(([pal, px, pz, k]) => pool(parent, pal.glow, px, pz, w * 0.9 * k, d * 0.9 * k, 0.17));
  solid(parent, new RoundedBoxGeometry(w - 0.06, 0.05, d - 0.06, 4, 0.025), { y: -0.245, pal: rim, edges: false });
}

// A mannequin: big round head, rounded body, arms and legs, a tie in the accent colour.
function limb(parent, a, b, r, opts = {}) {
  const d = new THREE.Vector3().subVectors(b, a), len = d.length();
  const g = solid(parent, new THREE.CapsuleGeometry(r, Math.max(0.01, len - 2 * r * 0.2), 6, 12), { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2, edges: false, hull: 1.16, ...opts });
  g.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize()); return g;
}
const POSES = {
  stand: { l: V(-0.2, 0.36, 0.02), r: V(0.2, 0.36, 0.02) },
  cheer: { l: V(-0.24, 0.98, 0.04), r: V(0.26, 0.96, 0.06) },
  hold: { l: V(-0.2, 0.36, 0.02), r: V(0.16, 0.72, 0.2) },
  think: { l: V(-0.2, 0.36, 0.02), r: V(0.06, 0.86, 0.13) },
  point: { l: V(-0.2, 0.36, 0.02), r: V(0.42, 0.7, 0.1) },
  carry: { l: V(-0.14, 0.62, 0.22), r: V(0.14, 0.62, 0.22) },
};
function man(parent, x, y, z, { pose = "stand", s = 1, tie = T, body, face } = {}) {
  const g = grp(parent, x, y, z); g.scale.setScalar(s * 1.15); g.rotation.y = face ?? facing();
  shadow(g, 0.26, 0.6);
  const sk = body || CLAY;
  for (const sx of [-1, 1]) {
    limb(g, V(sx * 0.07, 0.3, 0), V(sx * 0.075, 0.06, 0.01), 0.055, { pal: sk });
    solid(g, new THREE.SphereGeometry(0.06, 14, 10), { x: sx * 0.075, y: 0.035, z: 0.04, edges: false, hull: 1.18, pal: sk }).scale.set(1, 0.6, 1.6);
  }
  const prof = [[0, 0], [0.105, 0], [0.125, 0.1], [0.13, 0.22], [0.11, 0.3], [0, 0.32]];
  solid(g, new THREE.LatheGeometry(prof.map(([a, b]) => new THREE.Vector2(a, b)), 22), { y: 0.29, edges: false, hull: 1.07, pal: sk });
  solid(g, new THREE.CylinderGeometry(0.045, 0.05, 0.06, 12), { y: 0.63, edges: false, hull: 1.15, pal: sk });
  solid(g, new THREE.SphereGeometry(0.16, 22, 18), { y: 0.8, edges: false, hull: 1.06, pal: sk });
  const P = POSES[pose];
  for (const [sx, end] of [[-1, P.l], [1, P.r]]) {
    limb(g, V(sx * 0.125, 0.58, 0), end, 0.042, { pal: sk });
    solid(g, new THREE.SphereGeometry(0.052, 12, 10), { x: end.x, y: end.y, z: end.z, edges: false, hull: 1.18, pal: sk });
  }
  if (tie) {
    solid(g, box(0.05, 0.03, 0.02), { y: 0.585, z: 0.115, pal: tie, edges: false });
    solid(g, new THREE.ConeGeometry(0.035, 0.2, 4), { y: 0.47, z: 0.125, rx: Math.PI, ry: Math.PI / 4, pal: tie, edges: false, hull: 1.1 }).scale.set(1, 1, 0.35);
  }
  return g;
}
const popMan = (parent, x, y, z, t0, opts) => anim(man(parent, x, y, z, opts), "pop", t0, 0.45);

function disc(parent, x, z, { r = 0.8, h = 0.1, ring = T } = {}) {
  const g = grp(parent, x, 0, z);
  solid(g, new THREE.CylinderGeometry(r, r, h, 48), { y: h / 2, edges: false, hull: 1.015 });
  if (ring) solid(g, new THREE.TorusGeometry(r - 0.07, 0.03, 8, 64), { y: h + 0.005, rx: Math.PI / 2, pal: ring, edges: false });
  shadow(g, r * 1.25, 0.5);
  return g;
}
function slab(parent, x, z, { w = 1.3, d = 1.1, h = 0.14, pal } = {}) {
  const g = grp(parent, x, 0, z); solid(g, rbox(w, h, d, 0.05), { y: h / 2, pal, thr: 40 }); shadow(g, Math.max(w, d) * 0.7, 0.45); return g;
}
function desk(parent, x, z, { w = 0.9, d = 0.5, book = T } = {}) {
  const g = grp(parent, x, 0, z);
  solid(g, rbox(w, 0.42, d, 0.04), { y: 0.21, thr: 40 });
  if (book) { solid(g, box(0.3, 0.06, 0.22), { x: -w * 0.22, y: 0.45, pal: book }); solid(g, box(0.26, 0.012, 0.18), { x: -w * 0.22, y: 0.485, edges: false }); }
  shadow(g, w * 0.7, 0.5);
  return g;
}
function bulbObj(parent, { lit = true, s = 1 } = {}) {
  const g = grp(parent); g.userData.noFit = true;
  solid(g, new THREE.SphereGeometry(0.2 * s, 20, 16), { pal: lit ? GOLD : DIMC, edges: false, hull: 1.1 });
  solid(g, new THREE.CylinderGeometry(0.09 * s, 0.11 * s, 0.14 * s, 16), { y: -0.22 * s, pal: lit ? CLAY : DIMC, edges: false, hull: 1.1 });
  if (lit) glow(g, GOLD.glow, 1.3 * s, 0.6);
  return g;
}
function coinObj(parent) {
  const g = grp(parent); g.userData.noFit = true;
  solid(g, new THREE.CylinderGeometry(0.15, 0.15, 0.06, 24), { rx: Math.PI / 2.4, pal: GOLD, edges: false, hull: 1.12 });
  glow(g, GOLD.glow, 0.7, 0.45);
  return g;
}
function cardObj(parent) {
  const g = grp(parent); g.userData.noFit = true;
  solid(g, box(0.46, 0.035, 0.34), { y: 0.02, thr: 40 });
  const plain = solid(g, box(0.46, 0.04, 0.08), { y: 0.04, z: -0.12, edges: false, pal: { top: 0xd9d3cd, a: 0xd9d3cd, b: 0xd9d3cd } });
  const stamped = solid(g, box(0.46, 0.042, 0.08), { y: 0.042, z: -0.12, edges: false, pal: ICE });
  g.userData.plain = plain; g.userData.stamped = stamped;
  return g;
}
function floorBlock(parent, w, d, fh, y) {
  const g = grp(parent, 0, y, 0);
  solid(g, box(w, fh, d), { y: fh / 2 });
  solid(g, box(w + 0.1, 0.05, d + 0.1), { y: fh, edges: false });
  for (let c = 0; c < 3; c++) solid(g, box(0.24, fh * 0.42, 0.03), { x: -w / 2 + (w / 4) * (c + 1), y: fh * 0.52, z: d / 2 + 0.015, pal: ICE, edges: false });
  for (let c = 0; c < 2; c++) solid(g, box(0.03, fh * 0.42, 0.24), { x: w / 2 + 0.015, y: fh * 0.52, z: -d / 2 + (d / 3) * (c + 1), pal: ICE, edges: false });
  return g;
}
function tower(parent, x, z, { w = 1.6, d = 1.4, floors = 4, fh = 0.55, t0 = 0.2, dur = 1.4, glass = ICE } = {}) {
  const g = grp(parent, x, 0, z);
  for (let f = 0; f < floors; f++) {
    solid(g, box(w, fh, d), { y: f * fh + fh / 2 });
    solid(g, box(w + 0.1, 0.05, d + 0.1), { y: (f + 1) * fh, edges: false });
    if (f === 0) { solid(g, box(0.44, fh * 0.65, 0.03), { y: fh * 0.33, z: d / 2 + 0.015, pal: glass, edges: false }); continue; }
    for (let c = 0; c < 3; c++) {
      solid(g, box(0.24, fh * 0.42, 0.03), { x: -w / 2 + (w / 4) * (c + 1), y: f * fh + fh * 0.52, z: d / 2 + 0.015, pal: glass, edges: false });
      if (c < 2) solid(g, box(0.03, fh * 0.42, 0.24), { x: w / 2 + 0.015, y: f * fh + fh * 0.52, z: -d / 2 + (d / 3) * (c + 1), pal: glass, edges: false });
    }
  }
  const H = floors * fh;
  solid(g, box(w - 0.24, 0.26, d - 0.24), { y: H + 0.13 });
  shadow(g, Math.max(w, d) * 0.8, 0.5);
  anim(g, "rise", t0, dur, { h: H + 0.6 });
  // a glass frame that waits at the plate while the tower rises, then sweeps up and back
  const scan = solid(parent, box(w + 0.4, 0.36, d + 0.4), { x, y: 0.18, z, pal: CLAY, opacity: 0.22, edgeOpacity: 0.55 });
  scan.userData.noFit = true;
  every((t) => {
    const p = (t - t0) / dur;
    scan.visible = p > -0.1 && p < 2.6;
    const u = p < 1 ? 0 : p < 1.8 ? EASE.io(clamp((p - 1) / 0.8)) : 1 - EASE.io(clamp((p - 1.8) / 0.8));
    scan.position.y = 0.19 + u * (H - 0.2);
  });
  return { g, H: H + 0.26 };
}
// Stepped tiers of people, each level set further back and higher: the mechanistic hierarchy.
function pyramid(parent, x, z, counts, { t0 = 0.4, gap = 0.62, lh = 0.5, step = 0.5, riser = true, slow = 0.16, s = 0.6 } = {}) {
  const g = grp(parent, x, 0, z), n = counts.length;
  const zFront = ((n - 1) * step) / 2 + step / 2;
  counts.slice().reverse().forEach((c, j) => {
    const i = n - 1 - j, wdt = Math.max(c * gap + 0.3, 0.8), hgt = (j + 1) * lh, zc = zFront - j * step - step / 2;
    const tier = grp(g, 0, 0, 0);
    solid(tier, rbox(wdt, hgt, step, 0.04), { y: hgt / 2, z: zc, thr: 40 });
    anim(tier, "rise", t0 + j * 0.16, 0.55, { h: hgt + 0.4 });
    for (let k = 0; k < c; k++) popMan(g, (k - (c - 1) / 2) * gap, hgt, zc, t0 + 0.9 + j * 0.12 + k * 0.03, { s, body: i === 0 ? T : undefined });
  });
  shadow(g, Math.max(counts[n - 1] * gap, 1) * 0.9, 0.5);
  const top = n * lh;
  if (riser) {
    const rx = x + Math.max(counts[n - 1] * gap + 0.3, 0.8) / 2 + 0.3, zz = z + zFront;
    anim(polyline(parent, [V(rx, 0.1, zz), V(rx, top + 0.5, zz)], T.line, 1.4, 0.8), "draw", t0 + 1.5, 0.6);
    flow(parent, new THREE.LineCurve3(V(rx, 0.15, zz), V(rx, top + 0.5, zz)), { t0: t0 + 2.1, speed: slow, n: 2 });
    anim(solid(parent, new THREE.ConeGeometry(0.09, 0.2, 14), { x: rx, y: top + 0.6, z: zz, accent: true, edges: false, hull: 1.1 }), "pop", t0 + 2.0, 0.3);
  }
  return { g, top, zFront: z + zFront };
}

// ------------------------------------------------------------- scenes
const SCENES = {};

// EXPLORATION 1 — Flat network of teams. People leave their functional groups and form mixed teams
// on one flat level; messages hop sideways between teams; now and then two people swap teams.
SCENES.E1 = { view: "iso", build(sc) {
  T = EMBER;
  plate(sc, 8.4, 6.6);
  const depts = [{ c: V(-3.0, 0, -2.0), tie: EMBER }, { c: V(-3.1, 0, 2.15), tie: GOLD }, { c: V(2.95, 0, -2.3), tie: ROSE }];
  const pods = [V(-1.3, 0, 0.5), V(0.75, 0, -1.3), V(1.5, 0, 1.6)];
  const slotOff = [0, 1, 2].map((k) => { const a = Math.PI * (0.5 + (2 * k) / 3); return V(Math.cos(a) * 0.42, 0, Math.sin(a) * 0.42); });
  const deptOff = [V(-0.36, 0, 0.22), V(0.08, 0, -0.26), V(0.4, 0, 0.26)];
  depts.forEach((dp, j) => {
    const pad = slab(sc, dp.c.x, dp.c.z, { w: 1.35, d: 1.15, h: 0.12 });
    anim(pad, "rise", 0.1 + j * 0.1, 0.6, { h: 0.8 });
    anim(pad, "sink", 3.1 + j * 0.08, 0.6, { h: 0.7 });
  });
  pods.forEach((p, k) => anim(disc(sc, p.x, p.z, { r: 0.82 }), "pop", 1.3 + k * 0.1, 0.45));
  const people = [];
  depts.forEach((dp, j) => [0, 1, 2].forEach((k) => {
    const from = dp.c.clone().add(deptOff[k]).setY(0.12), to = pods[k].clone().add(slotOff[j]).setY(0.1);
    const lead = j === 0 && k === 1;
    const m = man(sc, from.x, from.y, from.z, { tie: dp.tie, body: lead ? EMBER : undefined, pose: lead ? "point" : "stand" });
    anim(m, "pop", 0.45 + j * 0.12 + k * 0.05, 0.45);
    anim(m, "move", 1.75 + (j * 3 + k) * 0.06, 1.15, { to, bob: 6 });
    people.push({ m, slot: to });
  }));
  // sideways links between the teams, busy in both directions
  pods.forEach((p, i) => {
    const q = pods[(i + 1) % 3], dir = q.clone().sub(p).normalize();
    const a = p.clone().add(dir.clone().multiplyScalar(0.85)).setY(0.04), b = q.clone().sub(dir.clone().multiplyScalar(0.85)).setY(0.04);
    anim(lines(sc, [a, b], EMBER.line, 1.8), "draw", 3.0 + i * 0.1, 0.45);
    flow(sc, new THREE.LineCurve3(a.clone().setY(0.13), b.clone().setY(0.13)), { t0: 3.4, speed: 0.75, n: 1 });
    flow(sc, new THREE.LineCurve3(b.clone().setY(0.13), a.clone().setY(0.13)), { t0: 3.7, speed: 0.6, n: 1 });
  });
  // tasks get redefined: two people swap teams, then swap back
  const A = people[0], B = people[5];
  every((t) => {
    if (t < 6.5) return;
    const ph = (t - 6.5) % 7.5;
    const f = ph < 1.1 ? EASE.io(ph / 1.1) : ph < 3.8 ? 1 : ph < 4.9 ? 1 - EASE.io((ph - 3.8) / 1.1) : 0;
    const moving = (ph < 1.1) || (ph > 3.8 && ph < 4.9);
    A.m.position.lerpVectors(A.slot, B.slot, f); B.m.position.lerpVectors(B.slot, A.slot, f);
    if (moving) { const b = Math.abs(Math.sin(ph * 9)) * 0.06; A.m.position.y += b; B.m.position.y += b; }
  });
} };

// EXPLORATION 2 — Many experiments, few winners. One problem branches into many tests; most fail
// and dim, one or two grow; lessons flow back from the failures.
SCENES.E2 = { view: "iso", build(sc) {
  T = EMBER;
  plate(sc, 8.4, 6.6);
  const R = V(-2.9, 0, 1.9), N0 = V(-1.6, 0, 0.8), N1 = V(0.2, 0, 1.9), N2 = V(-0.2, 0, -0.9);
  const root = grp(sc, R.x, 0, R.z);
  solid(root, rbox(0.9, 0.6, 0.9, 0.06), { y: 0.3, thr: 40 }); solid(root, rbox(0.92, 0.12, 0.92, 0.05), { y: 0.66, pal: EMBER, edges: false });
  shadow(root, 0.8); anim(root, "rise", 0.15, 0.7, { h: 1.2 });
  popMan(sc, -3.55, 0, 1.0, 0.55, { pose: "point" }); popMan(sc, -2.0, 0, 2.95, 0.65, { pose: "think" });
  const leaves = [[N1, V(2.4, 0, 2.6)], [N1, V(2.7, 0, 0.8)], [N2, V(2.2, 0, -1.2)], [N2, V(1.0, 0, -2.6)], [N2, V(-1.1, 0, -2.6)], [N0, V(-3.0, 0, -1.2)]];
  const y = 0.02, at = (p) => p.clone().setY(y);
  anim(lines(sc, [at(R), at(N0)], EMBER.line, 2), "draw", 0.9, 0.35);
  anim(lines(sc, [at(N0), at(N1), at(N0), at(N2)], EMBER.line, 2), "draw", 1.2, 0.4);
  [N0, N1, N2].forEach((n, i) => anim(solid(sc, new THREE.CylinderGeometry(0.13, 0.13, 0.06, 20), { x: n.x, y: 0.03, z: n.z, pal: EMBER, edges: false }), "pop", 1.15 + i * 0.12, 0.3));
  const fails = [0, 2, 4, 5], shapes = [
    () => new THREE.BoxGeometry(0.5, 0.5, 0.5), () => new THREE.CylinderGeometry(0.27, 0.27, 0.5, 28), () => new THREE.ConeGeometry(0.32, 0.6, 4),
    () => new THREE.BoxGeometry(0.62, 0.36, 0.42), () => new THREE.SphereGeometry(0.28, 22, 16), () => new THREE.CylinderGeometry(0.18, 0.3, 0.55, 6),
  ];
  leaves.forEach(([from, to], i) => {
    const t0 = 1.6 + i * 0.14;
    const ln = lines(sc, [at(from), at(to)], EMBER.line, 1.7, 0.999); anim(ln, "draw", t0, 0.4);
    const g = grp(sc, to.x, 0, to.z); shadow(g, 0.42);
    const geo = shapes[i](); geo.computeBoundingBox(); const hy = -geo.boundingBox.min.y;
    solid(g, geo, { y: hy, ry: Math.PI / 4, thr: 40, hull: i === 1 || i === 4 ? 1.06 : false, edges: !(i === 1 || i === 4) });
    anim(g, "pop", t0 + 0.35, 0.4);
    if (fails.includes(i)) {
      const k = fails.indexOf(i), tf = 3.9 + k * 0.22;
      dim(g, tf, 0.5);
      every((t) => { const p = EASE.io(clamp((t - tf) / 0.5)); g.rotation.z = 0.5 * p; g.position.y = -0.12 * p; ln.material.opacity = 1 - 0.7 * p; });
      // the lesson travels back to the start
      const back = path([at(to).setY(0.12), at(from).setY(0.12), ...(from === N0 ? [] : [at(N0).setY(0.12)]), at(R).setY(0.12)]);
      flow(sc, back, { t0: tf + 0.8, speed: 0.22, n: 1, r: 0.06 });
    }
  });
  // the winners grow
  const W = leaves[1][1], w2 = leaves[3][1];
  [0, 1, 2].forEach((j) => { const b = grp(sc, W.x, 0.5 + j * 0.42, W.z); solid(b, rbox(0.5, 0.42, 0.5, 0.04), { y: 0.21, pal: j === 2 ? EMBER : CLAY, thr: 40 }); anim(b, "grow", 4.5 + j * 0.25, 0.4); });
  const bulb = bulbObj(sc, { s: 1.1 }); bulb.position.set(W.x, 2.0, W.z); anim(bulb, "pop", 5.4, 0.5);
  every((t) => { if (t > 5.9) bulb.position.y = 2.0 + Math.sin((t - 5.9) * 2.2) * 0.06; });
  const b2 = grp(sc, w2.x, 0.36, w2.z); solid(b2, rbox(0.62, 0.36, 0.42, 0.04), { y: 0.18, pal: EMBER, thr: 40 }); anim(b2, "grow", 4.9, 0.4);
} };

// EXPLORATION 3 — The failure trap. An idea goes round the loop and is dropped before it matures;
// a new one replaces it. Unfinished work piles up, costs rise, the scale-up platform stays empty.
SCENES.E3 = { view: "iso", build(sc) {
  T = EMBER;
  plate(sc, 8.4, 6.6);
  const C = V(-0.9, 0, 0.45), R = 1.9;
  const shape = new THREE.Shape(); shape.absarc(0, 0, R + 0.24, 0, Math.PI * 2, false);
  const hole = new THREE.Path(); hole.absarc(0, 0, R - 0.24, 0, Math.PI * 2, true); shape.holes.push(hole);
  const ringGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.12, bevelEnabled: false, curveSegments: 72 });
  const ring = grp(sc, C.x, 0, C.z);
  solid(ring, ringGeo, { rx: -Math.PI / 2, thr: 40 }); shadow(ring, R + 0.6, 0.45);
  anim(ring, "rise", 0.2, 0.7, { h: 0.8 });
  const pt = (th, yy = 0.12) => V(C.x + Math.cos(th) * R, yy, C.z + Math.sin(th) * R);
  // direction marks moving round the loop
  const marks = [0, 1, 2, 3].map(() => {
    const g = grp(sc); g.userData.noFit = true;
    solid(g, new THREE.ConeGeometry(0.1, 0.24, 3), { rx: Math.PI / 2, pal: EMBER, edges: false }); return g;
  });
  every((t) => marks.forEach((g, i) => {
    g.visible = t > 1.1; const th = (t - 1.1) * 0.5 + (i * Math.PI) / 2;
    g.position.copy(pt(th, 0.2)); g.rotation.y = -th;
  }));
  // the scale-up platform, never reached
  const plat = slab(sc, 2.9, -1.3, { w: 1.6, d: 1.4, h: 0.14 }); anim(plat, "rise", 0.5, 0.6, { h: 0.8 });
  const ghost = solid(sc, box(1.1, 1.3, 0.95), { x: 2.9, y: 0.14 + 0.65, z: -1.3, opacity: 0.08, edgeOpacity: 0.35, pal: CLAY }); anim(ghost, "pop", 1.0, 0.4);
  anim(dashed(sc, new THREE.LineCurve3(pt(-0.2, 0.03), V(2.2, 0.03, -0.9)), 0x8a837d, 14, 1.2, 0.7), "draw", 1.2, 0.4);
  // team at the start of the loop
  const th0 = Math.PI * 0.78;
  popMan(sc, -3.55, 0, 2.55, 0.7, { pose: "cheer" }); popMan(sc, -3.85, 0, 1.55, 0.8, { pose: "think" });
  // unfinished work and rising costs, one more each round
  const pileAt = V(0.55, 0, 3.0);
  const pile = [[0, 0, 0, 0.44, 0.3], [0.48, 0, 0.12, 0.38, 1.1], [-0.42, 0, 0.18, 0.36, 0.6], [0.1, 0.4, 0.05, 0.34, 0.2], [0.55, 0.36, 0.1, 0.3, 1.4], [-0.3, 0.36, 0.1, 0.3, 0.9], [0.18, 0.72, 0.08, 0.28, 0.4]]
    .map(([dx, dy, dz, s, r]) => { const b = solid(sc, box(s, s * 0.8, s), { x: pileAt.x + dx, y: dy + s * 0.4, z: pileAt.z + dz, ry: r, rz: r * 0.2, pal: DIMC, ink: 0x0d0a09 }); b.visible = false; return b; });
  const costAt = V(2.75, 0, 1.55);
  const cost = Array.from({ length: 7 }, (_, j) => { const b = solid(sc, rbox(0.8, 0.22, 0.8, 0.04), { x: costAt.x, y: j * 0.24 + 0.11, z: costAt.z, pal: EMBER, ink: 0x3a1407 }); b.visible = false; return b; });
  const costBase = slab(sc, costAt.x, costAt.z, { w: 1.0, d: 1.0, h: 0.06 }); anim(costBase, "pop", 0.9, 0.4);
  const lit = bulbObj(sc, { s: 1 }), dead = bulbObj(sc, { lit: false, s: 1 });
  const t0 = 1.8, P = 3.4;
  every((t) => {
    const k = Math.floor((t - t0) / P), u = ((t - t0) % P) / P;
    lit.visible = dead.visible = false;
    pile.forEach((b, j) => { b.visible = t > t0 && k > j; });
    cost.forEach((b, j) => { const tj = t0 + j * P; const p = clamp((t - tj) / 0.4); b.visible = p > 0; b.scale.y = Math.max(0.001, EASE.out(p)); });
    if (t < t0) return;
    const start = pt(th0, 0.55), end = pt(th0 + Math.PI * 1.62, 0.55);
    if (u < 0.12) { lit.visible = true; lit.position.copy(start); lit.scale.setScalar(Math.max(0.001, EASE.back(u / 0.12))); }
    else if (u < 0.78) { lit.visible = true; lit.scale.setScalar(1); const th = th0 + Math.PI * 1.62 * EASE.io((u - 0.12) / 0.66); lit.position.copy(pt(th, 0.55 + Math.abs(Math.sin(th * 3)) * 0.06)); }
    else if (u < 0.97) {
      const p = (u - 0.78) / 0.19, j = Math.min(k, 6), dest = pile[j].position.clone().add(V(0, 0.35, 0));
      dead.visible = true; dead.position.lerpVectors(end, dest, EASE.io(p)); dead.position.y += Math.sin(p * Math.PI) * 0.5; dead.rotation.z = p * 1.2;
    }
  });
} };

// AMBIDEXTROUS 1 — Two units, one top team. The company in the middle; an organic unit (ember) on
// its left and a mechanistic unit (ice) on its right; the senior team on the roof holds both.
SCENES.A1 = { view: "high", build(sc) {
  T = ICE;
  plate(sc, 11, 5.2, { pools: [[EMBER, -3.4, 0, 0.55], [ICE, 3.6, 0, 0.55]], rim: CLAY });
  const { H } = tower(sc, 0, -0.7, { floors: 4, fh: 0.56, t0: 0.15, dur: 1.3, glass: { top: 0xcfc8c1, a: 0xbdb5ae, b: 0xa59d96 } });
  [[-0.42, EMBER], [0, GOLD], [0.42, ICE]].forEach(([dx, tie], i) => popMan(sc, dx, H, -0.6 + (i === 1 ? -0.18 : 0), 1.75 + i * 0.08, { s: 0.52, tie }));
  // organic unit
  as(EMBER, () => {
    const P = [V(-4.3, 0, 0.6), V(-2.75, 0, -0.55)];
    P.forEach((p, k) => {
      anim(disc(sc, p.x, p.z, { r: 0.68 }), "pop", 0.6 + k * 0.12, 0.4);
      [0, 1, 2].forEach((j) => { const a = Math.PI * (0.5 + (2 * j) / 3); popMan(sc, p.x + Math.cos(a) * 0.34, 0.1, p.z + Math.sin(a) * 0.34, 1.0 + k * 0.1 + j * 0.05, { s: 0.5, face: 0.2, body: k === 0 && j === 0 ? EMBER : undefined }); });
    });
    const a = V(-3.75, 0.05, 0.25), b = V(-3.3, 0.05, -0.2);
    anim(lines(sc, [a, b], EMBER.line, 1.8), "draw", 1.6, 0.3);
    flow(sc, new THREE.LineCurve3(a.clone().setY(0.13), b.clone().setY(0.13)), { t0: 2.0, speed: 0.9, n: 1, r: 0.06 });
    flow(sc, new THREE.LineCurve3(b.clone().setY(0.13), a.clone().setY(0.13)), { t0: 2.2, speed: 0.8, n: 1, r: 0.06 });
  });
  // mechanistic unit
  pyramid(sc, 3.6, -0.5, [1, 2, 3, 4], { t0: 0.6, gap: 0.42, lh: 0.36, step: 0.36, s: 0.48, slow: 0.14 });
  // the senior team links to both
  const top = V(0, H + 0.6, -0.6);
  const toL = new THREE.QuadraticBezierCurve3(top, V(-2.3, H + 0.9, -0.4), V(-3.4, 1.1, 0.0));
  const toR = new THREE.QuadraticBezierCurve3(top, V(2.3, H + 0.9, -0.4), V(3.6, 1.8, -0.9));
  anim(dashed(sc, toL, EMBER.line, 30, 1.5), "draw", 2.3, 0.6); anim(dashed(sc, toR, ICE.line, 30, 1.5), "draw", 2.4, 0.6);
  flow(sc, toL, { t0: 2.9, speed: 0.22, n: 1, r: 0.06, pal: EMBER }); flow(sc, toR, { t0: 3.0, speed: 0.22, n: 1, r: 0.06, pal: ICE });
} };

// AMBIDEXTROUS 2 — Each side works its own way. The exploring unit churns through prototypes inside
// a protective ring; the core moves tasks along a steady route; the top team sends more to the core
// and a protected share to the new unit, and hears back from both.
SCENES.A2 = { view: "iso", build(sc) {
  T = ICE;
  plate(sc, 8.4, 6.6, { pools: [[EMBER, -1.7, 1.9, 0.55], [ICE, 1.9, -1.4, 0.6]], rim: CLAY });
  // top team
  const D = V(-2.75, 0, -2.25);
  anim(disc(sc, D.x, D.z, { r: 0.85, h: 0.32, ring: GOLD }), "rise", 0.15, 0.6, { h: 0.8 });
  popMan(sc, D.x - 0.3, 0.32, D.z + 0.15, 0.6, { tie: EMBER, s: 0.95 }); popMan(sc, D.x + 0.32, 0.32, D.z - 0.1, 0.7, { tie: ICE, s: 0.95 });
  // exploring unit, protected
  const L = V(-1.7, 0, 1.95);
  as(EMBER, () => {
    anim(disc(sc, L.x, L.z, { r: 1.55, h: 0.06 }), "pop", 0.4, 0.45);
    const fence = solid(sc, new THREE.CylinderGeometry(1.75, 1.75, 0.55, 64, 1, true), { x: L.x, y: 0.28, z: L.z, pal: EMBER, opacity: 0.13, edges: false });
    anim(fence, "grow", 3.4, 0.6);
    const lip = solid(sc, new THREE.TorusGeometry(1.75, 0.025, 8, 80), { x: L.x, y: 0.56, z: L.z, rx: Math.PI / 2, pal: EMBER, edges: false }); anim(lip, "pop", 3.6, 0.4);
    const table = grp(sc, L.x, 0.06, L.z); solid(table, rbox(0.9, 0.34, 0.9, 0.05), { y: 0.17, thr: 40 }); anim(table, "rise", 0.6, 0.5, { h: 0.6 });
    [[-0.95, 0.35, "think"], [0.25, 0.95, "hold"], [0.9, -0.3, "point"]].forEach(([dx, dz, pose], i) => popMan(sc, L.x + dx, 0.06, L.z + dz, 0.9 + i * 0.08, { pose }));
    const protos = [[-0.22, -0.2], [0.2, -0.22], [-0.2, 0.2], [0.22, 0.2]].map(([dx, dz], i) => {
      const g = grp(sc, L.x + dx, 0.4, L.z + dz); g.userData.noFit = true;
      solid(g, i % 2 ? new THREE.CylinderGeometry(0.11, 0.11, 0.22, 18) : box(0.2, 0.2, 0.2), { y: 0.11, pal: i === 2 ? EMBER : CLAY, edges: i % 2 === 0, hull: i % 2 ? 1.08 : false });
      return g;
    });
    every((t) => protos.forEach((g, i) => {
      if (t < 1.4) { g.visible = false; return; }
      const u = ((t - 1.4) / 1.6 + i * 0.27) % 1;
      g.visible = u < 0.72; const e = u < 0.12 ? EASE.back(u / 0.12) : u > 0.6 ? 1 - (u - 0.6) / 0.12 : 1; g.scale.setScalar(Math.max(0.001, e));
    }));
  });
  // the core: tasks on a fixed route past three desks
  const z0 = -0.95, xs = [0.4, 1.3, 2.3, 3.3, 3.9];
  solid(sc, box(3.7, 0.03, 0.24), { x: 2.15, y: 0.015, z: z0, pal: ICE, edges: false });
  [1.3, 2.3, 3.3].forEach((x, i) => { anim(desk(sc, x, z0 - 0.62, { w: 0.72 }), "rise", 0.5 + i * 0.1, 0.5, { h: 0.7 }); popMan(sc, x, 0, z0 - 1.12, 0.9 + i * 0.08, { tie: ICE, s: 0.95 }); });
  const st = xs.map((x) => V(x, 0.04, z0));
  const cards = Array.from({ length: 5 }, () => cardObj(sc));
  const m = 0.45, d = 0.45, Pp = m + d;
  every((t) => cards.forEach((c, j) => {
    const t0 = 1.6, i = j + 5 * Math.floor((t - t0 - j * Pp) / (5 * Pp)), tau = t - t0 - i * Pp, r = along(st, tau, m, d);
    c.visible = !!r && t > t0; if (!c.visible) return; c.position.copy(r.pos);
    c.userData.plain.visible = r.at < 2; c.userData.stamped.visible = r.at >= 2;
  }));
  // resources down, information up
  const top = V(D.x, 1.15, D.z);
  const toCore = arc(top, V(1.3, 0.35, z0 + 0.3), 1.0), toNew = arc(top, V(L.x + 0.3, 0.5, L.z - 0.9), 0.6);
  anim(dashed(sc, toCore, GOLD.line, 30, 1.3, 0.8), "draw", 2.4, 0.5); anim(dashed(sc, toNew, GOLD.line, 30, 1.3, 0.8), "draw", 2.5, 0.5);
  flow(sc, toCore, { t0: 2.9, speed: 0.34, n: 3, make: coinObj }); flow(sc, toNew, { t0: 3.0, speed: 0.34, n: 1, make: coinObj });
  flow(sc, arc(V(3.3, 0.6, z0 - 0.7), V(D.x + 0.4, 1.0, D.z + 0.3), 1.3), { t0: 3.4, speed: 0.25, n: 1, r: 0.05, pal: WHITE_DOT });
  flow(sc, arc(V(L.x - 0.6, 0.6, L.z - 0.6), V(D.x - 0.2, 1.0, D.z + 0.5), 0.9), { t0: 3.6, speed: 0.25, n: 1, r: 0.05, pal: WHITE_DOT });
} };

// AMBIDEXTROUS 3 — Ideas graduate. Profits rise from the core to the top team and fund the new unit;
// an idea matures there, crosses to the core, and the core grows a floor. Then again.
SCENES.A3 = { view: "iso", build(sc) {
  T = ICE;
  plate(sc, 8.4, 6.6, { pools: [[EMBER, -1.8, 1.9, 0.5], [ICE, 2.0, -1.4, 0.55]], rim: CLAY });
  const D = V(-2.75, 0, -2.3);
  anim(disc(sc, D.x, D.z, { r: 0.8, h: 0.32, ring: GOLD }), "rise", 0.15, 0.6, { h: 0.8 });
  popMan(sc, D.x - 0.28, 0.32, D.z + 0.12, 0.6, { tie: EMBER, s: 0.95 }); popMan(sc, D.x + 0.3, 0.32, D.z - 0.12, 0.7, { tie: ICE, s: 0.95 });
  // the new unit
  const L = V(-1.8, 0, 1.95);
  as(EMBER, () => {
    anim(disc(sc, L.x, L.z, { r: 1.05 }), "pop", 0.4, 0.45);
    const tbl = grp(sc, L.x, 0.1, L.z); solid(tbl, new THREE.CylinderGeometry(0.3, 0.34, 0.36, 24), { y: 0.18, edges: false, hull: 1.05 }); anim(tbl, "rise", 0.55, 0.5, { h: 0.6 });
    [0, 1, 2].forEach((j) => { const a = Math.PI * (0.35 + (2 * j) / 3); popMan(sc, L.x + Math.cos(a) * 0.68, 0.1, L.z + Math.sin(a) * 0.68, 0.8 + j * 0.07, { pose: j === 1 ? "cheer" : "stand" }); });
  });
  // the core
  const C = V(2.05, 0, -1.35), w = 1.5, d = 1.3, fh = 0.5, base = 2;
  const core = grp(sc, C.x, 0, C.z); shadow(core, 1.2);
  for (let f = 0; f < base; f++) floorBlock(core, w, d, fh, f * fh);
  anim(core, "rise", 0.3, 0.9, { h: base * fh + 0.6 });
  const roof = grp(sc, C.x, base * fh, C.z); solid(roof, box(w - 0.24, 0.24, d - 0.24), { y: 0.12, pal: ICE }); anim(roof, "rise", 0.3, 0.9, { h: base * fh + 0.6 });
  popMan(sc, C.x - 1.0, 0, C.z + 1.15, 1.0, { tie: ICE }); popMan(sc, C.x + 0.2, 0, C.z + 1.35, 1.1, { tie: ICE, pose: "point" });
  // the bridge from new unit to core
  const b0 = V(-1.0, 0.03, 1.2), b1 = V(1.25, 0.03, -0.55);
  anim(dashed(sc, new THREE.LineCurve3(b0, b0.clone().lerp(b1, 0.5)), EMBER.line, 10, 1.5), "draw", 1.5, 0.3);
  anim(dashed(sc, new THREE.LineCurve3(b0.clone().lerp(b1, 0.5), b1), ICE.line, 10, 1.5), "draw", 1.75, 0.3);
  const t0 = 2.2, P = 6.0, extra = 3;
  const floors = Array.from({ length: extra }, (_, j) => { const f = floorBlock(core, w, d, fh, (base + j) * fh); anim(f, "rise", t0 + j * P + 5.1, 0.55, { h: fh + 0.25 }); return f; });
  every((t) => { if (t < 1.25) return; let up = 0; for (let j = 0; j < extra; j++) up += EASE.out(clamp((t - (t0 + j * P + 5.1)) / 0.55)); roof.position.y = base * fh + up * fh; });
  const coinsUp = [coinObj(sc), coinObj(sc)], coinsDown = [coinObj(sc), coinObj(sc)];
  const bulb = bulbObj(sc, { s: 1.1 });
  every((t) => {
    const k = Math.floor((t - t0) / P), u = ((t - t0) % P) / P, h = base * fh + Math.min(Math.max(k, 0), extra) * fh;
    const up = arc(V(C.x, h + 0.4, C.z), V(D.x, 0.9, D.z), 1.4), down = arc(V(D.x, 0.9, D.z), V(L.x, 0.75, L.z), 1.0);
    coinsUp.forEach((c, i) => { const p = (u - 0.02 - i * 0.05) / 0.22; c.visible = t > t0 && p > 0 && p < 1; if (c.visible) c.position.copy(up.getPoint(EASE.io(p))); });
    coinsDown.forEach((c, i) => { const p = (u - 0.24 - i * 0.05) / 0.2; c.visible = t > t0 && p > 0 && p < 1; if (c.visible) c.position.copy(down.getPoint(EASE.io(p))); });
    bulb.visible = t > t0 && u > 0.47 && u < 0.86;
    if (!bulb.visible) return;
    if (u < 0.6) { const p = (u - 0.47) / 0.13; bulb.position.set(L.x, 0.75, L.z); bulb.scale.setScalar(Math.max(0.001, 0.25 + 0.75 * EASE.back(p))); }
    else { const p = EASE.io((u - 0.6) / 0.26); bulb.scale.setScalar(1); bulb.position.lerpVectors(V(L.x, 0.75, L.z), V(C.x, h + 0.55, C.z), p); bulb.position.y += Math.sin(p * Math.PI) * 0.9; }
  });
} };

// EXPLOITATION 1 — Tall hierarchy, separate silos. Three functions, each its own column of levels,
// joined only at the top. A message between neighbours climbs one column and comes down another.
SCENES.X1 = { view: "face", build(sc) {
  T = ICE;
  plate(sc, 9.6, 4.4);
  const xs = [-2.7, 0, 2.7], z = -0.45, lv = 4, gap = 0.8, Ht = lv * gap;
  xs.forEach((x, si) => {
    const s = grp(sc, x, 0, z);
    for (let l = 0; l < lv; l++) solid(s, rbox(1.5, 0.1, 1.15, 0.03), { y: l * gap + 0.05, thr: 40 });
    for (const [px, pz] of [[-0.68, -0.5], [0.68, -0.5], [-0.68, 0.5], [0.68, 0.5]]) solid(s, box(0.06, Ht, 0.06), { x: px, y: Ht / 2, z: pz, edges: false, hull: 1.3 });
    shadow(s, 1.1); anim(s, "rise", 0.2 + si * 0.15, 0.8, { h: Ht + 0.4 });
    for (let l = 0; l < lv; l++) popMan(sc, x, l * gap + 0.1, z + 0.18, 0.95 + l * 0.12 + si * 0.05, { s: 0.5 });
  });
  // walls between the silos
  [-1.35, 1.35].forEach((x, i) => { const w = solid(sc, box(0.04, Ht - 0.05, 1.25), { x, y: (Ht - 0.05) / 2, z, pal: ICE, opacity: 0.16, edgeOpacity: 0.6, ink: ICE.b }); anim(w, "grow", 1.7 + i * 0.1, 0.5); });
  // the top team, the only place the silos meet
  const roof = grp(sc, 0, Ht, z); solid(roof, rbox(7.0, 0.16, 1.3, 0.05), { y: 0.08, thr: 40 }); anim(roof, "drop", 1.5, 0.6, { h: 1.2 });
  popMan(sc, 0, Ht + 0.16, z + 0.1, 1.95, { s: 0.55, body: ICE }); popMan(sc, -0.75, Ht + 0.16, z, 2.05, { s: 0.5 }); popMan(sc, 0.75, Ht + 0.16, z, 2.1, { s: 0.5 });
  // the short way is closed
  anim(dashed(sc, new THREE.LineCurve3(V(xs[0] + 0.4, 0.45, z + 0.7), V(xs[2] - 0.4, 0.45, z + 0.7)), 0x8a837d, 26, 1.2, 0.55), "draw", 2.4, 0.5);
  // the long way: up one column, across the top, down the other
  const mz = z + 0.62, hy = (l) => l * gap + 0.62;
  const st = [0, 1, 2, 3].map((l) => V(xs[0] + 0.5, hy(l), mz)).concat([V(xs[0] + 0.5, Ht + 0.5, mz), V(xs[2] - 0.5, Ht + 0.5, mz)], [3, 2, 1, 0].map((l) => V(xs[2] - 0.5, hy(l), mz)));
  anim(polyline(sc, st, ICE.line, 1.2, 0.45), "draw", 2.6, 0.9);
  const dot = dotObj(sc, 0.09, ICE);
  const m = 0.42, dwell = 0.38, cycle = (st.length - 1) * (m + dwell) + 1.4;
  every((t) => { const t0 = 3.0; if (t < t0) { dot.visible = false; return; } const r = along(st, (t - t0) % cycle, m, dwell); dot.visible = !!r; if (r) dot.position.copy(r.pos); });
} };

// EXPLOITATION 2 — One route, one rulebook. Every task follows the same route past specialists who
// each do one step from a manual; the manager approves; the next task follows at the same pace.
SCENES.X2 = { view: "iso", build(sc) {
  T = ICE;
  plate(sc, 8.4, 6.6);
  const z0 = 1.9, xc = 1.6;
  const st = [V(-3.6, 0.05, z0), V(-2.0, 0.05, z0), V(-0.3, 0.05, z0), V(xc, 0.05, z0), V(xc, 0.05, 0.1), V(xc, 0.05, -1.9)];
  solid(sc, box(xc + 3.6 + 0.13, 0.03, 0.26), { x: (xc - 3.6) / 2, y: 0.015, z: z0, pal: ICE, edges: false });
  solid(sc, box(0.26, 0.03, z0 + 1.9), { x: xc, y: 0.015, z: (z0 - 1.9) / 2, pal: ICE, edges: false });
  // specialists behind the lane, each with a manual on the desk
  [[-2.0, z0 - 0.72, -2.0, z0 - 1.2], [-0.3, z0 - 0.72, -0.3, z0 - 1.2], [xc - 0.72, 0.1, xc - 1.2, 0.1]].forEach(([dx, dz, px, pz], i) => {
    anim(desk(sc, dx, dz, { w: 0.85, d: 0.5 }), "rise", 0.3 + i * 0.12, 0.55, { h: 0.7 });
    popMan(sc, px, 0, pz, 0.8 + i * 0.1, { pose: "hold" });
  });
  // the manager on a raised step at the corner approves every task
  const M = V(xc + 0.95, 0, z0 + 0.85);
  const mg = grp(sc, M.x, 0, M.z); solid(mg, rbox(1.05, 0.24, 1.0, 0.05), { y: 0.12, thr: 40 }); shadow(mg, 0.8); anim(mg, "rise", 0.6, 0.5, { h: 0.6 });
  popMan(sc, M.x + 0.1, 0.24, M.z + 0.05, 1.1, { body: ICE, pose: "point" });
  // intake and done trays
  const tray = (x, z, n, t) => { const g = grp(sc, x, 0, z); solid(g, rbox(0.7, 0.08, 0.55, 0.03), { y: 0.04, thr: 40 }); shadow(g, 0.5); anim(g, "pop", t, 0.4); const sheets = []; for (let i = 0; i < n; i++) sheets.push(solid(g, box(0.46, 0.035, 0.34), { y: 0.1 + i * 0.045 })); return sheets; };
  tray(-3.6, z0 - 0.75, 3, 0.9);
  const done = tray(xc + 0.75, -1.9, 6, 1.0); done.forEach((s) => (s.visible = false));
  const cards = Array.from({ length: 6 }, () => cardObj(sc));
  const m = 0.55, d = 0.5, P = m + d, t0 = 1.7, n = st.length - 1;
  every((t) => {
    cards.forEach((c, j) => {
      const i = j + 6 * Math.floor((t - t0 - j * P) / (6 * P)), tau = t - t0 - i * P, r = along(st, tau, m, d);
      c.visible = t > t0 && !!r; if (!c.visible) return;
      c.position.copy(r.pos); c.rotation.y = r.at >= 3 && !(r.at === 3 && r.moving) ? Math.PI / 2 : 0;
      c.userData.plain.visible = r.at < 3; c.userData.stamped.visible = r.at >= 3;
    });
    const finished = Math.max(0, Math.floor((t - t0 - n * P) / P) + 1);
    done.forEach((s, i) => { s.visible = i < Math.min(finished, 6); });
  });
  // a report goes up from the manager after each approval
  flow(sc, new THREE.LineCurve3(V(M.x, 1.5, M.z), V(M.x, 3.0, M.z)), { t0: 3.4, speed: 0.55, n: 1, r: 0.06, pal: ICE });
} };

// EXPLOITATION 3 — The success trap. Cost savings race to the top; the new idea crawls up, stalls
// halfway and is parked; meanwhile the customers drift off the edge.
SCENES.X3 = { view: "face", build(sc) {
  T = ICE;
  plate(sc, 10, 4.4);
  const { top } = pyramid(sc, 0.4, -0.6, [1, 2, 3, 4], { t0: 0.3, gap: 0.64, lh: 0.66, step: 0.5, s: 0.62, riser: false });
  popMan(sc, -3.1, 0, 0.4, 1.2, { s: 0.75, tie: EMBER, pose: "hold" }); popMan(sc, -2.5, 0, 0.5, 1.25, { s: 0.75, tie: EMBER });
  popMan(sc, 2.85, 0, 0.45, 1.3, { s: 0.75 }); popMan(sc, 3.45, 0, 0.55, 1.35, { s: 0.75, pose: "point" });
  // savings: fast, all the way up
  const cx = 2.2, peak = top + 0.6;
  const cp = [V(3.1, 0.9, 0.65), V(cx, 0.9, 0.65), V(cx, peak, 0.65), V(0.75, peak, 0.65)];
  anim(polyline(sc, cp, GOLD.line, 2.0), "draw", 1.8, 0.6);
  flow(sc, path(cp), { t0: 2.2, speed: 0.45, n: 3, make: coinObj });
  // the idea: slow, stops halfway, parked on the shelf
  const stopY = 2 * 0.66 + 0.7, ix = -1.6;
  const ip = [V(-2.6, 0.9, 0.65), V(ix, 0.9, 0.65), V(ix, stopY, 0.65), V(-3.3, stopY, 0.65)];
  anim(polyline(sc, ip, EMBER.line, 2.0), "draw", 1.9, 0.6);
  const shelf = grp(sc, -3.9, 0, 0.2); const sh = stopY - 0.42;
  solid(shelf, rbox(1.5, 0.08, 1.0, 0.03), { y: sh }); solid(shelf, box(0.07, sh, 0.07), { x: -0.62, y: sh / 2, edges: false, hull: 1.3 }); solid(shelf, box(0.07, sh, 0.07), { x: 0.62, y: sh / 2, edges: false, hull: 1.3 });
  shadow(shelf, 0.9); anim(shelf, "rise", 1.0, 0.6, { h: 2.4 });
  const parked = [[-4.35, 0.05], [-3.95, 0.3], [-3.55, 0.0]].map(([x, dz]) => { const b = bulbObj(sc, { lit: false, s: 0.55 }); b.position.set(x, sh + 0.3, 0.2 + dz); b.visible = false; return b; });
  const idea = bulbObj(sc, { s: 0.6 });
  const iP = 7, it0 = 2.4;
  every((t) => {
    const k = Math.floor((t - it0) / iP), u = ((t - it0) % iP) / iP;
    parked.forEach((b, j) => { b.visible = t > it0 && j < Math.min(k + (u > 0.86 ? 1 : 0), 3); });
    idea.visible = t > it0 && u < 0.86;
    if (!idea.visible) return;
    // slow along and up (most of the time), a pause, then sideways to the shelf
    let q;
    if (u < 0.55) q = EASE.io(u / 0.55) * 0.62; else if (u < 0.68) q = 0.62; else q = 0.62 + 0.38 * EASE.io((u - 0.68) / 0.18);
    const pts = ip, seg = [0, 0.18, 0.62, 1];
    let i = 0; while (i < 2 && q > seg[i + 1]) i++;
    const f = (q - seg[i]) / (seg[i + 1] - seg[i]);
    idea.position.lerpVectors(pts[i], pts[i + 1], f); idea.position.y += 0.05;
    if (u > 0.55 && u < 0.68) idea.position.x += Math.sin((u - 0.55) * 90) * 0.03;
  });
  // the market moves on: customers walk off the edge, and later others arrive
  const cpad = slab(sc, 4.3, -1.35, { w: 1.3, d: 1.1, h: 0.08 }); anim(cpad, "pop", 1.4, 0.4);
  const crowd = grp(sc, 4.3, 0.08, -1.35); crowd.userData.noFit = true;
  [[-0.3, 0.2], [0.25, 0.3], [0, -0.25]].forEach(([dx, dz]) => man(crowd, dx, 0, dz, { s: 0.7, tie: GOLD }));
  every((t) => {
    const t0 = 3.0, P = 9;
    if (t < 1.6) { crowd.visible = false; return; }
    if (t < t0) { crowd.visible = true; crowd.position.set(4.3, 0.08, -1.35); crowd.scale.setScalar(Math.max(0.001, EASE.back(clamp((t - 1.6) / 0.45)))); return; }
    const u = ((t - t0) % P) / P;
    crowd.visible = u < 0.62 || u > 0.8; crowd.scale.setScalar(1);
    if (u < 0.2) crowd.position.set(4.3, 0.08, -1.35);
    else if (u < 0.62) { const p = (u - 0.2) / 0.42, x = 4.3 + 1.9 * EASE.io(p); crowd.position.set(x, 0.08 - Math.max(0, x - 5.05) * 2.2 + Math.abs(Math.sin(p * 18)) * 0.05, -1.35); }
    else if (u > 0.8) { crowd.position.set(4.3, 0.08, -1.35); crowd.scale.setScalar(Math.max(0.001, EASE.back(clamp((u - 0.8) / 0.08)))); }
  });
} };

// ------------------------------------------------------------- public API
export const SCENE_NAMES = Object.keys(SCENES);

function makeCamera(view) {
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
  if (view === "high") { cam.position.set(4.5, 15, 24); cam.lookAt(0, 1.5, 0); }
  else if (view === "face") { cam.position.set(4.5, 7.5, 24); cam.lookAt(0, 2.0, 0); }
  else { cam.position.set(20, 16.3, 20); cam.lookAt(0, 0.9, 0); }
  cam.updateMatrixWorld();
  return cam;
}
// The finished model's extent, ignoring things that travel (dots, coins, walkers).
function fitBox(root) {
  const out = new THREE.Box3(), tmp = new THREE.Box3();
  root.updateMatrixWorld(true);
  (function walk(o) {
    if (o.userData.noFit) return;
    if (o.geometry && !o.isSprite && o.material && o.material.blending !== THREE.AdditiveBlending) {
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      tmp.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld);
      if (Number.isFinite(tmp.min.x)) out.union(tmp);
    }
    o.children.forEach(walk);
  })(root);
  return out;
}

export function buildScene(name) {
  const def = SCENES[name];
  VIEW = def.view; T = EMBER; ANIM = [];
  const scene = new THREE.Scene();
  def.build(scene);
  const anims = ANIM; ANIM = [];
  const cam = makeCamera(def.view);
  apply(anims, 1000);
  const b = fitBox(scene), inv = cam.matrixWorldInverse;
  const ext = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
  for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) {
    const p = V(x, y, z).applyMatrix4(inv);
    ext.minX = Math.min(ext.minX, p.x); ext.maxX = Math.max(ext.maxX, p.x);
    ext.minY = Math.min(ext.minY, p.y); ext.maxY = Math.max(ext.maxY, p.y);
  }
  apply(anims, 0);
  return { name, scene, cam, anims, ext };
}

// Fits the model into a W x H viewport (CSS pixels).
export function fit(s, W, H, { pad = 10 } = {}) {
  const { ext, cam } = s;
  const k = Math.min((W - 2 * pad) / (ext.maxX - ext.minX), (H - 2 * pad) / (ext.maxY - ext.minY));
  const cx = (ext.minX + ext.maxX) / 2, cy = (ext.minY + ext.maxY) / 2;
  cam.left = cx - W / 2 / k; cam.right = cx + W / 2 / k; cam.top = cy + H / 2 / k; cam.bottom = cy - H / 2 / k;
  cam.updateProjectionMatrix();
  s.scene.traverse((o) => { if (o.material?.isLineMaterial) o.material.resolution.set(W * 2, H * 2); });
  s.W = W; s.H = H;
}

export function draw(renderer, s, t) { apply(s.anims, t); renderer.render(s.scene, s.cam); }

export function createRenderer(canvas, dpr = 1) {
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  r.setPixelRatio(dpr); r.outputColorSpace = THREE.SRGBColorSpace; r.autoClear = false;
  r.clippingPlanes = [new THREE.Plane(V(0, 1, 0), 0.3)];
  return r;
}

export function disposeScene(s) {
  s?.scene.traverse((o) => {
    o.geometry?.dispose();
    const m = o.material; if (m) (Array.isArray(m) ? m : [m]).forEach((mm) => { if (mm.map && !mm.map.userData.shared) mm.map.dispose(); mm.dispose(); });
  });
}
