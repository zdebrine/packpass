// Serves a built app folder on a port, falling back to index.html for client-side routes.
// node serve.mjs <dir> <port>
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const [dir, port] = process.argv.slice(2);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webp': 'image/webp',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.txt': 'text/plain', '.xml': 'application/xml' };
const root = path.resolve(dir);

http.createServer((req, res) => {
  const clean = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let file = path.join(root, clean);
  if (!file.startsWith(root)) { res.writeHead(403); return res.end(); }
  // Prerendered pages (/privacy → privacy/index.html or privacy.html), then the SPA shell.
  const tries = [file, path.join(file, 'index.html'), `${file}.html`, path.join(root, 'index.html')];
  file = tries.find((f) => fs.existsSync(f) && fs.statSync(f).isFile());
  res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}).listen(Number(port), '127.0.0.1');
