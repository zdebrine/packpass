// Renders a route to HTML at build time, so link previews and search see the copy (scripts/prerender.mjs).
import { StrictMode } from 'react';
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom';

import { App } from '@/App';

export function render(url: string) {
  return renderToString(
    <StrictMode>
      <StaticRouter location={url}><App /></StaticRouter>
    </StrictMode>,
  );
}
