import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import './styles.css';
import { Owners } from '@/pages/Owners';
import { Partners } from '@/pages/Partners';
import { Site, useHashScroll } from '@/Site';

function App() {
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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter><App /></BrowserRouter>
  </StrictMode>,
);
