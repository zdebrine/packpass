import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { clearanceName } from '@/data/catalog';
import type { Waiver } from '@/data/types';
import { Field, Row } from '@/ds/layout';
import { Icon } from '@/ds/Icon';
import { Text } from '@/ds/Text';
import { ReadyBadge, Notice } from '@/features/ready/parts';
import { assessmentFor, credits as creditsLabel, type Eligibility, type SessionView } from '@/lib/booking';
import { dayOffset, monthDay, shortDay, time, weekday } from '@/lib/dates';
import { vaccineRows, type VaccineRow } from '@/lib/ready';
import type { Vaccine } from '@/store/app';
import { useTheme } from '@/theme/ThemeProvider';

/** Booking sheet blockers (Scheduling flow: block-social, block-vaccine, block-waiver, block-credits, block-full). */

type Needs = Extract<Eligibility, { ok: false }>;

/** The clearance a blocked class asks for, and the next assessment that grants it. */
export function clearanceBlock(v: SessionView, el: Needs) {
  const type = el.needs === 'social' ? 'social' : el.needs === 'herding' ? 'herding' : el.needs === 'clearance' ? el.clearance : null;
  if (!type) return null;
  return { type, assessment: assessmentFor(v.cls, type) };
}

/** block-social: what the dog needs first, and the next assessment for it. */
export function ClearanceBlocker({ v, el, dogName }: { v: SessionView; el: Needs; dogName: string }) {
  const b = clearanceBlock(v, el);
  if (!b) return null;
  const name = clearanceName(b.type);
  const body = b.type === 'social' ? `${v.cls.title} is for dogs cleared to work around other dogs off leash.`
    : b.type === 'herding' ? `${v.partner.name} assesses every dog before ${v.cls.title}.`
      : el.reason;
  const a = b.assessment;
  return (
    <View style={{ gap: 20 }}>
      <Notice icon="shield" title={`${dogName} needs ${/^[AEIOU]/.test(name) ? 'an' : 'a'} ${name} clearance first.`} body={body} />
      {a ? (
        <View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginBottom: 4 }}>
            <Text variant="title">Next open assessment</Text>
            {dayOffset(a.session.startsAt, v.session.startsAt) < 0 ? <Text variant="caption" muted>{`Before ${weekday(v.session.startsAt)}`}</Text> : null}
          </View>
          <Row title={a.cls.title} last thumb={<Icon name="shield-check" />}
            meta={`${a.partner.name} · ${a.cls.durationMin} min · ${creditsLabel(a.cls.credits)}${a.cls.dropOff ? '' : ' · You stay'}`}
            trail={<Text variant="label" num>{`${shortDay(a.session.startsAt)} ${time(a.session.startsAt)}`}</Text>}
            onPress={() => router.replace(`/book/${a.session.id}`)} />
        </View>
      ) : null}
    </View>
  );
}

/** The vaccine a booking is waiting on: missing or expired now, else one that runs out before the class. */
export function vaccineFix(vaccines: Vaccine[], on: Date): VaccineRow | null {
  const rows = vaccineRows(vaccines);
  return rows.find((r) => r.status === 'needed' || r.status === 'expired')
    ?? rows.find((r) => r.expires && dayOffset(on, r.expires) > 0)
    ?? null;
}

/** block-vaccine: the dog's three records, with the one to upload. */
export function VaccineBlocker({ v, vaccines, dogName, denied }: { v: SessionView; vaccines: Vaccine[]; dogName: string; denied: boolean }) {
  const rows = vaccineRows(vaccines);
  const fix = vaccineFix(vaccines, v.session.startsAt);
  const title = denied ? `PackPass couldn't accept ${dogName}'s vet record.`
    : !fix ? `${dogName}'s vaccines need updating.`
      : fix.status === 'needed' ? `${dogName} needs a ${fix.type} record.`
        : fix.status === 'expired' ? `${dogName}'s ${fix.type} expired ${monthDay(fix.expires!)}.`
          : `${dogName}'s ${fix.type} expires before this class.`;
  return (
    <View style={{ gap: 16 }}>
      <Notice icon="syringe" tone="warn" title={title} body={`${v.partner.name} asks for current Rabies, DHPP and Bordetella.`} />
      {denied ? null : (
        <View>
          {rows.map((r, i) => (
            <Row key={r.type} title={r.type} meta={r.meta} thumb={<Icon name="syringe" />} last={i === rows.length - 1}
              trail={<ReadyBadge status={r.type === fix?.type && r.status === 'done' ? 'soon' : r.status} />} />
          ))}
        </View>
      )}
      <Text variant="caption" muted>Upload a new record and the booking goes through. PackPass saves it for every partner.</Text>
    </View>
  );
}

/** block-credits */
export function CreditsBlocker({ v, credits }: { v: SessionView; credits: number }) {
  return (
    <Notice icon="wallet" tone="warn"
      title={`${v.cls.title} needs ${creditsLabel(v.cls.credits)}. You have ${credits}.`}
      body={`Add credits now to book ${weekday(v.session.startsAt)}, or pick a 1-credit class.`} />
  );
}

/** block-full */
export function FullBlocker({ v }: { v: SessionView }) {
  return <Notice icon="users" title="This class is full." body={v.cls.groupSize > 1 ? `${v.cls.groupSize} of ${v.cls.groupSize} spots taken.` : 'Every time this day is taken.'} />;
}

function Checkbox({ checked, onPress, label }: { checked: boolean; onPress: () => void; label: string }) {
  const { c } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="checkbox" accessibilityState={{ checked }} accessibilityLabel={label} hitSlop={6}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View style={{ width: 22, height: 22, borderRadius: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: checked ? c.ink : 'transparent', borderWidth: checked ? 0 : 1.5, borderColor: c.lineStrong }}>
        {checked ? <Icon name="check" size={14} color={c.bg} /> : null}
      </View>
      <Text variant="label" style={{ flex: 1 }}>{label}</Text>
    </Pressable>
  );
}

/** The partner's (or PackPass's) name for a waiver. */
export const waiverOwner = (w: Waiver, partnerName: string) => (w.partnerId ? partnerName : 'PackPass');

/** block-waiver: the waiver in short, a link to all of it, and a typed-name signature with an agree box. */
export function WaiverBlocker({ waiver, partnerName, name, setName, agree, setAgree }: {
  waiver: Waiver; partnerName: string; name: string; setName: (v: string) => void; agree: boolean; setAgree: (v: boolean) => void;
}) {
  const { c } = useTheme();
  const owner = waiverOwner(waiver, partnerName);
  const points = waiver.summary.length ? waiver.summary : waiver.body ? [waiver.body.trim().split(/\n\s*\n/)[0]] : [];
  return (
    <View style={{ gap: 16 }}>
      {waiver.partnerId
        ? <Notice icon="file-pen" title={`First class at ${partnerName}. Sign their waiver.`} body={`Once only. Later bookings with ${partnerName} skip this step.`} />
        : <Notice icon="file-pen" title="Sign the PackPass waiver to book." body="Once only. It covers every class booked through PackPass, for every dog on your account." />}
      <View style={{ borderRadius: 16, backgroundColor: c.surfaceRaised, padding: 16, gap: 12 }}>
        <Text variant="heading" weight="600">{`${owner} waiver, in short`}</Text>
        {points.map((p, i) => (
          <View key={i} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
            <View style={{ marginTop: 2 }}><Icon name="check" size={16} /></View>
            <Text variant="label" weight="400" style={{ flex: 1 }}>{p}</Text>
          </View>
        ))}
        <Pressable accessibilityRole="link" onPress={() => router.push({ pathname: '/waiver', params: { id: waiver.id } })}>
          <Text variant="caption" style={{ textDecorationLine: 'underline' }}>Read the full waiver</Text>
        </Pressable>
        <Field label="Sign with your full name" value={name} onChangeText={setName} autoCapitalize="words" autoComplete="name" textContentType="name" />
        <Checkbox checked={agree} onPress={() => setAgree(!agree)} label={`I agree to ${owner === 'PackPass' ? 'the PackPass' : `${owner}'s`} waiver`} />
      </View>
    </View>
  );
}
