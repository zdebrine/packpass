import { createContext, useContext, type ReactNode } from 'react';

import { DEFAULT_CONTENT, type SiteContent } from './defaults';

const Ctx = createContext<SiteContent>(DEFAULT_CONTENT);

export const ContentProvider = ({ value, children }: { value: SiteContent; children: ReactNode }) => <Ctx.Provider value={value}>{children}</Ctx.Provider>;

/** The site's copy and photos (defaults overlaid with Sanity). */
export const useContent = () => useContext(Ctx);

/** Built pages carry their content in <script id="pp-content">, so hydration uses exactly what was prerendered. */
export const CONTENT_SCRIPT_ID = 'pp-content';
