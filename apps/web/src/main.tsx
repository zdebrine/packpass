import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import './styles.css';
import { App } from '@/App';
import { CONTENT_SCRIPT_ID, ContentProvider } from '@/content/context';
import { DEFAULT_CONTENT, type SiteContent } from '@/content/defaults';
import { loadContent } from '@/content/sanity';

const root = document.getElementById('root')!;
const app = (content: SiteContent) => (
  <StrictMode>
    <ContentProvider value={content}><BrowserRouter><App /></BrowserRouter></ContentProvider>
  </StrictMode>
);
// Built pages arrive prerendered with their content (scripts/prerender.mjs); the dev server sends an empty root
// and reads Sanity live, so a published edit shows on reload.
const baked = document.getElementById(CONTENT_SCRIPT_ID)?.textContent;
if (baked && root.hasChildNodes()) hydrateRoot(root, app(JSON.parse(baked) as SiteContent));
else {
  const r = createRoot(root);
  loadContent().catch((e) => { console.warn('Sanity content not loaded, using defaults', e); return DEFAULT_CONTENT; }).then((c) => r.render(app(c)));
}
