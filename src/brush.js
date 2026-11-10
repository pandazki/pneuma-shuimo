/*
 * 笔。A stroke is a centreline, a pressure along it and a state of ink; this file turns that into hairs.
 *
 * A brush is a bundle of hairs. Pressed, they spread and the stroke is wide; lifted, they gather to a tip. Each hair
 * carries its own load of ink and runs dry in its own time, so the paper shows between hairs toward the end of a long
 * stroke (飞白). A wet brush also leaves a body of ink under the hairs, which is why a wet stroke is solid and a dry
 * one is all hair.
 *
 * Nothing here touches the DOM: lay() works a stroke out once, and Painter lays whatever is new of it onto 2D contexts
 * it is handed (one per density band). Ink is painted opaque within a band, so a stroke never darkens where its own
 * hairs overlap; depth of ink comes from the bands and from one stroke crossing another.
 *
 * Units are whatever the caller draws in (the player uses CSS pixels).
 */

/** Densities of the bands a stroke is painted in, palest to darkest. */
export const BANDS = [0.3, 0.46, 0.62, 0.8, 1];
const bandOf = (intensity) => (intensity > 0.9 ? 4 : intensity > 0.76 ? 3 : intensity > 0.62 ? 2 : intensity > 0.46 ? 1 : 0);

/** Distance between hairs, and between samples along a stroke. */
const HAIR = 0.34;
const STEP = 0.55;

export const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
export const smooth = (a, b, v) => { const u = clamp((v - a) / (b - a)); return u * u * (3 - 2 * u); };

/** A steady stream of numbers in [0, 1) from a seed: the same seed always writes the same stroke. */
export function rng(seed) {
  let a = (seed >>> 0) || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** How hard the brush presses along a stroke (提按), by name: keys of [where 0..1, how hard 0..1]. */
export const PRESS = {
  plain: [[0, 0.92], [0.08, 1], [0.9, 1], [1, 0.9]],
  dot: [[0, 0.7], [0.45, 1], [1, 0.55]],
  press: [[0, 0.65], [0.3, 1], [0.75, 0.9], [1, 0.5]],
  leaf: [[0, 0.45], [0.07, 0.8], [0.27, 1], [0.5, 0.4], [0.7, 0.85], [0.9, 0.32], [1, 0.03]],
  hair: [[0, 0.5], [0.15, 0.9], [0.7, 0.6], [1, 0.04]],
  fly: [[0, 0.8], [0.12, 1], [0.6, 0.68], [1, 0.05]],
  ripple: [[0, 0.35], [0.15, 0.8], [0.33, 0.42], [0.53, 0.92], [0.72, 0.38], [0.88, 0.6], [1, 0.04]],
  swell: [[0, 0.45], [0.42, 1], [1, 0.38]],
  peak: [[0, 0.55], [0.45, 1], [0.56, 1], [1, 0.55]],
  fade: [[0, 1], [0.3, 0.7], [1, 0.05]],
  taper: [[0, 0.06], [0.5, 1], [1, 0.06]],
  rule: [[0, 0.62], [0.05, 1], [0.14, 0.72], [0.8, 0.6], [0.95, 0.74], [1, 0.5]],
};

/** How freely each writing of a stroke differs from the last, by name. */
export const LIBERTY = {
  free: { wander: 0.5, carry: 0.5, breath: 1 },
  still: { wander: 0.12, carry: 0.1, breath: 0.4 },
  quick: { wander: 0.8, carry: 1, breath: 1 },
  calm: { wander: 0.22, carry: 0.2, breath: 0.5 },
  leaf: { wander: 0.9, carry: 0.8, breath: 1 },
  script: { wander: 0.2, carry: 0.3, breath: 0.6 },
  sweep: { wander: 1.2, carry: 1.2, breath: 1 },
};

export function pressFn(press) {
  const keys = typeof press === 'string' ? (PRESS[press] ?? PRESS.plain) : (press ?? PRESS.plain);
  return (t) => {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i += 1) {
      if (t <= keys[i][0]) {
        const [t0, p0] = keys[i - 1];
        const [t1, p1] = keys[i];
        const u = (t - t0) / Math.max(1e-6, t1 - t0);
        return p0 + (p1 - p0) * u * u * (3 - 2 * u);
      }
    }
    return keys[keys.length - 1][1];
  };
}

/** Points round a circle, clockwise from one side of its gap to the other. Degrees: 0 to the right, 90 straight down. */
export function circlePath({ centre = [0, 0], radius = 10, gap = 0, gapAt = -52 } = {}) {
  const from = gapAt + gap / 2;
  const sweep = 360 - gap;
  const count = Math.max(6, Math.round(sweep / 18));
  const points = [];
  for (let i = 0; i <= count; i += 1) {
    const a = ((from + (sweep * i) / count) * Math.PI) / 180;
    points.push([centre[0] + radius * Math.cos(a), centre[1] + radius * Math.sin(a)]);
  }
  return points;
}

/** The centreline as a dense polyline. Centripetal Catmull-Rom: unevenly spaced points never loop or overshoot. */
function catmull(points) {
  if (points.length === 2) return [points[0], points[1]];
  const first = points[0];
  const last = points[points.length - 1];
  const p = [[2 * first[0] - points[1][0], 2 * first[1] - points[1][1]], ...points, [2 * last[0] - points[points.length - 2][0], 2 * last[1] - points[points.length - 2][1]]];
  const knot = (a, b) => Math.max(1e-4, Math.hypot(b[0] - a[0], b[1] - a[1]) ** 0.5);
  const out = [];
  for (let s = 1; s < p.length - 2; s += 1) {
    const [p0, p1, p2, p3] = [p[s - 1], p[s], p[s + 1], p[s + 2]];
    const t1 = knot(p0, p1), t2 = t1 + knot(p1, p2), t3 = t2 + knot(p2, p3);
    const steps = Math.max(6, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1])));
    for (let k = 0; k < steps; k += 1) {
      const t = t1 + ((t2 - t1) * k) / steps;
      const mix = (a, b, ta, tb) => [((tb - t) * a[0] + (t - ta) * b[0]) / (tb - ta), ((tb - t) * a[1] + (t - ta) * b[1]) / (tb - ta)];
      const a1 = mix(p0, p1, 0, t1), a2 = mix(p1, p2, t1, t2), a3 = mix(p2, p3, t2, t3);
      out.push(mix(mix(a1, a2, 0, t2), mix(a2, a3, t1, t3), t1, t2));
    }
  }
  out.push(last);
  return out;
}

function resample(dense, spacing) {
  const cum = [0];
  for (let i = 1; i < dense.length; i += 1) cum.push(cum[i - 1] + Math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1]));
  const total = cum[cum.length - 1];
  const count = Math.max(3, Math.round(total / spacing));
  const pts = [];
  let j = 1;
  for (let k = 0; k <= count; k += 1) {
    const target = (k / count) * total;
    while (j < dense.length - 1 && cum[j] < target) j += 1;
    const span = cum[j] - cum[j - 1];
    const f = span === 0 ? 0 : (target - cum[j - 1]) / span;
    pts.push([dense[j - 1][0] + (dense[j][0] - dense[j - 1][0]) * f, dense[j - 1][1] + (dense[j][1] - dense[j - 1][1]) * f]);
  }
  return { pts, total };
}

/** The length of a stroke's centreline as written (curves included), before any variation. */
export function lengthOf(def) {
  const path = def.circle ? circlePath(def.circle) : def.path;
  return resample(catmull(path), STEP).total;
}

const noise1 = (x) => {
  const i = Math.floor(x), f = x - i;
  const h = (n) => { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); };
  return h(i) + (h(i + 1) - h(i)) * f * f * (3 - 2 * f);
};
const tooth = (x, y) => { const s = Math.sin(Math.floor(x / 0.8) * 12.9898 + Math.floor(y / 0.8) * 78.233) * 43758.5453; return s - Math.floor(s); };

/**
 * One writing of a stroke, worked out once: its centreline, its width along the way, and its hairs.
 * def: { path | circle, width, press?, ink?, wet?, dry?, tint?, liberty? }. seed 0 writes it exactly as designed.
 */
export function lay(def, seed = 1) {
  const r = seed === 0 ? () => 0.5 : rng(seed);
  const lib = LIBERTY[def.liberty ?? 'free'] ?? LIBERTY.free;
  const scaleOf = Math.min(1, (def.width ?? 3) / 3 + 0.4);
  let ctrl = (def.circle ? circlePath(def.circle) : def.path).map((p) => [p[0], p[1]]);
  if (seed !== 0) {
    const w = lib.wander * scaleOf;
    const a = [0.5 + r() * 0.9, r() * 6.283, 0.5 + r() * 0.9, r() * 6.283];
    ctrl = ctrl.map(([x, y], i) => [x + w * Math.sin(i * a[0] + a[1]), y + w * Math.sin(i * a[2] + a[3])]);
    // The tip carries on a little as it lifts, a different distance each time.
    const n = ctrl.length;
    const dx = ctrl[n - 1][0] - ctrl[n - 2][0], dy = ctrl[n - 1][1] - ctrl[n - 2][1];
    const step = Math.hypot(dx, dy) || 1;
    const carry = Math.min(step * 0.3, (def.width ?? 3) * 0.8) * lib.carry * r();
    if (carry > 0.2 && n > 2) ctrl.push([ctrl[n - 1][0] + (dx / step) * carry, ctrl[n - 1][1] + (dy / step) * carry]);
  }
  const { pts, total } = resample(catmull(ctrl), STEP);
  const n = pts.length;
  const press = pressFn(def.press);
  const width = (def.width ?? 3) * (1 + (r() - 0.5) * 0.08 * lib.breath);
  const breath = { at: 0.3 + r() * 0.45, by: (r() - 0.5) * 0.16 * lib.breath, w: 0.1 + r() * 0.08 };
  const washy = smooth(0.65, 1, clamp(def.wet ?? 0.5));
  const washPhase = r() * 100, washWaves = Math.max(2, total / (width * 1.6));
  const half = [], nx = [], ny = [], cum = [0];
  for (let k = 0; k < n; k += 1) {
    const s = k / (n - 1);
    const b = 1 + breath.by * Math.exp(-(((s - breath.at) / breath.w) ** 2));
    const waver = 1 + washy * 0.16 * (noise1(washPhase + s * washWaves) - 0.5) * 2;
    half.push(Math.max(0.16, (width / 2) * press(s) * b * waver));
    const a = pts[Math.max(0, k - 1)], c = pts[Math.min(n - 1, k + 1)];
    const tx = c[0] - a[0], ty = c[1] - a[1], tl = Math.hypot(tx, ty) || 1;
    nx.push(-ty / tl); ny.push(tx / tl);
    if (k > 0) cum.push(cum[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
  }
  const wet = clamp(def.wet ?? 0.5);
  const dry = clamp((def.dry ?? 0.3) * (seed === 0 ? 1 : 0.8 + r() * 0.45));
  const ink = clamp((def.ink ?? 0.92) * (1 - r() * 0.06 * lib.breath), 0.05, 1);
  const tint = clamp(def.tint ?? 0, -1, 1);
  const count = Math.max(3, Math.round(width / HAIR));
  const clumps = Math.max(2, Math.round(count / 4));
  const short = Math.min(1, total / (width * 2.2));
  const hairs = [];
  for (let i = 0; i < count; i += 1) {
    const u = clamp(((i + 0.5) / count) * 2 - 1 + (r() - 0.5) * (1.1 / count), -1, 1);
    let load = 1 - r() * 0.5 * (1 - wet * 0.85) - (wet > 0.72 ? 0.3 : 0);
    load *= 1 - tint * u * 0.5;
    if (wet > 0.6) load += (Math.abs(u) > 0.82 ? 0.16 : 0) * ((wet - 0.6) / 0.4);
    hairs.push({
      u,
      load: clamp(load, 0.15, 1.2),
      thirst: clamp(0.35 + r() * 0.65 - u * u * 0.15, 0.2, 1),
      phase: r() * 1000,
      freq: 0.05 + r() * 0.09,
      lw: HAIR * (1.3 + wet * 1.2),
      start: (u * u * half[0] * 0.9 + r() * 0.7 * (1 - wet)) * short,
      end: total - (u * u * half[n - 1] * 0.9 + r() * (0.4 + dry * 3.5)) * short,
      clump: (Math.round(((u + 1) / 2) * clumps) / clumps) * 2 - 1,
    });
  }
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  const pad = width / 2 + 2;
  return {
    pts, n, cum, total, half, nx, ny, hairs, width, wet, dry, ink,
    bounds: { x: x0 - pad, y: y0 - pad, width: x1 - x0 + pad * 2, height: y1 - y0 + pad * 2 },
  };
}

/** Lays a stroke onto band contexts as far as it has been written; what is written is never painted again. */
export class Painter {
  constructor(laid) { this.laid = laid; this.k = -1; }

  /** written: 0 to 1 of the stroke's length. ctxs: one 2D context per band, already in the stroke's units. */
  paint(ctxs, written) {
    const L = this.laid;
    const target = Math.round(clamp(written) * (L.n - 1));
    if (written <= 0 || target <= this.k) return;
    const full = L.width / 2;
    for (const ctx of ctxs) ctx.lineCap = 'round';
    for (let k = Math.max(0, this.k); k <= target; k += 1) {
      const s = k / (L.n - 1);
      const d = L.dry * (0.18 + 0.82 * smooth(0.08 + 0.3 * L.wet, 1, s));
      const [x, y] = L.pts[k];
      // The body of ink under the hairs: plenty while the brush is loaded, gone as it runs dry.
      const body = L.half[k] * (0.22 + 0.7 * L.wet) * (1 - d * 1.7);
      if (body > 0.2 && k > this.k) {
        const ctx = ctxs[L.wet > 0.72 ? 2 : 4];
        ctx.beginPath();
        ctx.arc(x, y, body, 0, Math.PI * 2);
        ctx.fill();
      }
      if (k === 0 || k <= this.k) continue;
      const [px, py] = L.pts[k - 1];
      for (const h of L.hairs) {
        if (L.cum[k] < h.start || L.cum[k] > h.end) continue;
        const level = clamp(d * (1.35 - h.thirst));
        if (noise1(h.phase + L.cum[k] * h.freq) < level * 1.08 - 0.04) continue;
        const u = h.u + (h.clump - h.u) * level * 0.6;
        const hx = x + L.nx[k] * u * L.half[k] * 0.94, hy = y + L.ny[k] * u * L.half[k] * 0.94;
        if (tooth(hx, hy) < level * 0.5 - 0.16) continue;
        const intensity = h.load * (1 - level * 0.45);
        const ctx = ctxs[bandOf(intensity)];
        ctx.lineWidth = Math.max(0.22, h.lw * (1 - level * 0.45) * clamp(0.4 + 0.6 * (L.half[k] / full), 0.4, 1));
        ctx.beginPath();
        ctx.moveTo(px + L.nx[k - 1] * u * L.half[k - 1] * 0.94, py + L.ny[k - 1] * u * L.half[k - 1] * 0.94);
        ctx.lineTo(hx, hy);
        ctx.stroke();
      }
    }
    this.k = target;
  }
}
