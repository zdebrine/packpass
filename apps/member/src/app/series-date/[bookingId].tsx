import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { errorCopy } from '@/api/errors';
import { Button } from '@/ds/controls';
import { IconButton, useBottom } from '@/ds/layout';
import { Overlay } from '@/ds/overlay';
import { useWide } from '@/ds/responsive';
import { ModalSheet } from '@/ds/sheet';
import { Text } from '@/ds/Text';
import { Notice } from '@/features/ready/parts';
import { cancelHoursOf, cancelRefund, credits as creditsLabel, freeCancelUntil, view } from '@/lib/booking';
import { dayTimeInline, monthDay, time, weekday } from '@/lib/dates';
import { useApp } from '@/store/app';
import { useTheme } from '@/theme/ThemeProvider';

const back = () => (router.canGoBack() ? router.back() : router.replace('/month'));

/** cancel-one: cancels one date of a standing booking, or ends the series. */
export default function SeriesDate() {
  const { c } = useTheme();
  const wide = useWide();
  const bottom = useBottom(34);
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const booking = useApp((s) => s.bookings.find((b) => b.id === bookingId));
  const cancel = useApp((s) => s.cancelBooking);
  const endSeries = useApp((s) => s.endSeries);
  const [busy, setBusy] = useState<'one' | 'all' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const v = booking ? view(booking.sessionId) : undefined;
  if (!booking || !v) return null;

  const at = v.session.startsAt;
  const day = weekday(at);
  const refund = cancelRefund(at, booking.credits, cancelHoursOf(v.cls));
  const deadline = freeCancelUntil(v);
  const run = async (which: 'one' | 'all') => {
    setBusy(which);
    setError(null);
    try {
      if (which === 'one') await cancel(booking.id);
      else if (booking.seriesId) await endSeries(booking.seriesId);
      back();
    } catch (e) {
      setError(errorCopy(e));
      setBusy(null);
    }
  };

  const body = (
    <>
      <Text variant="wide" muted>{`${day}, ${monthDay(at)} · ${v.partner.name}`}</Text>
      <Text variant="displayLg" style={{ marginTop: 8 }}>{v.cls.title}</Text>
      <View style={{ marginTop: 20, gap: 12 }}>
        <Notice icon="repeat" title="Part of a weekly series." body={`Cancel this ${day} only. The series keeps going.`} />
        <View style={{ borderRadius: 12, backgroundColor: c.surfaceRaised, paddingHorizontal: 18 }}>
          {[['Time', time(at)], ['Credits back', refund ? String(refund) : `None, inside ${cancelHoursOf(v.cls)} hours`], ['Free cancel until', dayTimeInline(deadline)]].map(([k, val], i) => (
            <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 14, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}>
              <Text variant="label" muted>{k}</Text>
              <Text variant="label" weight="600">{val}</Text>
            </View>
          ))}
        </View>
      </View>
      {error ? <Text variant="label" color={c.kennelRed} style={{ marginTop: 12 }}>{error}</Text> : null}
      <View style={{ gap: 8, marginTop: 18 }}>
        <Button block disabled={!!busy} onPress={() => run('one')}>{busy === 'one' ? 'Cancelling…' : `Cancel ${monthDay(at)} only`}</Button>
        {booking.seriesId ? <Button block variant="quiet" disabled={!!busy} onPress={() => run('all')}>{busy === 'all' ? 'Ending…' : 'End the series'}</Button> : null}
        {booking.seriesId ? <Text variant="caption" muted center>{`Ending cancels every later ${day} still free to cancel and gives those credits back.`}</Text> : null}
        {!refund ? <Text variant="caption" muted center>{`Cancelling now keeps the ${creditsLabel(booking.credits)}.`}</Text> : null}
      </View>
    </>
  );

  if (wide) {
    return (
      <Overlay kind="dialog" width={480} top={72} onClose={back}>
        <View style={{ padding: 28 }}>
          {body}
          <View style={{ position: 'absolute', top: 16, right: 16 }}><IconButton icon="x" size={40} label="Close" onPress={back} /></View>
        </View>
      </Overlay>
    );
  }
  return <ModalSheet onClose={back} padding={{ paddingTop: 18, paddingHorizontal: 20, paddingBottom: bottom }}>{body}</ModalSheet>;
}
