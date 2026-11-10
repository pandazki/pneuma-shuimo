import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { validate } from '../src/script.js';

const dir = new URL('../examples/', import.meta.url);
for (const name of readdirSync(dir).filter((n) => n.endsWith('.json'))) {
  test(`示例 ${name} 通过校验`, () => {
    const r = validate(JSON.parse(readFileSync(new URL(name, dir), 'utf8')));
    assert.deepEqual(r.errors, []);
  });
}
const base = () => ({ id: 'a', title: '饮水', intent: 'x', rows: [{ kind: 'check', key: 'a', label: '好' }], ink: { motif: 'moon' } });
const refused = (patch, word) => test(`拒绝：${word}`, () => {
  const r = validate({ ...base(), ...patch });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes(word)), r.errors.join('\n'));
});
refused({ title: '今天喝了多少杯水的记录表' }, '字宽');
refused({ title: '饮水💧' }, '表情');
refused({ rows: [] }, '至少');
refused({ rows: [{ kind: 'slider', key: 'a' }] }, 'kind');
refused({ rows: [{ kind: 'entry', key: 'a', placeholder: '写' }, { kind: 'text', text: '后' }] }, '最后一行');
refused({ rows: [{ kind: 'check', key: 'a', label: '一' }, { kind: 'check', key: 'a', label: '二' }] }, '重复');
refused({ ink: { motif: 'dragon' } }, '母题');
refused({ ink: { strokes: [{ path: [[10, 10], [120, 10]], width: 2 }] } }, '画框');
refused({ onClick: 'alert(1)' }, '不认识的字段');
refused({ ink: { motif: 'orchid', when: 'first' }, rows: Array.from({ length: 6 }, (_, i) => ({ kind: 'check', key: `k${i}`, label: '读书二十分钟再休息', pause: 900 })) }, '等着用');
test('一种墨色会被提醒', () => {
  const r = validate({ ...base(), ink: { strokes: [1, 2, 3].map((i) => ({ path: [[60, 20 * i], [90, 20 * i + 8]], width: 3, ink: 0.9 })) } });
  assert.equal(r.ok, true);
  assert.ok(r.warnings.some((w) => w.includes('墨分五色')));
});
