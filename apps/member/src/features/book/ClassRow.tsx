import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { ClassCard } from '@/ds/cards';
import { Pill } from '@/ds/controls';
import { Icon, type IconName } from '@/ds/Icon';
import { Text } from '@/ds/Text';
import { eligibility, timeLabel, type SessionView } from '@/lib/booking';
import { useDog, useOriginLabel, useRules } from '@/store/app';
import { useTheme } from '@/theme/ThemeProvider';

/** Pill on a raised panel (desktop Book map): the design swaps the raised fill for the page colour. */
function P({ children, tone = 'raised', icon, fill }: { children: ReactNode; tone?: 'pitch' | 'raised' | 'muted'; icon?: IconName; fill?: string }) {
  const { c } = useTheme();
  if (!fill) return <Pill tone={tone} icon={icon}>{children}</Pill>;
  const bg = tone === 'pitch' ? c.pitch : fill;
  const fg = tone === 'pitch' ? c.onPitch : tone === 'muted' ? c.inkMuted : c.ink;
  return (
    <View style={{ height: 24, paddingLeft: icon ? 8 : 10, paddingRight: 10, borderRadius: 9999, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: bg }}>
      {icon ? <Icon name={icon} size={13} color={fg} /> : null}
      <Text variant="caption" weight={tone === 'muted' ? '500' : '600'} color={fg}>{children}</Text>
    </View>
  );
}

/** ClassCard row plus the eligibility and session-type pills shown under it on Book. */
export function ClassRow({ v, showPartnerAsCoach, pillFill }: { v: SessionView; showPartnerAsCoach?: boolean; pillFill?: string }) {
  useOriginLabel(); // re-render when distances are measured from somewhere new
  const dog = useDog();
  const el = eligibility(v, useRules(), dog.name);
  const cleared = el.ok && el.cleared;
  const needs = el.ok ? null : el.needs;
  const typePill = v.cls.sessionType !== 'Class';
  const partner = showPartnerAsCoach
    ? `Coach ${v.trainer.name}`
    : v.cls.sessionType === 'Private' ? `${v.trainer.name} · ${v.partner.name}` : v.partner.name;

  return (
    <View style={{ gap: 8 }}>
      <ClassCard
        layout="row"
        image={v.cls.image}
        title={v.cls.title}
        partner={partner}
        place={showPartnerAsCoach ? undefined : `${v.partner.distanceMi} mi`}
        time={timeLabel(v)}
        duration={`${v.cls.durationMin} min`}
        credits={v.cls.credits}
        spotsLeft={v.session.spotsLeft}
        onPress={() => router.push(`/class/${v.session.id}`)}
      />
      {cleared || needs || typePill || v.cls.dropOff ? (
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', paddingLeft: 102 }}>
          {cleared ? <P fill={pillFill} tone="pitch" icon="shield-check">Cleared</P> : null}
          {needs === 'herding' ? <P fill={pillFill} icon="shield">Needs assessment</P> : null}
          {needs === 'social' ? <P fill={pillFill} icon="shield">Needs Social</P> : null}
          {needs === 'vaccines' ? <P fill={pillFill} icon="syringe">Vaccines due</P> : null}
          {typePill ? <P fill={pillFill} tone="muted">{v.cls.sessionType}</P> : null}
          {v.cls.dropOff ? <P fill={pillFill} tone="muted">Drop-off</P> : null}
        </View>
      ) : null}
    </View>
  );
}
