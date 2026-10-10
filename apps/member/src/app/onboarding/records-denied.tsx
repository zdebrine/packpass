import { Redirect, router } from 'expo-router';
import { View } from 'react-native';

import { Button } from '@/ds/controls';
import { Icon } from '@/ds/Icon';
import { Screen, useBottom, themed } from '@/ds/layout';
import { Text } from '@/ds/Text';
import { Body, Intro } from '@/features/onboarding/parts';
import { useApp, useDog } from '@/store/app';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Records Denied. PackPass checked the vet record uploaded in onboarding (or later from Vaccines) and denied it
 * (PackPass › Vet records in the partner app). Shows their reason and sends the member to upload a new one.
 * Opens once per denial on launch, and from the notification.
 */
function RecordsDenied() {
  const { c } = useTheme();
  const bottom = useBottom(34);
  const dog = useDog();
  const record = useApp((s) => s.vaccineRecord);
  const see = useApp((s) => s.seeRecordDenial);
  const review = record?.review;
  if (review?.status !== 'denied') return <Redirect href="/" />;

  const later = () => {
    see();
    if (router.canGoBack()) router.back(); else router.replace('/');
  };
  const upload = () => {
    see();
    router.replace('/vaccines');
  };

  return (
    <Screen theme="dark">
      <Body top={34}>
        <View style={{ width: 64, height: 64, borderRadius: 9999, backgroundColor: c.kennelRedSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="shield-alert" size={30} color={c.kennelRed} />
        </View>
        <Intro
          eyebrow={`${dog.name} · Vet records`}
          title="Records denied."
          lede={`PackPass couldn't approve ${dog.name}'s vaccine record. Upload a new one and we'll check it again.`}
        />
        <View style={{ gap: 8, padding: 18, borderRadius: 20, backgroundColor: c.surfaceRaised }}>
          <Text variant="caption" muted>Why it was denied</Text>
          <Text variant="label" weight="600">{review.reason}</Text>
        </View>
        {record ? (
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderRadius: 20, backgroundColor: c.surfaceRaised }}>
            <Icon name="file-text" />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text variant="label" weight="600" numberOfLines={1}>{record.name}</Text>
              <Text variant="caption" muted>Denied</Text>
            </View>
          </View>
        ) : null}
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderRadius: 20, backgroundColor: c.surfaceRaised }}>
          <Icon name="syringe" />
          <Text variant="label" style={{ flex: 1 }}>{`Classes need Rabies, DHPP and Bordetella on one record, with the dates you enter matching it.`}</Text>
        </View>
      </Body>
      <View style={{ paddingHorizontal: 20, paddingBottom: bottom, gap: 10 }}>
        <Button block onPress={upload}>Upload new records</Button>
        <Button variant="quiet" block onPress={later}>Later</Button>
      </View>
    </Screen>
  );
}

export default themed('dark', RecordsDenied);
