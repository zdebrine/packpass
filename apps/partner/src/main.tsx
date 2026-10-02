import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';

import './styles.css';
import { PartnerProvider, useStaffSession } from '@/lib/partner';
import { Assessments } from '@/pages/Assessments';
import { Classes } from '@/pages/Classes';
import { Earnings } from '@/pages/Earnings';
import { Locations } from '@/pages/Locations';
import { NewClass } from '@/pages/NewClass';
import { Notes } from '@/pages/Notes';
import { Overview } from '@/pages/Overview';
import { Roster } from '@/pages/Roster';
import { Schedule } from '@/pages/Schedule';
import { Trainers } from '@/pages/Trainers';
import { Shell } from '@/Shell';
import { NotStaff, SignIn } from '@/SignIn';

function App() {
  const { status, reload } = useStaffSession();
  if (status.kind === 'loading') return null;
  if (status.kind === 'signed_out') return <SignIn />;
  if (status.kind === 'not_staff') return <NotStaff />;
  return (
    <PartnerProvider value={status} reload={reload}>
      <Routes>
        <Route element={<Shell />}>
          <Route index element={<Overview />} />
          <Route path="schedule" element={<Schedule />} />
          <Route path="classes" element={<Classes />} />
          <Route path="classes/new" element={<NewClass />} />
          <Route path="roster" element={<Roster />} />
          <Route path="notes" element={<Notes />} />
          <Route path="assessments" element={<Assessments />} />
          <Route path="locations" element={<Locations />} />
          <Route path="earnings" element={<Earnings />} />
          <Route path="trainers" element={<Trainers />} />
        </Route>
      </Routes>
    </PartnerProvider>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <div data-theme="light"><App /></div>
    </BrowserRouter>
  </StrictMode>,
);
