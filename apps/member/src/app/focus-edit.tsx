import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { errorCopy } from '@/api/errors';
import { SKILLS } from '@/data/practice';
import { Button, Chip } from '@/ds/controls';
import { IconButton, useBottom } from '@/ds/layout';
import { Overlay } from '@/ds/overlay';
import { useWide } from '@/ds/responsive';
import { ModalSheet } from '@/ds/sheet';
import { Text } from '@/ds/Text';
import { useFocusSkills } from '@/features/log/view';
import { useApp, useDog } from '@/store/app';
import { useTheme } from '@/theme/ThemeProvider';

/** 07k Working on › Edit: pick the skills the Log suggests practice for. Picks keep their order; new ones go last. */
export default function FocusEdit() {
  const { c } = useTheme();
  const wide = useWide();
  const bottom = useBottom(34);
  const dog = useDog();
  const current = useFocusSkills(dog);
  const setFocusSkills = useApp((s) => s.setFocusSkills);
  const [picked, setPicked] = useState<string[]>(current);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/log'));
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await setFocusSkills(dog.id, picked);
      back();
    } catch (e) {
      setError(errorCopy(e));
      setBusy(false);
    }
  };

  const body = (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <Text variant="title" style={{ flex: 1 }} accessibilityRole="header">Working on</Text>
        <IconButton icon="x" size={36} label="Close" onPress={back} />
      </View>
      <Text variant="heading" style={{ marginBottom: 6 }}>{`What's ${dog.name} working on?`}</Text>
      <Text muted style={{ marginBottom: 16 }}>Log suggests one drill a day for these. Change them any time.</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {SKILLS.map((s) => <Chip key={s.id} selected={picked.includes(s.id)} onPress={() => toggle(s.id)}>{s.label}</Chip>)}
      </View>
      {picked.length > 3 ? <Text variant="caption" muted style={{ marginTop: 14 }}>Two or three at a time is plenty. The first ones get the most practice.</Text> : null}
      {error ? <Text variant="label" color={c.kennelRed} style={{ marginTop: 16 }}>{error}</Text> : null}
      <Button block onPress={save} disabled={busy} style={{ marginTop: 24 }}>Save</Button>
    </View>
  );

  if (wide) {
    return (
      <Overlay kind="dialog" width={520} top={80} onClose={back}>
        <View style={{ padding: 24 }}>{body}</View>
      </Overlay>
    );
  }
  return (
    <ModalSheet onClose={back} padding={{ paddingTop: 12, paddingHorizontal: 20, paddingBottom: bottom }}>
      {body}
    </ModalSheet>
  );
}
