import { router } from 'expo-router';
import { View } from 'react-native';

import { Button } from '@/ds/controls';
import { Footer, Screen, themed } from '@/ds/layout';
import { tile, useWide } from '@/ds/responsive';
import { Text } from '@/ds/Text';
import { Split } from '@/features/desktop/Split';
import { Body, Intro, StepHeader } from '@/features/onboarding/parts';
import { ReadyChecklist } from '@/features/ready/parts';
import { readiness } from '@/lib/ready';
import { useApp } from '@/store/app';

/**
 * 18a Step 5 · Ready to book. Vaccines and the PackPass waiver, added once so every booking is one tap.
 * Vaccine dates entered here are saved with the dog at the end of onboarding; the waiver is signed now.
 */
function Ready() {
  const name = useApp((s) => s.draft.dogName.trim()) || 'your dog';
  const vaccines = useApp((s) => s.vaccines);
  const waivers = useApp((s) => s.waivers);
  const signed = useApp((s) => s.waiversSigned);
  const r = readiness(vaccines, waivers, signed);
  const wide = useWide();
  const next = () => router.push('/onboarding/reveal');

  const intro = (
    <Intro
      eyebrow="Step 5 of 6 · Ready to book"
      title={`Get ${name} ready to book.`}
      lede="Partners ask for current vaccines and a signed waiver. Add them once and PackPass checks every booking for you."
    />
  );
  const note = <Text variant="caption" muted>{`Some partners have their own waiver. PackPass asks for it once, on ${name}'s first booking there.`}</Text>;
  const done = r.state !== 'needed';
  const buttons = (
    <>
      <Button block onPress={next}>Continue</Button>
      {done ? null : <Button block variant="quiet" onPress={next}>Do this later</Button>}
    </>
  );

  if (wide) {
    return (
      <Split photo="dog_getting_pets_at_park" step={5}>
        {intro}
        <ReadyChecklist r={r} />
        {note}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <View style={tile(180)}><Button block onPress={next}>Continue</Button></View>
          {done ? null : <View style={tile(180)}><Button block variant="quiet" onPress={next}>Do this later</Button></View>}
        </View>
      </Split>
    );
  }

  return (
    <Screen theme="dark">
      <StepHeader step={5} />
      <Body gap={26}>
        {intro}
        <ReadyChecklist r={r} />
        {note}
      </Body>
      <Footer>{buttons}</Footer>
    </Screen>
  );
}

export default themed('dark', Ready);
