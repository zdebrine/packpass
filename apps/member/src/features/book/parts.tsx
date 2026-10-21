// Book's pieces (03 Book · browse, 03b Book · category, 04 Book · map): what each session means for the active dog,
// and the rows and cards that show it.
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { catalog } from '@/data/catalog';
import type { Dog } from '@/data/types';
import { Button, Tag } from '@/ds/controls';
import { Icon } from '@/ds/Icon';
import { Press } from '@/ds/Press';
import { Gradient, Photo, PhotoFill } from '@/ds/Surface';
import { Text } from '@/ds/Text';
import { assessmentFor, credits, eligibility, needsSocial, nextSession, timeLabel, type RuleContext, type SessionView } from '@/lib/booking';
import { BUILT_FOR, type Fit } from '@/lib/fit';
import { useTheme } from '@/theme/ThemeProvider';
import { radius } from '@/theme/tokens';

/** Open: the dog can book it now. Unlock: one step away (an assessment, a clearance, vaccines). No: a gate says it isn't for the dog. */
export type Access = 'open' | 'unlock' | 'no';

export interface BookRow {
  v: SessionView;
  access: Access;
  /** Open: why it's open ("Social cleared"). Unlock: what's missing. No: the class's rule ("Puppies 4 to 12 months"). */
  why: string;
  /** Unlock: the step that opens it. */
  fix?: { label: string; href: string };
  fit: Fit;
}

/** What a session means for the dog: open, one step away, or not for it, and why. Null for an assessment the dog already passed. */
export function bookRow(v: SessionView, rules: RuleContext, dogName: string, fit: Fit, onPath: (id: string) => boolean): BookRow | null {
  const e = eligibility(v, rules, dogName);
  const { cls } = v;
  if (!e.ok && e.needs === 'cleared') return null;
  if (!e.ok && e.needs === 'fit') return { v, access: 'no', why: e.label, fit };
  if (!e.ok && e.needs === 'herding') {
    const a = assessmentFor(cls);
    return {
      v, access: 'unlock', why: 'Needs a Herding assessment', fit,
      fix: a ? { label: `Book the assessment · ${credits(a.cls.credits)}`, href: `/book/${a.session.id}` } : { label: 'See the class', href: `/class/${v.session.id}` },
    };
  }
  if (!e.ok && e.needs === 'social') {
    if (onPath('calm-around-dogs')) return { v, access: 'unlock', why: 'Needs a Social clearance', fit, fix: { label: 'See the path', href: '/goal/calm-around-dogs' } };
    const a = socialAssessment();
    return {
      v, access: 'unlock', why: 'Needs a Social clearance', fit,
      fix: a ? { label: `Book a Social assessment · ${credits(a.cls.credits)}`, href: `/book/${a.session.id}` } : { label: 'See the class', href: `/class/${v.session.id}` },
    };
  }
  if (!e.ok) {
    const denied = rules.recordsDenied;
    return { v, access: 'unlock', why: denied ? 'Needs a new vet record' : 'Needs current vaccines', fit, fix: { label: denied ? 'Upload a vet record' : 'Update vaccines', href: '/vaccines' } };
  }
  const why = [
    needsSocial(cls) ? (rules.hasSocial ? 'Social cleared' : 'On your path') : null,
    cls.requiresFixed ? 'Spayed or neutered' : null,
  ].filter(Boolean);
  return { v, access: 'open', why: why.length ? why.join(' · ') : cls.groupSize === 1 && cls.sessionType === 'Class' ? 'Solo session' : 'No clearance needed', fit };
}

/** The soonest Social assessment anywhere: it opens group classes at every partner. */
function socialAssessment(): SessionView | undefined {
  return Object.values(catalog.classes)
    .filter((c) => c.grants === 'social')
    .map((c) => nextSession(c.id))
    .filter((s): s is SessionView => !!s)
    .sort((a, b) => +a.session.startsAt - +b.session.startsAt)[0];
}

/** "Border Collie · 3 yrs · Social cleared". */
export const dogLine = (dog: Dog, hasSocial: boolean) => [dog.breed, dog.age, hasSocial ? 'Social cleared' : null].filter(Boolean).join(' · ');

/** "6:30" over "pm"; a sniff space's open window as "4:00" over "to 8 pm". */
export function timeParts(v: SessionView): [string, string] {
  const w = v.cls.openWindow?.match(/(\d+:\d+)\s*(?:am|pm)?\s*to\s*(\d+)(?::00)?(?::\d+)?\s*(am|pm)/i);
  if (w) return [w[1], `to ${w[2]} ${w[3]}`];
  const m = timeLabel(v).match(/^(\S+)\s+(.*)$/);
  return m ? [m[1], m[2]] : [timeLabel(v), ''];
}

/** "Ridgeline Dog Sport · 2.4 mi", with the trainer first for a private session. */
export const placeLine = (v: SessionView) =>
  `${v.cls.sessionType === 'Private' ? `${v.trainer.name} · ` : ''}${v.partner.name} · ${v.partner.distanceMi.toFixed(1)} mi`;

const spotsCopy = (n: number) => (n === 0 ? 'Full' : n === 1 ? 'Last spot' : `${n} left`);
const go = (v: SessionView) => () => router.push(`/class/${v.session.id}`);

/** The open, one-step-away or not-for-the-dog line under a class. */
export function AccessLine({ row, dogName }: { row: BookRow; dogName: string }) {
  const { c } = useTheme();
  const icon = row.access === 'open' ? 'shield-check' : row.access === 'unlock' ? 'lock' : 'ban';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 5, minWidth: 0 }}>
      <View style={{ marginTop: 1.5 }}><Icon name={icon} size={13} color={row.access === 'open' ? c.turf : c.ink} /></View>
      <Text style={{ fontSize: 12, lineHeight: 16, flexShrink: 1 }} weight="600">
        {row.access === 'no' ? `Not for ${dogName} · ${row.why}` : row.why}
      </Text>
    </View>
  );
}

/** A class as a row: time, thumbnail, title, place and access, credits and spots. */
export function BookRowView({ row, dogName, first }: { row: BookRow; dogName: string; first?: boolean }) {
  const { c } = useTheme();
  const { v } = row;
  const [t, ap] = timeParts(v);
  const low = v.session.spotsLeft === 1 && row.access !== 'no';
  return (
    <Press
      onPress={go(v)}
      scale={false}
      accessibilityLabel={v.cls.title}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: first ? 0 : StyleSheet.hairlineWidth * 2, borderTopColor: c.line, opacity: row.access === 'no' ? 0.5 : 1 }}
    >
      <View style={{ minWidth: 44 }}>
        <Text variant="heading" num style={{ lineHeight: 18 }}>{t}</Text>
        <Text variant="caption" muted style={{ lineHeight: 15 }}>{ap}</Text>
      </View>
      <View style={{ width: 44, height: 44, borderRadius: radius.thumb, overflow: 'hidden', backgroundColor: c.surfaceSunken }}>
        <Photo name={v.cls.image} style={StyleSheet.absoluteFill} />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text variant="heading">{v.cls.title}</Text>
        <Text variant="caption" muted>{placeLine(v)}</Text>
        <AccessLine row={row} dogName={dogName} />
      </View>
      <View style={{ alignItems: 'flex-end', gap: 2 }}>
        <Text variant="label" weight="600" num>{credits(v.cls.credits)}</Text>
        <Text variant="caption" color={low ? c.kennelRed : c.inkMuted}>{spotsCopy(v.session.spotsLeft)}</Text>
      </View>
    </Press>
  );
}

/** "Open to Juno": a photo card for a class the dog can book now. */
export function OpenCard({ row, dogName, dayLabel, width = 200, height = 240 }: { row: BookRow; dogName: string; dayLabel: string; width?: number; height?: number }) {
  const { v } = row;
  const built = row.fit.builtFor ? BUILT_FOR[row.fit.builtFor] : null;
  return (
    <Press onPress={go(v)} accessibilityLabel={v.cls.title} style={{ width, gap: 10 }}>
      <View style={{ height, borderRadius: 20, overflow: 'hidden' }}>
        <PhotoFill name={v.cls.image} />
        <Gradient stops={[['rgba(0,0,0,0.38)', 0], ['rgba(0,0,0,0)', 0.32]]} />
        <View style={{ position: 'absolute', top: 12, left: 12, right: 12, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 }}>
          <Tag tone="glass">{credits(v.cls.credits)}</Tag>
          {built ? <Tag tone="glass">{built.charAt(0).toUpperCase() + built.slice(1)}</Tag> : null}
        </View>
      </View>
      <View style={{ gap: 3, minWidth: 0 }}>
        <Text variant="heading" numberOfLines={1}>{v.cls.title}</Text>
        <Text variant="caption" muted numberOfLines={1}>{`${dayLabel} · ${timeLabel(v)} · ${v.cls.durationMin} min`}</Text>
        <Text variant="caption" muted numberOfLines={1}>{placeLine(v)}</Text>
        <View style={{ marginTop: 3 }}><AccessLine row={row} dogName={dogName} /></View>
      </View>
    </Press>
  );
}

/** "Unlock next": a class one step away, with the step as a button. */
export function UnlockCard({ row, dogName, dayLabel, width }: { row: BookRow; dogName: string; dayLabel: string; width?: number }) {
  const { c } = useTheme();
  const { v } = row;
  return (
    <View style={{ width, gap: 12, padding: 14, borderRadius: 20, backgroundColor: c.surfaceRaised }}>
      <Press onPress={go(v)} scale={false} accessibilityLabel={v.cls.title} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 56, height: 56, borderRadius: radius.thumb, overflow: 'hidden', backgroundColor: c.surfaceSunken }}>
          <Photo name={v.cls.image} style={StyleSheet.absoluteFill} />
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text variant="heading" numberOfLines={1}>{v.cls.title}</Text>
          <Text variant="caption" muted numberOfLines={1}>{`${dayLabel} · ${timeLabel(v)} · ${v.cls.durationMin} min`}</Text>
          <Text variant="caption" muted numberOfLines={1}>{placeLine(v)}</Text>
          <AccessLine row={row} dogName={dogName} />
        </View>
      </Press>
      {row.fix ? <Button size="sm" block onPress={() => router.push(row.fix!.href as never)}>{row.fix.label}</Button> : null}
    </View>
  );
}

/** A section heading: "Sport 6" over a muted line, with an optional arrow. */
export function SectionHead({ title, count, sub, onMore, moreLabel }: { title: string; count?: number; sub?: string; onMore?: () => void; moreLabel?: string }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="title" accessibilityRole="header">
          {title}
          {count != null ? <Text variant="title" weight="500" muted>{` ${count}`}</Text> : null}
        </Text>
        {sub ? <Text variant="caption" muted style={{ marginTop: 2 }}>{sub}</Text> : null}
      </View>
      {onMore ? (
        <Press onPress={onMore} accessibilityRole="button" accessibilityLabel={moreLabel} style={{ width: 36, height: 36, borderRadius: 9999, backgroundColor: c.surfaceRaised, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="arrow-right" size={18} />
        </Press>
      ) : null}
    </View>
  );
}

/** "Hiding 1 class Juno can't join: dogs 8 years and up." with Show and Hide. */
export function HiddenLine({ rows, dogName, showing, onToggle }: { rows: BookRow[]; dogName: string; showing: boolean; onToggle: () => void }) {
  const { c } = useTheme();
  if (!rows.length) return null;
  const classes = new Set(rows.map((r) => r.v.cls.id)).size;
  const why = [...new Set(rows.map((r) => r.why.replace(/^./, (x) => x.toLowerCase())))].join(', ');
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingRight: 12, paddingLeft: 16, borderRadius: 16, backgroundColor: c.surfaceRaised, maxWidth: 640 }}>
      <Text variant="caption" style={{ flex: 1 }}>
        {showing ? `Showing classes ${dogName} can't join, greyed out.` : `Hiding ${classes === 1 ? '1 class' : `${classes} classes`} ${dogName} can't join: ${why}.`}
      </Text>
      <Press onPress={onToggle} accessibilityRole="button" style={{ height: 32, paddingHorizontal: 14, borderRadius: 9999, justifyContent: 'center', backgroundColor: c.bg }}>
        <Text variant="label" weight="600">{showing ? 'Hide' : 'Show'}</Text>
      </Press>
    </View>
  );
}

/** Rows grouped under "1.1 mi · Northside Canine", nearest place first. */
export function PlaceGroup({ title, n, children }: { title: string; n: number; children: ReactNode }) {
  const { c } = useTheme();
  return (
    <View style={{ minWidth: 0 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: c.line }}>
        <Text variant="label" weight="600" style={{ flex: 1 }} numberOfLines={1}>{title}</Text>
        <Text variant="caption" muted>{n === 1 ? '1 class' : `${n} classes`}</Text>
      </View>
      {children}
    </View>
  );
}
