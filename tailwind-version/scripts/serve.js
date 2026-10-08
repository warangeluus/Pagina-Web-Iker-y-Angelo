import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
export function createStoreServer(basePath = '/') {
  return http.createServer(async (request, response) => {
    try {
      if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405); response.end(); return; }
      const incoming = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      if (!incoming.startsWith(basePath)) { response.writeHead(404); response.end(); return; }
      const pathname = '/' + incoming.slice(basePath.length);
      let file = path.resolve(root, '.' + pathname);
      if ((file !== root && !file.startsWith(root + path.sep)) || pathname.includes('node_modules') || pathname.split('/').some(p => p.startsWith('.'))) {
        response.writeHead(403); response.end(); return;
      }
      if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html');
      const data = await readFile(file);
      response.writeHead(200, { 'Content-Type': types[path.extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      response.end(request.method === 'HEAD' ? undefined : data);
    } catch { response.writeHead(404); response.end('Recurso no encontrado'); }
  });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  createStoreServer().listen(8000, '127.0.0.1', () => console.log('URBAN STYLE: http://127.0.0.1:8000'));
}
