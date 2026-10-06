// Renders a route to HTML at build time, so link previews and search see the copy (scripts/prerender.mjs).
import { StrictMode } from 'react';
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom';

import { App } from '@/App';
import { ContentProvider } from '@/content/context';
import type { SiteContent } from '@/content/defaults';

export { DEFAULT_CONTENT } from '@/content/defaults';
export { loadContent, SANITY_CONFIGURED } from '@/content/sanity';

export function render(url: string, content: SiteContent) {
  return renderToString(
    <StrictMode>
      <ContentProvider value={content}><StaticRouter location={url}><App /></StaticRouter></ContentProvider>
    </StrictMode>,
  );
}
