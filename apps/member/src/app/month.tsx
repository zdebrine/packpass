import { router, type Href } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { catalog } from '@/data/catalog';
import type { SeriesDate } from '@/data/types';
import { Button } from '@/ds/controls';
import { Icon } from '@/ds/Icon';
import { IconButton, Row, Screen } from '@/ds/layout';
import { Overlay } from '@/ds/overlay';
import { useWide } from '@/ds/responsive';
import { Press } from '@/ds/Press';
import { Text } from '@/ds/Text';
import { Notice } from '@/features/ready/parts';
import { activeBookings, credits as creditsLabel, view } from '@/lib/booking';
import { now } from '@/lib/clock';
import { monthDay, shortDay, time, weekday } from '@/lib/dates';
import { everyLabel, monthEnd } from '@/lib/series';
import { useAllowance, useApp, useDog, useSeries } from '@/store/app';
import { useTheme } from '@/theme/ThemeProvider';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WD = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const list = (xs: string[]) => xs.join(', ').replace(/, ([^,]*)$/, ' and $1');

type Mark = { kind: 'stand' | 'book' | 'drop' | 'x'; bookingId?: string };

/**
 * Juno's month (Pack Scheduling month-standing): the credit month on a calendar, standing bookings as filled
 * days with a repeat mark, dates the credits don't cover ringed red with the overage, and every booking listed.
 * Tapping a standing date opens cancel-one.
 */
export default function Month() {
  const { c } = useTheme();
  const wide = useWide();
  const dog = useDog();
  const credits = useApp((s) => s.credits);
  const renewsOn = useApp((s) => s.membership.renewsOn);
  const bookings = useApp((s) => s.bookings);
  const allowance = useAllowance();
  const series = useSeries().filter((x) => x.dogId === dog.id);

  const today = now();
  const reset = renewsOn ? new Date(`${renewsOn.slice(0, 10)}T00:00:00`) : monthEnd(today);
  const label = MONTHS[today.getMonth()];
  const marks = new Map<string, Mark>();
  const short: { d: SeriesDate; credits: number }[] = [];
  for (const x of series) {
    const cost = catalog.classes[x.classId]?.credits ?? 0;
    for (const d of x.dates) {
      marks.set(dayKey(d.startsAt), { kind: d.status === 'booked' ? 'stand' : d.status === 'short' ? 'drop' : 'x', bookingId: d.bookingId });
      if (d.status === 'short') short.push({ d, credits: cost });
    }
  }
  const singles = activeBookings(bookings.filter((b) => b.dogId === dog.id && !b.seriesId))
    .filter((x) => x.booking.status !== 'cancelled' && x.v.session.startsAt >= today && x.v.session.startsAt < reset);
  for (const s of singles) if (!marks.has(dayKey(s.v.session.startsAt))) marks.set(dayKey(s.v.session.startsAt), { kind: 'book' });
  const over = short.reduce((n, x) => n + x.credits, 0);

  // Every calendar month the credit month touches (usually one).
  const months: Date[] = [];
  for (let m = new Date(today.getFullYear(), today.getMonth(), 1); m < reset; m = new Date(m.getFullYear(), m.getMonth() + 1, 1)) months.push(m);

  const cal = (first: Date) => {
    const lead = (first.getDay() + 6) % 7;
    const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    const cells = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => new Date(first.getFullYear(), first.getMonth(), i + 1))];
    return (
      <View key={first.toISOString()} style={{ padding: 16, borderRadius: 16, backgroundColor: c.surfaceRaised }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12, gap: 12 }}>
          <Text variant="heading" weight="600">{MONTHS[first.getMonth()]}</Text>
          {series.length && first === months[0] ? <Text variant="caption" muted style={{ flexShrink: 1 }}>Tap a standing date to cancel just that one</Text> : null}
        </View>
        <View style={{ flexDirection: 'row' }}>
          {WD.map((w, i) => <Text key={i} variant="caption" muted center style={{ flex: 1 }}>{w}</Text>)}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 }}>
          {cells.map((d, i) => {
            const m = d ? marks.get(dayKey(d)) : undefined;
            const filled = m?.kind === 'stand' || m?.kind === 'book';
            const fg = filled ? c.onInverse : m?.kind === 'drop' ? c.kennelRed : m?.kind === 'x' ? c.inkFaint : c.ink;
            const cell = (
              <View style={{
                height: 40, margin: 2, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
                backgroundColor: filled ? c.inverse : 'transparent',
                borderWidth: m?.kind === 'drop' ? 1.5 : m?.kind === 'x' ? 1 : 0, borderColor: m?.kind === 'drop' ? c.kennelRed : c.lineStrong,
              }}>
                <Text variant="caption" weight={filled || m?.kind === 'drop' ? '600' : undefined} color={fg}
                  style={m?.kind === 'x' ? { textDecorationLine: 'line-through' } : undefined}>{d ? String(d.getDate()) : ''}</Text>
                {m?.kind === 'stand' || m?.kind === 'drop' ? <View style={{ position: 'absolute', top: 3, right: 3 }}><Icon name="repeat" size={10} color={fg} /></View> : null}
              </View>
            );
            return (
              <View key={i} style={{ width: `${100 / 7}%` }}>
                {m?.kind === 'stand' && m.bookingId ? (
                  <Press onPress={() => router.push(`/series-date/${m.bookingId}` as Href)} scale={false}
                    accessibilityRole="button" accessibilityLabel={`${d ? `${weekday(d)}, ${monthDay(d)}` : ''}. Standing booking. Cancel this date`}>{cell}</Press>
                ) : cell}
              </View>
            );
          })}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 12 }}>
          {[['Booked', c.inverse, null], ['Drops off', 'transparent', c.kennelRed]].map(([l, bg, ring]) => (
            <View key={l as string} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 12, height: 12, borderRadius: 4, backgroundColor: bg as string, borderWidth: ring ? 1.5 : 0, borderColor: (ring as string) ?? undefined }} />
              <Text variant="caption" muted>{l as string}</Text>
            </View>
          ))}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Icon name="repeat" size={12} color={c.inkMuted} /><Text variant="caption" muted>Repeats weekly</Text></View>
        </View>
      </View>
    );
  };

  const booked = series.reduce((n, x) => n + x.dates.filter((d) => d.status === 'booked').length * (catalog.classes[x.classId]?.credits ?? 0), 0)
    + singles.reduce((n, x) => n + x.booking.credits, 0);
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const content = (
    <View style={{ gap: 16 }}>
      {over ? (
        <Notice icon="circle-alert" tone="warn" title={`Standing bookings go ${creditsLabel(over)} over ${label}.`}
          body={`${list(short.map((x) => `${weekday(x.d.startsAt)}, ${monthDay(x.d.startsAt)}`))} ${short.length === 1 ? 'drops' : 'drop'} off unless you add credits or cancel another date.`} />
      ) : series.length ? (
        <Notice icon="check" tone="pitch" title={`${label} fits in your credits.`} body="Every standing date is covered." />
      ) : null}
      {months.map(cal)}
      <View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 8, marginBottom: 4 }}>
          <Text variant="title">Booked</Text>
          <Text variant="caption" muted>{allowance ? `${booked} of ${allowance} credits` : creditsLabel(booked)}</Text>
        </View>
        {series.map((x) => {
          const first = x.dates[0];
          const v = first ? view(first.sessionId) : undefined;
          const cls = catalog.classes[x.classId];
          const n = x.dates.filter((d) => d.status === 'booked').length;
          return (
            <Row key={x.id} title={cls?.title ?? 'Standing booking'} thumb={<Icon name="repeat" />}
              meta={v ? `${everyLabel(v.session.startsAt)} · ${time(v.session.startsAt)} · ${v.partner.name}` : 'Every week'}
              trail={<Text variant="caption" muted>{creditsLabel(n * (cls?.credits ?? 0))}</Text>} />
          );
        })}
        {singles.map(({ booking, v }, i) => (
          <Row key={booking.id} title={v.cls.title} thumb={<Icon name="calendar" />} last={i === singles.length - 1}
            meta={`${shortDay(v.session.startsAt)} · ${time(v.session.startsAt)} · ${v.partner.name}`}
            trail={<Text variant="caption" muted>{creditsLabel(booking.credits)}</Text>}
            onPress={() => router.push(`/class/${v.session.id}` as Href)} />
        ))}
        {!series.length && !singles.length ? <Text variant="label" muted style={{ marginTop: 10 }}>Nothing booked before credits reset.</Text> : null}
      </View>
      {over ? (
        <Button block onPress={() => router.push('/plan')}>{`Add ${creditsLabel(over)}`}</Button>
      ) : null}
    </View>
  );

  const sub = `${label} · ${allowance ? `${credits} of ${allowance}` : credits} credits left · resets ${monthDay(reset)}`;

  if (wide) {
    return (
      <Overlay kind="panel" width={520} onClose={close}>
        <View style={{ paddingTop: 28, paddingHorizontal: 24, paddingBottom: 40 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <Text variant="pageTitle" accessibilityRole="header">{`${dog.name}'s month`}</Text>
            <IconButton icon="x" size={40} label="Close" onPress={close} />
          </View>
          <Text variant="caption" muted style={{ marginTop: 6, marginBottom: 20 }}>{sub}</Text>
          {content}
        </View>
      </Overlay>
    );
  }

  return (
    <Screen>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 10, paddingHorizontal: 20, paddingBottom: 40 }}>
        <IconButton icon="chevron-left" label="Back" onPress={close} />
        <Text variant="pageTitle" style={{ marginTop: 20 }} accessibilityRole="header">{`${dog.name}'s month`}</Text>
        <Text variant="caption" muted style={{ marginTop: 6, marginBottom: 20 }}>{sub}</Text>
        {content}
      </ScrollView>
    </Screen>
  );
}
