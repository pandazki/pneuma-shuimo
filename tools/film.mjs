#!/usr/bin/env node
/*
 * 连续画面：把一幅小品拍成十格（同一段表演的十个时刻），供肉眼（或模型的眼睛）检查它是怎么动的。
 *   node tools/film.mjs <piece.json> [...] [--out dir] [--at 毫秒]
 * 先校验；通过时打印时间表，然后输出到 <out>/：
 *   <id>.film.png    每写完一笔拍一格，再加停着、正在收、结束三格
 *   <id>.still.png   一个时刻放大三倍，旁边是实际大小；默认是刚写完的那一刻，--at 可以指定别的时刻
 *   <id>.answer.png  有 "answer" 时：指针来之前一格，回应的过程九格
 * film 和 answer 的每一格是整张纸（-100 到 200），红色虚线是头像自己的方框（0 到 100）。
 */
import { readFile, mkdir } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { validatePiece, describePiece, filmMoments } from '../src/piece.js';
import { serve, shoot } from './shoot.mjs';

const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(name); return i < 0 ? undefined : args.splice(i, 2)[1]; };
const out = resolve(flag('--out') ?? 'shots');
const at = flag('--at');
if (args.length === 0) { console.error('用法：node tools/film.mjs <piece.json> [...] [--out dir]'); process.exit(2); }
await mkdir(out, { recursive: true });
const { server, base } = await serve();
let refused = false;
try {
  for (const file of args) {
    let piece;
    try { piece = JSON.parse(await readFile(file, 'utf8')); } catch (e) { console.log(`✗ ${file}\n  不是合法的 JSON：${e.message}`); refused = true; continue; }
    const v = validatePiece(piece);
    if (!v.ok) { refused = true; console.log(`✗ ${file} 被拒（${v.errors.length} 处）`); for (const e of v.errors) console.log(`  错：${e}`); }
    else {
      console.log(`✓ ${file} 通过（${piece.occasion === 'hover' ? '指针下' : '闲时'}）`);
      console.log(describePiece(v.plan).split('\n').map((l) => `  ${l}`).join('\n'));
    }
    for (const w of v.warnings) console.log(`  提醒：${w}`);
    if (!v.ok) continue;
    const src = encodeURIComponent('/@abs' + resolve(file));
    const rows = Math.ceil(filmMoments(v.plan).length / 5);
    console.log('  ' + relative(process.cwd(), await shoot(`${base}/demo/film.html?piece=${src}`, join(out, `${piece.id}.film.png`), `1212,${12 + rows * 262}`)));
    console.log('  ' + relative(process.cwd(), await shoot(`${base}/demo/film.html?piece=${src}&still=1${at ? `&t=${at}` : ''}`, join(out, `${piece.id}.still.png`), '860,700')));
    if (piece.answer) console.log('  ' + relative(process.cwd(), await shoot(`${base}/demo/film.html?piece=${src}&answer=1`, join(out, `${piece.id}.answer.png`), '1212,536')));
  }
} finally { server.close(); }
process.exit(refused ? 1 : 0);
