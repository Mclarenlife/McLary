import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 4173);
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.avif':'image/avif','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2','.ttf':'font/ttf','.json':'application/json'};
http.createServer(async (req,res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const target = path.resolve(root, '.' + pathname);
    if (!target.startsWith(root + path.sep) && target !== root) { res.writeHead(403); return res.end(); }
    let file = target;
    if (pathname === '/' || /^\/about\/?$/.test(pathname) || /^\/cases\/[a-z-]+\/?$/.test(pathname)) file = path.join(root,'index.html');
    if (!(await stat(file)).isFile()) throw new Error('not file');
    res.writeHead(200, {'Content-Type':types[path.extname(file)] || 'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});
    res.end(await readFile(file));
  } catch { res.writeHead(404, {'Content-Type':'text/plain'}); res.end('Not found'); }
}).listen(port,'127.0.0.1', () => console.log(`Files archive: http://localhost:${port}`));
