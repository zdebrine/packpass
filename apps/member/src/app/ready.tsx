import { router } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { Button } from '@/ds/controls';
import { Footer, IconButton, Screen } from '@/ds/layout';
import { Text } from '@/ds/Text';
import { openVaccine, openWaiver, PartnerWaivers, ReadyChecklist, ReadyNotice } from '@/features/ready/parts';
import { readiness } from '@/lib/ready';
import { useApp, useDog } from '@/store/app';

/** 18b to 18d Ready to book: the dog's vaccines, the PackPass waiver and partner waivers, with the next fix. */
export default function ReadyToBook() {
  const dog = useDog();
  const vaccines = useApp((s) => s.vaccines);
  const waivers = useApp((s) => s.waivers);
  const signed = useApp((s) => s.waiversSigned);
  const r = readiness(vaccines, waivers, signed);
  const n = r.next;
  const fix = n?.kind === 'vaccine'
    ? <Button block icon="file-plus" onPress={() => openVaccine(n.row)}>{n.row.status === 'needed' ? `Upload ${n.row.type} record` : `Upload new ${n.row.type} record`}</Button>
    : n?.kind === 'waiver' && r.waiver ? <Button block icon="file-pen" onPress={() => openWaiver(r.waiver!)}>Sign the waiver</Button> : null;

  return (
    <Screen>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 10, paddingHorizontal: 20, paddingBottom: 24, gap: 24 }}>
        <IconButton icon="chevron-left" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/dog'))} />
        <View>
          <Text variant="pageTitle" accessibilityRole="header">Ready to book</Text>
          <Text variant="caption" muted style={{ marginTop: 4 }}>{[dog.name, dog.breed].filter(Boolean).join(' · ')}</Text>
        </View>
        <ReadyNotice r={r} dogName={dog.name} />
        <ReadyChecklist r={r} />
        <PartnerWaivers waivers={waivers} signed={signed} />
      </ScrollView>
      {fix ? <Footer>{fix}</Footer> : null}
    </Screen>
  );
}
