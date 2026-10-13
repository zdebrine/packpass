import { router } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { catalog } from '@/data/catalog';
import { monthSuggestions, recommended } from '@/data/fixtures';
import { isComplete, stepIndex } from '@/data/passport';
import { useGoals } from '@/lib/paths';
import { AthleteCard, ClassCard } from '@/ds/cards';
import { Button, StatusBadge, Tag } from '@/ds/controls';
import { Bars, Card, EmptyState, IconButton, Row, Screen, SectionTitle, useTop } from '@/ds/layout';
import { col, Columns, Page, useWide } from '@/ds/responsive';
import { Press } from '@/ds/Press';
import { HeroScrim, Photo, PhotoFill } from '@/ds/Surface';
import { Text } from '@/ds/Text';
import { Map, useMe } from '@/features/Map';
import { HeldPlan } from '@/features/today/HeldPlan';
import { activeBookings, bookError, bookingFor, checkInClosesAt, credits as creditsLabel, nextSession, timeLabel } from '@/lib/booking';
import { now } from '@/lib/clock';
import { monthDay, relativeDay, time, weekday } from '@/lib/dates';
import { openDirections } from '@/lib/directions';
import { monthHeader } from '@/lib/log';
import { useDogStats, useMonthDone } from '@/lib/stats';
import { useAllowance, useApp, useDog, useNotifications, useOriginLabel, useRules } from '@/store/app';
import { useTheme } from '@/theme/ThemeProvider';


/** 02 Today */
export default function Today() {
  const { c } = useTheme();
  const top = useTop();
  const wide = useWide();
  const bookings = useApp((s) => s.bookings);
  const credits = useApp((s) => s.credits);
  const allowance = useAllowance();
  const read = useApp((s) => s.readNotifications);
  const juno = useDog();
  const from = useOriginLabel();
  const rules = useRules();
  const notes = useNotifications();
  const me = useMe();
  const canBook = (id: string) => !bookError(id, juno.id, rules);

  // Today is the dog that's showing: its classes, holds, goals and month. Other dogs' show when they're picked.
  const upcoming = activeBookings(bookings.filter((b) => b.dogId === juno.id))
    .filter((x) => x.booking.status === 'booked' && checkInClosesAt(x.v.session.startsAt) >= now());
  const upNext = upcoming[0];
  const unread = notes.some((n) => n.isNew && !read.includes(n.id));
  const goal = useGoals().goals.find((g) => !isComplete(g));
  const step = goal ? goal.steps[stepIndex(goal)] : undefined;
  const stepView = step?.classId ? nextSession(step.classId) : undefined;
  const stepBooked = !!step?.classId && upcoming.some((x) => x.v.cls.id === step.classId);
  const { done, short } = useMonthDone();
  const stats = useDogStats();
  // The first suggestion Juno can book that isn't booked yet. Live mode suggests the soonest class in the
  // balance the month is shortest on.
  const suggestIds = short ? Object.values(catalog.classes).filter((k) => k.balance === short).map((k) => k.id) : monthSuggestions;
  const suggestion = suggestIds
    .map((id) => nextSession(id, 1))
    .filter((v) => v && canBook(v.session.id) && !bookingFor(bookings.filter((b) => b.dogId === juno.id), v.session.id))
    .sort((a, b) => (short ? +a!.session.startsAt - +b!.session.startsAt : 0))[0];
  const picks = recommended
    .map(([id, from]) => nextSession(id, from))
    .filter((v): v is NonNullable<typeof v> => !!v && canBook(v.session.id))
    .slice(0, 4);

  const month = [
    ...done.map((m) => ({ ...m, status: 'Done' as string | null, onPress: undefined as undefined | (() => void) })),
    ...upcoming.slice(0, 4).map(({ booking, v }) => ({
      key: booking.id,
      meta: `Booked · ${weekday(v.session.startsAt).slice(0, 3)} ${monthDay(v.session.startsAt)} · ${v.cls.balance}`,
      title: `${v.cls.title} · ${creditsLabel(booking.credits)}`,
      photo: v.cls.image,
      status: 'Booked',
      onPress: () => router.push(`/class/${v.session.id}`),
    })),
    ...(!suggestion ? [] : [{
      key: 'suggested',
      meta: `Suggested · ${weekday(suggestion.session.startsAt).slice(0, 3)} ${time(suggestion.session.startsAt)} · ${suggestion.cls.balance}`,
      title: `${suggestion.cls.title} · ${creditsLabel(suggestion.cls.credits)}`,
      photo: suggestion.cls.image,
      status: null,
      onPress: () => router.push(`/class/${suggestion.session.id}`),
    }]),
  ];

  const creditsTrail = (
    <Press onPress={() => router.push('/plan')} scale={false} accessibilityRole="button" accessibilityLabel={`${allowance ? `${credits} of ${allowance}` : credits} credits left. Plan and credits`} style={{ alignItems: 'flex-end' }}>
      <Text variant="statNum" style={{ fontSize: 22, lineHeight: 24 }}>{credits}</Text>
      <Text style={{ fontSize: 11, lineHeight: 14 }} muted>{allowance ? `of ${allowance} credits` : credits === 1 ? 'credit' : 'credits'}</Text>
    </Press>
  );
  const athlete = (
    <Press onPress={() => router.push('/dog')} scale={false} accessibilityLabel={`${juno.name}'s profile`}>
      <AthleteCard compact name={juno.name} photo={juno.photo} breed={juno.breed} age={juno.age} stage={juno.stage} streak={stats.streak >= 2 ? stats.streak : undefined}
        trailing={wide ? undefined : creditsTrail} />
    </Press>
  );

  const upNextMap = (h: number) => {
    const p = upNext?.v.partner;
    if (!p) return null;
    const at: [number, number] | null = p.lat != null && p.lng != null ? [p.lat, p.lng] : null;
    return at ? (
      <Map center={at} zoom={15} radius={0} height={h} me={me} pins={[{ lat: at[0], lng: at[1], active: true, title: p.name }]} />
    ) : <View style={{ height: h, backgroundColor: c.surfaceRaised }} />;
  };
  const upNextCard = !upNext ? (
    <Card line>
      <EmptyState icon="calendar" title="Nothing booked this week" body={`Pick a class to keep ${juno.name}'s streak going.`}>
        <Button onPress={() => router.push('/book')}>Find a class</Button>
      </EmptyState>
    </Card>
  ) : (
    <Card line style={{ overflow: 'hidden' }}>
      <View style={{ padding: 16, gap: 4 }}>
        <Press onPress={() => router.push(`/class/${upNext.v.session.id}`)} scale={false} accessibilityLabel={upNext.v.cls.title} style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <StatusBadge tone="signal">{relativeDay(upNext.v.session.startsAt)}</StatusBadge>
            <Text variant="caption" muted>{`${time(upNext.v.session.startsAt)} · ${upNext.v.cls.durationMin} min · ${creditsLabel(upNext.booking.credits)}`}</Text>
          </View>
          <Text variant="headline" style={{ marginTop: 4 }}>{upNext.v.cls.title}</Text>
          <Text variant="caption" muted>{`${upNext.v.partner.name} · ${upNext.v.partner.street} · ${upNext.v.partner.distanceMi} mi`}</Text>
        </Press>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: wide ? 'wrap' : 'nowrap' }}>
          <Button icon="scan-line" style={{ flex: 1 }} onPress={() => router.push(`/check-in/scan?booking=${upNext.booking.id}`)}>Check in</Button>
          <Button icon="navigation" variant="outline" style={{ flex: 1 }} onPress={() => openDirections(upNext.v.partner)}>Directions</Button>
          {wide ? <Button variant="ghost" onPress={() => router.push(`/class/${upNext.v.session.id}`)}>Details</Button> : null}
        </View>
      </View>
      {upNextMap(wide ? 180 : 112)}
    </Card>
  );

  const monthSection = (
    <>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <Text variant="title">This month</Text>
        <Text variant="caption" muted>{`${monthHeader().month} · resets ${monthHeader().resets}`}</Text>
      </View>
      <View style={wide ? { flexDirection: 'row', flexWrap: 'wrap', columnGap: 24 } : null}>
        {month.map((m, i) => (
          <Row
            key={m.key}
            onPress={m.onPress}
            last={wide ? false : i === month.length - 1}
            style={wide ? { flexBasis: 300, flexGrow: 1, minHeight: 56 } : null}
            thumb={<Photo name={m.photo} style={{ width: 44, height: 44 }} />}
            title={m.title}
            meta={m.meta}
            trail={m.status ? <StatusBadge>{m.status}</StatusBadge> : <Button size="sm" variant="outline" onPress={m.onPress}>Book</Button>}
          />
        ))}
      </View>
    </>
  );

  const goalSection = goal ? (
    <>
      <SectionTitle title="Next goal" onMore={() => router.push(`/goal/${goal.id}`)} />
      <Card line style={{ padding: 16, gap: 12 }}>
        <View style={{ gap: 4 }}>
          <Text variant="caption" muted>{`Step ${stepIndex(goal) + 1} of ${goal.steps.length} · ${goal.id === 'calm-around-dogs' ? 'Group sport ready' : 'Calm walks'}`}</Text>
          <Text variant="title">{goal.title}</Text>
        </View>
        <Bars total={goal.steps.length} done={stepIndex(goal)} height={4} />
        {stepView ? (
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: c.line }}>
            <Photo name={stepView.cls.image} style={{ width: 44, height: 44, borderRadius: 12 }} />
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <Text variant="heading">{step?.title}</Text>
              <Text variant="caption" muted>{`${stepView.cls.sessionType} · ${stepView.trainer.name} · ${weekday(stepView.session.startsAt).slice(0, 3)} ${timeLabel(stepView)}`}</Text>
            </View>
            <Text variant="caption" num>{creditsLabel(stepView.cls.credits)}</Text>
          </View>
        ) : null}
        {stepView && stepBooked ? (
          <Button block variant="outline" onPress={() => router.push(`/goal/${goal.id}`)}>{`Step ${stepIndex(goal) + 1} booked. See the path`}</Button>
        ) : stepView ? (
          <Button block onPress={() => router.push(`/book/${stepView.session.id}`)}>{`Book step ${stepIndex(goal) + 1}`}</Button>
        ) : null}
      </Card>
    </>
  ) : null;

  const gutter = wide ? 0 : 20;
  const recommendedSection = (
    <>
      <SectionTitle
        title={`Recommended for ${juno.name}`}
        onMore={() => router.push('/book')}
        style={{ paddingHorizontal: gutter, alignItems: 'flex-start' }}
      />
      <Text variant="caption" muted style={{ marginTop: -10, marginBottom: 12, marginHorizontal: gutter, maxWidth: 520 }}>{`Two sprint days this month. These add mental work and fit ${juno.name}'s clearances.`}</Text>
      {picks.length === 0 ? <Text muted style={{ marginHorizontal: gutter }}>Nothing open to book right now.</Text> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingHorizontal: gutter, paddingBottom: wide ? 4 : 0 }}>
        {picks.map((v) => {
          const id = v.session.id;
          return (
            <ClassCard
              key={id}
              image={v.cls.image}
              discipline={v.cls.sessionType === 'Private' ? 'Private' : v.cls.discipline}
              dropOff={v.cls.dropOff}
              title={v.cls.title}
              partner={v.cls.sessionType === 'Private' ? v.trainer.name : v.partner.name}
              time={`${weekday(v.session.startsAt).slice(0, 3)} ${timeLabel(v)}`}
              credits={v.cls.credits}
              spotsLeft={v.session.spotsLeft}
              onPress={() => router.push(`/class/${id}`)}
            />
          );
        })}
      </ScrollView>
    </>
  );

  const heroTags = (
    <>
      <Press onPress={() => router.push('/settings')} scale={false} accessibilityLabel={`Distances from ${from}. Change`}>
        <Tag tone="glass" icon="map-pin">{from}</Tag>
      </Press>
      <View><Tag tone="glass">{`${weekday(now())} · ${monthDay(now())}`}</Tag></View>
    </>
  );

  if (wide) {
    // 02 Today, desktop: a photo header, then the plan on the left and the dog and goal on the right (credits live in the sidebar).
    return (
      <Page>
        <View style={{ height: 240, borderRadius: 24, overflow: 'hidden' }}>
          <PhotoFill name={juno.photo ?? 'dog_and_owner_chilling'} position={{ top: '35%', left: '50%' }} />
          <HeroScrim />
          <View style={{ position: 'absolute', top: 20, left: 24, right: 24, flexDirection: 'row', alignItems: 'center', gap: 6 }}>{heroTags}</View>
          <View style={{ position: 'absolute', left: 24, right: 24, bottom: 24, flexDirection: 'row', flexWrap: 'wrap', gap: 20, alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <View style={{ maxWidth: 640, gap: 6 }}>
              <Text variant="hero" color="#fff" style={{ fontSize: 40, lineHeight: 44 }} accessibilityRole="header">{`${juno.name} is due for a hard day.`}</Text>
              <Text variant="label" weight="400" color="rgba(255,255,255,0.9)">{`Scent work would round out ${juno.name}'s month.`}</Text>
            </View>
            <Button variant="glass" size="sm" onPress={() => router.push('/book')}>Find a class</Button>
          </View>
        </View>
        <Columns style={{ marginTop: 24 }} gap={24}>
          <View style={col(999, 520, { gap: 32 })}>
            <View style={{ gap: 12 }}>
              <Text variant="title">Up next</Text>
              {upNextCard}
            </View>
            <HeldPlan dogId={juno.id} style={{ marginTop: 0, paddingHorizontal: 0 }} />
            <View>{monthSection}</View>
            <View>{recommendedSection}</View>
          </View>
          <View style={col(1, 260, { maxWidth: 320, gap: 24 })}>
            {athlete}
            {goalSection ? <View>{goalSection}</View> : null}
          </View>
        </Columns>
      </Page>
    );
  }

  return (
    <Screen bleed statusLight>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 32 }}>
        <View style={{ height: 300, overflow: 'hidden' }}>
          {/* The member's dog; a field photo until they add one. */}
          <PhotoFill name={juno.photo ?? 'dog_and_owner_chilling'} position={{ top: '35%', left: '50%' }} />
          <HeroScrim />
          <View style={{ position: 'absolute', top: top + 6, left: 20, right: 20, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {heroTags}
            <View style={{ flex: 1 }} />
            <IconButton icon="bell" glass dot={unread} label={unread ? 'Notifications, unread' : 'Notifications'} onPress={() => router.push('/notifications')} />
          </View>
          <View style={{ position: 'absolute', left: 20, right: 20, bottom: 44, gap: 6 }}>
            <Text variant="hero" color="#fff" accessibilityRole="header">{`${juno.name} is due for a hard day.`}</Text>
            <Text variant="label" weight="400" color="rgba(255,255,255,0.9)">{`Scent work would round out ${juno.name}'s month.`}</Text>
          </View>
        </View>

        <View style={{ marginTop: -24, backgroundColor: c.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 20, gap: 32 }}>
          <View style={{ paddingHorizontal: 20, gap: 12 }}>
            <Text variant="title">Up next</Text>
            {upNextCard}
          </View>

          <View style={{ paddingHorizontal: 20 }}>{athlete}</View>

          <HeldPlan dogId={juno.id} style={{ marginTop: 0 }} />

          <View style={{ paddingHorizontal: 20 }}>{monthSection}</View>

          {goalSection ? <View style={{ paddingHorizontal: 20 }}>{goalSection}</View> : null}

          <View>{recommendedSection}</View>
        </View>
      </ScrollView>
    </Screen>
  );
}
