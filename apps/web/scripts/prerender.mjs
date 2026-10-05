// After `vite build` and the SSR build, render each route into its HTML file so the copy is in the page
// before any script runs. `/` goes into dist/index.html and `/partners` into dist/partners/index.html.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { render } = await import(pathToFileURL(resolve(root, 'dist-ssr/entry-server.js')).href);
const template = readFileSync(resolve(root, 'dist/index.html'), 'utf8');

const PAGES = [
  { url: '/', file: 'index.html', title: 'PackPass · Dog classes in Austin, matched to your dog' },
  { url: '/partners', file: 'partners/index.html', title: 'Partner with PackPass · Fill your empty spots' },
];

for (const { url, file, title } of PAGES) {
  const html = render(url);
  if (!template.includes('<div id="root"></div>')) throw new Error('dist/index.html has no empty #root');
  const out = template
    .replace('<div id="root"></div>', `<div id="root">${html}</div>`)
    .replace(/<title>.*?<\/title>/, `<title>${title}</title>`);
  mkdirSync(dirname(resolve(root, 'dist', file)), { recursive: true });
  writeFileSync(resolve(root, 'dist', file), out);
  console.log(`prerendered ${url} → dist/${file} (${Math.round(html.length / 1024)} KB)`);
}
rmSync(resolve(root, 'dist-ssr'), { recursive: true, force: true });
