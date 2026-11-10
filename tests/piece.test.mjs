import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { validatePiece, composePiece } from '../src/piece.js';

const dir = new URL('../pieces/', import.meta.url);
const load = (name) => JSON.parse(readFileSync(new URL(name, dir), 'utf8'));
for (const name of readdirSync(dir).filter((n) => n.endsWith('.json'))) {
  test(`小品 ${name} 通过校验`, () => assert.deepEqual(validatePiece(load(name)).errors, []));
}
const base = () => ({ id: 'a', name: '试', idea: 'x', occasion: 'hover', circle: 'keep', strokes: [{ path: [[50, 20], [70, 0]], width: 5, fleeting: 300 }] });
const refused = (patch, word) => test(`拒绝：${word}`, () => {
  const r = validatePiece({ ...base(), ...patch });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes(word)), r.errors.join('\n'));
});
refused({ occasion: 'click' }, 'occasion');
refused({ circle: 'spin' }, 'circle');
refused({ rotate: 90 }, '不认识的字段');
refused({ strokes: [{ path: [[50, 20], [260, 0]], width: 5 }] }, '出了纸');
refused({ strokes: [{ path: [[50, 20], [70, 0]], width: 5, replaces: 0 }] }, 'replaces');
refused({ strokes: Array.from({ length: 12 }, (_, i) => ({ path: [[10, 10 + i], [90, 10 + i]], width: 4, pause: 2500 })) }, '最多');
refused({ answer: [{ path: [[1, 1], [9, 9]], width: 4 }] }, '只有闲时');
test('moved 让此前的墨在那一刻干去', () => {
  const plan = composePiece(load('sparrow.json'));
  const mover = plan.inks.find((i) => i.def.moved);
  for (const ink of plan.inks.slice(0, plan.inks.indexOf(mover))) assert.ok(ink.dryAt <= mover.t0);
});
test('每一笔最后都会干去：结束时只剩圆', () => {
  for (const name of readdirSync(dir).filter((n) => n.endsWith('.json'))) {
    const plan = composePiece(load(name));
    for (const ink of plan.inks) assert.ok(ink.dryAt !== null && ink.dryAt + ink.dryDur <= plan.total + 1, name);
  }
});
test('静止的画会被提醒', () => {
  const r = validatePiece({ ...base(), strokes: [{ path: [[50, 20], [70, 0]], width: 5 }] });
  assert.ok(r.warnings.some((w) => w.includes('静止')));
});
