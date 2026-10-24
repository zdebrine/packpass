// Standing bookings on the booking sheet (Pack Scheduling class-repeat and booked-repeat): the Repeat weekly
// switch with its Until choice, and the "Booked every Saturday." result listing the dates it booked.
import { View } from 'react-native';

import { Chip } from '@/ds/controls';
import { Row, Toggle } from '@/ds/layout';
import { Icon } from '@/ds/Icon';
import { Text } from '@/ds/Text';
import { credits as creditsLabel, type SessionView } from '@/lib/booking';
import { dayTimeInline, monthDay, time, weekday } from '@/lib/dates';
import { everyLabel } from '@/lib/series';
import type { Series } from '@/data/types';
import { useTheme } from '@/theme/ThemeProvider';

export type Until = 'credits' | 'date';

/** Seven more weeks after the picked date: the design's "Nov 28" for an Oct 3 start. */
export const untilDate = (start: Date) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + 49);
export const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const freeUntil = (d: Date) => `Free cancel until ${dayTimeInline(new Date(d.getTime() - 12 * 3_600_000))}`;

export function RepeatToggle({ v, on, setOn, until, setUntil }: { v: SessionView; on: boolean; setOn: (on: boolean) => void; until: Until; setUntil: (u: Until) => void }) {
  const { c } = useTheme();
  const start = v.session.startsAt;
  const end = untilDate(start);
  const every = everyLabel(start);
  return (
    <View style={{ paddingVertical: 14, paddingHorizontal: 18, borderRadius: 12, backgroundColor: c.surfaceRaised, gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Icon name="repeat" />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="label" weight="600">Repeat weekly</Text>
          <Text variant="caption" muted>
            {!on ? `Book ${every.toLowerCase()} at ${time(start)}` : until === 'credits' ? `${every} until credits run out` : `${every} until ${monthDay(end)}`}
          </Text>
        </View>
        <Toggle on={on} label="Repeat weekly" onPress={() => setOn(!on)} />
      </View>
      {on ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <Text variant="caption" muted>Until</Text>
          <Chip selected={until === 'credits'} onPress={() => setUntil('credits')}>Credits run out</Chip>
          <Chip selected={until === 'date'} onPress={() => setUntil('date')}>{monthDay(end)}</Chip>
        </View>
      ) : null}
    </View>
  );
}

/** The sheet's caption under the button while Repeat weekly is on. */
export const repeatCaption = (v: SessionView) =>
  `Each ${weekday(v.session.startsAt)} has its own free cancel window, until 12 hours before`;

/** booked-repeat: the dates the series booked this credit month, and what it means for each. */
export function SeriesBooked({ v, series, dogName }: { v: SessionView; series?: Series; dogName: string }) {
  const booked = (series?.dates ?? []).filter((d) => d.status === 'booked');
  const short = (series?.dates ?? []).filter((d) => d.status === 'short');
  const day = weekday(v.session.startsAt);
  return (
    <View style={{ marginTop: 14 }}>
      {booked.map((d, i) => (
        <Row key={d.sessionId} title={`${day}, ${monthDay(d.startsAt)}`} meta={`${time(d.startsAt)} · ${freeUntil(d.startsAt)}`}
          thumb={<Icon name="repeat" />} trail={<Text variant="caption" muted>{creditsLabel(v.cls.credits)}</Text>} last={i === booked.length - 1} />
      ))}
      <Text variant="caption" muted style={{ marginTop: 12, marginHorizontal: 4 }}>
        {`${v.cls.dropOff ? `Drop-off: leave ${dogName} with the trainer.` : `You stay with ${dogName}.`} Each ${day} can be cancelled on its own.`
          + (short.length ? ` ${short.map((d) => monthDay(d.startsAt)).join(' and ')} ${short.length === 1 ? 'needs' : 'need'} more credits. PackPass books ${short.length === 1 ? 'it' : 'them'} if credits come back.` : '')}
      </Text>
    </View>
  );
}
