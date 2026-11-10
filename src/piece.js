import { PRESS, LIBERTY, lengthOf } from './brush.js';

/*
 * 小品。What the assistant's own circle does when it is alive: a little performance in brush strokes, written by an
 * agent as plain JSON. A piece is strokes in time. Each is written as a brush writes it (it lands, travels, lifts),
 * and then it stays, or dries after a moment (`fleeting`), or is dried by a later stroke (`replaces`, `moved`).
 * That is the whole of its animation: nothing ever moves, turns or scales. Movement is shown the way a painter would
 * show it, one stroke drying as another is written a little further on.
 *
 * The avatar is a box of 100 × 100 units with the circle at its centre; the paper round it is three boxes wide, so a
 * stroke may leap out of the circle and land outside it. When a piece is over, everything it wrote dries and the
 * circle is there again: every piece ends on the circle.
 *
 * No DOM here. validatePiece() is the gate; composePiece() is the timetable the avatar follows.
 */

export const PIECE_FORMAT = 1;

/** The avatar's own circle, in the 100-unit box. */
export const AVATAR = { centre: [50, 50], radius: 33, gap: 50, gapAt: -52, width: 10 };
export const avatarCircle = (over = {}) => ({ circle: { centre: AVATAR.centre, radius: AVATAR.radius, gap: AVATAR.gap, gapAt: AVATAR.gapAt, ...over }, width: AVATAR.width, press: 'plain', ink: 0.95, wet: 0.5, dry: 0.55, liberty: 'free' });

/** The paper a piece may write on, and where ink that stays should keep to. */
export const PAPER = { min: -100, max: 200, nearMin: -15, nearMax: 115 };
export const PIECE_LIMITS = { strokes: 30, answer: 8, leisureMs: 60000, hoverMs: 5000, hoverSpeed: 0.3 };

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const STROKE_FIELDS = ['path', 'circle', 'width', 'press', 'ink', 'wet', 'dry', 'tint', 'pace', 'pause', 'liberty', 'fleeting', 'moved', 'replaces'];

/** The strokes a stroke takes the place of: `replaces` is one place or a list of them. */
export const replaced = (def) => (def.replaces === undefined ? [] : Array.isArray(def.replaces) ? def.replaces : [def.replaces]);

function strokeMs(def) {
  return Math.min(5000, Math.max(160, (260 + lengthOf(def) * 11) * (def.pace ?? 1)));
}

/**
 * When everything happens (ms). For each stroke: when it starts (`t0`), how long it takes to write (`dur`), when it
 * starts to dry (`dryAt`) and for how long (`dryDur`). On hover a piece plays at 0.3 of its written times.
 */
export function composePiece(piece, occasion = piece.occasion) {
  const k = occasion === 'hover' ? PIECE_LIMITS.hoverSpeed : 1;
  const away = piece.circle === 'away';
  const inks = [];
  let t = away ? 500 * k : 250 * k;
  const run = (strokes, base) => strokes.forEach((def, i) => {
    t += (def.pause ?? (i === 0 && base === 0 ? 0 : 500)) * k;
    const dur = strokeMs(def) * k;
    const ink = { def, t0: t, dur, dryAt: null, dryDur: 420 * k + 180 };
    if (def.moved) for (const earlier of inks) if (earlier.dryAt === null || earlier.dryAt > t) { earlier.dryAt = t; earlier.dryDur = 300 * k + 160; }
    for (const n of replaced(def)) { const old = inks[n]; if (old && (old.dryAt === null || old.dryAt > t)) { old.dryAt = t + dur * 0.15; old.dryDur = 260 * k + 140; } }
    t += dur;
    if (def.fleeting !== undefined) ink.dryAt = t + def.fleeting * k;
    inks.push(ink);
  });
  run(piece.strokes, 0);
  const written = t;
  const hold = occasion === 'hover' ? Math.min(piece.hold ?? 500, 1200) : (piece.hold ?? 8000);
  const foldAt = written + hold;
  const left = inks.filter((ink) => ink.dryAt === null || ink.dryAt > foldAt);
  left.forEach((ink, i) => { ink.dryAt = foldAt + ((left.length - 1 - i) / Math.max(1, left.length)) * 500 * (k + 0.3); ink.dryDur = 600 * k + 300; });
  const total = foldAt + 1100 * k + 700;
  return { occasion, speed: k, inks, away, circleDryAt: 0, circleDryDur: 900 * k + 200, circleBackAt: foldAt + 150, circleBackDur: 650, written, foldAt, total };
}

/**
 * Moments worth looking at: the instant each stroke is finished (so nothing brief is missed), then one in the hold,
 * one as it folds, and the end. With more than `most` strokes, strokes are skipped evenly.
 */
export function filmMoments(plan, most = 17) {
  const n = plan.inks.length;
  const keep = n <= most ? plan.inks.map((_, i) => i) : Array.from({ length: most }, (_, k) => Math.round((k * (n - 1)) / (most - 1)));
  const moments = keep.map((i) => ({ t: Math.round(plan.inks[i].t0 + plan.inks[i].dur), label: `[${i}] 写完` }));
  moments.push({ t: Math.round(plan.written + (plan.foldAt - plan.written) / 2), label: '停着' });
  moments.push({ t: Math.round(plan.foldAt + (plan.total - plan.foldAt) * 0.35), label: '正在收' });
  moments.push({ t: Math.round(plan.total), label: '结束' });
  return moments;
}
export const filmTimes = (plan) => filmMoments(plan).map((m) => m.t);

export function describePiece(plan) {
  const sec = (ms) => `${(ms / 1000).toFixed(2).padStart(6)}s`;
  const lines = [];
  if (plan.away) lines.push(`${sec(0)}  圆干去`);
  plan.inks.forEach((ink, i) => {
    const d = ink.def;
    const notes = [d.moved ? '前面的都干去' : '', d.replaces !== undefined ? `替掉 [${replaced(d).join(', ')}]` : '', d.fleeting !== undefined ? `写完 ${((d.fleeting * plan.speed) / 1000).toFixed(2)}s 后干去` : ''].filter(Boolean).join('，');
    lines.push(`${sec(ink.t0)}  [${String(i).padStart(2)}]  写 ${(ink.dur / 1000).toFixed(2)}s${notes ? `  （${notes}）` : ''}`);
  });
  lines.push(`${sec(plan.written)}  写完，停 ${((plan.foldAt - plan.written) / 1000).toFixed(1)}s`);
  lines.push(`${sec(plan.foldAt)}  收：墨干去${plan.away ? '，圆重新写出来' : '，圆还在'}`);
  lines.push(`${sec(plan.total)}  结束`);
  return lines.join('\n');
}

export function validatePiece(input) {
  const errors = [], warnings = [];
  const err = (m) => errors.push(m), warn = (m) => warnings.push(m);
  if (!isObj(input)) return { ok: false, errors: ['小品必须是一个 JSON 对象。'], warnings };
  const p = input;
  const known = ['format', 'id', 'name', 'occasion', 'circle', 'strokes', 'answer', 'hold', 'idea'];
  for (const k of Object.keys(p)) if (!known.includes(k)) err(`不认识的字段 "${k}"；小品只有这些字段：${known.join('、')}。`);
  if (p.format !== undefined && p.format !== PIECE_FORMAT) err(`"format" 只能是 ${PIECE_FORMAT}。`);
  if (typeof p.id !== 'string' || !/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(p.id) || p.id.length > 40) err('"id" 必须是小写英文短横线命名（如 "fish-leap"），最多 40 个字符。');
  if (typeof p.name !== 'string' || p.name.trim() === '' || [...p.name].length > 8) err('"name" 是它的名字，1 到 8 个字（如"鱼跃""睡猫"）。');
  if (p.idea !== undefined && (typeof p.idea !== 'string' || [...p.idea].length > 160)) err('"idea" 是一两句话，最多 160 个字：它演的是什么。');
  if (p.idea === undefined) warn('没有 "idea"：用一两句话写下它演的是什么（谁，做了什么，怎么收场）。写不出来，说明这一幅还没想清楚。');
  if (!['leisure', 'hover'].includes(p.occasion)) err('"occasion" 必须是 "leisure"（闲时，慢慢地写）或 "hover"（主人的指针停在头像上时，两三秒的一小段）。');
  if (!['keep', 'away'].includes(p.circle)) err('"circle" 必须是 "keep"（圆一直在，和它一起玩）或 "away"（圆先干去，结束时重新写出来）。');
  if (p.hold !== undefined && !(isNum(p.hold) && p.hold >= 0 && p.hold <= 30000)) err('"hold" 必须在 0 到 30000 毫秒之间。');

  const checkStrokes = (strokes, where, most) => {
    if (!Array.isArray(strokes) || strokes.length < 1) { err(`"${where}" 至少要有一笔。`); return false; }
    if (strokes.length > most) err(`"${where}" 有 ${strokes.length} 笔，最多 ${most} 笔。`);
    let ok = true;
    strokes.forEach((st, i) => {
      const at = `${where}[${i}]`;
      if (!isObj(st)) { err(`${at} 必须是一个对象。`); ok = false; return; }
      for (const k of Object.keys(st)) if (!STROKE_FIELDS.includes(k)) err(`${at} 有不认识的字段 "${k}"；一笔只有：${STROKE_FIELDS.join('、')}。`);
      if ((st.path === undefined) === (st.circle === undefined)) { err(`${at} 要有 "path" 或 "circle"，且只有一个。`); ok = false; return; }
      const isAvatar = st.circle !== undefined && isObj(st.circle) && st.circle.centre === undefined && st.circle.radius === undefined;
      if (!isAvatar && !(isNum(st.width) && st.width >= 0.8 && st.width <= 16)) { err(`${at}.width 必须在 0.8 到 16 之间（细线 1.5，枝 3–5，头像的圆是 10）。`); ok = false; }
      const range = (name, lo, hi) => { if (st[name] !== undefined && !(isNum(st[name]) && st[name] >= lo && st[name] <= hi)) err(`${at}.${name} 必须在 ${lo} 到 ${hi} 之间。`); };
      range('ink', 0.1, 1); range('wet', 0, 1); range('dry', 0, 1); range('tint', -1, 1); range('pace', 0.1, 3); range('pause', 0, 8000); range('fleeting', 0, 20000);
      if (st.moved !== undefined && st.moved !== true) err(`${at}.moved 只能是 true。`);
      if (st.replaces !== undefined) {
        const count = where === 'answer' ? (Array.isArray(p.strokes) ? p.strokes.length : 0) : i;
        const list = Array.isArray(st.replaces) ? st.replaces : [st.replaces];
        if (list.length < 1 || list.length > 8 || !list.every((n) => Number.isInteger(n) && n >= 0 && n < count)) err(`${at}.replaces 要指向${where === 'answer' ? ' "strokes" 里' : '它之前'}的笔：一个编号，或几个编号的数组（从 0 数起，这里只能是 0 到 ${count - 1}）。`);
      }
      if (st.liberty !== undefined && !Object.hasOwn(LIBERTY, st.liberty)) err(`${at}.liberty 只能是：${Object.keys(LIBERTY).join('、')}。`);
      if (typeof st.press === 'string') { if (!Object.hasOwn(PRESS, st.press) || st.press === 'rule') err(`${at}.press 没有叫 "${st.press}" 的提按；现有：${Object.keys(PRESS).filter((k) => k !== 'rule').join('、')}，或者写成 [[位置, 力度], ...]。`); }
      else if (st.press !== undefined) {
        const good = Array.isArray(st.press) && st.press.length >= 2 && st.press.length <= 12 && st.press.every((k) => Array.isArray(k) && k.length === 2 && isNum(k[0]) && isNum(k[1]) && k[0] >= 0 && k[0] <= 1 && k[1] >= 0 && k[1] <= 1) && st.press.every((k, j) => j === 0 || k[0] > st.press[j - 1][0]);
        if (!good) err(`${at}.press 写成关键点时，要 2 到 12 个 [位置, 力度]，都在 0 到 1 之间，位置依次增大。`);
      }
      let pts;
      if (st.path !== undefined) {
        if (!Array.isArray(st.path) || st.path.length < 2 || st.path.length > 40 || !st.path.every((q) => Array.isArray(q) && q.length === 2 && isNum(q[0]) && isNum(q[1]))) { err(`${at}.path 要 2 到 40 个 [x, y] 点。`); ok = false; return; }
        pts = st.path;
      } else {
        const c = st.circle;
        if (!isObj(c)) { err(`${at}.circle 必须是一个对象；{} 就是头像自己的圆。`); ok = false; return; }
        if (c.centre !== undefined && !(Array.isArray(c.centre) && c.centre.length === 2 && c.centre.every(isNum))) { err(`${at}.circle.centre 要是 [x, y]。`); ok = false; return; }
        if (c.radius !== undefined && !(isNum(c.radius) && c.radius >= 1 && c.radius <= 60)) { err(`${at}.circle.radius 必须在 1 到 60 之间。`); ok = false; return; }
        if (c.gap !== undefined && !(isNum(c.gap) && c.gap >= 0 && c.gap <= 320)) err(`${at}.circle.gap 必须在 0 到 320 度之间。`);
        if (c.gapAt !== undefined && !isNum(c.gapAt)) err(`${at}.circle.gapAt 必须是角度。`);
        const [cx, cy] = c.centre ?? AVATAR.centre, r = c.radius ?? AVATAR.radius;
        pts = [[cx - r, cy - r], [cx + r, cy + r]];
      }
      const h = (st.width ?? AVATAR.width) / 2;
      pts.forEach(([x, y], j) => {
        if (x - h < PAPER.min || x + h > PAPER.max || y - h < PAPER.min || y + h > PAPER.max) err(`${at} 的第 ${j + 1} 个点 [${x}, ${y}] 出了纸（${PAPER.min} 到 ${PAPER.max}）；把它收回来。`);
      });
      if (p.occasion === 'leisure' && st.fleeting === undefined && where === 'strokes') {
        const out = pts.some(([x, y]) => x < PAPER.nearMin || x > PAPER.nearMax || y < PAPER.nearMin || y > PAPER.nearMax);
        const later = strokes.slice(i + 1).some((s2) => isObj(s2) && (s2.moved === true || replaced(s2).includes(i)));
        if (out && !later) warn(`${at} 离头像很远（出了 ${PAPER.nearMin} 到 ${PAPER.nearMax}），又会一直留到收场：闲时的画要留在头像身上或紧挨着它。给它 "fleeting"，或让后面的一笔带走它。`);
      }
      const len = pts.reduce((a, q, j) => (j === 0 ? 0 : a + Math.hypot(q[0] - pts[j - 1][0], q[1] - pts[j - 1][1])), 0);
      if (st.path !== undefined && len < 0.8) err(`${at} 的 path 太短；一个点也要两个相距约 2 的点。`);
      if (st.path !== undefined && len < 4 && isNum(st.width) && st.width < 3) warn(`${at} 是一个不到 3 宽的小点：头像只有五十几个像素，这样的点看不见；点要 4 以上。`);
    });
    return ok;
  };

  const mainOk = checkStrokes(p.strokes, 'strokes', PIECE_LIMITS.strokes);
  if (p.answer !== undefined) {
    if (p.occasion !== 'leisure') err('"answer" 只有闲时的小品才有：主人的指针碰到它时，它怎样回应。');
    checkStrokes(p.answer, 'answer', PIECE_LIMITS.answer);
  }
  if (errors.length > 0 || !mainOk) return { ok: false, errors: errors.length ? errors : ['笔画有误。'], warnings };

  // 法度，能量化的部分。
  const s = p.strokes;
  const inks = s.map((st) => st.ink ?? 0.92);
  if (s.length >= 3 && Math.max(...inks) - Math.min(...inks) < 0.25) warn('整幅只用了一种墨色：至少一处浓墨（ink 0.9 以上）和一处淡墨（0.45 以下）。');
  const pauses = s.slice(1).map((st) => st.pause ?? 500), paces = s.map((st) => st.pace ?? 1);
  if (s.length >= 4 && new Set(pauses).size === 1) warn('每一笔之前停得一样久：没有节奏。想一想哪里该顿（换一样东西画之前、要紧的一笔之前），哪里该连着写。');
  if (s.length >= 4 && new Set(paces).size === 1) warn('每一笔一样快：没有快慢。一甩的笔 pace 0.3，慢慢拖的笔 1.3。');
  const alive = s.some((st) => st.fleeting !== undefined || st.moved || st.replaces !== undefined) || p.answer !== undefined;
  if (!alive) warn('没有一笔会干去、被替掉或带走前面的：这是一幅静止的画，不是一段动的。至少让一样东西动一下（"fleeting"、"replaces"、"moved"），或者给它一个 "answer"。');
  if (p.circle === 'keep' && !s.some((st) => touchesCircle(st))) warn('"circle": "keep" 是和圆一起玩，可是没有一笔挨着圆（圆心 [50,50]，半径 33）：要么让东西落在圆上、从缺口出来、待在圆里，要么用 "away"。');

  const dots = s.filter((st) => st.path && st.path.length === 2 && Math.hypot(st.path[1][0] - st.path[0][0], st.path[1][1] - st.path[0][1]) < 6 && Math.hypot(st.path[0][0] - 50, st.path[0][1] - 50) < 26);
  if (dots.some((a, i) => dots.slice(i + 1).some((b) => Math.abs(a.path[0][1] - b.path[0][1]) < 9 && Math.abs(a.path[0][0] - b.path[0][0]) > 9)))
    warn('圆里有两个并排的点：圆本身像一张脸的轮廓，两点会被看成一双眼睛，再加一道弧就是一个表情。除非你画的就是一张脸，否则把它们错开、挪到圆外，或者只留一个。');
  const plan = composePiece(p);
  const sec = (ms) => (ms / 1000).toFixed(1);
  if (p.occasion === 'hover' && plan.total > PIECE_LIMITS.hoverMs) errors.push(`在指针下它要演 ${sec(plan.total)} 秒，最多 ${sec(PIECE_LIMITS.hoverMs)} 秒（那里按写下的时间的 ${PIECE_LIMITS.hoverSpeed} 倍播放）；减少笔数、缩短 pause 或把 pace 调小。`);
  if (p.occasion === 'leisure' && plan.total > PIECE_LIMITS.leisureMs) errors.push(`它要演 ${sec(plan.total)} 秒，最多 ${sec(PIECE_LIMITS.leisureMs)} 秒；减少笔数，或缩短 pause 和 hold。`);
  if (p.occasion === 'leisure' && plan.written < 5000) warnings.push(`闲时的小品只写了 ${sec(plan.written)} 秒：太赶。闲时要慢，笔与笔之间停一停（pause 600–1500），像在想下一笔。`);
  let answerPlan = null;
  if (p.answer !== undefined && errors.length === 0) {
    answerPlan = composePiece({ ...p, strokes: p.answer, circle: 'keep', hold: 400 }, 'hover');
    if (answerPlan.total > PIECE_LIMITS.hoverMs) errors.push(`"answer" 要演 ${sec(answerPlan.total)} 秒，最多 ${sec(PIECE_LIMITS.hoverMs)} 秒。`);
  }
  return errors.length ? { ok: false, errors, warnings } : { ok: true, errors, warnings, plan, answerPlan };
}

function touchesCircle(st) {
  const pts = st.path ?? [];
  const [cx, cy] = AVATAR.centre;
  return st.circle !== undefined || pts.some(([x, y]) => Math.hypot(x - cx, y - cy) <= AVATAR.radius + AVATAR.width);
}
