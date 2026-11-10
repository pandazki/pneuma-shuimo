#!/usr/bin/env node
/*
 * 校验：node tools/check.mjs <script.json> [...]
 * 通过时打印时间表（什么时候写什么）和提醒；不通过时逐条说明哪里错、怎么改。退出码：0 通过，1 被拒。
 */
import { readFile } from 'node:fs/promises';
import { validate } from '../src/script.js';
import { describe } from '../src/layout.js';

const files = process.argv.slice(2);
if (files.length === 0) { console.error('用法：node tools/check.mjs <script.json> [...]'); process.exit(2); }
let refused = false;
for (const file of files) {
  let script;
  try { script = JSON.parse(await readFile(file, 'utf8')); }
  catch (e) { console.log(`✗ ${file}\n  不是合法的 JSON：${e.message}`); refused = true; continue; }
  const result = validate(script);
  if (!result.ok) {
    refused = true;
    console.log(`✗ ${file} 被拒（${result.errors.length} 处）`);
    for (const e of result.errors) console.log(`  错：${e}`);
  } else {
    console.log(`✓ ${file} 通过`);
    console.log(describe(result.plan).split('\n').map((l) => `  ${l}`).join('\n'));
  }
  for (const w of result.warnings) console.log(`  提醒：${w}`);
}
process.exit(refused ? 1 : 0);
