// Development server only: serves this entry's game/ folder at
// http://localhost:8080 so the game can be played and screenshotted in a
// desktop browser. Not part of the graded entry (the grader runs main.ts).

import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const root = join(here, 'game');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg' };

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost:8080');
  const path = url.pathname === '/' ? '/index.html' : url.pathname;
  const file = join(root, decodeURIComponent(path));
  if (!file.startsWith(root) || !existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found\n');
    return;
  }
  res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
});

server.listen(8080, () => {
  console.log('Starfall Salvage at http://localhost:8080');
});
