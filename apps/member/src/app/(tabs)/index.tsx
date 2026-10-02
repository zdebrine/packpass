import { router } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { monthDone, monthSuggestions, PLAN, recommended } from '@/data/fixtures';
import { goals, isComplete, stepIndex } from '@/data/passport';
import { AthleteCard, ClassCard } from '@/ds/cards';
import { Button, Tag } from '@/ds/controls';
import { Icon } from '@/ds/Icon';
import { Bars, Screen, SectionTitle, useTop } from '@/ds/layout';
import { Press } from '@/ds/Press';
import { Glass, HeroScrim, Photo, PhotoFill } from '@/ds/Surface';
import { Text } from '@/ds/Text';
import { MapSketch } from '@/features/MapSketch';
import { HeldPlan } from '@/features/today/HeldPlan';
import { activeBookings, bookError, bookingFor, credits as creditsLabel, nextSession, timeLabel } from '@/lib/booking';
import { now } from '@/lib/clock';
import { monthDay, relativeDay, time, weekday } from '@/lib/dates';
import { openDirections } from '@/lib/directions';
import { monthHeader } from '@/lib/log';
import { useApp, useDog, useNotifications, useOriginLabel, useRules } from '@/store/app';
import { useTheme } from '@/theme/ThemeProvider';


/** 02 Today */
export default function Today() {
  const { c } = useTheme();
  const top = useTop();
  const bookings = useApp((s) => s.bookings);
  const credits = useApp((s) => s.credits);
  const social = useApp((s) => s.social);
  const read = useApp((s) => s.readNotifications);
  const juno = useDog();
  const from = useOriginLabel();
  const rules = useRules();
  const notes = useNotifications();
  const canBook = (id: string) => !bookError(id, juno.id, rules);

  const upcoming = activeBookings(bookings).filter((x) => x.booking.status === 'booked' && x.v.session.startsAt >= now());
  const upNext = upcoming[0];
  const unread = notes.some((n) => n.isNew && !read.includes(n.id));
  const goal = goals(social).find((g) => !isComplete(g));
  const step = goal ? goal.steps[stepIndex(goal)] : undefined;
  const stepView = step?.classId ? nextSession(step.classId) : undefined;
  const stepBooked = !!step?.classId && upcoming.some((x) => x.v.cls.id === step.classId);
  // The first suggestion Juno can book that isn't booked yet.
  const suggestion = monthSuggestions
    .map((id) => nextSession(id, 1))
    .find((v) => v && canBook(v.session.id) && !bookingFor(bookings, v.session.id));
  const picks = recommended
    .map(([id, from]) => nextSession(id, from))
    .filter((v): v is NonNullable<typeof v> => !!v && canBook(v.session.id))
    .slice(0, 4);

  const month = [
    ...monthDone.map((m) => ({ key: m.title, meta: m.meta, title: m.title, photo: m.photo, status: 'Done' as string | null, onPress: undefined as undefined | (() => void) })),
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

  return (
    <Screen bleed statusLight>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 32 }}>
        <View style={{ height: 440, overflow: 'hidden' }}>
          {/* The member's dog; a field photo until they add one. */}
          <PhotoFill name={juno.photo ?? 'grass'} position={{ top: '35%', left: '50%' }} />
          <HeroScrim />
          <View style={{ position: 'absolute', top: top + 8, left: 20, right: 20, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Press onPress={() => router.push('/settings')} accessibilityLabel={`Distances from ${from}. Change`}>
              <Glass style={{ height: 44, paddingHorizontal: 16, borderRadius: 9999, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Icon name="map-pin" size={18} color="#fff" />
                <Text variant="wide" color="#fff" style={{ fontSize: 12 }}>{from}</Text>
              </Glass>
            </Press>
            <View style={{ flex: 1 }} />
            <Press onPress={() => router.push('/notifications')} accessibilityLabel={unread ? 'Notifications, unread' : 'Notifications'} style={{ width: 44, height: 44, borderRadius: 9999, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
              <Glass style={{ position: 'absolute', width: 44, height: 44, borderRadius: 9999 }} />
              <Icon name="bell" color="#fff" />
              {unread ? <View style={{ position: 'absolute', top: 10, right: 11, width: 9, height: 9, borderRadius: 9999, backgroundColor: c.agility }} /> : null}
            </Press>
          </View>
          <View style={{ position: 'absolute', left: 20, right: 20, bottom: 52 }}>
            <View style={{ marginBottom: 14 }}><Tag tone="glass">{`${weekday(now())} · ${monthDay(now())}`}</Tag></View>
            <Text variant="displayXl" color="#fff" accessibilityRole="header">{`${juno.name} is due for a hard day.`}</Text>
            <Text variant="label" color="rgba(255,255,255,0.9)" style={{ marginTop: 8 }}>{`Scent work would round out ${juno.name}'s month.`}</Text>
          </View>
        </View>

        <View style={{ marginTop: -28, backgroundColor: c.bg, borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingTop: 20 }}>
          <Press onPress={() => router.push('/dog')} scale={false} style={{ paddingHorizontal: 20 }} accessibilityLabel={`${juno.name}'s profile`}>
            <AthleteCard compact name={juno.name} photo={juno.photo} breed={juno.breed} age={juno.age} stage={juno.stage} streak={9} />
          </Press>

          <View style={{ marginTop: 32, paddingHorizontal: 20 }}>
            <Text variant="title" style={{ marginBottom: 14 }}>Up next</Text>
            {upNext ? (
              <View style={{ backgroundColor: c.surfaceRaised, borderRadius: 28, padding: 12, paddingBottom: 16 }}>
                <Press onPress={() => router.push(`/class/${upNext.v.session.id}`)} scale={false} accessibilityLabel={upNext.v.cls.title}>
                  <MapSketch variant="card" pin={{ left: '48%', top: '22%' }} style={{ height: 104, borderRadius: 20 }} />
                  <View style={{ paddingTop: 14, paddingHorizontal: 8 }}>
                    <Text variant="wide" muted>{`${relativeDay(upNext.v.session.startsAt)} · ${time(upNext.v.session.startsAt)} · ${upNext.v.cls.durationMin} min`}</Text>
                    <Text variant="displayMd" style={{ marginTop: 6 }}>{upNext.v.cls.title}</Text>
                    <Text variant="caption" muted style={{ marginTop: 4 }}>{`${upNext.v.partner.name} · ${upNext.v.partner.street} · ${upNext.v.partner.distanceMi} mi`}</Text>
                  </View>
                </Press>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
                  <Button variant="quiet" fill={c.bg} style={{ flex: 1 }} onPress={() => openDirections(upNext.v.partner)}>Directions</Button>
                  <Button style={{ flex: 1 }} onPress={() => router.push(`/check-in/scan?booking=${upNext.booking.id}`)}>Check in</Button>
                </View>
              </View>
            ) : (
              <View style={{ backgroundColor: c.surfaceRaised, borderRadius: 28, padding: 20 }}>
                <Text>{`Nothing booked this week. Pick a class to keep ${juno.name}'s streak going.`}</Text>
                <View style={{ marginTop: 14, flexDirection: 'row' }}><Button onPress={() => router.push('/book')}>Find a class</Button></View>
              </View>
            )}
          </View>

          <HeldPlan />

          <View style={{ marginTop: 32, paddingHorizontal: 20 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
              <Text variant="title">This month</Text>
              <Text variant="caption" muted>{`${monthHeader().month} · resets ${monthHeader().resets}`}</Text>
            </View>
            <View style={{ gap: 8 }}>
              {month.map((m) => (
                <Press key={m.key} onPress={m.onPress} scale={!!m.onPress} style={{ flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 10, paddingLeft: 10, paddingRight: 14, borderRadius: 20, backgroundColor: c.surfaceRaised }}>
                  <Photo name={m.photo} style={{ width: 44, height: 44, borderRadius: 12 }} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text variant="caption" muted>{m.meta}</Text>
                    <Text variant="label" weight="600">{m.title}</Text>
                  </View>
                  {m.status ? <Tag>{m.status}</Tag> : <Button size="sm" onPress={m.onPress}>Book</Button>}
                </Press>
              ))}
            </View>
          </View>

          {goal ? (
          <View style={{ marginTop: 32, paddingHorizontal: 20 }}>
            <SectionTitle title="Next goal" onMore={() => router.push(`/goal/${goal.id}`)} />
            <View style={{ backgroundColor: c.surfaceRaised, borderRadius: 28, padding: 20, gap: 14 }}>
              <View>
                <Text variant="wide" muted>{`Step ${stepIndex(goal) + 1} of ${goal.steps.length} · ${goal.id === 'calm-around-dogs' ? 'Group sport ready' : 'Calm walks'}`}</Text>
                <Text variant="displayMd" style={{ marginTop: 6 }}>{goal.title}</Text>
              </View>
              <Bars total={goal.steps.length} done={stepIndex(goal)} />
              {stepView ? (
                <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', padding: 10, borderRadius: 20, backgroundColor: c.bg }}>
                  <Photo name={stepView.cls.image} style={{ width: 52, height: 52, borderRadius: 12 }} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text variant="label" weight="600">{step?.title}</Text>
                    <Text variant="caption" muted>{`${stepView.cls.sessionType} · ${stepView.trainer.name} · ${weekday(stepView.session.startsAt).slice(0, 3)} ${timeLabel(stepView)}`}</Text>
                  </View>
                  <Text variant="label" weight="600" num style={{ paddingRight: 6 }}>{creditsLabel(stepView.cls.credits)}</Text>
                </View>
              ) : null}
              {stepView && stepBooked ? (
                <Button block variant="quiet" fill={c.bg} onPress={() => router.push(`/goal/${goal.id}`)}>{`Step ${stepIndex(goal) + 1} booked. See the path`}</Button>
              ) : stepView ? (
                <Button block onPress={() => router.push(`/book/${stepView.session.id}`)}>{`Book step ${stepIndex(goal) + 1}`}</Button>
              ) : null}
            </View>
          </View>
          ) : null}

          <View style={{ marginTop: 32 }}>
            <SectionTitle title={`Recommended for ${juno.name}`} onMore={() => router.push('/book')} style={{ paddingHorizontal: 20 }} />
            <Text variant="caption" muted style={{ marginTop: -8, marginBottom: 14, marginHorizontal: 20 }}>{`Two sprint days this month. These add mental work and fit ${juno.name}'s clearances.`}</Text>
            {picks.length === 0 ? <Text muted style={{ marginHorizontal: 20 }}>Nothing open to book right now.</Text> : null}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingHorizontal: 20 }}>
              {picks.map((v) => {
                const id = v.session.id;
                return (
                  <ClassCard
                    key={id}
                    image={v.cls.image}
                    discipline={v.cls.sessionType === 'Private' ? 'Private' : v.cls.discipline}
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
          </View>

          <View style={{ marginTop: 32, paddingHorizontal: 20 }}>
            <Text variant="title" style={{ marginBottom: 14 }}>Credits</Text>
            <View style={{ backgroundColor: c.surfaceRaised, borderRadius: 28, padding: 20, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                  <Text variant="display2xl" num>{credits}</Text>
                  <Text variant="heading" muted>{`of ${PLAN.credits}`}</Text>
                </View>
                <Text variant="caption" muted style={{ marginTop: 6 }}>{`${credits} of ${PLAN.credits} credits left, resets ${monthHeader().resets}`}</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 4, alignItems: 'flex-end', height: 56 }}>
                {Array.from({ length: PLAN.credits }, (_, i) => (
                  <View key={i} style={{ width: 8, height: 56, borderRadius: 9999, backgroundColor: i < credits ? c.ink : c.surfaceSunken }} />
                ))}
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}
