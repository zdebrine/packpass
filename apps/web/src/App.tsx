import { Navigate, Route, Routes } from 'react-router-dom';

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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
