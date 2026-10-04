import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { isAdmin, loadClasses, loadStaff, loadTrainers, type ClassType, type Partner, type Staff, type Trainer } from './api';
import { db } from './supabase';

interface PartnerState {
  staff: Staff;
  partner: Partner;
  classes: ClassType[];
  trainers: Trainer[];
  classById: (id: string) => ClassType | undefined;
  trainerName: (id?: string | null) => string;
  /** More than one trainer: show trainer names (the prototype's "gym" view). */
  gym: boolean;
  /** A PackPass admin too: the sidebar adds the PackPass section. */
  admin: boolean;
  reloadCatalog: () => Promise<void>;
}

const Ctx = createContext<PartnerState | null>(null);
export const usePartner = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error('usePartner outside PartnerProvider');
  return v;
};

type Status =
  | { kind: 'loading' } | { kind: 'signed_out' } | { kind: 'not_staff' }
  /** A PackPass admin who isn't staff at a partner: only the admin pages. */
  | { kind: 'admin_only' }
  | { kind: 'ready'; staff: Staff; partner: Partner; classes: ClassType[]; trainers: Trainer[]; admin: boolean };

/** Loads the signed-in staff member's partner, and re-loads when the session changes. */
export function useStaffSession() {
  const [status, setStatus] = useState<Status>({ kind: 'loading' });
  const load = useCallback(async () => {
    const r = await loadStaff().catch(() => null);
    const { data } = await db.auth.getSession();
    if (!data.session) return setStatus({ kind: 'signed_out' });
    const admin = await isAdmin().catch(() => false);
    if (!r) return setStatus({ kind: admin ? 'admin_only' : 'not_staff' });
    const [classes, trainers] = await Promise.all([loadClasses(r.partner.id), loadTrainers(r.partner.id)]);
    setStatus({ kind: 'ready', ...r, classes, trainers, admin });
  }, []);
  useEffect(() => {
    load();
    // USER_UPDATED: a reset or invite code signs in as PASSWORD_RECOVERY, then saving the password updates the
    // user. load runs outside the callback, since Supabase calls made inside it wait on the auth lock.
    const { data } = db.auth.onAuthStateChange((e) => {
      if (e === 'SIGNED_IN' || e === 'SIGNED_OUT' || e === 'USER_UPDATED') setTimeout(load, 0);
    });
    return () => data.subscription.unsubscribe();
  }, [load]);
  return { status, reload: load };
}

export function PartnerProvider({ value, reload, children }: { value: Extract<Status, { kind: 'ready' }>; reload: () => Promise<void>; children: ReactNode }) {
  const state: PartnerState = {
    staff: value.staff, partner: value.partner, classes: value.classes, trainers: value.trainers,
    classById: (id) => value.classes.find((c) => c.id === id),
    trainerName: (id) => value.trainers.find((t) => t.id === id)?.name ?? '',
    gym: value.trainers.length > 1,
    admin: value.admin,
    reloadCatalog: reload,
  };
  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}

/** Fetches with a reload function; keeps the last data while reloading. */
export function useData<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    fn().then((d) => { if (live) { setData(d); setError(null); } }).catch((e) => live && setError(e instanceof Error ? e.message : String(e)));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return { data, error, reload: () => setTick((t) => t + 1) };
}
