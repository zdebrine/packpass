import { useState } from 'react';

import { errorCopy } from '@/api/errors';
import { Button } from '@/ds/controls';
import { Text } from '@/ds/Text';
import { credits as creditsLabel, type SessionView } from '@/lib/booking';
import { now } from '@/lib/clock';
import { dayTimeInline } from '@/lib/dates';
import { useApp } from '@/store/app';
import { useTheme } from '@/theme/ThemeProvider';

const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;

/**
 * Footer actions for a full session: join, or see your place and leave. A spot that opens is booked
 * for the first dog in line until 12 hours before the start (so it can still be cancelled for free);
 * after that, everyone waiting is told and the first to book gets it.
 */
export function WaitlistActions({ v, dogId, dogName }: { v: SessionView; dogId: string; dogName: string }) {
  const { c } = useTheme();
  const entry = useApp((s) => s.waitlist.find((w) => w.sessionId === v.session.id && w.dogId === dogId));
  const join = useApp((s) => s.joinWaitlist);
  const leave = useApp((s) => s.leaveWaitlist);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deadline = new Date(v.session.startsAt.getTime() - 12 * 3_600_000);
  const auto = deadline > now();
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

  return (
    <>
      {entry ? (
        <>
          <Text variant="label" weight="600" center accessibilityLiveRegion="polite">{`On the waitlist · ${ordinal(entry.place)} in line`}</Text>
          <Text variant="caption" muted center>
            {auto
              ? `If a spot opens before ${dayTimeInline(deadline)}, we'll book it for ${dogName} and use ${cost}. You can still cancel for free until then.`
              : `We'll tell you if a spot opens. The first to book it gets it.`}
          </Text>
        </>
      ) : (
        <Text variant="caption" muted center>
          {auto
            ? `This class is full. Join the waitlist and we'll book ${dogName} in if a spot opens before ${dayTimeInline(deadline)}. ${chargedThen}`
            : 'This class is full. Join the waitlist to hear if a spot opens.'}
        </Text>
      )}
      {error ? <Text variant="caption" weight="600" center color={c.kennelRed}>{error}</Text> : null}
      {entry ? (
        <Button block variant="quiet" disabled={busy} onPress={() => run(() => leave(v.session.id, dogId))}>{busy ? 'Leaving…' : 'Leave the waitlist'}</Button>
      ) : (
        <Button block disabled={busy} onPress={() => run(() => join(v.session.id, dogId))}>{busy ? 'Joining…' : 'Join the waitlist'}</Button>
      )}
    </>
  );
}
