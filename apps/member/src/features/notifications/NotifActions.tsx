// The buttons and rows under a notification (Pack Scheduling, notif-before and notif-after): the reminder
// sequence's Confirm / Cancel and Check in / Directions, a trainer note's Book again, and the 10-day nudge's
// two classes that fit the dog this week. Kinds without actions render nothing.
import { router, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { catalog } from '@/data/catalog';
import type { Notif } from '@/data/passport';
import { Button } from '@/ds/controls';
import { Row } from '@/ds/layout';
import { Photo } from '@/ds/Surface';
import { Text } from '@/ds/Text';
import { useFit } from '@/features/book/useFit';
import { bookError, bookingFor, freeCancelUntil, nextSession, view, type SessionView } from '@/lib/booking';
import { now } from '@/lib/clock';
import { dayTimeInline, time, weekday } from '@/lib/dates';
import { openDirections } from '@/lib/directions';
import { useApp, useDog, useRules } from '@/store/app';

/** "Tue 6:30 pm · Eastside Dog Club · You stay · Free cancel until Mon 6:30 pm" */
export function sessionLine(v: SessionView) {
  const deadline = freeCancelUntil(v);
  return [
    `${weekday(v.session.startsAt).slice(0, 3)} ${time(v.session.startsAt)}`,
    v.partner.name,
    v.cls.dropOff ? 'Drop-off' : 'You stay',
    deadline > now() ? `Free cancel until ${dayTimeInline(deadline)}` : null,
  ].filter(Boolean).join(' · ');
}

export function NotifActions({ n, onDone }: { n: Notif; onDone: () => void }) {
  const dog = useDog();
  const rules = useRules();
  const fit = useFit();
  const bookings = useApp((s) => s.bookings);
  const v = n.sessionId ? view(n.sessionId) : undefined;
  const booking = n.sessionId ? bookings.find((b) => b.sessionId === n.sessionId && b.status === 'booked') : undefined;

  const btns = (children: ReactNode) => <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>{children}</View>;

  if (n.kind === 'reminder_24h' && v && booking) {
    const free = freeCancelUntil(v) > now();
    return btns(<>
      <Button size="sm" onPress={onDone}>Confirm</Button>
      {free ? <Button size="sm" variant="quiet" onPress={() => router.push(`/class/${v.session.id}` as Href)}>Cancel</Button> : null}
    </>);
  }

  if (n.kind === 'reminder_2h' && v) {
    return btns(<>
      {booking ? <Button size="sm" onPress={() => router.push(`/check-in/scan?booking=${booking.id}` as Href)}>Check in</Button> : null}
      <Button size="sm" variant="quiet" icon="navigation" onPress={() => openDirections(v.partner)}>Directions</Button>
    </>);
  }

  if (n.kind === 'session_note' && v) {
    const next = nextSession(v.cls.id);
    const canBook = next && !bookError(next.session.id, dog.id, rules) && !bookingFor(bookings.filter((b) => b.dogId === dog.id), next.session.id);
    return btns(<>
      {n.href ? <Button size="sm" variant="quiet" onPress={() => router.push(n.href as Href)}>See note</Button> : null}
      {canBook ? <Button size="sm" onPress={() => router.push(`/book/${next.session.id}` as Href)}>Book again</Button> : null}
    </>);
  }

  if (n.kind === 'nudge_10d') {
    // The two classes this week the dog can book that fit it best (the score Book ranks by), soonest on a tie.
    const week = now().getTime() + 7 * 86_400_000;
    const picks = Object.values(catalog.classes)
      .map((k) => nextSession(k.id))
      .filter((x): x is SessionView => !!x && x.session.startsAt.getTime() < week && !bookError(x.session.id, dog.id, rules))
      .sort((a, b) => fit(b.cls).score - fit(a.cls).score || +a.session.startsAt - +b.session.startsAt)
      .slice(0, 2);
    if (!picks.length) return null;
    return (
      <View style={{ marginTop: 8 }}>
        {picks.map((x, i) => (
          <Row
            key={x.session.id}
            title={x.cls.title}
            meta={sessionLine(x)}
            thumb={<Photo name={x.cls.image} style={{ width: 44, height: 44 }} />}
            trail={<Text variant="caption" muted>{`${x.cls.credits} cr`}</Text>}
            last={i === picks.length - 1}
            onPress={() => { onDone(); router.push(`/class/${x.session.id}` as Href); }}
          />
        ))}
      </View>
    );
  }

  return null;
}
