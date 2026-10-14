import { router } from 'expo-router';
import { View } from 'react-native';

import { ClassCard } from '@/ds/cards';
import { StatusBadge } from '@/ds/controls';
import { eligibility, timeLabel, type SessionView } from '@/lib/booking';
import { builtForLabel } from '@/lib/fit';
import { useDog, useOriginLabel, useRules } from '@/store/app';

import { useFit } from './useFit';

/** ClassCard row plus the eligibility and session-type pills shown under it on Book. */
export function ClassRow({ v, showPartnerAsCoach }: { v: SessionView; showPartnerAsCoach?: boolean }) {
  useOriginLabel(); // re-render when distances are measured from somewhere new
  const dog = useDog();
  const el = eligibility(v, useRules(), dog.name);
  const cleared = el.ok && el.cleared;
  const needs = el.ok ? null : el.needs;
  const notFor = !el.ok && el.needs === 'fit' ? el.label : null;
  const fit = useFit();
  const built = notFor ? null : fit(v.cls).builtFor;
  const typePill = v.cls.sessionType !== 'Class';
  const partner = showPartnerAsCoach
    ? `Coach ${v.trainer.name}`
    : v.cls.sessionType === 'Private' ? `${v.trainer.name} · ${v.partner.name}` : v.partner.name;

  return (
    <View style={{ gap: 4, opacity: notFor ? 0.5 : 1 }}>
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
      {cleared || needs || built || typePill || v.cls.dropOff ? (
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', paddingLeft: 76, marginTop: -4 }}>
          {built ? <StatusBadge tone="signal" icon="sparkles">{builtForLabel(built)}</StatusBadge> : null}
          {cleared ? <StatusBadge tone="cleared" icon="shield-check">Cleared</StatusBadge> : null}
          {needs === 'herding' ? <StatusBadge tone="needs" icon="shield">Needs assessment</StatusBadge> : null}
          {needs === 'social' ? <StatusBadge tone="needs" icon="shield">Needs Social</StatusBadge> : null}
          {needs === 'vaccines' ? <StatusBadge tone="warning" icon="syringe">Vaccines due</StatusBadge> : null}
          {notFor ? <StatusBadge tone="needs" icon="ban">{`Not for ${dog.name} · ${notFor}`}</StatusBadge> : null}
          {typePill ? <StatusBadge>{v.cls.sessionType}</StatusBadge> : null}
          {v.cls.dropOff ? <StatusBadge>Drop-off</StatusBadge> : null}
        </View>
      ) : null}
    </View>
  );
}
