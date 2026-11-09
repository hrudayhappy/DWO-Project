// Landing-page scenes: small isometric models of how an organisation is designed.
// Every object is registered on a timeline and assembled by apply(anims, t): it rises
// through the plate, pops, draws or fades in, then the flows keep moving.
// Labels are not drawn in the scene. Each scene lists notes with a 3D anchor; the Stage
// component lays them out in columns beside the canvas and joins them with leader lines.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { LineSegments2 } from "three/addons/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";

export const THEMES = {
  explore: { field: "#6a1e2c", accent: 0xff8a76, accentMid: 0xf26a58, accentDark: 0xa83a33, ink: 0x3a1218 },
  ambi:    { field: "#0f4d3e", accent: 0x6ff0bf, accentMid: 0x3fd6a0, accentDark: 0x1f8a66, ink: 0x123a30 },
  exploit: { field: "#14306b", accent: 0x8fd0ff, accentMid: 0x5aaef2, accentDark: 0x2d6fb3, ink: 0x101e40 },
};
const WHITE = { top: 0xffffff, a: 0xeef2f4, b: 0xd9e0e4 };
const IDEA = 0xffd65a;
let T, RES = new THREE.Vector2(800, 600), VIEW = "iso", ANIM = [], NOTES = [];
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const clamp = (v) => Math.min(1, Math.max(0, v));
const EASE = {
  out: (p) => 1 - Math.pow(1 - p, 3),
  back: (p) => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); },
  io: (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2),
};

// ------------------------------------------------------------- drawing primitives
function shade(geo, pal) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  g.computeVertexNormals();
  const n = g.attributes.normal, cols = [];
  const C = [new THREE.Color(pal.top), new THREE.Color(pal.a), new THREE.Color(pal.b), new THREE.Color(pal.b).multiplyScalar(0.82)];
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
function lineMat(color, width = 1.25, opacity = 1) {
  const m = new LineMaterial({ color, linewidth: width * 2, transparent: opacity < 1, opacity }); m.resolution = RES; return m;
}
const palAccent = () => ({ top: T.accent, a: T.accentMid, b: T.accentDark });
function solid(parent, geo, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, accent = false, pal, edges = true, hull = false, ink, opacity = 1, thr = 30 } = {}) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.set(rx, ry, rz);
  const p = pal || (accent ? palAccent() : WHITE);
  g.add(new THREE.Mesh(shade(geo, p), new THREE.MeshBasicMaterial({ vertexColors: true, transparent: opacity < 1, opacity, depthWrite: opacity >= 1, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 })));
  const inkC = ink ?? (accent ? T.accentDark : T.ink);
  if (edges) g.add(new LineSegments2(new LineSegmentsGeometry().fromEdgesGeometry(new THREE.EdgesGeometry(geo, thr)), lineMat(inkC, 1.25, opacity < 1 ? Math.max(opacity, 0.5) : 1)));
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
function dashed(parent, curve, color, n = 40, width = 1.6) { const p = curve.getPoints(n), s = []; for (let i = 0; i < p.length - 1; i += 2) s.push(p[i], p[i + 1]); return lines(parent, s, color, width); }
function grp(parent, x = 0, y = 0, z = 0) { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; }

// ------------------------------------------------------------- timeline
function anim(obj, mode, t0, dur = 0.6, opts = {}) { ANIM.push({ obj, mode, t0, dur, base: obj.position.clone(), sc: obj.scale.clone(), ...opts }); return obj; }
function every(fn) { ANIM.push({ mode: "fn", fn }); }
export function apply(anims, t) {
  for (const a of anims) {
    if (a.mode === "fn") { a.fn(t); continue; }
    const p = clamp((t - a.t0) / a.dur), o = a.obj;
    o.visible = p > 0; if (!o.visible) continue;
    if (a.mode === "rise") o.position.y = a.base.y - (a.h ?? 3) * (1 - EASE.out(p));
    else if (a.mode === "drop") o.position.y = a.base.y + (a.h ?? 1.2) * (1 - EASE.out(p));
    else if (a.mode === "grow") o.scale.y = a.sc.y * Math.max(0.001, EASE.out(p));
    else if (a.mode === "pop") { const e = Math.max(0.001, EASE.back(p)); o.scale.set(a.sc.x * e, a.sc.y * e, a.sc.z * e); }
    else if (a.mode === "fade") { o.material.opacity = EASE.out(p); o.position.y = a.base.y - 0.25 * (1 - EASE.out(p)); }
    else if (a.mode === "draw") o.geometry.instanceCount = Math.max(1, Math.ceil(EASE.io(p) * o.userData.n));
  }
}
// Tokens that travel along a curve on a loop once t passes t0.
function flow(parent, curve, { t0 = 2, speed = 0.5, n = 3, r = 0.085, color, make } = {}) {
  const items = Array.from({ length: n }, () => (make ? make(parent) : dotObj(parent, r, color)));
  every((t) => items.forEach((it, i) => {
    it.visible = t > t0; if (!it.visible) return;
    const u = (((t - t0) * speed + i / n) % 1 + 1) % 1; it.position.copy(curve.getPoint(u));
  }));
}
function dotObj(parent, r = 0.085, color) {
  const g = new THREE.Group(); parent.add(g);
  g.add(new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), new THREE.MeshBasicMaterial({ color: color ?? T.accentMid })));
  const h = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), new THREE.MeshBasicMaterial({ color: T.ink, side: THREE.BackSide })); h.scale.setScalar(1.3); g.add(h);
  return g;
}

// ------------------------------------------------------------- kit
const facing = () => (VIEW === "iso" ? Math.PI / 4 : 0.18);

function plate(parent, w = 10, d = 7.4) {
  solid(parent, new RoundedBoxGeometry(w, 0.22, d, 4, 0.1), { y: -0.11, thr: 40 });
  solid(parent, new RoundedBoxGeometry(w, 0.06, d, 4, 0.03), { y: -0.25, accent: true, edges: false });
  const bar = (x, z, len) => solid(parent, box(len, 0.02, 0.16), { x, y: 0.011, z, accent: true, edges: false });
  bar(-w / 2 + 1.0, -d / 2 + 0.45, 1.1); bar(-w / 2 + 2.4, -d / 2 + 0.45, 0.5);
  bar(w / 2 - 1.0, d / 2 - 0.45, 1.2); bar(w / 2 - 2.3, d / 2 - 0.45, 0.6);
}

// A note beside the scene: a title, an optional line of detail, the point it refers to, and when it appears.
function note(title, sub, x, y, z, t0, side) { NOTES.push({ title, sub, at: V(x, y, z), t0, side }); }

// A mannequin: big round head, rounded body, arms and legs, a tie (or goggles for scientists).
function limb(parent, a, b, r, opts = {}) {
  const d = new THREE.Vector3().subVectors(b, a), len = d.length();
  const g = solid(parent, new THREE.CapsuleGeometry(r, Math.max(0.01, len - 2 * r * 0.2), 6, 12), { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2, edges: false, hull: 1.16, ...opts });
  g.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize()); return g;
}
const POSES = {
  stand: { l: [V(-0.2, 0.36, 0.02)], r: [V(0.2, 0.36, 0.02)] },
  cheer: { l: [V(-0.24, 0.98, 0.04)], r: [V(0.26, 0.96, 0.06)] },
  hold: { l: [V(-0.2, 0.36, 0.02)], r: [V(0.16, 0.72, 0.2)] },
  think: { l: [V(-0.2, 0.36, 0.02)], r: [V(0.06, 0.86, 0.13)] },
  point: { l: [V(-0.2, 0.36, 0.02)], r: [V(0.42, 0.7, 0.1)] },
};
function man(parent, x, y, z, { pose = "stand", s = 1, tie = true, accent = false, goggles = false, coat = false, face, item } = {}) {
  const g = grp(parent, x, y, z); g.scale.setScalar(s * 1.15); g.rotation.y = face ?? facing();
  const sk = accent ? { top: T.accent, a: T.accentMid, b: T.accentDark } : WHITE;
  for (const sx of [-1, 1]) {
    limb(g, V(sx * 0.07, 0.3, 0), V(sx * 0.075, 0.06, 0.01), 0.055, { pal: sk });
    solid(g, new THREE.SphereGeometry(0.06, 14, 10), { x: sx * 0.075, y: 0.035, z: 0.04, edges: false, hull: 1.18, pal: sk }).scale.set(1, 0.6, 1.6);
  }
  const prof = coat ? [[0, 0], [0.15, 0], [0.14, 0.1], [0.135, 0.26], [0.13, 0.34], [0.1, 0.4], [0, 0.42]] : [[0, 0], [0.105, 0], [0.125, 0.1], [0.13, 0.22], [0.11, 0.3], [0, 0.32]];
  solid(g, new THREE.LatheGeometry(prof.map(([a, b]) => new THREE.Vector2(a, b)), 22), { y: coat ? 0.2 : 0.29, edges: false, hull: 1.07, pal: sk });
  solid(g, new THREE.CylinderGeometry(0.045, 0.05, 0.06, 12), { y: 0.63, edges: false, hull: 1.15, pal: sk });
  solid(g, new THREE.SphereGeometry(0.16, 22, 18), { y: 0.8, edges: false, hull: 1.06, pal: sk });
  const P = POSES[pose];
  for (const [sx, end] of [[-1, P.l[0]], [1, P.r[0]]]) {
    const sh = V(sx * 0.125, 0.58, 0);
    limb(g, sh, end, 0.042, { pal: sk });
    solid(g, new THREE.SphereGeometry(0.052, 12, 10), { x: end.x, y: end.y, z: end.z, edges: false, hull: 1.18, pal: sk });
  }
  if (tie && !goggles) {
    solid(g, box(0.05, 0.03, 0.02), { y: 0.585, z: 0.115, accent: true, edges: false });
    solid(g, new THREE.ConeGeometry(0.035, 0.2, 4), { y: 0.47, z: 0.125, rx: Math.PI, ry: Math.PI / 4, accent: true, edges: false, hull: 1.1 }).scale.set(1, 1, 0.35);
  }
  if (goggles) {
    solid(g, new THREE.TorusGeometry(0.162, 0.022, 8, 28), { y: 0.83, rx: Math.PI / 2, pal: { top: T.ink, a: T.ink, b: T.ink }, edges: false });
    for (const sx of [-1, 1]) solid(g, new THREE.CylinderGeometry(0.05, 0.05, 0.04, 16), { x: sx * 0.065, y: 0.83, z: 0.15, rx: Math.PI / 2, accent: true, edges: false, hull: 1.2 });
  }
  if (item === "tube") {
    const e = P.r[0];
    solid(g, new THREE.CylinderGeometry(0.03, 0.03, 0.26, 12), { x: e.x, y: e.y + 0.1, z: e.z + 0.02, edges: false, hull: 1.2 });
    solid(g, new THREE.CylinderGeometry(0.027, 0.027, 0.1, 12), { x: e.x, y: e.y + 0.04, z: e.z + 0.02, accent: true, edges: false });
  }
  return g;
}
const popMan = (parent, x, y, z, t0, opts) => anim(man(parent, x, y, z, opts), "pop", t0, 0.45);

function pad(parent, x, z, { w = 1.6, d = 1.3, h = 0.32, accent = false, round = false } = {}) {
  const g = grp(parent, x, 0, z);
  if (round) solid(g, new THREE.CylinderGeometry(w / 2, w / 2, h, 40), { y: h / 2, accent, edges: false, hull: 1.02 });
  else solid(g, rbox(w, h, d, 0.08), { y: h / 2, accent, thr: 40 });
  return g;
}
function tower(parent, x, z, { w = 1.8, d = 1.6, floors = 6, fh = 0.58, t0 = 0.2, dur = 1.6 } = {}) {
  const g = grp(parent, x, 0, z);
  for (let f = 0; f < floors; f++) {
    solid(g, box(w, fh, d), { y: f * fh + fh / 2 });
    solid(g, box(w + 0.12, 0.06, d + 0.12), { y: (f + 1) * fh });
    if (f === 0) { solid(g, box(0.5, fh * 0.65, 0.03), { y: fh * 0.33, z: d / 2 + 0.015, pal: { top: 0xdfe5e8, a: 0xdfe5e8, b: 0xdfe5e8 } }); continue; }
    for (let c = 0; c < 3; c++) {
      solid(g, box(0.28, fh * 0.42, 0.03), { x: -w / 2 + (w / 4) * (c + 1), y: f * fh + fh * 0.52, z: d / 2 + 0.015, pal: { top: 0xf7f9fa, a: 0xf7f9fa, b: 0xf7f9fa } });
      if (c < 2) solid(g, box(0.03, fh * 0.42, 0.28), { x: w / 2 + 0.015, y: f * fh + fh * 0.52, z: -d / 2 + (d / 3) * (c + 1), pal: { top: 0xf7f9fa, a: 0xf7f9fa, b: 0xf7f9fa } });
    }
  }
  const H = floors * fh;
  solid(g, box(w - 0.3, 0.3, d - 0.3), { y: H + 0.15 });
  anim(g, "rise", t0, dur, { h: H + 0.6 });
  // scan frame: waits at plate level while the tower rises, then sweeps up and back
  const scan = solid(parent, box(w + 0.45, 0.42, d + 0.45), { x, y: 0.2, z, accent: true, opacity: 0.3 });
  every((t) => {
    const p = (t - t0) / dur;
    scan.visible = p > -0.1 && p < 2.6;
    const u = p < 1 ? 0 : p < 1.8 ? EASE.io(clamp((p - 1) / 0.8)) : 1 - EASE.io(clamp((p - 1.8) / 0.8));
    scan.position.y = 0.21 + u * (H - 0.2);
  });
  return { g, H };
}
// Stepped tiers of people, each level set further back and higher: the mechanistic hierarchy.
// counts are listed top level first. Returns the top height.
function pyramid(parent, x, z, counts, { t0 = 0.4, gap = 0.62, lh = 0.5, step = 0.5, ties = true, riser = true, slow = 0.16, s = 0.6 } = {}) {
  const g = grp(parent, x, 0, z), n = counts.length;
  const zFront = ((n - 1) * step) / 2 + step / 2;
  counts.slice().reverse().forEach((c, j) => { // j = 0 is the bottom level, nearest the viewer
    const i = n - 1 - j, wdt = Math.max(c * gap + 0.3, 0.8), hgt = (j + 1) * lh, zc = zFront - j * step - step / 2;
    const tier = grp(g, 0, 0, 0);
    solid(tier, rbox(wdt, hgt, step, 0.04), { y: hgt / 2, z: zc, thr: 40 });
    anim(tier, "rise", t0 + j * 0.16, 0.55, { h: hgt + 0.4 });
    for (let k = 0; k < c; k++) popMan(g, (k - (c - 1) / 2) * gap, hgt, zc, t0 + 0.9 + j * 0.12 + k * 0.03, { s, accent: i === 0, tie: ties });
  });
  const top = n * lh;
  if (riser) {
    const rx = x + Math.max(counts[n - 1] * gap + 0.3, 0.8) / 2 + 0.3, zz = z + zFront;
    const r = polyline(parent, [V(rx, 0.1, zz), V(rx, top + 0.6, zz)], T.ink, 1.3, 0.7); anim(r, "draw", t0 + 1.5, 0.6);
    flow(parent, new THREE.LineCurve3(V(rx, 0.15, zz), V(rx, top + 0.6, zz)), { t0: t0 + 2.1, speed: slow, n: 2 });
    anim(solid(parent, new THREE.ConeGeometry(0.1, 0.22, 14), { x: rx, y: top + 0.7, z: zz, accent: true, edges: false, hull: 1.1 }), "pop", t0 + 2.0, 0.3);
  }
  return { g, top, zFront: z + zFront };
}
function conveyor(parent, x0, x1, z, { y = 0 } = {}) {
  const len = x1 - x0, cx = (x0 + x1) / 2;
  for (const lx of [x0 + 0.35, cx, x1 - 0.35]) for (const s of [-1, 1]) solid(parent, box(0.1, 0.45, 0.1), { x: lx, y: y + 0.22, z: z + s * 0.45 });
  solid(parent, box(len, 0.22, 1.1), { x: cx, y: y + 0.56, z });
  for (let xx = x0 + 0.25; xx < x1 - 0.1; xx += 0.4) lines(parent, [V(xx, y + 0.675, z - 0.5), V(xx, y + 0.675, z + 0.5)], T.ink, 1, 0.5);
  return y + 0.67;
}
function robotArm(parent, x, z, top) {
  const g = grp(parent, x, 0, z);
  solid(g, new THREE.CylinderGeometry(0.28, 0.32, 0.18, 24), { y: 0.09, z: -1.3, hull: 1.04, edges: false });
  solid(g, box(0.2, 1.6, 0.2), { y: 0.98, z: -1.3 });
  solid(g, box(0.18, 0.18, 1.4), { y: 1.7, z: -0.68 });
  const head = grp(g, 0, 0, 0);
  solid(head, box(0.14, 0.55, 0.14), { y: 1.36 });
  solid(head, box(0.34, 0.06, 0.34), { y: top + 0.52, accent: true });
  every((t) => { head.position.y = -0.12 * Math.max(0, Math.sin(t * 5.2)); });
  return g;
}
function flask(parent, x, y, z, accent = true) {
  const g = grp(parent, x, y, z);
  const pts = [[0, 0], [0.22, 0], [0.24, 0.05], [0.24, 0.18], [0.09, 0.4], [0.08, 0.58], [0.1, 0.61]].map(([a, b]) => new THREE.Vector2(a, b));
  solid(g, new THREE.LatheGeometry(pts, 24), { edges: false, hull: 1.06, opacity: 0.999 });
  const lp = [[0, 0.01], [0.21, 0.01], [0.22, 0.05], [0.22, 0.16], [0.14, 0.26], [0, 0.26]].map(([a, b]) => new THREE.Vector2(a, b));
  solid(g, new THREE.LatheGeometry(lp, 24), { y: 0.002, accent, edges: false });
  return g;
}
function rack(parent, x, y, z, n = 4) {
  const g = grp(parent, x, y, z);
  solid(g, box(0.95, 0.12, 0.3), { y: 0.06 });
  for (let i = 0; i < n; i++) {
    const tx = -0.33 + i * 0.22;
    solid(g, new THREE.CylinderGeometry(0.055, 0.055, 0.5, 14), { x: tx, y: 0.3, edges: false, hull: 1.12, opacity: 0.999 });
    solid(g, new THREE.CylinderGeometry(0.05, 0.05, 0.2 + (i % 3) * 0.08, 14), { x: tx, y: 0.15 + (i % 3) * 0.04, accent: true, edges: false });
  }
  return g;
}
function bulbObj(parent, { lit = true, s = 1 } = {}) {
  const g = grp(parent);
  solid(g, new THREE.SphereGeometry(0.2 * s, 20, 16), { pal: lit ? { top: IDEA, a: IDEA, b: 0xf0b93a } : WHITE, edges: false, hull: 1.1 });
  solid(g, new THREE.CylinderGeometry(0.09 * s, 0.11 * s, 0.14 * s, 16), { y: -0.22 * s, edges: false, hull: 1.1 });
  return g;
}
function coinObj(parent) { const g = grp(parent); solid(g, new THREE.CylinderGeometry(0.16, 0.16, 0.06, 24), { pal: { top: IDEA, a: IDEA, b: 0xf0b93a }, edges: false, hull: 1.12 }); return g; }
function unit(parent, s = 0.42, accent = false) { const g = grp(parent); solid(g, box(s, s, s), { y: s / 2, accent }); return g; }

// ------------------------------------------------------------- scenes
// Each scene builds its models and lists its notes. hold = seconds before the stage moves on.
const SCENES = {};

// Exploration: a flat round of departments around the CEO; information moves fast in every direction.
SCENES.E1 = { view: "iso", hold: 9.5, build(sc) {
  plate(sc, 9.2, 7.6);
  const R = [["Marketing", -3.35, 0.1], ["R&D", 0.1, -2.75], ["Finance", 3.35, -0.1], ["Operations", -0.1, 2.75]];
  const C = V(0, 0, 0);
  const pts = R.map(([, x, z]) => V(x, 0.02, z));
  pts.forEach((p, i) => {
    const q = pts[(i + 1) % pts.length];
    anim(lines(sc, [V(p.x, 0.03, p.z), V(q.x, 0.03, q.z)], T.accentMid, 2.4), "draw", 1.1 + i * 0.08, 0.6);
    anim(lines(sc, [V(C.x, 0.03, C.z), V(p.x, 0.03, p.z)], T.accentMid, 2.4), "draw", 0.9 + i * 0.08, 0.5);
  });
  anim(pad(sc, 0, 0, { w: 1.4, round: true, accent: true, h: 0.36 }), "rise", 0.15, 0.7, { h: 1 });
  R.forEach(([, x, z], i) => anim(pad(sc, x, z, { w: 1.7, d: 1.35 }), "rise", 0.35 + i * 0.12, 0.7, { h: 1 }));
  popMan(sc, 0, 0.36, 0, 1.2, { accent: true, pose: "point", s: 1.2 });
  R.forEach(([, x, z], i) => { popMan(sc, x - 0.35, 0.32, z + 0.12, 1.35 + i * 0.07, { s: 1.15 }); popMan(sc, x + 0.36, 0.32, z - 0.14, 1.42 + i * 0.07, { s: 1.15, pose: i % 2 ? "think" : "stand" }); });
  // fast information: every link, every direction
  pts.forEach((p, i) => {
    const q = pts[(i + 1) % pts.length];
    flow(sc, new THREE.LineCurve3(V(p.x, 0.14, p.z), V(q.x, 0.14, q.z)), { t0: 2.0, speed: 0.9 * (i % 2 ? 1 : -1), n: 2 });
    flow(sc, new THREE.LineCurve3(V(0, 0.14, 0), V(p.x, 0.14, p.z)), { t0: 2.1, speed: 1.1 * (i % 2 ? -1 : 1), n: 2 });
  });
  note("CEO", "In the middle, one step from every team", 0, 1.75, 0, 1.6, "left");
  R.forEach(([name, x, z], i) => note(name, null, x, 1.2, z, 1.75 + i * 0.08));
  note("Information moves fast", "Along every link, in both directions", 1.62, 0.04, 1.33, 2.3, "right");
} };

// Exploration: R&D and growth.
SCENES.E2 = { view: "iso", hold: 9, build(sc) {
  plate(sc, 10, 8);
  const bench = grp(sc, -1.0, 0, 0.0);
  solid(bench, box(4.6, 0.85, 1.3), { y: 0.425 }); solid(bench, box(4.8, 0.08, 1.5), { y: 0.89 });
  anim(bench, "rise", 0.2, 0.8, { h: 1.2 });
  anim(rack(sc, -2.4, 0.93, 0.0, 4), "pop", 0.85, 0.4); anim(flask(sc, -1.1, 0.93, 0.2), "pop", 0.95, 0.4);
  anim(flask(sc, -0.4, 0.93, -0.1, false), "pop", 1.0, 0.4); anim(rack(sc, 0.5, 0.93, 0.1, 3), "pop", 1.05, 0.4);
  // bubbles rising from the flask
  flow(sc, new THREE.LineCurve3(V(-1.1, 1.55, 0.2), V(-1.1, 2.6, 0.2)), { t0: 2.2, speed: 0.5, n: 3, r: 0.05 });
  popMan(sc, -2.5, 0, 1.6, 1.2, { goggles: true, coat: true, pose: "hold", item: "tube", s: 1.3 });
  popMan(sc, -0.6, 0, 1.75, 1.3, { goggles: true, coat: true, pose: "think", s: 1.3 });
  popMan(sc, 1.2, 0, 1.4, 1.4, { goggles: true, coat: true, pose: "cheer", s: 1.3 });
  // growth chart
  const hs = [0.6, 1.0, 1.5, 2.2];
  hs.forEach((h, i) => { const bar = grp(sc, 2.6 + i * 0.55, 0, -2.0); solid(bar, box(0.42, h, 0.42), { y: h / 2, accent: i === 3 }); anim(bar, "grow", 1.6 + i * 0.22, 0.5); });
  const arr = solid(sc, new THREE.ConeGeometry(0.2, 0.42, 16), { x: 4.25, y: 2.6, z: -2.0, accent: true, edges: false, hull: 1.1 }); anim(arr, "pop", 2.6, 0.4);
  note("Scientists", "Coats, goggles and test tubes", -2.5, 1.55, 1.6, 1.5, "left");
  note("R&D lab", "Most money and attention go here", 1.2, 0.95, 0.0, 1.7, "right");
  note("Growth", "New products lift revenue", 4.25, 2.75, -2.0, 2.7, "right");
} };

// Exploration: the catch. High costs, mostly R&D; a line that throws out rejects.
SCENES.E3 = { view: "iso", hold: 9.5, build(sc) {
  plate(sc, 10, 8);
  // cost column, built segment by segment
  const col = grp(sc, -3.2, 0, 1.6); let y = 0;
  [[0.45, false], [0.45, false], [1.9, true]].forEach(([h, acc], i) => {
    const seg = grp(col, 0, y, 0); solid(seg, box(1.0, h, 1.0), { y: h / 2, accent: acc }); anim(seg, "grow", 0.4 + i * 0.35, 0.55); y += h;
  });
  // short line, uneven units, and a growing reject pile
  const line = grp(sc, 0, 0, -1.6); const top = conveyor(line, -1.6, 2.0, 0); anim(line, "rise", 0.3, 0.8, { h: 1.2 });
  const bin = grp(sc, 3.4, 0, -0.2); solid(bin, box(1.5, 0.5, 1.5), { y: 0.25 }); anim(bin, "rise", 0.6, 0.6, { h: 0.8 });
  const sizes = [0.5, 0.36, 0.56, 0.42];
  const along = new THREE.LineCurve3(V(-1.4, top, -1.6), V(2.0, top, -1.6));
  flow(sc, along, { t0: 1.4, speed: 0.22, n: 4, make: (p) => { const g = grp(p); const k = (p.children.length) % 4; solid(g, box(sizes[k], sizes[(k + 1) % 4], sizes[(k + 2) % 4]), { y: 0.25, rz: (k % 2 ? 0.2 : -0.15) }); return g; } });
  const pile = [[-0.35, 0.62, -0.25, 0.32, 0.4], [0.3, 0.64, 0.1, 0.3, 1.1], [0.0, 0.92, 0.0, 0.28, 0.7], [-0.2, 0.66, 0.38, 0.26, 0.2], [0.38, 0.88, -0.32, 0.25, 1.4], [-0.38, 1.0, 0.1, 0.24, 0.9], [0.12, 1.2, -0.12, 0.26, 0.3]];
  pile.forEach(([dx, yy, dz, s, r], i) => anim(solid(sc, box(s, s, s), { x: 3.4 + dx, y: yy, z: -0.2 + dz, rx: r, ry: r * 1.4, rz: r * 0.5 }), "drop", 1.6 + i * 0.32, 0.4, { h: 1.6 }));
  popMan(sc, 1.6, 0, 1.6, 1.3, { pose: "think", s: 1.3 });
  note("Costs: high", "R&D takes the largest share", -3.2, y + 0.05, 1.6, 1.7, "left");
  note("Efficiency: low", "Uneven units on a short line", 0.6, top + 0.3, -1.6, 2.2, "right");
  note("Rejects pile up", "Much of the output is thrown away", 3.4, 1.3, -0.2, 2.6, "right");
} };

// Ambidextrous: one company in the middle; an organic unit on its left, a mechanistic one on its right.
SCENES.A1 = { view: "high", hold: 9.5, build(sc) {
  plate(sc, 12, 5.2);
  const { H } = tower(sc, 0, -0.6, { floors: 6, fh: 0.55, t0: 0.15, dur: 1.4 });
  // organic: a flat semicircle around its lead, short links, quick decisions
  const L = V(-3.6, 0, 0.1);
  anim(pad(sc, L.x, L.z, { w: 3.6, h: 0.12, round: true }), "rise", 0.5, 0.6, { h: 0.6 });
  popMan(sc, L.x, 0.12, L.z - 0.7, 1.1, { accent: true, s: 0.85 });
  for (let i = 0; i < 6; i++) {
    const a = Math.PI * (0.08 + 0.84 * (i / 5)), p = V(L.x + Math.cos(a) * 1.35, 0.12, L.z - 0.7 + Math.sin(a) * 1.3);
    popMan(sc, p.x, p.y, p.z, 1.2 + i * 0.06, { s: 0.75, face: 0.18 });
    anim(lines(sc, [V(p.x, 0.15, p.z), V(L.x, 0.15, L.z - 0.7)], T.accentMid, 1.8), "draw", 1.6 + i * 0.05, 0.3);
    flow(sc, new THREE.LineCurve3(V(p.x, 0.2, p.z), V(L.x, 0.2, L.z - 0.7)), { t0: 2.0, speed: 1.0 * (i % 2 ? 1 : -1), n: 1, r: 0.07 });
  }
  // mechanistic: five levels, information climbs slowly
  pyramid(sc, 3.7, -0.4, [1, 2, 3, 4, 5], { t0: 0.6, gap: 0.48, lh: 0.42, step: 0.42, s: 0.5 });
  // the company links both to the top
  const top = V(0, H + 0.35, -0.6);
  anim(dashed(sc, new THREE.QuadraticBezierCurve3(top, V(-2.2, H + 0.6, -0.4), V(L.x, 1.4, L.z - 0.7)), T.accentMid, 30, 1.6), "draw", 2.3, 0.6);
  anim(dashed(sc, new THREE.QuadraticBezierCurve3(top, V(2.2, H + 0.6, -0.4), V(3.7, 2.6, -0.3)), T.accentMid, 30, 1.6), "draw", 2.4, 0.6);
  note("One company", "Both units answer to the same top team", 0, H + 0.3, -0.6, 1.6, "left");
  note("Organic unit", "A flat circle that decides quickly", L.x - 1.2, 0.5, L.z + 0.2, 1.9, "left");
  note("Mechanistic unit", "Five levels, one above the other", 3.7, 2.55, -1.24, 2.1, "right");
  note("Vertical flow", "Reports climb level by level", 5.35, 1.6, 0.65, 2.8, "right");
} };

// Ambidextrous: one budget, split evenly between R&D and manufacturing.
SCENES.A2 = { view: "iso", hold: 9, build(sc) {
  plate(sc, 10, 8);
  const lab = grp(sc, -2.4, 0, 2.2);
  solid(lab, box(2.4, 0.8, 1.2), { y: 0.4 }); solid(lab, box(2.55, 0.08, 1.35), { y: 0.84 });
  rack(lab, -0.5, 0.88, 0, 3); flask(lab, 0.55, 0.88, 0.15);
  anim(lab, "rise", 0.5, 0.8, { h: 1.2 });
  popMan(sc, -2.9, 0, 3.4, 1.3, { goggles: true, coat: true, pose: "hold", item: "tube" });
  popMan(sc, -1.8, 0, 3.45, 1.4, { goggles: true, coat: true, pose: "cheer" });
  const fac = grp(sc, 2.4, 0, -2.2); const top = conveyor(fac, -1.6, 1.8, 0); robotArm(fac, 0.2, 0, top);
  for (let x = -1.2; x < 1.7; x += 0.8) unit(fac, 0.4).position.set(x, top, 0);
  anim(fac, "rise", 0.5, 0.8, { h: 1.6 });
  popMan(sc, 1.6, 0, -0.6, 1.4); popMan(sc, 2.6, 0, -0.5, 1.5);
  // the budget in the middle
  const vault = grp(sc, 0.0, 0, 0.0);
  solid(vault, rbox(1.4, 0.9, 1.4, 0.08), { y: 0.45, thr: 40 });
  for (let i = 0; i < 4; i++) solid(vault, new THREE.CylinderGeometry(0.16, 0.16, 0.06, 24), { x: -0.25, y: 0.93 + i * 0.07, pal: { top: IDEA, a: IDEA, b: 0xf0b93a }, edges: false, hull: 1.1 });
  for (let i = 0; i < 3; i++) solid(vault, new THREE.CylinderGeometry(0.16, 0.16, 0.06, 24), { x: 0.25, y: 0.93 + i * 0.07, z: 0.2, pal: { top: IDEA, a: IDEA, b: 0xf0b93a }, edges: false, hull: 1.1 });
  anim(vault, "rise", 0.2, 0.7, { h: 1.2 });
  const toLab = new THREE.QuadraticBezierCurve3(V(-0.5, 0.2, 0.7), V(-1.2, 0.2, 1.5), V(-1.3, 0.2, 1.6));
  const toFac = new THREE.QuadraticBezierCurve3(V(0.7, 0.2, -0.5), V(1.5, 0.2, -1.2), V(1.6, 0.2, -1.3));
  anim(dashed(sc, toLab, T.accentMid, 20, 2.2), "draw", 1.6, 0.4); anim(dashed(sc, toFac, T.accentMid, 20, 2.2), "draw", 1.6, 0.4);
  flow(sc, toLab, { t0: 2.0, speed: 0.6, n: 2, make: coinObj }); flow(sc, toFac, { t0: 2.0, speed: 0.6, n: 2, make: coinObj });
  note("Budget", "One pool, split evenly", -0.25, 1.25, 0, 1.2, "left");
  note("R&D · 50%", "Works on the next products", -2.4, 0.9, 2.2, 2.2, "left");
  note("Manufacturing · 50%", "Runs today's line efficiently", 3.6, 1.0, -2.2, 2.3, "right");
} };

// Exploitation: the tower rises beside its five-level hierarchy.
SCENES.X1 = { view: "face", hold: 9.5, build(sc) {
  plate(sc, 11, 4.4);
  const { H } = tower(sc, -2.4, -0.5, { floors: 7, fh: 0.56, t0: 0.15, dur: 1.6 });
  pyramid(sc, 2.2, -0.6, [1, 2, 3, 4, 5], { t0: 0.8, gap: 0.6, lh: 0.58, step: 0.5, s: 0.62, slow: 0.14 });
  note("Head office", "Rules and reporting lines are set here", -2.4, H + 0.3, -0.5, 1.7, "left");
  note("Tall hierarchy", "Five levels, one manager at the top", 2.2, 3.55, -1.6, 2.1, "right");
  note("Reports climb slowly", "Level by level, then orders come back down", 4.15, 1.75, 0.65, 2.7, "right");
} };

// Exploitation: the efficient line.
SCENES.X2 = { view: "iso", hold: 9, build(sc) {
  plate(sc, 10, 8);
  const fac = grp(sc, -0.3, 0, -0.6); const top = conveyor(fac, -4.0, 3.2, 0); [-2.2, 0.8].forEach((x) => robotArm(fac, x, 0, top));
  anim(fac, "rise", 0.2, 0.9, { h: 1.6 });
  flow(sc, new THREE.LineCurve3(V(-4.1, top, -0.6), V(2.9, top, -0.6)), { t0: 1.3, speed: 0.12, n: 8, make: (p) => unit(p, 0.42) });
  const stack = grp(sc, 3.9, 0, 1.4);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) for (let k = 0; k < 2; k++) solid(stack, box(0.42, 0.42, 0.42), { x: i * 0.47 - 0.47, y: 0.21 + k * 0.47, z: j * 0.47 });
  anim(stack, "rise", 0.9, 0.6, { h: 1.2 });
  const bin = grp(sc, 1.2, 0, 2.6); solid(bin, box(0.9, 0.4, 0.9), { y: 0.2 }); anim(bin, "rise", 1.0, 0.5, { h: 0.6 });
  popMan(sc, -2.6, 0, 1.6, 1.3, { s: 1.25 }); popMan(sc, -1.4, 0, 1.8, 1.4, { pose: "point", s: 1.25 });
  // cost column: short
  const col = grp(sc, -3.6, 0, 2.8); solid(col, box(0.8, 0.45, 0.8), { y: 0.225 }); anim(col, "grow", 1.2, 0.5);
  note("Costs: low", null, -3.6, 0.5, 2.8, 1.9, "left");
  note("Wastage: almost none", "The reject bin stays empty", 1.2, 0.42, 2.6, 2.1, "left");
  note("Identical units", "A steady rhythm along the line", 1.7, top + 0.45, -0.6, 2.3, "right");
  note("Finished stock", "Every unit to the same standard", 4.4, 0.95, 1.4, 2.5, "right");
} };

// Exploitation: the catch. Cost savings reach the top; the R&D idea is parked halfway.
SCENES.X3 = { view: "face", hold: 11, build(sc) {
  plate(sc, 11, 4.4);
  const { top } = pyramid(sc, 0.4, -0.6, [1, 2, 3, 4], { t0: 0.3, gap: 0.64, lh: 0.66, step: 0.5, s: 0.62, riser: false });
  // the two teams at the bottom
  popMan(sc, -3.1, 0, 0.4, 1.2, { goggles: true, coat: true, s: 0.75, pose: "hold", item: "tube" });
  popMan(sc, -2.5, 0, 0.5, 1.25, { goggles: true, coat: true, s: 0.75 });
  popMan(sc, 3.4, 0, 0.4, 1.3, { s: 0.75 }); popMan(sc, 4.0, 0, 0.5, 1.35, { s: 0.75, pose: "point" });
  // cost savings: climb every level, quickly, and arrive at the top
  const cx = 2.2, peak = top + 0.6;
  const costPath = new THREE.CatmullRomCurve3([V(3.4, 0.9, 0.6), V(cx, 0.9, 0.6), V(cx, peak, 0.6), V(0.7, peak, 0.6)], false, "catmullrom", 0.02);
  anim(polyline(sc, [V(3.4, 0.9, 0.6), V(cx, 0.9, 0.6), V(cx, peak, 0.6), V(0.75, peak, 0.6)], T.accentMid, 2.6), "draw", 1.8, 0.6);
  flow(sc, costPath, { t0: 2.2, speed: 0.45, n: 3, make: coinObj });
  // the idea: climbs halfway, slowly, is diverted sideways and parked
  const stopY = 2 * 0.66 + 0.7, ix = -1.6;
  anim(polyline(sc, [V(-2.6, 0.9, 0.6), V(ix, 0.9, 0.6), V(ix, stopY, 0.6), V(-3.3, stopY, 0.6)], IDEA, 2.6), "draw", 1.9, 0.6);
  const shelf = grp(sc, -3.9, 0, 0.2); solid(shelf, box(1.5, 0.08, 1.0), { y: stopY - 0.42 }); solid(shelf, box(0.08, stopY - 0.42, 0.08), { x: -0.6, y: (stopY - 0.42) / 2 }); solid(shelf, box(0.08, stopY - 0.42, 0.08), { x: 0.6, y: (stopY - 0.42) / 2 });
  anim(shelf, "rise", 1.0, 0.6, { h: 2.4 });
  [[-4.3, 0], [-3.9, 0.25], [-3.5, -0.05]].forEach(([x, dz], i) => { const b = bulbObj(sc, { lit: false, s: 0.55 }); b.position.set(x, stopY - 0.12, 0.2 + dz); anim(b, "pop", 1.5 + i * 0.1, 0.4); });
  const ideaPath = new THREE.CatmullRomCurve3([V(-2.6, 0.9, 0.6), V(ix, 0.9, 0.6), V(ix, stopY, 0.6), V(-3.2, stopY, 0.6)], false, "catmullrom", 0.02);
  const idea = bulbObj(sc, { s: 0.6 });
  every((t) => { const u = clamp((t - 2.4) / 3.2); idea.visible = t > 2.4; idea.position.copy(ideaPath.getPoint(EASE.io(u))); idea.position.y += 0.05; });
  note("R&D team", "Brings a new idea", -2.8, 0.75, 0.45, 1.6, "left");
  note("Parked for the future", null, -4.3, stopY + 0.1, 0.2, 2.6, "left");
  note("New idea stalls halfway", "It never reaches the people who decide", ix, stopY + 0.05, 0.6, 4.6, "left");
  note("Cost minimisation", "Quick wins, approved fast", 3.7, 0.75, 0.45, 1.6, "right");
  note("Savings reach the top", "Climbing every level quickly", cx, peak, 0.6, 2.4, "right");
} };

// ------------------------------------------------------------- public API
export const SCENE_NAMES = Object.keys(SCENES);

function makeCamera(view) {
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
  if (view === "high") { cam.position.set(4.5, 15, 24); cam.lookAt(0, 1.5, 0); }
  else if (view === "face") { cam.position.set(4.5, 7.5, 24); cam.lookAt(0, 2.2, 0); }
  else { cam.position.set(20, 16.3, 20); cam.lookAt(0, 0.9, 0); }
  cam.updateMatrixWorld();
  return cam;
}

// Builds a scene for a theme. Returns everything needed to render it at any time t.
export function buildScene(name, theme) {
  const def = SCENES[name];
  VIEW = def.view; T = THEMES[theme]; ANIM = []; NOTES = [];
  const scene = new THREE.Scene();
  def.build(scene);
  const anims = ANIM, notes = NOTES;
  ANIM = []; NOTES = [];
  // the finished model's extent in camera space, used to fit it into any viewport
  const cam = makeCamera(def.view);
  apply(anims, 1000);
  scene.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(scene), inv = cam.matrixWorldInverse;
  const ext = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
    const p = V(x, y, z).applyMatrix4(inv);
    ext.minX = Math.min(ext.minX, p.x); ext.maxX = Math.max(ext.maxX, p.x);
    ext.minY = Math.min(ext.minY, p.y); ext.maxY = Math.max(ext.maxY, p.y);
  }
  apply(anims, 0);
  return { name, scene, cam, anims, notes, ext, hold: def.hold ?? 9 };
}

// Fits the model into a W x H viewport, leaving `side` px free on the left and right for notes.
export function fit(s, W, H, { side = 0, pad = 12 } = {}) {
  const { ext, cam } = s;
  const k = Math.min((W - 2 * side - 2 * pad) / (ext.maxX - ext.minX), (H - 2 * pad) / (ext.maxY - ext.minY));
  const cx = (ext.minX + ext.maxX) / 2, cy = (ext.minY + ext.maxY) / 2;
  cam.left = cx - W / 2 / k; cam.right = cx + W / 2 / k; cam.top = cy + H / 2 / k; cam.bottom = cy - H / 2 / k;
  cam.updateProjectionMatrix();
  // line widths are given in CSS pixels against a 2x resolution
  s.scene.traverse((o) => { if (o.material?.isLineMaterial) o.material.resolution.set(W * 2, H * 2); });
  s.W = W; s.H = H;
}

// Where a note's anchor lands on screen, in CSS pixels.
export function project(s, v) {
  const p = v.clone().project(s.cam);
  return { x: (p.x + 1) / 2 * s.W, y: (1 - p.y) / 2 * s.H };
}

export function draw(renderer, s, t) { apply(s.anims, t); renderer.render(s.scene, s.cam); }

export function createRenderer(canvas, dpr = 1) {
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: false });
  r.setPixelRatio(dpr); r.outputColorSpace = THREE.SRGBColorSpace;
  r.clippingPlanes = [new THREE.Plane(V(0, 1, 0), 0.3)];
  return r;
}

export function disposeScene(s) {
  s?.scene.traverse((o) => {
    o.geometry?.dispose();
    const m = o.material; if (m) (Array.isArray(m) ? m : [m]).forEach((mm) => { mm.map?.dispose(); mm.dispose(); });
  });
}

// Still images of each scene's finished state, for the tabs. Cached per scene and theme.
const THUMBS = new Map();
export function thumbnails(names, theme, w = 480, h = 200) {
  const out = {}, todo = names.filter((n) => !THUMBS.has(`${theme}:${n}`));
  if (todo.length) {
    const canvas = document.createElement("canvas");
    const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    r.setPixelRatio(1); r.setSize(w, h, false); r.outputColorSpace = THREE.SRGBColorSpace;
    r.clippingPlanes = [new THREE.Plane(V(0, 1, 0), 0.3)];
    for (const n of todo) {
      const s = buildScene(n, theme); fit(s, w, h, { pad: 10 });
      // thicker lines at thumbnail size
      s.scene.traverse((o) => { if (o.material?.isLineMaterial) o.material.resolution.set(w * 1.4, h * 1.4); });
      draw(r, s, 7);
      THUMBS.set(`${theme}:${n}`, canvas.toDataURL("image/png"));
      disposeScene(s);
    }
    r.dispose(); r.forceContextLoss();
  }
  for (const n of names) out[n] = THUMBS.get(`${theme}:${n}`);
  return out;
}
