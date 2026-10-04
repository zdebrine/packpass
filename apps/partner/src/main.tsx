import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import './styles.css';
import { AdminShell } from '@/admin/AdminNav';
import { Partners as AdminPartners } from '@/admin/Partners';
import { Review } from '@/admin/Review';
import { Staff as AdminStaff } from '@/admin/Staff';
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
import { Team } from '@/pages/Team';
import { Trainers } from '@/pages/Trainers';
import { Shell } from '@/Shell';
import { NotStaff, SignIn } from '@/SignIn';

const adminRoutes = (
  <>
    <Route path="admin" element={<Review />} />
    <Route path="admin/partners" element={<AdminPartners />} />
    <Route path="admin/staff" element={<AdminStaff />} />
  </>
);

function App() {
  const { status, reload } = useStaffSession();
  if (status.kind === 'loading') return null;
  if (status.kind === 'signed_out') return <SignIn />;
  if (status.kind === 'not_staff') return <NotStaff />;
  if (status.kind === 'admin_only') {
    return (
      <Routes>
        <Route element={<AdminShell />}>
          {adminRoutes}
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Route>
      </Routes>
    );
  }
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
          {status.staff.role === 'owner' ? <Route path="earnings" element={<Earnings />} /> : null}
          <Route path="trainers" element={<Trainers />} />
          {status.staff.role === 'owner' ? <Route path="team" element={<Team />} /> : null}
          <Route path="*" element={<Navigate to="/" replace />} />
          {status.admin ? adminRoutes : null}
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
