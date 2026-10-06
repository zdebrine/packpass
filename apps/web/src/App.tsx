import { Navigate, Route, Routes } from 'react-router-dom';

import { PRIVACY, SUPPORT, TERMS } from '@/content/legal';
import { Legal } from '@/pages/Legal';
import { Owners } from '@/pages/Owners';
import { Partners } from '@/pages/Partners';
import { Site, useHashScroll } from '@/Site';

/** The routes, shared by the browser entry (main.tsx) and the prerender (entry-server.tsx). */
export function App() {
  useHashScroll();
  return (
    <Routes>
      <Route element={<Site />}>
        <Route index element={<Owners />} />
        <Route path="partners" element={<Partners />} />
        <Route path="privacy" element={<Legal doc={PRIVACY} />} />
        <Route path="terms" element={<Legal doc={TERMS} />} />
        <Route path="support" element={<Legal doc={SUPPORT} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
