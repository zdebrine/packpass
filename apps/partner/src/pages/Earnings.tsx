import { Landmark } from 'lucide-react';
import { useState } from 'react';

import { loadEarnings, loadEarningsByClass, type EarningsMonth } from '@/lib/api';
import { useData, usePartner } from '@/lib/partner';
import { money } from '@/lib/time';
import { Button, Modal, Tag } from '@/ui/kit';
import { Loading } from './Overview';

// Months come back as dates ("2026-09-01"); format them without shifting time zones.
const monthOf = (m: string, style: 'long' | 'short' = 'long') => new Date(`${m}T12:00:00Z`).toLocaleString('en-US', { month: style, timeZone: 'UTC' });
const nextFirst = (m: string) => { const d = new Date(`${m}T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() + 1); return d.toLocaleString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }); };

/** 07 Earnings: credits redeemed at the partner's rate, by month and by class, and how payouts reach the bank. */
export function Earnings() {
  const { partner } = usePartner();
  const { data } = useData(async () => ({ months: await loadEarnings(6), byClass: await loadEarningsByClass() }), []);
  const [setup, setSetup] = useState(false);
  if (!data) return <Loading />;
  const { months, byClass } = data;
  const [now, ...past] = months;
  const rate = money(partner.payout_rate_cents);
  const max = Math.max(1, ...months.map((m) => m.amount_cents));
  const held = past.filter((m) => m.amount_cents > 0).reduce((a, m) => a + m.amount_cents, 0);
  const connected = partner.payout_status === 'connected';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32, maxWidth: 1240 }}>
      <header style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <span className="pk-wide pk-muted">{`Earnings · ${monthOf(now.month)}`}</span>
        <h1 className="pk-display-2xl" style={{ margin: 0 }}>{money(now.amount_cents)}</h1>
        <span className="pk-label pk-muted">{`${now.credits} credit${now.credits === 1 ? '' : 's'} redeemed at ${rate} per credit so far. Rates are set by PackPass.`}</span>
      </header>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 32, alignItems: 'flex-start' }}>
        <div style={{ flex: '999 1 520px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 32 }}>
          <section className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
            <h2 className="pk-title" style={{ margin: 0 }}>By month</h2>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${months.length},minmax(0,1fr))`, gap: 16, alignItems: 'end', height: 200 }}>
              {[...months].reverse().map((m) => (
                <div key={m.month} style={{ display: 'flex', flexDirection: 'column', gap: 8, justifyContent: 'flex-end', height: '100%' }}>
                  <span className="pk-label" style={{ fontWeight: 600 }}>{money(m.amount_cents)}</span>
                  <span style={{ display: 'block', height: `${Math.max(4, (m.amount_cents / max) * 120)}px`, borderRadius: 12, background: m === now || !m.amount_cents ? 'var(--surface-sunken)' : 'var(--inverse)' }} />
                  <span className="pk-caption pk-muted">{m === now ? `${monthOf(m.month, 'short')} so far` : monthOf(m.month, 'short')}</span>
                </div>
              ))}
            </div>
          </section>
          <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h2 className="pk-title" style={{ margin: 0 }}>{`By class · ${monthOf(now.month)}`}</h2>
            {byClass.length ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2fr) repeat(3,minmax(0,1fr))', gap: 12, padding: '0 20px' }}>
                  <span className="pk-caption pk-muted">Class</span><span className="pk-caption pk-muted" style={{ textAlign: 'right' }}>Dogs</span>
                  <span className="pk-caption pk-muted" style={{ textAlign: 'right' }}>Credits</span><span className="pk-caption pk-muted" style={{ textAlign: 'right' }}>Earned</span>
                </div>
                {byClass.map((c) => (
                  <div key={c.class_id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2fr) repeat(3,minmax(0,1fr))', gap: 12, padding: '14px 20px', borderRadius: 20, background: 'var(--surface-raised)', alignItems: 'center' }}>
                    <span className="pk-label" style={{ fontWeight: 600 }}>{c.title}</span>
                    <span className="pk-label" style={{ textAlign: 'right' }}>{c.dogs}</span>
                    <span className="pk-label" style={{ textAlign: 'right' }}>{c.credits}</span>
                    <span className="pk-label" style={{ textAlign: 'right', fontWeight: 600 }}>{money(c.amount_cents)}</span>
                  </div>
                ))}
              </>
            ) : <span className="pk-label pk-muted">No sessions have run this month yet.</span>}
          </section>
        </div>

        <aside style={{ flex: '1 1 300px', maxWidth: 420, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ background: 'var(--pitch)', color: 'var(--on-pitch)', borderRadius: 28, padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <span className="pk-wide" style={{ color: 'var(--on-pitch-muted)' }}>{`Next payout · ${nextFirst(now.month)}`}</span>
            <span className="pk-display-xl">{money(now.amount_cents + (connected ? 0 : held))}</span>
            <span className="pk-label" style={{ color: 'var(--on-pitch-muted)' }}>
              {connected ? `${monthOf(now.month)} so far. Paid monthly on the 1st.` : held ? `${monthOf(now.month)} so far, plus ${money(held)} held until payouts are set up.` : `${monthOf(now.month)} so far. Paid once payouts are set up.`}
            </span>
          </div>
          <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <h2 className="pk-title" style={{ margin: 0 }}>Payout method</h2>
              {partner.payout_status === 'pending' ? <Tag tone="warning">Verifying</Tag> : null}
            </div>
            {connected ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <span style={{ width: 44, height: 44, flex: 'none', borderRadius: 9999, background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Landmark size={20} /></span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}><span className="pk-label" style={{ fontWeight: 600 }}>Bank account on file</span><span className="pk-caption pk-muted">Through Stripe · Monthly on the 1st</span></div>
              </div>
            ) : partner.payout_status === 'pending' ? (
              <p className="pk-label" style={{ margin: 0, textWrap: 'pretty' }}>Stripe is checking your details. This usually takes one business day. You'll get an email when payouts are on.</p>
            ) : (
              <>
                <p className="pk-label" style={{ margin: 0, textWrap: 'pretty' }}>Add a bank account through Stripe to get paid. Earnings are held until then.</p>
                <Button block onClick={() => setSetup(true)}>Set up payouts</Button>
              </>
            )}
          </div>
          <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h2 className="pk-title" style={{ margin: 0 }}>Past months</h2>
            {past.some((m) => m.dogs) ? null : <span className="pk-label pk-muted">{`Nothing before ${monthOf(now.month)} yet.`}</span>}
            {past.filter((m) => m.dogs).map((m) => (
              <div key={m.month} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', borderRadius: 20, background: 'var(--surface-raised)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span className="pk-label" style={{ fontWeight: 600 }}>{monthOf(m.month)}</span>
                  <span className="pk-caption pk-muted">{`${m.sessions} session${m.sessions === 1 ? '' : 's'} · ${m.dogs} dog${m.dogs === 1 ? '' : 's'} · ${m.credits} credits`}</span>
                </div>
                <span className="pk-label" style={{ fontWeight: 600 }}>{money(m.amount_cents)}</span>
              </div>
            ))}
          </section>
          <Button variant="quiet" block onClick={() => download(months, partner.name, partner.payout_rate_cents)}>Download statement</Button>
        </aside>
      </div>

      {setup ? (
        <Modal eyebrow="Payouts" title="Get paid through Stripe" width={560} onClose={() => setSetup(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p className="pk-body" style={{ margin: 0, textWrap: 'pretty' }}>PackPass pays partners through Stripe on the 1st of each month, for every credit redeemed the month before. Stripe asks for your business details and a bank account, and checks them in about a business day.</p>
            <p className="pk-body pk-muted" style={{ margin: 0, textWrap: 'pretty' }}>Stripe setup isn't open yet. Your earnings are recorded and held, and you'll get an email when you can connect your account.</p>
            <Button onClick={() => setSetup(false)}>Got it</Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

/** A CSV of the months shown, for the partner's books. */
function download(months: EarningsMonth[], name: string, rateCents: number) {
  const rows = [['Month', 'Sessions', 'Dogs', 'Credits', 'Rate', 'Earned'], ...months.map((m) => [m.month.slice(0, 7), m.sessions, m.dogs, m.credits, (rateCents / 100).toFixed(2), (m.amount_cents / 100).toFixed(2)])];
  const url = URL.createObjectURL(new Blob([rows.map((r) => r.join(',')).join('\n')], { type: 'text/csv' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: `${name} PackPass earnings.csv` });
  a.click();
  URL.revokeObjectURL(url);
}
