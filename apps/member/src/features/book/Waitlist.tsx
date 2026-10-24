import { useState } from 'react';

import { errorCopy } from '@/api/errors';
import { Button } from '@/ds/controls';
import { Text } from '@/ds/Text';
import { credits as creditsLabel, type SessionView } from '@/lib/booking';
import { now } from '@/lib/clock';
import { dayTimeInline, time } from '@/lib/dates';
import { useApp } from '@/store/app';
import { useTheme } from '@/theme/ThemeProvider';

const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;

/**
 * Footer actions for a full session: join, or see your place and leave. A spot that opens is booked
 * for the first dog in line until 12 hours before the start (so it can still be cancelled for free);
 * after that, PackPass holds it for the first dog in line for 2 hours to accept or pass (Scheduling flow,
 * notif-waitlist). With auto-promote off, everyone waiting is told and the first to book gets it.
 * onAccept books an offered spot (the booking sheet passes its own confirm).
 */
export function WaitlistActions({ v, dogId, dogName, center = true, fill, onAccept }: {
  v: SessionView; dogId: string; dogName: string; center?: boolean; fill?: string; onAccept?: () => Promise<void>;
}) {
  const { c } = useTheme();
  const entry = useApp((s) => s.waitlist.find((w) => w.sessionId === v.session.id && w.dogId === dogId));
  const join = useApp((s) => s.joinWaitlist);
  const leave = useApp((s) => s.leaveWaitlist);
  const book = useApp((s) => s.bookSession);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deadline = new Date(v.session.startsAt.getTime() - 12 * 3_600_000);
  const auto = deadline > now();
  const offers = v.session.autoPromote !== false;
  const offer = entry?.offerUntil && new Date(entry.offerUntil) > now() ? new Date(entry.offerUntil) : null;
  const cost = creditsLabel(v.cls.credits);
  const chargedThen = v.cls.credits === 1 ? 'The credit is only used then.' : `The ${cost} are only used then.`;
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(errorCopy(e));
    } finally {
      setBusy(false);
    }
  };

  const accept = onAccept ?? (async () => {
    const r = await book(v.session.id, dogId);
    if (!r.ok) throw new Error(r.error);
  });

  if (offer) {
    return (
      <>
        <Text variant="label" weight="600" center={center} accessibilityLiveRegion="polite">{`A spot opened. Accept by ${time(offer)}.`}</Text>
        <Text variant="caption" muted center={center}>The free cancel window has closed, so PackPass holds the spot for 2 hours, then offers it to the next dog.</Text>
        {error ? <Text variant="caption" weight="600" center={center} color={c.kennelRed}>{error}</Text> : null}
        <Button block variant="signal" disabled={busy} onPress={() => run(accept)}>{busy ? 'Booking…' : `Accept for ${cost}`}</Button>
        <Button block variant="quiet" fill={fill} disabled={busy} onPress={() => run(() => leave(v.session.id, dogId))}>Pass</Button>
      </>
    );
  }

  return (
    <>
      {entry ? (
        <>
          <Text variant="label" weight="600" center={center} accessibilityLiveRegion="polite">{`On the waitlist · ${ordinal(entry.place)} in line`}</Text>
          <Text variant="caption" muted center={center}>
            {auto
              ? `If a spot opens before ${dayTimeInline(deadline)}, we'll book it for ${dogName} and use ${cost}. You can still cancel for free until then.`
              : offers ? `If a spot opens, PackPass holds it for ${dogName} for 2 hours to accept.` : `We'll tell you if a spot opens. The first to book it gets it.`}
          </Text>
        </>
      ) : (
        <Text variant="caption" muted center={center}>
          {auto
            ? `This class is full. Join the waitlist and we'll book ${dogName} in if a spot opens before ${dayTimeInline(deadline)}. ${chargedThen}`
            : offers ? `This class is full. Join the waitlist and if a spot opens, PackPass holds it for ${dogName} for 2 hours to accept. ${chargedThen.replace('then', 'when you accept')}`
              : 'This class is full. Join the waitlist to hear if a spot opens.'}
        </Text>
      )}
      {error ? <Text variant="caption" weight="600" center={center} color={c.kennelRed}>{error}</Text> : null}
      {entry ? (
        <Button block variant="quiet" fill={fill} disabled={busy} onPress={() => run(() => leave(v.session.id, dogId))}>{busy ? 'Leaving…' : 'Leave the waitlist'}</Button>
      ) : (
        <Button block disabled={busy} onPress={() => run(() => join(v.session.id, dogId))}>{busy ? 'Joining…' : 'Join the waitlist'}</Button>
      )}
    </>
  );
}
