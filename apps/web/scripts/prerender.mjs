// After `vite build` and the SSR build, render each route into its HTML file so the copy is in the page
// before any script runs. `/` goes into dist/index.html and `/partners` into dist/partners/index.html
// (likewise /privacy, /terms and /support).
// The copy comes from Sanity (src/content/sanity.ts), read once here; a publish in Sanity triggers a rebuild.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { render, loadContent, SANITY_CONFIGURED, DEFAULT_CONTENT } = await import(pathToFileURL(resolve(root, 'dist-ssr/entry-server.js')).href);
const template = readFileSync(resolve(root, 'dist/index.html'), 'utf8');
if (!template.includes('<div id="root"></div>')) throw new Error('dist/index.html has no empty #root');

let content;
try {
  content = await loadContent();
  console.log(SANITY_CONFIGURED ? 'content: Sanity' : 'content: defaults (no VITE_SANITY_PROJECT_ID)');
} catch (e) {
  // On Vercel a failed read fails the build, so the live site keeps its last good content instead of reverting
  // to the defaults. Local builds (no network, say) carry on with the defaults.
  if (process.env.VERCEL) throw e;
  console.warn(`content: defaults (Sanity not reachable: ${e.message})`);
  content = DEFAULT_CONTENT;
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// JSON inside <script>: escape "<" so copy can't close the tag.
const data = JSON.stringify(content).replace(/</g, '\\u003c');
const share = content.site.shareImage.src;

const PAGES = [
  { url: '/', file: 'index.html', title: content.site.ownerTitle },
  { url: '/partners', file: 'partners/index.html', title: content.site.partnerTitle },
  { url: '/privacy', file: 'privacy/index.html', title: 'Privacy policy · PackPass' },
  { url: '/terms', file: 'terms/index.html', title: 'Membership terms · PackPass' },
  { url: '/support', file: 'support/index.html', title: 'Support · PackPass' },
];

for (const { url, file, title } of PAGES) {
  const html = render(url, content);
  const out = template
    .replace('<div id="root"></div>', `<div id="root">${html}</div><script id="pp-content" type="application/json">${data}</script>`)
    .replace(/<title>.*?<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/(<meta name="description" content=")[^"]*/, `$1${esc(content.site.description)}`)
    .replace(/(<meta property="og:description" content=")[^"]*/, `$1${esc(content.site.description)}`)
    .replace(/(<meta property="og:image" content=")[^"]*/, `$1${esc(share)}`);
  mkdirSync(dirname(resolve(root, 'dist', file)), { recursive: true });
  writeFileSync(resolve(root, 'dist', file), out);
  console.log(`prerendered ${url} → dist/${file} (${Math.round(html.length / 1024)} KB)`);
}
rmSync(resolve(root, 'dist-ssr'), { recursive: true, force: true });
