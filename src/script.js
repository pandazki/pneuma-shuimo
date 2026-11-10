import { MOTIFS } from './motifs.js';
import { PRESS, LIBERTY } from './brush.js';
import { compose, LIMITS, textUnits } from './layout.js';

/*
 * 脚本。What an agent writes to grow something for its owner: plain JSON, no code in it. validate() is the gate every
 * script passes before it reaches the paper. It returns every problem as a sentence that says where and what to do,
 * so whoever wrote the script can fix it without seeing this file.
 *
 *   errors   → the script is refused.
 *   warnings → it plays, but something about it is not in the manner (法度); fix them unless there is a reason not to.
 *
 * No DOM here: the same file checks scripts in the app, on a server and from the command line.
 */

export const FORMAT = 1;
export const ROW_KINDS = ['text', 'check', 'tally', 'entry'];

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{1F1E6}-\u{1F1FF}]/u;
const LOUD = /[!！]{1,}|[?？]{2,}|[~～]{2,}/;

export function validate(input) {
  const errors = [];
  const warnings = [];
  const err = (m) => errors.push(m);
  const warn = (m) => warnings.push(m);
  if (!isObj(input)) return { ok: false, errors: ['脚本必须是一个 JSON 对象。'], warnings };
  const s = input;
  const known = ['format', 'id', 'title', 'intent', 'rows', 'ink', 'seal', 'resets', 'pace'];
  for (const k of Object.keys(s)) if (!known.includes(k)) err(`不认识的字段 "${k}"；脚本只有这些字段：${known.join('、')}。`);
  if (s.format !== undefined && s.format !== FORMAT) err(`"format" 只能是 ${FORMAT}。`);
  if (typeof s.id !== 'string' || !/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(s.id) || s.id.length > 40) err('"id" 必须是小写英文短横线命名（如 "daily-water"），最多 40 个字符。');

  const text = (value, where, max, { required = true } = {}) => {
    if (value === undefined && !required) return;
    if (typeof value !== 'string' || value.trim() === '') { err(`${where} 必须是一段非空的文字。`); return; }
    if (value !== value.trim()) err(`${where} 的首尾不能有空白。`);
    if (/[\n\r\t]/.test(value)) err(`${where} 只能是一行，不能换行。`);
    if (EMOJI.test(value)) err(`${where} 里有表情符号；这里只有墨和字，去掉它。`);
    const units = textUnits(value);
    if (units > max) err(`${where} 有 ${units} 个字宽，最多 ${max}（汉字算 1，英文数字算 0.5）；写短一些。`);
    if (LOUD.test(value)) warn(`${where}（"${value}"）语气太响：不用感叹号、连续问号或波浪号，平静地说。`);
  };

  text(s.title, '"title"', LIMITS.title);
  if (typeof s.title === 'string' && /[，。、；：,.;:]/.test(s.title)) warn('"title" 是一个名字，不是一句话：去掉标点，两到四个字最好（如"饮水""晨课"）。');
  if (typeof s.title === 'string' && textUnits(s.title) > 6) warn(`"title"（"${s.title}"）偏长：两到四个字最好。`);
  text(s.intent, '"intent"', 120, { required: false });
  if (s.intent === undefined) warn('没有 "intent"：写上主人的原话或这样东西是为什么而生的，日后才知道它从哪里来。');

  const keys = new Set();
  const key = (value, where) => {
    if (typeof value !== 'string' || !/^[a-z][a-zA-Z0-9]{0,23}$/.test(value)) { err(`${where} 必须是字母开头的英文名（如 "cups"），最多 24 个字符。`); return; }
    if (keys.has(value)) err(`${where} 的 "${value}" 和另一行重复了；每一行的 key 都要不同。`);
    keys.add(value);
  };

  if (!Array.isArray(s.rows) || s.rows.length < 1) err('"rows" 至少要有一行。');
  else {
    if (s.rows.length > LIMITS.rows) err(`"rows" 有 ${s.rows.length} 行，最多 ${LIMITS.rows} 行；一样东西只做一件事，拆成两样或者删掉次要的。`);
    s.rows.forEach((row, i) => {
      const at = `rows[${i}]`;
      if (!isObj(row)) { err(`${at} 必须是一个对象。`); return; }
      if (!ROW_KINDS.includes(row.kind)) { err(`${at}.kind 必须是 ${ROW_KINDS.map((k) => `"${k}"`).join('、')} 之一。`); return; }
      const allowed = { text: ['kind', 'text', 'tone', 'pause'], check: ['kind', 'key', 'label', 'pause'], tally: ['kind', 'key', 'label', 'goal', 'unit', 'pause'], entry: ['kind', 'key', 'placeholder', 'max', 'items', 'pause'] }[row.kind];
      for (const k of Object.keys(row)) if (!allowed.includes(k)) err(`${at} 有不认识的字段 "${k}"；"${row.kind}" 行只有：${allowed.join('、')}。`);
      if (row.pause !== undefined && !(isNum(row.pause) && row.pause >= 0 && row.pause <= 1500)) err(`${at}.pause 必须在 0 到 1500 毫秒之间。`);
      if (row.kind === 'text') {
        text(row.text, `${at}.text`, LIMITS.text);
        if (row.tone !== undefined && !['plain', 'faint'].includes(row.tone)) err(`${at}.tone 只能是 "plain" 或 "faint"。`);
      } else if (row.kind === 'check') {
        key(row.key, `${at}.key`);
        text(row.label, `${at}.label`, LIMITS.label);
      } else if (row.kind === 'tally') {
        key(row.key, `${at}.key`);
        text(row.label, `${at}.label`, LIMITS.tallyLabel);
        if (row.goal !== undefined && !(Number.isInteger(row.goal) && row.goal >= 1 && row.goal <= LIMITS.tally)) err(`${at}.goal 必须是 1 到 ${LIMITS.tally} 的整数（一行最多写六个"正"字）。`);
        text(row.unit, `${at}.unit`, 2, { required: false });
      } else if (row.kind === 'entry') {
        key(row.key, `${at}.key`);
        text(row.placeholder, `${at}.placeholder`, LIMITS.label);
        if (row.max !== undefined && !(Number.isInteger(row.max) && row.max >= 1 && row.max <= LIMITS.entries)) err(`${at}.max 必须是 1 到 ${LIMITS.entries} 的整数。`);
        if (row.items !== undefined) {
          if (!Array.isArray(row.items) || row.items.length > (row.max ?? LIMITS.entries)) err(`${at}.items 必须是一个数组，条数不超过 max（没写 max 时最多 ${LIMITS.entries} 条）。`);
          else row.items.forEach((item, j) => text(item, `${at}.items[${j}]`, LIMITS.label));
        }
        if (i !== s.rows.length - 1) err(`${at} 是 "entry" 行，它必须是最后一行：添上的条目写在它下面。`);
      }
    });
    if (s.rows.filter((r) => isObj(r) && r.kind === 'entry').length > 1) err('只能有一行 "entry"。');
    if (s.rows.every((r) => isObj(r) && r.kind === 'text')) warn('所有行都是文字：这只是一张字条。如果主人要的是能用的东西，至少给一行 check、tally 或 entry。');
    if (s.rows.filter((r) => isObj(r) && r.kind === 'text').length > 2) warn('文字行超过两行：说明越少越好，留一句最要紧的。');
    if (s.rows.length > 5) warn(`有 ${s.rows.length} 行：五行以内最从容，留白也是内容。`);
  }

  if (s.seal !== undefined) {
    if (typeof s.seal !== 'string' || [...s.seal].length !== 1 || !/\p{Script=Han}/u.test(s.seal)) err('"seal" 必须是一个汉字（印文），如"水""读"。');
  }
  if (s.resets !== undefined && !['never', 'daily', 'weekly'].includes(s.resets)) err('"resets" 只能是 "never"、"daily"（每天从空开始）或 "weekly"（每周一从空开始）；没有按月或别的周期。');
  if (s.pace !== undefined && !(isNum(s.pace) && s.pace >= 0.6 && s.pace <= 1.6)) err('"pace" 必须在 0.6（利落）到 1.6（从容）之间。');

  if (s.ink !== undefined) checkInk(s.ink, err, warn);
  else warn('没有 "ink"：一幅小画让它成为一件东西而不只是一张表。选一个母题，或者自己写几笔。');

  if (errors.length > 0) return { ok: false, errors, warnings };
  const plan = compose(s);
  const sec = (ms) => (ms / 1000).toFixed(1);
  if (plan.usable > LIMITS.usableMs) errors.push(`各行要 ${sec(plan.usable)} 秒才写完，最多 ${sec(LIMITS.usableMs)} 秒：主人在等着用它。${s.ink?.when === 'first' ? '把 "ink.when" 改回 "last"（先让它能用，再画），或者' : ''}缩短 pause、减少行数，或把 "pace" 调小。`);
  if (plan.total > LIMITS.unfoldMs) errors.push(`整幅展开要 ${sec(plan.total)} 秒，最多 ${sec(LIMITS.unfoldMs)} 秒；减少小画的笔数或缩短笔间的 pause。`);
  else if (plan.total > LIMITS.unfoldEaseMs) warnings.push(`整幅展开要 ${sec(plan.total)} 秒，${sec(LIMITS.unfoldEaseMs)} 秒以内最好。`);
  return { ok: errors.length === 0, errors, warnings, plan };
}

function checkInk(ink, err, warn) {
  if (!isObj(ink)) { err('"ink" 必须是一个对象：{"motif": "..."} 或 {"strokes": [...]}。'); return; }
  for (const k of Object.keys(ink)) if (!['motif', 'strokes', 'when', 'mirror'].includes(k)) err(`"ink" 有不认识的字段 "${k}"；只有 motif、strokes、when、mirror。`);
  if (ink.when !== undefined && !['first', 'last'].includes(ink.when)) err('"ink.when" 只能是 "first"（先画再写）或 "last"（写完再画）。');
  if (ink.mirror !== undefined && typeof ink.mirror !== 'boolean') err('"ink.mirror" 只能是 true 或 false。');
  if ((ink.motif === undefined) === (ink.strokes === undefined)) { err('"ink" 里 "motif" 和 "strokes" 要有且只有一个。'); return; }
  if (ink.motif !== undefined) {
    if (!Object.hasOwn(MOTIFS, ink.motif)) err(`没有叫 "${ink.motif}" 的母题；现有：${Object.keys(MOTIFS).join('、')}。要别的就用 "strokes" 自己写。`);
    return;
  }
  const strokes = ink.strokes;
  if (!Array.isArray(strokes) || strokes.length < 1) { err('"ink.strokes" 至少要有一笔。'); return; }
  if (strokes.length > LIMITS.strokes) err(`"ink.strokes" 有 ${strokes.length} 笔，最多 ${LIMITS.strokes} 笔；写意，不是插图。`);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, sx = 0, sy = 0, sw = 0;
  const inks = [];
  let ok = true;
  strokes.forEach((st, i) => {
    const at = `ink.strokes[${i}]`;
    if (!isObj(st)) { err(`${at} 必须是一个对象。`); ok = false; return; }
    const fields = ['path', 'circle', 'width', 'press', 'ink', 'wet', 'dry', 'tint', 'pace', 'pause', 'liberty'];
    for (const k of Object.keys(st)) if (!fields.includes(k)) err(`${at} 有不认识的字段 "${k}"；一笔只有：${fields.join('、')}。`);
    if ((st.path === undefined) === (st.circle === undefined)) { err(`${at} 要有 "path" 或 "circle"，且只有一个。`); ok = false; return; }
    const range = (name, lo, hi) => { if (st[name] !== undefined && !(isNum(st[name]) && st[name] >= lo && st[name] <= hi)) err(`${at}.${name} 必须在 ${lo} 到 ${hi} 之间。`); };
    if (!(isNum(st.width) && st.width >= 0.6 && st.width <= 12)) { err(`${at}.width 必须在 0.6 到 12 之间（细线约 1，叶子 4 到 6）。`); ok = false; }
    range('ink', 0.1, 1); range('wet', 0, 1); range('dry', 0, 1); range('tint', -1, 1); range('pace', 0.2, 2.5); range('pause', 0, 1500);
    if (st.liberty !== undefined && !Object.hasOwn(LIBERTY, st.liberty)) err(`${at}.liberty 只能是：${Object.keys(LIBERTY).join('、')}。`);
    if (typeof st.press === 'string') { if (!Object.hasOwn(PRESS, st.press) || st.press === 'rule') err(`${at}.press 没有叫 "${st.press}" 的提按；现有：${Object.keys(PRESS).filter((k) => k !== 'rule').join('、')}，或者写成 [[位置, 力度], ...]。`); }
    else if (st.press !== undefined) {
      const good = Array.isArray(st.press) && st.press.length >= 2 && st.press.length <= 12 && st.press.every((k) => Array.isArray(k) && k.length === 2 && isNum(k[0]) && isNum(k[1]) && k[0] >= 0 && k[0] <= 1 && k[1] >= 0 && k[1] <= 1) && st.press.every((k, j) => j === 0 || k[0] > st.press[j - 1][0]);
      if (!good) err(`${at}.press 写成关键点时，要 2 到 12 个 [位置, 力度]，都在 0 到 1 之间，位置依次增大。`);
    }
    if (st.circle !== undefined && isObj(st.circle) && (st.circle.gap ?? 0) >= 15 && (st.circle.gap ?? 0) <= 110 && typeof st.press !== 'object' && st.press !== 'taper' && (st.ink ?? 0.92) > 0.5 && isNum(st.circle.radius) && st.circle.radius >= 4)
      warn(`${at} 是一个留着小缺口的墨圈，和纸上的你（那个圆）、和每行前面的圈是一个样子，会被当成能点的东西。月亮用大缺口（gap 140 以上）加 "press": "taper" 写成一弯；别的圆形用闭合的（gap 0）或淡墨。`);
    let pts = [];
    if (st.path !== undefined) {
      if (!Array.isArray(st.path) || st.path.length < 2 || st.path.length > 32 || !st.path.every((p) => Array.isArray(p) && p.length === 2 && isNum(p[0]) && isNum(p[1]))) { err(`${at}.path 要 2 到 32 个 [x, y] 点。`); ok = false; return; }
      pts = st.path;
    } else {
      const c = st.circle;
      if (!isObj(c) || !Array.isArray(c.centre) || c.centre.length !== 2 || !c.centre.every(isNum) || !(isNum(c.radius) && c.radius >= 1 && c.radius <= 45)) { err(`${at}.circle 要有 "centre": [x, y] 和 "radius"（1 到 45）。`); ok = false; return; }
      if (c.gap !== undefined && !(isNum(c.gap) && c.gap >= 0 && c.gap <= 320)) err(`${at}.circle.gap 必须在 0 到 320 度之间。`);
      if (c.gapAt !== undefined && !isNum(c.gapAt)) err(`${at}.circle.gapAt 必须是角度。`);
      pts = [[c.centre[0] - c.radius, c.centre[1] - c.radius], [c.centre[0] + c.radius, c.centre[1] + c.radius]];
    }
    if (!isNum(st.width)) return;
    const h = st.width / 2;
    pts.forEach(([x, y], j) => {
      if (x - h < 0 || x + h > 100 || y - h < 0 || y + h > 100) err(`${at} 的第 ${j + 1} 个点 [${x}, ${y}] 连同半个笔宽出了画框（0 到 100）；把它收回来。`);
      x0 = Math.min(x0, x - h); y0 = Math.min(y0, y - h); x1 = Math.max(x1, x + h); y1 = Math.max(y1, y + h);
      sx += x * st.width; sy += y * st.width; sw += st.width;
    });
    const len = pts.reduce((a, p, j) => (j === 0 ? 0 : a + Math.hypot(p[0] - pts[j - 1][0], p[1] - pts[j - 1][1])), 0);
    if (st.path !== undefined && len < 0.8) err(`${at} 的 path 太短（${len.toFixed(1)}）；一个点也要两个相距约 1 的点。`);
    if (st.path !== undefined && len < 3 && st.width < 1.6) warn(`${at} 是一个不到 1.6 宽的小点，在纸上几乎看不见；点要 2 以上。`);
    inks.push(st.ink ?? 0.92);
  });
  if (!ok || sw === 0) return;
  // 法度，能量化的部分。
  const cover = ((x1 - x0) * (y1 - y0)) / 10000;
  if (cover > 0.8) warn(`小画铺满了画框的 ${Math.round(cover * 100)}%：留白不足。让它偏在一侧，至少空出四分之一。`);
  if (strokes.length >= 2 && x1 - x0 < 34 && y1 - y0 < 34) warn(`整幅小画只有 ${Math.round(x1 - x0)} × ${Math.round(y1 - y0)}，画框是 100 × 100：主体至少要有三分之一宽，把它写大。`);
  else if (cover < 0.08) warn(`小画只占画框的 ${Math.round(cover * 100)}%，在纸上会是一小团；把要紧的几笔写大。`);
  if (strokes.length >= 3 && Math.max(...inks) - Math.min(...inks) < 0.25) warn('整幅只用了一种墨色：墨分五色，至少要有一处浓墨（ink 0.9 以上）和一处淡墨（0.4 以下）。');
  const cx = sx / sw, cy = sy / sw;
  if (strokes.length >= 3 && Math.abs(cx - 50) < 6 && Math.abs(cy - 50) < 6) warn('小画的重心正在画框中央：构图要偏，重心放低或放在一侧，另一侧留空。');
  if (cx < 38) warn('小画的重心偏在画框左边，会贴着文字：画框在纸的右侧，重心放在右半边，左上留空。');
}

/** The first state of a script: every key at its empty value. */
export function initialState(script) {
  const state = {};
  for (const row of script.rows) {
    if (row.kind === 'check') state[row.key] = false;
    else if (row.kind === 'tally') state[row.key] = 0;
    else if (row.kind === 'entry') state[row.key] = (row.items ?? []).map((text) => ({ text, done: false }));
  }
  return state;
}
