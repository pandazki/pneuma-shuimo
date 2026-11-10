#!/usr/bin/env node
/*
 * 截图：把一份脚本在播放器里写出来，拍成 PNG，供肉眼（或模型的眼睛）检查。
 *   node tools/shoot.mjs <script.json> [--out dir] [--mid 毫秒]
 * 输出到 <out>/：
 *   <id>.png       刚写完，还没用过
 *   <id>.used.png  用到一半：隔一行点掉一行，数到目标的六成，清单里有三条（第一条点掉），印已钤
 *   <id>.full.png  用满：全部点掉，数到目标，清单写满
 *   <id>.ink.png   小画单独放大六倍，红色虚线是画框（100 × 100）
 */
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { dirname, extname, join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate } from '../src/script.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png' };
const CHROMES = [process.env.CHROME, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium', '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean);

export function serve() {
  return new Promise((done) => {
    const server = createServer(async (req, res) => {
      try {
        const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
        const file = path.startsWith('/@abs/') ? '/' + path.slice(6) : join(root, path);
        const body = await readFile(file);
        res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
        res.end(body);
      } catch { res.writeHead(404); res.end('not found'); }
    });
    server.listen(0, '127.0.0.1', () => done({ server, base: `http://127.0.0.1:${server.address().port}` }));
  });
}

export function shoot(url, out, size = '560,460', budget = 4000, scale = 2) {
  const chrome = CHROMES.find((c) => existsSync(c));
  if (!chrome) throw new Error('没有找到 Chrome；用环境变量 CHROME 指明它的位置。');
  return new Promise((done, fail) => {
    execFile(chrome, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--force-device-scale-factor=${scale}`, `--window-size=${size}`, `--virtual-time-budget=${budget}`, `--screenshot=${out}`, url], { timeout: 60000 }, (err) => (err ? fail(err) : done(out)));
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const flag = (name) => { const i = args.indexOf(name); return i < 0 ? undefined : args.splice(i, 2)[1]; };
  const out = resolve(flag('--out') ?? 'shots');
  const rawUrl = flag('--url');
  const size = flag('--size');
  const budget = Number(flag('--budget') ?? 4000);
  const mid = flag('--mid');
  const files = args.filter((a) => !a.startsWith('--'));
  if (files.length === 0 && !rawUrl) { console.error('用法：node tools/shoot.mjs <script.json> [--out dir]'); process.exit(2); }
  await mkdir(out, { recursive: true });
  const { server, base } = await serve();
  try {
    if (rawUrl) console.log(await shoot(`${base}/${rawUrl}`, join(out, 'page.png'), size ?? '900,700', budget));
    for (const file of files) {
      const script = JSON.parse(await readFile(file, 'utf8'));
      const verdict = validate(script);
      if (!verdict.ok) { console.log(`✗ ${file} 没有通过校验，先运行 node tools/check.mjs ${file}`); process.exitCode = 1; continue; }
      const src = encodeURIComponent('/@abs' + resolve(file));
      const dim = size ?? `560,${verdict.plan.height + 90}`;
      const id = script.id;
      const page = `${base}/demo/stage.html?script=${src}&seed=7`;
      const say = async (name, url, d = dim, scale = 2) => console.log(relative(process.cwd(), await shoot(url, join(out, name), d, 4000, scale)));
      await say(`${id}.png`, `${page}&instant=1`);
      await say(`${id}.used.png`, `${page}&instant=1&face=used`);
      await say(`${id}.full.png`, `${page}&instant=1&face=full`);
      if (script.ink) await say(`${id}.ink.png`, `${page}&instant=1&ink=1`, '132,132', 6);
      // --mid 2000：展开到第 2000 毫秒时的样子，用来看先后顺序。
      if (mid) await say(`${id}.mid.png`, `${page}&at=${mid}`);
    }
  } finally { server.close(); }
}
