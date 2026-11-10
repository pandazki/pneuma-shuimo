#!/usr/bin/env node
/* 本地看：node tools/serve.mjs [端口]，然后打开 http://127.0.0.1:4173/demo/ */
import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png' };
const port = Number(process.argv[2] ?? process.env.PORT ?? 4173);
createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (path === '/') { res.writeHead(302, { location: '/demo/' }); res.end(); return; }
    if (path === '/scripts.json') {
      const list = [];
      for (const dir of ['examples', 'trials/sheets']) for (const f of (await readdir(join(root, dir)).catch(() => [])).filter((n) => n.endsWith('.json')).sort()) list.push(`/${dir}/${f}`);
      res.writeHead(200, { 'content-type': TYPES['.json'], 'cache-control': 'no-store' }); res.end(JSON.stringify(list)); return;
    }
    if (path === '/pieces.json') {
      const list = [];
      for (const dir of ['pieces', 'trials/pieces']) for (const f of (await readdir(join(root, dir)).catch(() => [])).filter((n) => n.endsWith('.json')).sort()) list.push(`/${dir}/${f}`);
      res.writeHead(200, { 'content-type': TYPES['.json'], 'cache-control': 'no-store' }); res.end(JSON.stringify(list)); return;
    }
    if (path.endsWith('/')) path += 'index.html';
    const file = join(root, path);
    if (!file.startsWith(root)) throw new Error('outside');
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(body);
  } catch { if (!res.headersSent) res.writeHead(404); res.end('not found'); }
}).listen(port, '127.0.0.1', () => console.log(`墨 → http://127.0.0.1:${port}/demo/`));
