import { lengthOf } from './brush.js';
import { MOTIFS } from './motifs.js';

/*
 * 摆放。Where everything a script says goes on the paper, and when it is written. A script never says where or how
 * large: that is decided here, once, for every script, so everything grown this way is in one hand.
 *
 * The sheet (CSS px):
 *
 *   ○  题 目                                  [印]
 *      ─────────────────────────────────────         ← the one stroke (一画) everything grows from
 *      ○ 一行                               ┌─────┐
 *      ○ 又一行                             │ 小画 │   ← the ink box, 100 × 100 units, at the lower right
 *      今日 正 丅   3／8 杯                  └─────┘     (upper right when the sheet has an entry row)
 *
 * Pure: no DOM. The validator uses it to time a script; the player follows it.
 */

export const LIMITS = { title: 8, text: 16, label: 12, tallyLabel: 6, rows: 6, tally: 30, entries: 10, strokes: 24, usableMs: 4000, unfoldMs: 9000, unfoldEaseMs: 6500 };

export const SHEET = { width: 460, top: 68, row: 38, left: 64, textLeft: 92, circle: { centre: [30, 34], radius: 18.4, width: 5.7 }, ruleY: 52, inkBox: 112, font: 16 };

/** Width of a text in characters: a Han character or full-width mark is 1, anything else 0.5. */
export function textUnits(text) {
  let units = 0;
  for (const ch of text) units += /[⺀-鿿豈-﫿＀-￯　-〿]/.test(ch) ? 1 : 0.5;
  return Math.ceil(units * 2) / 2;
}

export const CIRCLE = { circle: { centre: SHEET.circle.centre, radius: SHEET.circle.radius, gap: 50, gapAt: -52 }, width: SHEET.circle.width, press: 'plain', ink: 0.95, wet: 0.5, dry: 0.55, liberty: 'free' };

export function strokeMs(def, pace = 1) {
  return Math.round(Math.min(2400, Math.max(110, (150 + lengthOf(def) * 4.2) * (def.pace ?? 1) * pace)));
}

/** The small ring that begins a check row, and the dot that fills it (点睛) when it is done. */
export const ringDef = (top) => ({ circle: { centre: [SHEET.left + 10, top + 19], radius: 6.2, gap: 44, gapAt: -52 }, width: 1.7, press: 'plain', ink: 0.72, wet: 0.5, dry: 0.4, pace: 0.7, liberty: 'calm' });
export const dotDef = (top) => ({ path: [[SHEET.left + 9.1, top + 18.5], [SHEET.left + 10.9, top + 19.6]], width: 5.4, press: 'dot', ink: 1, wet: 0.68, dry: 0, pace: 0.8, liberty: 'still' });

/** The n-th stroke (from 0) of a tally: five strokes write one 正, in the order a hand writes it. */
const ZHENG = [[[1, 2], [15, 2]], [[8, 2.4], [8, 14]], [[8.4, 8], [14, 8]], [[3.6, 7], [3.6, 14]], [[0, 14.4], [16, 14.4]]];
export function tallyDef(row, n) {
  const ox = row.marksLeft + Math.floor(n / 5) * 21, oy = row.top + 10;
  return { path: ZHENG[n % 5].map(([x, y]) => [ox + x, oy + y]), width: 2.1, press: 'rule', ink: 0.94, wet: 0.55, dry: 0.35, pace: 0.9, liberty: 'script' };
}

export const underlineDef = (top) => ({ path: [[SHEET.left, top + 31], [SHEET.left + 130, top + 30.4], [SHEET.left + 262, top + 31]], width: 1.5, press: 'rule', ink: 0.5, wet: 0.4, dry: 0.6, pace: 0.45, liberty: 'calm' });

/** A script's ink, as strokes in sheet pixels. */
function inkStrokes(ink, box) {
  const strokes = ink.motif ? MOTIFS[ink.motif].strokes : ink.strokes;
  const k = box.size / 100;
  const tx = (x) => box.x + (ink.mirror ? 100 - x : x) * k;
  const ty = (y) => box.y + y * k;
  return strokes.map((s) => {
    const def = { ...s, width: s.width * k, tint: ink.mirror && s.tint ? -s.tint : s.tint };
    if (s.circle) def.circle = { ...s.circle, centre: [tx(s.circle.centre[0]), ty(s.circle.centre[1])], radius: s.circle.radius * k, gapAt: ink.mirror ? 180 - (s.circle.gapAt ?? -52) : s.circle.gapAt };
    else def.path = s.path.map(([x, y]) => [tx(x), ty(y)]);
    return def;
  });
}

export function compose(script) {
  const pace = script.pace ?? 1;
  const W = SHEET.width;
  const entry = script.rows.find((r) => r.kind === 'entry');
  const entryMax = entry ? (entry.max ?? Math.max(5, entry.items?.length ?? 0)) : 0;
  const lines = script.rows.length + entryMax;
  const height = Math.max(SHEET.top + lines * SHEET.row + 14, script.ink ? SHEET.top + SHEET.inkBox + 10 : 0, 96);
  const inkBox = script.ink ? { x: W - SHEET.inkBox - 6, y: entry ? SHEET.top - 4 : height - SHEET.inkBox - 6, size: SHEET.inkBox } : null;
  const seal = { x: W - 34, y: 17, size: 26, text: script.seal ?? '留' };

  const beats = [];
  let t = 0;
  let inkNo = 0;
  const stroke = (role, def, extra = {}) => { if (role === 'ink') { inkNo += 1; extra = { ...extra, no: inkNo }; } const dur = strokeMs(def, pace); beats.push({ type: 'stroke', role, t, dur, def, ...extra }); return dur; };
  const write = (role, text, extra = {}) => { const dur = Math.round([...text].length * 62 * pace); beats.push({ type: 'text', role, t, dur, text, ...extra }); return dur; };

  // 一画：from the circle's mouth to the seal.
  const rule = { path: [[SHEET.left - 8, SHEET.ruleY + 1], [SHEET.left + 150, SHEET.ruleY - 0.6], [W - 46, SHEET.ruleY + 0.4]], width: 2.4, press: 'rule', ink: 0.78, wet: 0.35, dry: 0.75, pace: 0.42, liberty: 'calm' };
  const ruleDur = stroke('rule', rule);
  t += Math.round(ruleDur * 0.35);
  t += write('title', script.title);
  t = Math.max(t, ruleDur);

  const inkBeats = () => {
    if (!script.ink) return;
    inkStrokes(script.ink, inkBox).forEach((def, i) => { t += Math.round((def.pause ?? (i === 0 ? 0 : 140)) * pace); t += stroke('ink', def); });
  };
  if (script.ink?.when === 'first') { t += Math.round(160 * pace); inkBeats(); }

  const rows = script.rows.map((row, index) => {
    const top = SHEET.top + index * SHEET.row;
    t += Math.round((row.pause ?? 150) * pace);
    const geom = { ...row, index, top };
    if (row.kind === 'text') t += write('text', row.text, { row: index });
    else if (row.kind === 'check') {
      const d = stroke('ring', ringDef(top), { row: index });
      const at = t; t += Math.round(d * 0.5); t += write('label', row.label, { row: index }); t = Math.max(t, at + d);
    } else if (row.kind === 'tally') {
      t += write('label', row.label, { row: index });
      geom.marksLeft = SHEET.left + textUnits(row.label) * SHEET.font + 14;
      geom.slots = Math.ceil((row.goal ?? 20) / 5);
      geom.countLeft = geom.marksLeft + Math.max(geom.slots * 21, 78) + 6;
      beats.push({ type: 'text', role: 'count', t, dur: 200, row: index, text: '' });
    } else if (row.kind === 'entry') {
      const d = stroke('underline', underlineDef(top), { row: index });
      beats.push({ type: 'text', role: 'placeholder', t: t + Math.round(d * 0.3), dur: 240, row: index, text: row.placeholder });
      t += d;
      geom.max = entryMax;
    }
    return geom;
  });

  const usable = t;
  if (script.ink && script.ink.when !== 'first') { t += Math.round(220 * pace); inkBeats(); }
  t += Math.round(180 * pace);
  beats.push({ type: 'seal', role: 'seal', t, dur: 260 });
  t += 260;
  return { width: W, height, pace, rows, beats, inkBox, seal, usable, total: t };
}

const ROLE = { rule: '一画', ring: '圈', underline: '横线', ink: '小画', title: '题目', label: '字', text: '字', count: '计数', placeholder: '提示', seal: '印位' };

/** The plan as lines a reader can check the rhythm by. */
export function describe(plan) {
  const lines = plan.beats.map((b) => `${(b.t / 1000).toFixed(2).padStart(5)}s  ${ROLE[b.role].padEnd(3, '　')} ${b.type === 'text' && b.text ? `「${b.text}」` : ''}${b.no ? `第 ${b.no} 笔 ` : ''}${b.type === 'stroke' ? `${(b.dur / 1000).toFixed(2)}s` : ''}${b.row !== undefined ? `  第 ${b.row + 1} 行` : ''}`);
  lines.push(`${(plan.usable / 1000).toFixed(2).padStart(5)}s  各行写完，可以用了`);
  lines.sort((a, b) => parseFloat(a) - parseFloat(b));
  lines.push(`${(plan.total / 1000).toFixed(2).padStart(5)}s  展开完毕（纸 ${plan.width} × ${plan.height}）`);
  return lines.join('\n');
}
