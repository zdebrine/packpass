import { Download, Landmark } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { loadEarnings, loadEarningsByClass, stripeConnect, type EarningsMonth } from '@/lib/api';
import { useData, usePartner } from '@/lib/partner';
import { money } from '@/lib/time';
import { Badge, Button, ErrorLine, Ico, Modal, Page, PageHead, StatGroup } from '@/ui/kit';
import { Loading } from './Overview';

// Months come back as dates ("2026-09-01"); format them without shifting time zones.
const monthOf = (m: string, style: 'long' | 'short' = 'long') => new Date(`${m}T12:00:00Z`).toLocaleString('en-US', { month: style, timeZone: 'UTC' });
const nextFirst = (m: string) => { const d = new Date(`${m}T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() + 1); return d.toLocaleString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }); };

/** 07 Earnings: credits redeemed at the partner's rate, by month and by class, and how payouts reach the bank. */
export function Earnings() {
  const { partner, reloadCatalog } = usePartner();
  const { data } = useData(async () => ({ months: await loadEarnings(6), byClass: await loadEarningsByClass() }), []);
  const [setup, setSetup] = useState(false);
  const [busy, setBusy] = useState(false);
  const [stripeError, setStripeError] = useState('');
  const [params] = useSearchParams();
  const navigate = useNavigate();
  // Back from Stripe's onboarding (?stripe=return, or ?stripe=retry when its link expired): read the account's status.
  const back = params.get('stripe');
  useEffect(() => {
    if (!back) return;
    navigate('/earnings', { replace: true });
    if (back === 'retry') { setSetup(true); return; }
    stripeConnect('refresh').then(() => reloadCatalog()).catch(() => setStripeError('Couldn’t check your Stripe account. Refresh the page to try again.'));
  }, [back, navigate, reloadCatalog]);
  // Verifying: Stripe may have turned payouts on since the last visit.
  const verifying = partner.payout_status === 'pending';
  useEffect(() => {
    if (verifying && !back) stripeConnect('refresh').then((r) => { if (r.status !== 'pending') reloadCatalog(); }).catch(() => {});
  }, [verifying, back, reloadCatalog]);
  const openStripe = async (action: 'onboard' | 'dashboard') => {
    setBusy(true); setStripeError('');
    try {
      const { url } = await stripeConnect(action);
      if (url) window.location.assign(url);
    } catch {
      setStripeError('Stripe didn’t open. Try again in a minute.');
      setBusy(false);
    }
  };
  if (!data) return <Loading />;
  const { months, byClass } = data;
  const [now, ...past] = months;
  const rate = money(partner.payout_rate_cents);
  const max = Math.max(1, ...months.map((m) => m.amount_cents));
  const held = past.filter((m) => m.amount_cents > 0).reduce((a, m) => a + m.amount_cents, 0);
  const connected = partner.payout_status === 'connected';

  const payout = money(now.amount_cents + (connected ? 0 : held));

  return (
    <Page>
      <PageHead title="Earnings" sub={`${monthOf(now.month)} · ${now.credits} credit${now.credits === 1 ? '' : 's'} redeemed at ${rate} per credit so far. Rates are set by PackPass.`}>
        <Button variant="outline" icon={Download} onClick={() => download(months, partner.name, partner.payout_rate_cents)}>Download statement</Button>
      </PageHead>
      <StatGroup columns={3} stats={[
        { label: `Earned in ${monthOf(now.month)}`, value: money(now.amount_cents), caption: `${now.credits} credits at ${rate} per credit` },
        { label: 'Next payout', value: nextFirst(now.month), caption: connected ? `${payout} · Paid monthly on the 1st` : held ? `${payout} · ${money(held)} held until payouts are set up` : `${payout} · Paid once payouts are set up` },
        { label: 'Dogs this month', value: String(now.dogs), caption: `${now.sessions} session${now.sessions === 1 ? '' : 's'} so far` },
      ]} />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'flex-start' }}>
        <div style={{ flex: '999 1 480px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 24 }}>
          <section className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h2 className="pp-title">By month</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ height: 180, display: 'grid', gridTemplateColumns: `repeat(${months.length},minmax(0,1fr))`, gap: 24, alignItems: 'end', padding: '0 12px', boxSizing: 'border-box', boxShadow: 'inset 0 -1px 0 var(--line-strong)' }}>
                {[...months].reverse().map((m) => (
                  <div key={m.month} style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', gap: 6 }}>
                    <span className="pp-label pp-num">{money(m.amount_cents)}</span>
                    <span style={{ display: 'block', width: '100%', maxWidth: 72, height: `${Math.max(2, (m.amount_cents / max) * 130)}px`, borderRadius: '6px 6px 0 0', background: m === now || !m.amount_cents ? 'var(--surface-sunken)' : 'var(--turf)' }} />
                  </div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${months.length},minmax(0,1fr))`, gap: 24, padding: '0 12px' }}>
                {[...months].reverse().map((m) => <span key={m.month} className="pp-caption pp-muted" style={{ textAlign: 'center' }}>{m === now ? `${monthOf(m.month, 'short')} so far` : monthOf(m.month, 'short')}</span>)}
              </div>
            </div>
          </section>
          <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <h2 className="pp-title">{`By class · ${monthOf(now.month)}`}</h2>
            {byClass.length ? (
              <div className="tbl">
                <div className="tbl-head" style={{ gridTemplateColumns: BY_CLASS }}>
                  <span>Class</span><span className="r">Dogs</span><span className="r">Credits</span><span className="r">Earned</span>
                </div>
                {byClass.map((c) => (
                  <div key={c.class_id} className="tbl-row" style={{ gridTemplateColumns: BY_CLASS, minHeight: 44 }}>
                    <span className="pp-heading ellipsis">{c.title}</span>
                    <span className="pp-body pp-num r">{c.dogs}</span>
                    <span className="pp-body pp-num r">{c.credits}</span>
                    <span className="pp-label pp-num r">{money(c.amount_cents)}</span>
                  </div>
                ))}
              </div>
            ) : <span className="pp-label pp-muted">No sessions have run this month yet.</span>}
          </section>
        </div>

        <aside style={{ flex: '1 1 280px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 24 }}>
          <section className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <h2 className="pp-title" style={{ whiteSpace: 'nowrap' }}>Payout method</h2>
              {partner.payout_status === 'pending' ? <Badge tone="warning">Verifying</Badge> : null}
            </div>
            {connected ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ width: 32, height: 32, flex: 'none', borderRadius: 8, background: 'var(--surface-raised)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Ico icon={Landmark} /></span>
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}><span className="pp-label">Bank account on file</span><span className="pp-caption pp-muted">Through Stripe · Monthly on the 1st</span></div>
                </div>
                <Button variant="outline" block disabled={busy} onClick={() => openStripe('dashboard')}>Open Stripe</Button>
              </>
            ) : partner.payout_status === 'pending' ? (
              <>
                <p className="pp-body" style={{ textWrap: 'pretty' }}>Stripe is checking your details. This usually takes one business day. You'll get an email when payouts are on.</p>
                <Button variant="outline" block disabled={busy} onClick={() => openStripe('onboard')}>Review details in Stripe</Button>
              </>
            ) : (
              <>
                <p className="pp-body" style={{ textWrap: 'pretty' }}>Add a bank account through Stripe to get paid. Earnings are held until then.</p>
                <Button block onClick={() => setSetup(true)}>Set up payouts</Button>
              </>
            )}
          </section>
          {setup ? null : <ErrorLine>{stripeError}</ErrorLine>}
          <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <h2 className="pp-title">Past months</h2>
            {past.some((m) => m.dogs) ? (
              <div className="tbl">
                <div className="tbl-head" style={{ gridTemplateColumns: PAST }}><span>Month</span><span>Period</span><span className="r">Amount</span></div>
                {past.filter((m) => m.dogs).map((m) => (
                  <div key={m.month} className="tbl-row" style={{ gridTemplateColumns: PAST, minHeight: 44 }}>
                    <span className="pp-label">{monthOf(m.month, 'short')}</span>
                    <span className="pp-caption pp-muted ellipsis">{`${m.sessions} session${m.sessions === 1 ? '' : 's'} · ${m.dogs} dog${m.dogs === 1 ? '' : 's'} · ${m.credits} credits`}</span>
                    <span className="pp-label pp-num r">{money(m.amount_cents)}</span>
                  </div>
                ))}
              </div>
            ) : <span className="pp-label pp-muted">{`Nothing before ${monthOf(now.month)} yet.`}</span>}
          </section>
        </aside>
      </div>

      {setup ? (
        <Modal eyebrow="Payouts · Stripe Connect" title="Get paid through Stripe" width={480} onClose={() => setSetup(false)}
          footer={<><ErrorLine>{stripeError}</ErrorLine><Button variant="outline" onClick={() => setSetup(false)}>Not now</Button><Button disabled={busy} onClick={() => openStripe('onboard')}>{busy ? 'Opening Stripe…' : 'Continue to Stripe'}</Button></>}>
          <p className="pp-body" style={{ textWrap: 'pretty' }}>PackPass pays partners through Stripe on the 1st of each month, for every credit redeemed the month before. Stripe asks for your business details and a bank account, and checks them in about a business day.</p>
          <p className="pp-caption pp-muted" style={{ margin: 0, textWrap: 'pretty' }}>Your bank and tax details go to Stripe, not PackPass. Earnings so far stay held until Stripe turns payouts on.</p>
        </Modal>
      ) : null}
    </Page>
  );
}

const BY_CLASS = 'minmax(0,2fr) repeat(3,minmax(0,1fr))';
const PAST = '48px minmax(0,1fr) 80px';

/** A CSV of the months shown, for the partner's books. */
function download(months: EarningsMonth[], name: string, rateCents: number) {
  const rows = [['Month', 'Sessions', 'Dogs', 'Credits', 'Rate', 'Earned'], ...months.map((m) => [m.month.slice(0, 7), m.sessions, m.dogs, m.credits, (rateCents / 100).toFixed(2), (m.amount_cents / 100).toFixed(2)])];
  const url = URL.createObjectURL(new Blob([rows.map((r) => r.join(',')).join('\n')], { type: 'text/csv' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: `${name} PackPass earnings.csv` });
  a.click();
  URL.revokeObjectURL(url);
}
