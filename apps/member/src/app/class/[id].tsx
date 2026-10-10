import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Share, View } from 'react-native';

import { errorCopy } from '@/api/errors';
import { Button, Tag } from '@/ds/controls';
import { Icon } from '@/ds/Icon';
import { Badge, Bars, Footer, IconButton, Screen, useTop } from '@/ds/layout';
import { Press } from '@/ds/Press';
import { Photo, PhotoFill, Gradient } from '@/ds/Surface';
import { Text } from '@/ds/Text';
import { WaitlistActions } from '@/features/book/Waitlist';
import { MapSketch } from '@/features/MapSketch';
import { assessmentFor, bookingFor, cancelRefund, checkInClosesAt, credits as creditsLabel, eligibility, view } from '@/lib/booking';
import { now } from '@/lib/clock';
import { cancelCopy, dayTime, monthDay } from '@/lib/dates';
import { openDirections } from '@/lib/directions';
import { useApp, useDog, useOriginLabel, useRules } from '@/store/app';
import { useTheme } from '@/theme/ThemeProvider';


function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  const { c } = useTheme();
  return (
    <View style={{ flexBasis: '48%', flexGrow: 1, backgroundColor: c.surfaceRaised, borderRadius: 20, padding: 14 }}>
      <Text variant="caption" muted>{label}</Text>
      {children}
    </View>
  );
}

function Section({ title, children, gap = 14 }: { title: string; children: React.ReactNode; gap?: number }) {
  return (
    <View style={{ marginTop: 32 }}>
      <Text variant="title" style={{ marginBottom: gap }}>{title}</Text>
      {children}
    </View>
  );
}

/** 05 Class detail */
export default function ClassDetail() {
  useOriginLabel(); // re-render when distances are measured from somewhere new
  const { c } = useTheme();
  const top = useTop();
  const { id } = useLocalSearchParams<{ id: string }>();
  const v = view(id);
  const juno = useDog();
  const rules = useRules();
  const onCalmPath = useApp((s) => s.activePaths.includes('calm-around-dogs'));
  const bookings = useApp((s) => s.bookings);
  const vaccines = useApp((s) => s.vaccines);
  const cancelBooking = useApp((s) => s.cancelBooking);
  const [saved, setSaved] = useState(false);
  // Cancel lives here (booking detail): tap, confirm inline (Alert has no web version), then the footer offers booking again.
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  if (!v) {
    return (
      <Screen>
        <View style={{ padding: 20, gap: 16 }}>
          <IconButton icon="chevron-left" label="Back" onPress={() => router.back()} />
          <Text variant="displayLg">This session isn’t available.</Text>
          <Button onPress={() => router.replace('/book')}>Find a class</Button>
        </View>
      </Screen>
    );
  }

  const { cls, partner, trainer, session } = v;
  const el = eligibility(v, rules, juno.name);
  const started = session.startsAt <= now();
  // The showing dog's booking, else another of the member's dogs' (a notification about that dog's class).
  const booking = bookingFor(bookings.filter((b) => b.dogId === juno.id), session.id) ?? bookingFor(bookings, session.id);
  const assessment = !el.ok && el.needs === 'herding' ? assessmentFor(cls) : undefined;
  const firstVaccine = [...vaccines].sort((a, b) => (a.expires < b.expires ? -1 : 1))[0];
  const group = cls.groupSize === 1 ? (cls.sessionType === 'Private' ? '1:1 · Private' : 'Your dogs only') : `${cls.groupSize} dogs · ${session.spotsLeft === 0 ? 'full' : `${session.spotsLeft} left`}`;
  const refund = booking ? cancelRefund(session.startsAt, booking.credits) : 0;
  const cancel = async () => {
    if (!booking) return;
    setBusy(true);
    try {
      await cancelBooking(booking.id);
      setNotice(refund ? `Cancelled. ${creditsLabel(refund)} back in your balance.` : 'Cancelled. Inside 12 hours, so the credits were used.');
    } catch (e) {
      setNotice(errorCopy(e));
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };
  const when = `${cls.openWindow ? `${dayTime(session.startsAt).split(' ')[0]} · ${cls.openWindow}` : dayTime(session.startsAt)} · ${partner.name}`;

  return (
    <Screen bleed statusLight>
      <ScrollView style={{ flex: 1 }}>
        <View style={{ height: 460, overflow: 'hidden' }}>
          <PhotoFill name={cls.image} />
          <Gradient stops={[['rgba(0,0,0,0.4)', 0], ['rgba(0,0,0,0)', 0.24], ['rgba(0,0,0,0)', 0.4], ['rgba(0,0,0,0.72)', 1]]} />
          <View style={{ position: 'absolute', top: top + 8, left: 20, right: 20, flexDirection: 'row', justifyContent: 'space-between' }}>
            <IconButton glass icon="chevron-left" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/book'))} />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <IconButton glass icon="share" label="Share" onPress={() => Share.share({ message: `${cls.title}, ${dayTime(session.startsAt)} at ${partner.name}. Book it on PackPass.` }).catch(() => {})} />
              <IconButton glass icon="bookmark" label={saved ? 'Saved' : 'Save'} onPress={() => setSaved((s) => !s)} style={saved ? { backgroundColor: 'rgba(255,255,255,0.4)' } : undefined} />
            </View>
          </View>
          <View style={{ position: 'absolute', left: 20, right: 20, bottom: 24 }}>
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
              <Tag tone="glass">{cls.discipline}</Tag>
              <Tag tone="glass">{creditsLabel(cls.credits)}</Tag>
            </View>
            <Text variant="displayXl" color="#fff" accessibilityRole="header">{cls.title}</Text>
            <Text variant="label" color="rgba(255,255,255,0.85)" style={{ marginTop: 10 }}>{when}</Text>
          </View>
        </View>

        <View style={{ paddingTop: 24, paddingHorizontal: 20, paddingBottom: 40 }}>
          {el.ok && el.cleared ? (
            <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center', padding: 16, borderRadius: 20, backgroundColor: c.surfaceRaised, marginBottom: 8 }}>
              <Badge icon="shield-check" bg={c.pitch} fg={c.onPitch} />
              <View style={{ flex: 1 }}>
                <Text variant="label" weight="600">{`${juno.name} is cleared for this.`}</Text>
                <Text variant="caption" muted>Social, via Eastside Dog Club, Sep 2026.</Text>
              </View>
            </View>
          ) : null}
          {!el.ok ? (
            <View style={{ flexDirection: 'row', gap: 14, alignItems: 'flex-start', padding: 16, borderRadius: 20, backgroundColor: c.surfaceRaised, marginBottom: 8 }}>
              <Badge icon="shield" bg={c.surfaceSunken} fg={c.ink} />
              <View style={{ flex: 1 }}>
                <Text variant="label" weight="600">{el.reason}</Text>
                <Text variant="caption" muted style={{ marginTop: 2 }}>
                  {el.needs === 'herding'
                    ? 'Herding partners assess every dog on livestock themselves.'
                    : el.needs === 'social'
                      ? onCalmPath
                        ? `${juno.name} is working on it. Finish Calm around dogs to open group classes.`
                        : 'A Social assessment opens group sport, play and group skills at every partner.'
                      : firstVaccine
                        ? `${firstVaccine.type} runs out ${monthDay(new Date(firstVaccine.expires + 'T12:00'))}. Update the record to book this date.`
                        : `Add ${juno.name}'s vaccine records to book.`}
                </Text>
              </View>
            </View>
          ) : null}

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Stat label="Duration"><Text variant="heading" style={{ marginTop: 4 }}>{`${cls.durationMin} min`}</Text></Stat>
            <Stat label="Intensity"><Bars total={5} done={cls.intensity} color={c.ink} style={{ marginTop: 10 }} /></Stat>
            <Stat label="Group"><Text variant="heading" style={{ marginTop: 4 }}>{group}</Text></Stat>
            <Stat label="Suits">
              <Text variant="heading" style={{ marginTop: 4 }}>{cls.suits}</Text>
              <Text variant="caption" muted>{cls.suitsNote}</Text>
            </Stat>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 }}>
            <View style={{ width: 8, height: 8, borderRadius: 9999, backgroundColor: c.turf }} />
            <Text variant="label">{`Adds to ${juno.name}'s month: ${cls.balance.toLowerCase()}`}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }}>
            {cls.dropOff ? <Tag>Drop-off</Tag> : <View style={{ width: 8, height: 8, borderRadius: 9999, backgroundColor: c.inkMuted }} />}
            <Text variant="label" style={{ flex: 1 }}>{cls.dropOff ? 'Leave your dog with the trainer. Pick up at the end.' : 'You stay with your dog.'}</Text>
          </View>

          <Section title="What happens" gap={10}>
            <Text>{cls.description}</Text>
          </Section>

          <Section title="Trainer">
            <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
              <Photo name={trainer.photo} style={{ width: 56, height: 56, borderRadius: 9999 }} />
              <View style={{ flex: 1 }}>
                <Text variant="heading">{trainer.name}</Text>
                <Text variant="caption" muted>{trainer.credential}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Icon name="star" size={16} />
                <Text variant="label" num>{trainer.rating.toFixed(1)}</Text>
              </View>
            </View>
          </Section>

          <Section title="Location">
            <View style={{ backgroundColor: c.surfaceRaised, borderRadius: 28, padding: 12 }}>
              <MapSketch variant="detail" pin={{ left: '44%', top: '18%', size: 32 }} style={{ height: 120, borderRadius: 20 }} />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 14, paddingHorizontal: 8, paddingBottom: 4 }}>
                <View style={{ flex: 1 }}>
                  <Text variant="label" weight="600">{partner.name}</Text>
                  <Text variant="caption" muted>{`${partner.address} · ${partner.distanceMi} mi · ${partner.parking}`}</Text>
                </View>
                <Button size="sm" onPress={() => openDirections(partner)}>Directions</Button>
              </View>
            </View>
          </Section>

          <Section title="Requirements" gap={10}>
            <View style={{ gap: 10 }}>
              {cls.requirements.map((r) => (
                <View key={r.text} style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                  <Icon name={r.icon} />
                  <Text style={{ flex: 1 }}>{r.text.replace('Juno', juno.name)}</Text>
                </View>
              ))}
            </View>
          </Section>
        </View>
      </ScrollView>

      <Footer>
        {notice && !confirming ? <Text variant="caption" weight="600" center accessibilityLiveRegion="polite">{notice}</Text> : null}
        {booking && confirming ? (
          <>
            <Text variant="label" weight="600" center accessibilityLiveRegion="polite">{`Cancel ${cls.title}?`}</Text>
            <Text variant="caption" center color={refund ? c.inkMuted : c.kennelRed}>
              {refund
                ? `${creditsLabel(refund)} ${refund === 1 ? 'goes' : 'go'} back to your balance, and the spot opens for someone else.`
                : `It starts within 12 hours, so the ${creditsLabel(booking.credits)} won't come back.`}
            </Text>
            <Button block disabled={busy} onPress={() => setConfirming(false)}>Keep booking</Button>
            <Button block variant="quiet" disabled={busy} onPress={cancel}>{busy ? 'Cancelling…' : 'Yes, cancel'}</Button>
          </>
        ) : booking ? (
          <>
            <Text variant="caption" muted center>{`Booked for ${dayTime(session.startsAt)}. ${cancelCopy(session.startsAt)}.`}</Text>
            {booking.status === 'checked_in' ? (
              <Button block variant="quiet" disabled>Checked in</Button>
            ) : (
              <>
                {checkInClosesAt(session.startsAt) < now()
                  ? <Button block variant="quiet" disabled>Check-in closed</Button>
                  : <Button block onPress={() => router.push(`/check-in/scan?booking=${booking.id}`)}>Check in</Button>}
                {started ? null : (
                  <Press onPress={() => { setNotice(null); setConfirming(true); }} scale={false} accessibilityRole="button" style={{ alignSelf: 'center', paddingVertical: 4 }}>
                    <Text variant="label" weight="600" style={{ textDecorationLine: 'underline' }}>Cancel booking</Text>
                  </Press>
                )}
              </>
            )}
          </>
        ) : started ? (
          <>
            <Text variant="caption" muted center>This session has already started.</Text>
            <Button block variant="quiet" onPress={() => router.replace('/book')}>See other classes</Button>
          </>
        ) : !el.ok && el.needs === 'social' ? (
          <>
            {onCalmPath ? <Button variant="signal" block onPress={() => router.push('/goal/calm-around-dogs')}>See the path</Button> : null}
            <Button variant="quiet" block onPress={() => router.replace('/book')}>See other classes</Button>
          </>
        ) : !el.ok && el.needs === 'vaccines' ? (
          <>
            <Button variant="signal" block onPress={() => router.push('/vaccines')}>Update vaccines</Button>
            <Button variant="quiet" block onPress={() => router.replace('/book')}>See other classes</Button>
          </>
        ) : !el.ok ? (
          <>
            {assessment ? (
              <Text variant="caption" muted center>{`${assessment.cls.title.replace(' assessment', '')} assessment · ${assessment.cls.durationMin} min · ${creditsLabel(assessment.cls.credits)} · ${assessment.partner.name}`}</Text>
            ) : null}
            <Button variant="signal" block onPress={() => assessment && router.push(`/book/${assessment.session.id}`)}>Book assessment</Button>
            <Button variant="quiet" block onPress={() => router.replace('/book')}>See other classes</Button>
          </>
        ) : session.spotsLeft === 0 ? (
          <WaitlistActions v={v} dogId={juno.id} dogName={juno.name} />
        ) : (
          <>
            <Text variant="caption" muted center>{cancelCopy(session.startsAt)}</Text>
            <Button variant="signal" block onPress={() => router.push(`/book/${session.id}`)}>{`Book for ${creditsLabel(cls.credits)}`}</Button>
          </>
        )}
      </Footer>
    </Screen>
  );
}

