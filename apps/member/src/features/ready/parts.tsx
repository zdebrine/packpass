import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { catalog } from '@/data/catalog';
import type { Waiver } from '@/data/types';
import { StatusBadge } from '@/ds/controls';
import { Icon, type IconName } from '@/ds/Icon';
import { Badge, Row } from '@/ds/layout';
import { Text } from '@/ds/Text';
import { fromIso } from '@/lib/dates';
import type { Readiness, ReadyStatus, VaccineRow } from '@/lib/ready';
import { useTheme } from '@/theme/ThemeProvider';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "Signed Mar 12, 2026" */
export const signedLabel = (iso: string) => {
  const d = fromIso(iso);
  return `Signed ${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
};

/** Done, Needed, Expires soon, Expired: the v3 Badge for each Ready to book state. */
export function ReadyBadge({ status }: { status: ReadyStatus | 'not-yet' }) {
  if (status === 'done') return <StatusBadge tone="cleared">Done</StatusBadge>;
  if (status === 'needed') return <StatusBadge tone="needs">Needed</StatusBadge>;
  if (status === 'soon') return <StatusBadge tone="warning">Expires soon</StatusBadge>;
  if (status === 'expired') return <StatusBadge tone="warning">Expired</StatusBadge>;
  return <StatusBadge>Not yet</StatusBadge>;
}

function Section({ title, aside, children }: { title: string; aside?: string; children: ReactNode }) {
  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginBottom: 4 }}>
        <Text variant="title">{title}</Text>
        {aside ? <Text variant="caption" muted style={{ flexShrink: 1, textAlign: 'right' }}>{aside}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function Thumb({ icon }: { icon: IconName }) {
  return <Icon name={icon} />;
}

const Chevron = () => {
  const { c } = useTheme();
  return <Icon name="chevron-right" size={18} color={c.inkFaint} />;
};

export const openVaccine = (row: VaccineRow) => router.push({ pathname: '/vaccines', params: { type: row.type } });
export const openWaiver = (w: Waiver) => router.push({ pathname: '/waiver', params: { id: w.id } });

/** 18a to 18d: the vaccines and the PackPass waiver, each with its Badge. Rows that need something open the fix. */
export function ReadyChecklist({ r }: { r: Readiness }) {
  return (
    <View style={{ gap: 24 }}>
      <Section title="Vaccines" aside="PackPass checks these on every booking">
        {r.vaccines.map((v, i) => {
          const fix = v.status !== 'done';
          return (
            <Row key={v.type} title={v.type} meta={v.meta} thumb={<Thumb icon="syringe" />} last={i === r.vaccines.length - 1}
              trail={<><ReadyBadge status={v.status} />{fix ? <Chevron /> : null}</>}
              onPress={fix ? () => openVaccine(v) : undefined} />
          );
        })}
      </Section>
      {r.waiver ? (
        <Section title="Waiver">
          <Row title={r.waiver.title} thumb={<Thumb icon="file-pen" />} last
            meta={r.waiverSignedOn ? signedLabel(r.waiverSignedOn) : 'Covers every class booked through PackPass'}
            trail={<><ReadyBadge status={r.waiverSignedOn ? 'done' : 'needed'} />{r.waiverSignedOn ? null : <Chevron />}</>}
            onPress={() => openWaiver(r.waiver!)} />
        </Section>
      ) : null}
    </View>
  );
}

export type NoticeTone = 'pitch' | 'warn' | 'plain';

/** The v3 notice: a round icon, a title and a line under it. Pitch for ready, warn for something expired or short. */
export function Notice({ icon, title, body, tone = 'plain' }: { icon: IconName; title: string; body: string; tone?: NoticeTone }) {
  const { c } = useTheme();
  const [bg, fg] = tone === 'pitch' ? [c.pitch, c.onPitch] : tone === 'warn' ? [c.kennelRedSoft, c.kennelRed] : [c.surfaceSunken, c.ink];
  return (
    <View style={{ flexDirection: 'row', gap: 14, alignItems: 'flex-start', padding: 16, borderRadius: 16, backgroundColor: c.surfaceRaised }} accessibilityLiveRegion="polite">
      <Badge icon={icon} bg={bg} fg={fg} size={40} iconSize={18} />
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text variant="heading" weight="600">{title}</Text>
        <Text variant="caption" muted>{body}</Text>
      </View>
    </View>
  );
}

/** The state at the top of Ready to book: ready, something needed, or a record expiring soon. */
export function ReadyNotice({ r, dogName }: { r: Readiness; dogName: string }) {
  const n = r.next;
  const [icon, tone, title, body]: [IconName, NoticeTone, string, string] =
    r.state === 'done' ? ['shield-check', 'pitch', `${dogName} is ready to book.`, 'Vaccines and waiver on file. PackPass checks them on every booking.']
      : n?.kind === 'waiver' ? ['file-pen', 'plain', 'Waiver not signed yet.', 'Sign the PackPass waiver once and it covers every class, for every dog on your account.']
        : n?.kind === 'vaccine' && n.row.status === 'soon' ? ['clock', 'warn', `${n.row.type} expires in ${n.row.days} ${n.row.days === 1 ? 'day' : 'days'}.`, 'Bookings after that date will ask for a new record.']
          : n?.kind === 'vaccine' && n.row.status === 'expired' ? ['circle-alert', 'warn', `${n.row.type} has expired.`, `Classes stay locked until ${dogName} has a current record. Takes a minute.`]
            : ['file-plus', 'plain', `${n?.kind === 'vaccine' ? n.row.type : 'Vaccine'} record needed.`, `Classes stay locked until it's uploaded. Takes a minute.`];
  return <Notice icon={icon} tone={tone} title={title} body={body} />;
}

/** Partner waivers: signed ones, and ones PackPass asks for once on the first booking there. */
export function PartnerWaivers({ waivers, signed }: { waivers: Waiver[]; signed: Record<string, string> }) {
  const list = waivers.filter((w) => w.partnerId);
  if (!list.length) return null;
  return (
    <Section title="Partner waivers">
      {list.map((w, i) => {
        const on = signed[w.id];
        return (
          <Row key={w.id} title={catalog.partners[w.partnerId!]?.name ?? w.title} thumb={<Thumb icon="building" />} last={i === list.length - 1}
            meta={on ? signedLabel(on) : 'Asked once, on the first booking there'}
            trail={<ReadyBadge status={on ? 'done' : 'not-yet'} />}
            onPress={() => openWaiver(w)} />
        );
      })}
    </Section>
  );
}

/** The Dog tab's Ready to book card: one line on what's missing, opening the full checklist. */
export function ReadyCard({ r, dogName }: { r: Readiness; dogName: string }) {
  const { c } = useTheme();
  const n = r.next;
  const meta = r.state === 'done' ? 'Vaccines and waiver on file. PackPass checks every booking.'
    : n?.kind === 'waiver' ? 'Sign the PackPass waiver once. It covers every class.'
      : n?.kind === 'vaccine' && n.row.status === 'soon' ? `${n.row.type} expires in ${n.row.days} ${n.row.days === 1 ? 'day' : 'days'}.`
        : n?.kind === 'vaccine' && n.row.status === 'expired' ? `${n.row.type} has expired. Upload a new record.`
          : `${n?.kind === 'vaccine' ? n.row.type : 'A vaccine'} record needed before ${dogName}'s first booking.`;
  return (
    <Row
      style={{ paddingHorizontal: 16, borderRadius: 16, backgroundColor: c.surfaceRaised }}
      title="Ready to book"
      meta={<Text variant="caption" muted numberOfLines={2}>{meta}</Text>}
      thumb={<Icon name={r.state === 'done' ? 'shield-check' : 'file-plus'} />}
      trail={<><ReadyBadge status={r.state === 'done' ? 'done' : r.state === 'soon' ? 'soon' : 'needed'} /><Chevron /></>}
      onPress={() => router.push('/ready')}
      last
    />
  );
}
