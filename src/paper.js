import { BANDS, Painter } from './brush.js';

/*
 * 纸。One canvas; every stroke on it has a layer of its own that only grows while it is written and is shown through
 * its own opacity as it dries. Nothing on the paper ever moves, turns or scales: ink is written, and ink dries.
 */

/** Extra pixels per CSS pixel, for a paper shown enlarged (a stage scaled up by CSS): set before papers are made. */
export const DENSITY = { boost: 1 };

const surface = (w, h) => {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
};

export class Paper {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.marks = new Set();
    this.ratio = 1;
    this.width = 0;
    this.height = 0;
  }

  /** Size in CSS pixels. Everything written so far is laid again at the new size. */
  resize(width, height) {
    const ratio = Math.max(1, Math.min(8, (globalThis.devicePixelRatio || 1) * DENSITY.boost));
    if (width === this.width && height === this.height && ratio === this.ratio) return;
    this.width = width; this.height = height; this.ratio = ratio;
    this.canvas.width = Math.round(width * ratio);
    this.canvas.height = Math.round(height * ratio);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    for (const mark of this.marks) mark.layer = null;
  }

  /** Puts a laid stroke on the paper. The caller moves `written` (0..1) and `opacity` (1..0) and calls draw(). */
  add(laid, colour) {
    const mark = { laid, colour, written: 0, opacity: 1, layer: null };
    this.marks.add(mark);
    return mark;
  }

  remove(mark) { this.marks.delete(mark); }
  clear() { this.marks.clear(); }

  layerOf(mark) {
    if (mark.layer) return mark.layer;
    const { ratio } = this;
    const b = mark.laid.bounds;
    const x = Math.floor(b.x * ratio), y = Math.floor(b.y * ratio);
    const w = Math.max(1, Math.ceil((b.x + b.width) * ratio) - x), h = Math.max(1, Math.ceil((b.y + b.height) * ratio) - y);
    const canvases = BANDS.map(() => surface(w, h));
    const ctxs = canvases.map((c) => {
      const ctx = c.getContext('2d');
      ctx.setTransform(ratio, 0, 0, ratio, -x, -y);
      ctx.strokeStyle = mark.colour;
      ctx.fillStyle = mark.colour;
      return ctx;
    });
    mark.layer = { canvases, ctxs, x, y, painter: new Painter(mark.laid) };
    return mark.layer;
  }

  draw() {
    const { ctx } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    for (const mark of this.marks) {
      if (mark.written <= 0) continue;
      const layer = this.layerOf(mark);
      layer.painter.paint(layer.ctxs, mark.written);
      if (mark.opacity <= 0.003) continue;
      // A wet stroke bleeds into the paper: its edge is soft, never ruled.
      const bleed = Math.max(0, mark.laid.wet - 0.65) * Math.min(mark.laid.width, 9) * 0.34 * this.ratio;
      ctx.filter = bleed > 0.05 ? `blur(${bleed.toFixed(2)}px)` : 'none';
      layer.canvases.forEach((c, band) => {
        ctx.globalAlpha = Math.min(1, mark.opacity * mark.laid.ink * BANDS[band]);
        ctx.drawImage(c, layer.x, layer.y);
      });
    }
    ctx.globalAlpha = 1;
    ctx.filter = 'none';
  }
}
