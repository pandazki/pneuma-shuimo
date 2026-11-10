import { lay, rng, clamp } from './brush.js';
import { Paper } from './paper.js';
import { AVATAR, avatarCircle, composePiece, validatePiece } from './piece.js';

/*
 * 灵。The assistant's avatar: one circle written with a brush, alive.
 *
 *   - At rest it is the circle, and no clock runs. Every writing of the circle differs a little.
 *   - The owner's pointer comes over it: a pale wash spreads inside it on the side the pointer is (its attention
 *     leaning that way). The pointer stays a moment: it plays a short piece. The pointer leaves: the wash fades.
 *   - Nothing has happened for a while: it writes a piece at leisure, slowly, then folds it back into the circle.
 *     If the pointer finds it mid-piece, the piece answers (the cat opens an eye) and gives way.
 *   - It is thinking: the circle is written again and again over its own trace, each time a little different.
 *   - It is pressed: whatever it was doing dries at once and the circle is written anew.
 *
 * Everything on the paper is a function of time: each stroke knows when it is written and when it dries. So any
 * moment can be shown still (`at`), which is how a piece is checked without watching it.
 *
 *   const spirit = summon(container, { size: 56, pieces, idle: { first: [60e3, 120e3], between: [150e3, 300e3] } });
 *   spirit.play(piece); spirit.set('thinking'); spirit.set('rest'); spirit.destroy();
 */

const ease = (u) => { const v = clamp(u); return v < 0.5 ? 2 * v * v : 1 - ((-2 * v + 2) ** 2) / 2; };
const REACH = 3; // the paper is three avatars wide: -100 to 200 in units

export function summon(container, options = {}) {
  const size = options.size ?? 56;
  const k = size / 100;
  const random = rng(options.seed ?? (Math.random() * 0x7fffffff) | 0);
  const seed = () => 1 + Math.floor(random() * 0x7ffffffe);
  const between = ([lo, hi]) => lo + (hi - lo) * random();
  const still = options.at !== undefined;
  const reduced = !still && globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

  const root = document.createElement('div');
  root.className = 'shuimo-spirit';
  root.style.cssText = `position:relative;width:${size}px;height:${size}px;`;
  root.tabIndex = 0;
  root.setAttribute('role', 'button');
  root.setAttribute('aria-label', options.label ?? '助理');
  const canvas = document.createElement('canvas');
  canvas.style.cssText = `position:absolute;left:${-size}px;top:${-size}px;pointer-events:none;`;
  root.append(canvas);
  container.append(root);
  const paper = new Paper(canvas);
  paper.resize(size * REACH, size * REACH);
  const INK = getComputedStyle(root).color || '#1f1d1a';

  /** A stroke in the avatar's units, as one in paper pixels. */
  const px = (def) => {
    const tx = ([x, y]) => [(x + 100) * k, (y + 100) * k];
    const out = { ...def, width: (def.width ?? AVATAR.width) * k };
    if (def.circle) out.circle = { centre: tx(def.circle.centre ?? AVATAR.centre), radius: (def.circle.radius ?? AVATAR.radius) * k, gap: def.circle.gap ?? AVATAR.gap, gapAt: def.circle.gapAt ?? AVATAR.gapAt };
    else out.path = def.path.map(tx);
    return out;
  };

  // ── ink in time ──
  const inks = new Set();
  const put = (def, t0, dur, group) => {
    const ink = { mark: paper.add(lay(px(def), seed()), INK), t0, dur, dryAt: null, dryDur: 400, floor: 0, group };
    inks.add(ink);
    return ink;
  };
  const dry = (ink, at, dur = 300) => { if (ink.dryAt === null || ink.dryAt > at) { ink.dryAt = at; ink.dryDur = dur; } };
  const show = (now) => {
    let moving = false;
    for (const ink of inks) {
      const u = ink.dur <= 0 ? (now >= ink.t0 ? 1 : 0) : (now - ink.t0) / ink.dur;
      ink.mark.written = Math.max(ink.mark.written, ease(u));
      const gone = ink.dryAt === null ? 0 : clamp((now - ink.dryAt) / ink.dryDur);
      const risen = ink.rise ? clamp((now - ink.t0) / ink.rise) : 1;   // a wash does not land, it spreads
      ink.mark.opacity = (1 - (1 - ink.floor) * gone) * risen;
      if (risen < 1) moving = true;
      if (ink.dryAt !== null && gone >= 1 && ink.floor === 0) { paper.remove(ink.mark); inks.delete(ink); continue; }
      if (u < 1 || (ink.dryAt !== null && gone < 1)) moving = true;
    }
    paper.draw();
    return moving;
  };
  let frame = 0;
  const tick = (now) => { frame = 0; if (show(now)) frame = requestAnimationFrame(tick); };
  const wake = () => { if (!still && frame === 0) frame = requestAnimationFrame(tick); };
  const now = () => (still ? 0 : performance.now());

  // ── the circle ──
  let circle = put(avatarCircle(), -1, 0, 'circle');
  /** Written again over its own trace: the old one pales to a trace, the new is written, the trace dries. */
  const rewriteCircle = (at = now(), dur = 620) => {
    const old = circle;
    if (old) { old.floor = 0; dry(old, at, dur + 400); }
    circle = put(avatarCircle(), at + 80, reduced ? 0 : dur, 'circle');
    wake();
  };

  // ── a performance ──
  let act = null; // { piece, plan, inks, start, end, occasion }
  const timers = new Set();
  const later = (ms, fn) => { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); return id; };

  function play(piece, occasion = piece.occasion, start = now(), over = {}) {
    const verdict = validatePiece(piece);
    if (!verdict.ok) throw new Error(`小品没有通过校验：\n${verdict.errors.join('\n')}`);
    if (act) return false;
    if (reduced) return false;
    dryEye(start);
    const plan = composePiece(over.hold === undefined ? piece : { ...piece, hold: over.hold }, occasion);
    const mine = plan.inks.map((i) => { const ink = put(i.def, start + i.t0, i.dur, 'piece'); if (i.dryAt !== null) dry(ink, start + i.dryAt, i.dryDur); return ink; });
    if (plan.away) {
      dry(circle, start + plan.circleDryAt, plan.circleDryDur);
      circle = put(avatarCircle(), start + plan.circleBackAt, plan.circleBackDur, 'circle');
    }
    act = { piece, plan, inks: mine, start, end: start + plan.total, occasion, answered: false };
    if (!still) { const mineAct = act; later(plan.total + 30, () => { if (act === mineAct) { act = null; schedule(); options.onRest?.(); } }); }
    wake();
    return true;
  }

  /** Whatever it is doing gives way: its ink dries now, and the circle is there. */
  function giveWay(at = now(), dur = 260) {
    if (!act) return;
    for (const ink of act.inks) { if (ink.t0 > at) { paper.remove(ink.mark); inks.delete(ink); } else dry(ink, at, dur); }
    if (act.plan.away && circle.t0 > at) { circle.t0 = at + 60; circle.dur = 520; }
    act = null;
    wake();
  }

  /** The piece on the paper answers the pointer (a few quick strokes), then gives way. */
  function answer(at = now()) {
    if (!act || act.answered) return;
    const { piece } = act;
    if (!piece.answer) { giveWay(at, 420); return; }
    act.answered = true;
    // What is not yet written is left unwritten; the answer is played over what is there.
    for (const ink of act.inks) if (ink.t0 > at) { paper.remove(ink.mark); inks.delete(ink); }
    const main = act.inks;
    const plan = composePiece({ ...piece, strokes: piece.answer.map(({ replaces, ...rest }) => rest), circle: 'keep', hold: 500 }, 'hover');
    plan.inks.forEach((i, n) => {
      const ink = put(i.def, at + i.t0, i.dur, 'piece');
      for (const r of [].concat(piece.answer[n].replaces ?? [])) if (main[r]) dry(main[r], at + i.t0, 220);
      if (piece.answer[n].moved) for (const old of main) dry(old, at + i.t0, 240);
      dry(ink, at + (i.dryAt ?? plan.foldAt), i.dryDur);
      act.inks.push(ink);
    });
    for (const ink of main) dry(ink, at + plan.foldAt, 500);
    if (act.plan.away) { circle.t0 = at + plan.foldAt + 100; circle.dur = 600; }
    const mineAct = act;
    later(plan.total + 30, () => { if (act === mineAct) { act = null; schedule(); } });
    wake();
  }

  // ── attention: it turns toward the owner ──
  // No eye, no face. Inside the circle, on the side the pointer is, a pale wash of ink spreads (晕): its attention
  // leaning that way. The pointer goes round: the old wash fades as a new one spreads on the new side. It never slides.
  let eye = null;
  const writeEye = (dx, dy) => {
    const d = Math.hypot(dx, dy) || 1;
    const lean = Math.min(1, d / (size * 0.3)) * 8.5;
    const [cx, cy] = [50 + (dx / d) * lean, 50 + (dy / d) * lean];
    dryEye(now(), 520);
    eye = put({ path: [[cx - 1.5, cy - 1], [cx + 1.5, cy + 1]], width: 39, press: 'dot', ink: 0.26, wet: 1, dry: 0, liberty: 'still' }, now(), 0, 'eye');
    eye.rise = reduced ? 0 : 420;
    eye.angle = Math.atan2(dy, dx);
    wake();
  };
  const dryEye = (at = now(), over = 420) => { if (eye) { dry(eye, at, over); eye = null; wake(); } };
  /** It looks that way (dx, dy from its middle, in px), as if a pointer were there; unlook() lets the eye dry. */
  const look = (dx, dy) => { if (!act && state === 'rest') writeEye(dx, dy); };

  // ── states ──
  // rest      nothing is happening: the circle, still.
  // thinking  the circle is written again and again over its own trace.
  // working   it is doing something: inside the circle the brush goes round, a stretch at a time, each stretch
  //           drying as the next is written. done() closes the gap with one stroke (合口), which then dries.
  // blank     it has let go (放空): the ink pales to a trace, stays so a long while, and is written back.
  let state = 'rest';
  let loop = 0;
  const think = () => { if (state !== 'thinking') return; rewriteCircle(now(), 900); loop = later(between([1500, 2100]), think); };
  let turn = -90;
  const work = () => {
    if (state !== 'working') return;
    const at = now();
    const arc = put({ circle: { centre: [50, 50], radius: 16, gap: 282, gapAt: turn + 180 }, width: 6, press: 'taper', ink: 0.82, wet: 0.45, dry: 0.5, liberty: 'free' }, at, 380, 'work');
    dry(arc, at + 430, 520);
    turn += between([58, 74]);
    wake();
    loop = later(430, work);
  };
  const blank = () => {
    if (state !== 'blank') return;
    circle.floor = 0.14;
    dry(circle, now(), 3200);
    wake();
    loop = later(between([6500, 9000]), () => { if (state !== 'blank') return; rewriteCircle(now(), 2400); loop = later(between([4200, 5200]), blank); });
  };
  function set(next) {
    if (next === state) return;
    const was = state;
    state = next;
    clearTimeout(loop);
    if (was === 'blank' && circle.floor > 0) rewriteCircle(now(), 700);
    if (next === 'rest') { schedule(); return; }
    giveWay(); dryEye(); clearTimeout(idleTimer);
    if (next === 'thinking') think();
    else if (next === 'working') work();
    else if (next === 'blank') blank();
  }
  /** The work is done: one stroke closes the gap, stays a beat and dries; then it rests. */
  function done() {
    if (state !== 'working') return;
    state = 'rest';
    clearTimeout(loop);
    const at = now() + 300;
    const rim = [-80, -68, -52, -36, -24].map((deg) => [50 + 33 * Math.cos((deg * Math.PI) / 180), 50 + 33 * Math.sin((deg * Math.PI) / 180)]);
    const close = put({ path: rim, width: 10, press: 'plain', ink: 0.95, wet: 0.5, dry: 0.3, liberty: 'calm' }, at, 360, 'work');
    dry(close, at + 1500, 700);
    wake();
    schedule();
  }

  // ── leisure ──
  let idleTimer = 0;
  let lastLeisure = null, lastHover = null, lastHoverAt = -1e9;
  const pick = (occasion, last) => {
    const all = (options.pieces ?? []).filter((p) => p.occasion === occasion);
    const pool = all.length > 1 ? all.filter((p) => p.id !== last) : all;
    return pool.length ? pool[Math.floor(random() * pool.length)] : null;
  };
  let firstIdle = true;
  function schedule() {
    clearTimeout(idleTimer);
    if (still || !options.idle || state !== 'rest') return;
    idleTimer = later(between(firstIdle ? options.idle.first : options.idle.between), () => {
      if (act || state !== 'rest' || hovering || document.hidden) { schedule(); return; }
      const piece = pick('leisure', lastLeisure);
      if (!piece) return;
      firstIdle = false;
      lastLeisure = piece.id;
      play(piece);
    });
  }

  // ── the pointer ──
  let hovering = false;
  let dwell = 0;
  const offset = (event) => { const r = root.getBoundingClientRect(); return [event.clientX - (r.left + r.width / 2), event.clientY - (r.top + r.height / 2)]; };
  const onEnter = (event) => {
    hovering = true;
    if (state !== 'rest') return;
    if (act && act.occasion === 'leisure') { answer(); return; }
    if (act) return;
    writeEye(...offset(event));
    clearTimeout(dwell);
    dwell = later(320, () => {
      if (!hovering || act || state !== 'rest' || performance.now() - lastHoverAt < 2600) return;
      const piece = pick('hover', lastHover);
      if (!piece) return;
      lastHover = piece.id; lastHoverAt = performance.now();
      play(piece);
    });
  };
  const onMove = (event) => {
    if (!hovering || act || state !== 'rest' || !eye) return;
    const [dx, dy] = offset(event);
    const turn = Math.abs(Math.atan2(Math.sin(Math.atan2(dy, dx) - eye.angle), Math.cos(Math.atan2(dy, dx) - eye.angle)));
    if (turn > 0.5 && performance.now() - eye.t0 > 380) writeEye(dx, dy);
  };
  const onLeave = () => { hovering = false; clearTimeout(dwell); dryEye(); schedule(); };
  const onDown = () => { clearTimeout(dwell); giveWay(now(), 180); dryEye(); rewriteCircle(); schedule(); options.onPress?.(); };
  if (!still) {
    root.addEventListener('pointerenter', onEnter);
    root.addEventListener('pointermove', onMove);
    root.addEventListener('pointerleave', onLeave);
    root.addEventListener('pointerdown', onDown);
    root.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') onDown(); });
  }

  if (still) {
    // One moment of one piece, with no clock: for looking at.
    const { piece, occasion, t, answer: withAnswer } = options.at;
    if (piece) {
      play(piece, occasion ?? piece.occasion, 0);
      if (withAnswer !== undefined && piece.answer) { show(withAnswer); answer(withAnswer); }
    }
    show(t ?? 0);
  } else {
    show(performance.now());
    schedule();
  }

  return {
    el: root,
    get state() { return state; },
    get busy() { return act !== null; },
    set,
    play: (piece, occasion, over) => play(piece, occasion, now(), over),
    look, unlook: () => dryEye(), done,
    /**
     * One more stroke of its own, for whoever is directing it (a ceremony the app has made for it): written `after`
     * ms from now over `dur` ms, and staying until the handle's dry() is called, or drying by itself after `stays` ms.
     */
    ink(def, { after = 0, dur = 400, stays } = {}) {
      const at = now() + after;
      const ink = put(def, at, reduced ? 0 : dur, 'own');
      if (stays !== undefined) dry(ink, at + dur + stays, 600);
      wake();
      return { dry: (over = 400) => { dry(ink, now(), over); wake(); } };
    },
    /** Its circle dries where it is (it is leaving, or being carried off); rewrite() writes it again where it now is. */
    dryAway(dur = 500) { giveWay(); dryEye(); dry(circle, now(), dur); wake(); },
    rewrite(dur = 620) { rewriteCircle(now(), dur); },
    giveWay: () => giveWay(),
    destroy() { for (const id of timers) clearTimeout(id); if (frame) cancelAnimationFrame(frame); paper.clear(); root.remove(); },
  };
}
