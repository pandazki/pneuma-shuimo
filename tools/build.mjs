#!/usr/bin/env node
/*
 * 把演示打成一份静态站点：node tools/build.mjs [输出目录，默认 dist]
 * 本地的 serve.mjs 会现列 /scripts.json 和 /pieces.json；这里把这两份清单写成文件，其余原样拷过去。
 */
import { cp, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(process.argv[2] ?? 'dist');
const list = async (dirs) => {
  const found = [];
  for (const dir of dirs) for (const f of (await readdir(join(root, dir)).catch(() => [])).filter((n) => n.endsWith('.json')).sort()) found.push(`/${dir}/${f}`);
  return found;
};
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
for (const dir of ['demo', 'src', 'examples', 'pieces', 'trials']) await cp(join(root, dir), join(out, dir), { recursive: true });
await writeFile(join(out, 'scripts.json'), JSON.stringify(await list(['examples', 'trials/sheets'])));
await writeFile(join(out, 'pieces.json'), JSON.stringify(await list(['pieces', 'trials/pieces'])));
await writeFile(join(out, 'index.html'), '<!doctype html><meta charset="utf-8"><title>墨</title><meta http-equiv="refresh" content="0;url=/demo/"><a href="/demo/">墨</a>\n');
console.log(`墨 → ${out}`);
