import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Share, View, type DimensionValue } from 'react-native';

import { errorCopy } from '@/api/errors';
import { catalog, clearanceName } from '@/data/catalog';
import { Button, Tag } from '@/ds/controls';
import { Icon } from '@/ds/Icon';
import { Badge, Bars, Footer, IconButton, Screen, useTop } from '@/ds/layout';
import { Press } from '@/ds/Press';
import { col, Columns, Page, tile, useWide, web } from '@/ds/responsive';
import { Photo, PhotoFill, Gradient } from '@/ds/Surface';
import { Text } from '@/ds/Text';
import { useFit } from '@/features/book/useFit';
import { WaitlistActions } from '@/features/book/Waitlist';
import { Map, useMe } from '@/features/Map';
import { assessmentFor, bookingFor, cancelRefund, checkInClosesAt, credits as creditsLabel, eligibility, view } from '@/lib/booking';
import { now } from '@/lib/clock';
import { cancelCopy, dayTime, monthDay, relativeDay, time } from '@/lib/dates';
import { openDirections } from '@/lib/directions';
import { breedOnlyLabel, builtForLabel, builtForList } from '@/lib/fit';
import { useAllowance, useApp, useDog, useOriginLabel, useRules } from '@/store/app';
import { useTheme } from '@/theme/ThemeProvider';


/** `cell` is the desktop grid width (repeat(auto-fit, minmax(160px, 1fr))); without it, the phone's two-up wrap. */
function Stat({ label, children, cell }: { label: string; children: React.ReactNode; cell?: DimensionValue }) {
  const { c } = useTheme();
  return (
    <View style={cell !== undefined ? { width: cell, minWidth: 0, backgroundColor: c.surfaceRaised, borderRadius: 12, padding: 16 } : { flexBasis: '48%', flexGrow: 1, backgroundColor: c.surfaceRaised, borderRadius: 12, padding: 14 }}>
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
/** What a clearance opens, for an assessment's class page (Scheduling flow 23b). */
const opensCopy = (type: string, partnerName: string) =>
  catalog.clearanceTypes[type]?.description
  || (type === 'social' ? 'It opens group play, sport and group skills at every partner.'
    : type === 'herding' ? `It opens livestock classes at ${partnerName}.`
      : `It opens classes that ask for a ${clearanceName(type)} clearance.`);

export default function ClassDetail() {
  useOriginLabel(); // re-render when distances are measured from somewhere new
  const { c } = useTheme();
  const top = useTop();
  const { id } = useLocalSearchParams<{ id: string }>();
  const v = view(id);
  const juno = useDog();
  const rules = useRules();
  const fit = useFit();
  const onCalmPath = useApp((s) => s.activePaths.includes('calm-around-dogs'));
  const bookings = useApp((s) => s.bookings);
  const vaccines = useApp((s) => s.vaccines);
  const cancelBooking = useApp((s) => s.cancelBooking);
  const [saved, setSaved] = useState(false);
  // Cancel lives here (booking detail): tap, confirm inline (Alert has no web version), then the footer offers booking again.
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const wide = useWide();
  const me = useMe();
  const [statsW, setStatsW] = useState(0);
  const balance = useApp((s) => s.credits);
  const allowance = useAllowance();

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
  // The showing dog's booking only. A notification about another dog's class names that dog (?dog=), which shows it.
  const booking = bookingFor(bookings.filter((b) => b.dogId === juno.id), session.id);
  const assessment = el.ok ? undefined : el.needs === 'herding' ? assessmentFor(cls) : el.needs === 'clearance' ? assessmentFor(cls, el.clearance) : undefined;
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

  // Desktop stats grid: auto-fit columns of at least 160 with an 8 gap, so a short last row keeps its column width.
  const statCols = Math.min(4, Math.max(1, Math.floor((statsW + 8) / 168)));
  const statCell: DimensionValue | undefined = !wide ? undefined : statsW ? Math.floor((statsW - 8 * (statCols - 1)) / statCols) : '100%';
  const notices = (
    <>
      {el.ok && el.cleared ? (
        <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center', padding: 16, borderRadius: 12, backgroundColor: c.surfaceRaised, marginBottom: 8 }}>
          <Badge icon="shield-check" bg={c.pitch} fg={c.onPitch} />
          <View style={{ flex: 1 }}>
            <Text variant="label" weight="600">{`${juno.name} is cleared for this.`}</Text>
            <Text variant="caption" muted>Social, via Eastside Dog Club, Sep 2026.</Text>
          </View>
        </View>
      ) : null}
      {el.ok && cls.grants ? (
        <View style={{ flexDirection: 'row', gap: 14, alignItems: 'flex-start', padding: 16, borderRadius: 12, backgroundColor: c.surfaceRaised, marginBottom: 8 }}>
          <Badge icon="shield-check" bg={c.surfaceSunken} fg={c.ink} />
          <View style={{ flex: 1 }}>
            <Text variant="label" weight="600">{`Pass and ${juno.name} is ${clearanceName(cls.grants)} cleared for ${catalog.clearanceTypes[cls.grants]?.expiryMonths ?? 12} months.`}</Text>
            <Text variant="caption" muted style={{ marginTop: 2 }}>{opensCopy(cls.grants, partner.name)}</Text>
          </View>
        </View>
      ) : null}
      {!el.ok ? (
        <View style={{ flexDirection: 'row', gap: 14, alignItems: 'flex-start', padding: 16, borderRadius: 12, backgroundColor: c.surfaceRaised, marginBottom: 8 }}>
          <Badge icon={el.needs === 'fit' ? 'ban' : el.needs === 'cleared' ? 'shield-check' : 'shield'} bg={c.surfaceSunken} fg={c.ink} />
          <View style={{ flex: 1 }}>
            <Text variant="label" weight="600">{el.reason}</Text>
            <Text variant="caption" muted style={{ marginTop: 2 }}>
              {el.needs === 'fit'
                ? `${partner.name} sets who this class is for, so ${juno.name} can't book it.`
                : el.needs === 'cleared'
                ? 'It opens again if the clearance runs out.'
                : el.needs === 'herding'
                ? 'Herding partners assess every dog on livestock themselves.'
                : el.needs === 'clearance'
                ? catalog.clearanceTypes[el.clearance]?.description || `A ${clearanceName(el.clearance)} assessment with a trainer opens it.`
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
    </>
  );
  // Who the class is built for. Breed never gates it, so a dog that isn't a match hears the class is open to it.
  const built = cls.builtFor?.length ? fit(cls).builtFor : null;
  const builtRow = cls.builtFor?.length ? (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 }}>
      <Icon name="sparkles" size={16} />
      <Text variant="label" style={{ flex: 1 }}>
        {built
          ? `${cls.breedOnly ? breedOnlyLabel(cls.builtFor) : builtForLabel(built)}. ${juno.name} is ${/^[aeiou]/i.test(juno.breed) ? 'an' : 'a'} ${juno.breed}.`
          : cls.breedOnly ? `${breedOnlyLabel(cls.builtFor)}.` : `Open to all breeds. ${builtForList(cls.builtFor)}.`}
      </Text>
    </View>
  ) : null;
  const stats = (
    <>
      <Stat cell={statCell} label="Duration"><Text variant="heading" style={{ marginTop: 4 }}>{`${cls.durationMin} min`}</Text></Stat>
      <Stat cell={statCell} label="Intensity"><Bars total={5} done={cls.intensity} color={c.ink} style={{ marginTop: 10 }} /></Stat>
      <Stat cell={statCell} label="Group"><Text variant="heading" style={{ marginTop: 4 }}>{group}</Text></Stat>
      <Stat cell={statCell} label="Suits">
        <Text variant="heading" style={{ marginTop: 4 }}>{cls.suits}</Text>
        <Text variant="caption" muted>{cls.suitsNote}</Text>
      </Stat>
    </>
  );
  const trainerRow = (
    <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
      <Photo name={trainer.photo} style={{ width: 56, height: 56, borderRadius: 9999 }} />
      <View style={{ flex: 1 }}>
        <Text variant="heading">{trainer.name}</Text>
        <Text variant="caption" muted>{trainer.credential}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Icon name="star" size={wide ? 14 : 16} />
        <Text variant="label" num>{trainer.rating.toFixed(1)}</Text>
      </View>
    </View>
  );
  const locationCard = (
    <View style={{ borderRadius: 16, overflow: 'hidden', boxShadow: `inset 0 0 0 1px ${c.line}` }}>
      {partner.lat != null && partner.lng != null ? (
        <Map center={[partner.lat, partner.lng]} zoom={15} radius={0} height={wide ? 160 : 120} me={me} pins={[{ lat: partner.lat, lng: partner.lng, active: true, title: partner.name }]} />
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="heading">{partner.name}</Text>
          <Text variant="caption" muted>{`${partner.address} · ${partner.distanceMi} mi · ${partner.parking}`}</Text>
        </View>
        <Button size="sm" variant="outline" icon="navigation" onPress={() => openDirections(partner)}>Directions</Button>
      </View>
    </View>
  );
  const requirementsList = (
    <View style={{ gap: 10 }}>
      {cls.requirements.map((r) => (
        <View key={r.text} style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <Icon name={r.icon} />
          <Text style={{ flex: 1 }}>{r.text.replace('Juno', juno.name)}</Text>
        </View>
      ))}
    </View>
  );
  // The phone shows these in the sticky footer; desktop puts them in the booking aside, on a raised card.
  const quietFill = wide ? c.bg : undefined;
  const actions = (
    <>
      {notice && !confirming ? <Text variant="caption" weight="600" center={!wide} accessibilityLiveRegion="polite">{notice}</Text> : null}
      {booking && confirming ? (
        <>
          <Text variant="label" weight="600" center={!wide} accessibilityLiveRegion="polite">{`Cancel ${cls.title}?`}</Text>
          <Text variant="caption" center={!wide} color={refund ? c.inkMuted : c.kennelRed}>
            {refund
              ? `${creditsLabel(refund)} ${refund === 1 ? 'goes' : 'go'} back to your balance, and the spot opens for someone else.`
              : `It starts within 12 hours, so the ${creditsLabel(booking.credits)} won't come back.`}
          </Text>
          <Button block disabled={busy} onPress={() => setConfirming(false)}>Keep booking</Button>
          <Button block variant="quiet" fill={quietFill} disabled={busy} onPress={cancel}>{busy ? 'Cancelling…' : 'Yes, cancel'}</Button>
        </>
      ) : booking ? (
        <>
          <Text variant="caption" muted center={!wide}>{`Booked for ${dayTime(session.startsAt)}. ${cancelCopy(session.startsAt)}.`}</Text>
          {booking.status === 'checked_in' ? (
            <Button block variant="quiet" fill={quietFill} disabled>Checked in</Button>
          ) : (
            <>
              {checkInClosesAt(session.startsAt) < now()
                ? <Button block variant="quiet" fill={quietFill} disabled>Check-in closed</Button>
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
          <Text variant="caption" muted center={!wide}>This session has already started.</Text>
          <Button block variant="quiet" fill={quietFill} onPress={() => router.replace('/book')}>See other classes</Button>
        </>
      ) : !el.ok && el.needs === 'fit' ? (
        <Button variant="quiet" fill={quietFill} block onPress={() => router.replace('/book')}>See other classes</Button>
      ) : !el.ok && el.needs === 'cleared' ? (
        <>
          <Button variant="signal" block onPress={() => router.push(`/passport/${cls.grants}`)}>See the Passport</Button>
          <Button variant="quiet" fill={quietFill} block onPress={() => router.replace('/book')}>See other classes</Button>
        </>
      ) : !el.ok && el.needs === 'social' ? (
        <>
          {onCalmPath ? <Button variant="signal" block onPress={() => router.push('/goal/calm-around-dogs')}>See the path</Button> : null}
          <Button variant="quiet" fill={quietFill} block onPress={() => router.replace('/book')}>See other classes</Button>
        </>
      ) : !el.ok && el.needs === 'vaccines' ? (
        <>
          <Button variant="signal" block onPress={() => router.push('/vaccines')}>Update vaccines</Button>
          <Button variant="quiet" fill={quietFill} block onPress={() => router.replace('/book')}>See other classes</Button>
        </>
      ) : !el.ok && wide ? (
        <>
          <Text variant="wide" muted>Assessment first</Text>
          {assessment ? (
            <Text variant="label">{`${assessment.cls.title.replace(' assessment', '')} assessment · ${assessment.cls.durationMin} min · ${creditsLabel(assessment.cls.credits)} · ${assessment.partner.name}`}</Text>
          ) : null}
          <Button variant="signal" block onPress={() => assessment && router.push(`/book/${assessment.session.id}`)}>Book assessment</Button>
          <Button variant="quiet" fill={quietFill} block onPress={() => router.replace('/book')}>See other classes</Button>
        </>
      ) : !el.ok ? (
        <>
          {assessment ? (
            <Text variant="caption" muted center={!wide}>{`${assessment.cls.title.replace(' assessment', '')} assessment · ${assessment.cls.durationMin} min · ${creditsLabel(assessment.cls.credits)} · ${assessment.partner.name}`}</Text>
          ) : null}
          <Button variant="signal" block onPress={() => assessment && router.push(`/book/${assessment.session.id}`)}>Book assessment</Button>
          <Button variant="quiet" fill={quietFill} block onPress={() => router.replace('/book')}>See other classes</Button>
        </>
      ) : session.spotsLeft === 0 ? (
        <WaitlistActions v={v} dogId={juno.id} dogName={juno.name} center={!wide} fill={quietFill} />
      ) : wide ? (
        <>
          <View>
            <Text variant="wide" muted>{`${relativeDay(session.startsAt)} · ${cls.openWindow ?? time(session.startsAt)}`}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 6 }}>
              <Text variant="statNum" num>{cls.credits}</Text>
              <Text variant="heading" muted>{cls.credits === 1 ? 'credit' : 'credits'}</Text>
            </View>
          </View>
          <Text variant="caption" muted>{cancelCopy(session.startsAt)}</Text>
          <Button variant="signal" block onPress={() => router.push(`/book/${session.id}`)}>{`Book for ${creditsLabel(cls.credits)}`}</Button>
          <Text variant="caption" muted>{allowance ? `${balance} of ${allowance} credits left this month` : `${creditsLabel(balance)} left`}</Text>
        </>
      ) : (
        <>
          <Text variant="caption" muted center={!wide}>{cancelCopy(session.startsAt)}</Text>
          <Button variant="signal" block onPress={() => router.push(`/book/${session.id}`)}>{`Book for ${creditsLabel(cls.credits)}`}</Button>
        </>
      )}
    </>
  );

  if (wide) {
    return (
      <Page>
        <Press onPress={() => (router.canGoBack() ? router.back() : router.replace('/book'))} accessibilityRole="button" accessibilityLabel="Back to Book" style={{ alignSelf: 'flex-start', height: 40, paddingLeft: 10, paddingRight: 16, borderRadius: 9999, backgroundColor: c.surfaceRaised, flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 }} activeStyle={{ backgroundColor: c.surfaceSunken }}>
          <Icon name="chevron-left" size={18} />
          <Text variant="label" weight="600">Book</Text>
        </Press>
        <View style={{ height: 320, borderRadius: 24, overflow: 'hidden' }}>
          <PhotoFill name={cls.image} />
          <Gradient stops={[['rgba(0,0,0,0.3)', 0], ['rgba(0,0,0,0)', 0.3], ['rgba(0,0,0,0)', 0.45], ['rgba(0,0,0,0.72)', 1]]} />
          <View style={{ position: 'absolute', top: 20, right: 20, flexDirection: 'row', gap: 8 }}>
            <IconButton glass icon="share" label="Share" onPress={() => Share.share({ message: `${cls.title}, ${dayTime(session.startsAt)} at ${partner.name}. Book it on PackPass.` }).catch(() => {})} />
            <IconButton glass icon="bookmark" label={saved ? 'Saved' : 'Save'} onPress={() => setSaved((s) => !s)} style={saved ? { backgroundColor: 'rgba(255,255,255,0.4)' } : undefined} />
          </View>
          <View style={{ position: 'absolute', left: 32, right: 32, bottom: 28 }}>
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
              <Tag tone="glass">{cls.discipline}</Tag>
              <Tag tone="glass">{creditsLabel(cls.credits)}</Tag>
            </View>
            <Text variant="hero" color="#fff" accessibilityRole="header">{cls.title}</Text>
            <Text variant="label" color="rgba(255,255,255,0.85)" style={{ marginTop: 10 }}>{when}</Text>
          </View>
        </View>

        <Columns gap={40} style={{ marginTop: 32 }}>
          <View style={col(999, 520)}>
            {notices}
            <View onLayout={(e) => setStatsW(e.nativeEvent.layout.width)} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {stats}
            </View>
            {builtRow}
            {cls.dropOff ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginTop: 12, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, backgroundColor: c.surfaceRaised }}>
                <Tag>Drop-off</Tag>
                <Text variant="label">Leave your dog with the trainer. Pick up at the end.</Text>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, backgroundColor: c.surfaceRaised }}>
                <Icon name="users" />
                <Text variant="label" weight="600">You stay with your dog.</Text>
              </View>
            )}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 }}>
              <View style={{ width: 8, height: 8, borderRadius: 9999, backgroundColor: c.turf }} />
              <Text variant="label">{`Adds to ${juno.name}'s month: ${cls.balance.toLowerCase()}`}</Text>
            </View>

            <Text variant="title" style={{ marginTop: 36, marginBottom: 10 }}>What happens</Text>
            <Text style={{ maxWidth: 680 }}>{cls.description}</Text>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 36, columnGap: 32, marginTop: 36 }}>
              <View style={tile(280)}>
                <Text variant="title" style={{ marginBottom: 14 }}>Trainer</Text>
                {trainerRow}
                <Text variant="title" style={{ marginTop: 36, marginBottom: 12 }}>Requirements</Text>
                {requirementsList}
              </View>
              <View style={tile(280)}>
                <Text variant="title" style={{ marginBottom: 14 }}>Location</Text>
                {locationCard}
              </View>
            </View>
          </View>
          <View style={col(1, 320, web({ position: 'sticky', top: 24 }))}>
            <View style={{ backgroundColor: c.surfaceRaised, borderRadius: 16, padding: 24, gap: 14 }}>
              {actions}
            </View>
          </View>
        </Columns>
      </Page>
    );
  }

  return (
    <Screen bleed statusLight>
      <ScrollView style={{ flex: 1 }}>
        <View style={{ height: 320, overflow: 'hidden' }}>
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
          {notices}

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {stats}
          </View>
          {builtRow}
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
            {trainerRow}
          </Section>

          <Section title="Location">
            {locationCard}
          </Section>

          <Section title="Requirements" gap={10}>
            {requirementsList}
          </Section>
        </View>
      </ScrollView>

      <Footer>
        {actions}
      </Footer>
    </Screen>
  );
}

