import { router } from 'expo-router';
import { View } from 'react-native';

import { ClassCard } from '@/ds/cards';
import { Pill } from '@/ds/controls';
import { eligibility, timeLabel, type SessionView } from '@/lib/booking';
import { useDog, useRules } from '@/store/app';

/** ClassCard row plus the eligibility and session-type pills shown under it on Book. */
export function ClassRow({ v, showPartnerAsCoach }: { v: SessionView; showPartnerAsCoach?: boolean }) {
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
      {cleared || needs || typePill ? (
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', paddingLeft: 102 }}>
          {cleared ? <Pill tone="pitch" icon="shield-check">Cleared</Pill> : null}
          {needs === 'herding' ? <Pill icon="shield">Needs assessment</Pill> : null}
          {needs === 'social' ? <Pill icon="shield">Needs Social</Pill> : null}
          {needs === 'vaccines' ? <Pill icon="syringe">Vaccines due</Pill> : null}
          {typePill ? <Pill tone="muted">{v.cls.sessionType}</Pill> : null}
        </View>
      ) : null}
    </View>
  );
}
