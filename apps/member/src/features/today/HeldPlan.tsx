import { useState } from 'react';
import { View } from 'react-native';

import { SHORT } from '@/api/errors';
import { Button } from '@/ds/controls';
import { Icon } from '@/ds/Icon';
import { Press } from '@/ds/Press';
import { Photo } from '@/ds/Surface';
import { Text } from '@/ds/Text';
import { credits as creditsLabel, view } from '@/lib/booking';
import { now } from '@/lib/clock';
import { addMinutes, dayTimeInline, monthDay, time, weekday } from '@/lib/dates';
import { recordOf, useApp, useRulesFor } from '@/store/app';
import { useTheme } from '@/theme/ThemeProvider';

/** A hold gives its spot back 24 hours before the session (held_spots.expires_at). */
const releaseOf = (startsAt: Date) => addMinutes(startsAt, -24 * 60);

/**
 * The rest of the starting month (01j), held until the dog passes its Social assessment. Each hold
 * reserves the spot (held_spots on the server) until a day before the session. One tap books them.
 * Within a day of the first release it says so (the server sends the same reminder as a notification).
 */
export function HeldPlan({ dogId }: { dogId: string }) {
  const { c } = useTheme();
  const dog = useApp((s) => s.dogs.find((d) => d.id === dogId));
  const { hasSocial } = useRulesFor(dogId);
  const pending = useApp((s) => recordOf(s, dogId).pendingPlan);
  const bookHeld = useApp((s) => s.bookHeld);
  const releaseHolds = useApp((s) => s.releaseHolds);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const rows = pending
    .map((id) => view(id))
    .filter((v): v is NonNullable<typeof v> => !!v && releaseOf(v.session.startsAt) > now())
    .sort((a, b) => a.session.startsAt.getTime() - b.session.startsAt.getTime());
  if (!dog || (!rows.length && !result)) return null;
  const first = rows[0];
  const soon = first && releaseOf(first.session.startsAt).getTime() - now().getTime() <= 24 * 3_600_000 ? first : null;

  const book = async () => {
    setBusy(true);
    const out = await bookHeld(dog.id);
    setBusy(false);
    const ok = out.filter((o) => !o.error).length;
    const missed = out.filter((o) => o.error).map((o) => `${view(o.sessionId)?.cls.title ?? 'A session'} (${SHORT[o.error!] ?? o.error})`);
    setResult(`Booked ${ok} of ${out.length}.${missed.length ? ` Skipped: ${missed.join(', ')}.` : ''}`);
  };

  return (
    <View style={{ marginTop: 32, paddingHorizontal: 20 }}>
      <Text variant="title" style={{ marginBottom: 14 }}>{`Rest of ${dog.name}'s month`}</Text>
      <View style={{ backgroundColor: c.surfaceRaised, borderRadius: 28, padding: 20, gap: 12 }}>
        {result ? (
          <Text variant="label" accessibilityLiveRegion="polite">{result}</Text>
        ) : (
          <>
            {rows.map((v) => (
              <View key={v.session.id} style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                <Photo name={v.cls.image} style={{ width: 44, height: 44, borderRadius: 12, opacity: hasSocial ? 1 : 0.6 }} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text variant="caption" muted>{`${weekday(v.session.startsAt).slice(0, 3)} ${monthDay(v.session.startsAt)} · ${time(v.session.startsAt)}`}</Text>
                  <Text variant="label" weight="600">{`${v.cls.title} · ${creditsLabel(v.cls.credits)}`}</Text>
                </View>
                {hasSocial ? null : <Icon name="lock" size={18} color={c.inkFaint} />}
              </View>
            ))}
            {soon ? (
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <Icon name="clock" size={16} color={c.kennelRed} />
                <Text variant="caption" weight="600" style={{ flex: 1 }}>{`${soon.cls.title} releases ${dayTimeInline(releaseOf(soon.session.startsAt))}${hasSocial ? ' unless you book it.' : '.'}`}</Text>
              </View>
            ) : null}
            {hasSocial ? (
              <Button block disabled={busy} onPress={book}>{busy ? 'Booking…' : `Book ${rows.length} ${rows.length === 1 ? 'session' : 'sessions'}`}</Button>
            ) : (
              <Text variant="caption" muted>{`Spots are held for ${dog.name} until the day before each session. Book them once ${dog.name} passes the Social assessment.`}</Text>
            )}
            <Press onPress={() => releaseHolds(dog.id)} scale={false} accessibilityRole="button" style={{ alignSelf: 'flex-start' }}>
              <Text variant="caption" weight="600" style={{ textDecorationLine: 'underline' }}>Let these spots go</Text>
            </Press>
          </>
        )}
      </View>
    </View>
  );
}
