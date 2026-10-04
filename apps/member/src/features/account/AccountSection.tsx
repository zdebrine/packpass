import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { errorCopy } from '@/api/errors';
import { Button } from '@/ds/controls';
import { Field } from '@/ds/layout';
import { Press } from '@/ds/Press';
import { Text } from '@/ds/Text';
import { useApp } from '@/store/app';
import { useTheme } from '@/theme/ThemeProvider';

/** Settings › Account: name, email, password, and the way to delete the account. */
export function AccountSection() {
  const { c } = useTheme();
  const account = useApp((s) => s.account);
  const saveName = useApp((s) => s.saveName);
  const changePassword = useApp((s) => s.changePassword);
  const [editing, setEditing] = useState<null | 'name' | 'password'>(null);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  const open = (what: 'name' | 'password') => { setEditing(what); setValue(what === 'name' ? account.name : ''); setNote(null); };
  const save = async () => {
    setBusy(true); setNote(null);
    try {
      if (editing === 'name') await saveName(value);
      else await changePassword(value);
      setNote({ ok: true, text: editing === 'name' ? 'Name saved.' : 'Password changed.' });
      setEditing(null);
    } catch (e) {
      setNote({ ok: false, text: errorCopy(e) });
    } finally {
      setBusy(false);
    }
  };

  const row = (title: string, sub: string, action: React.ReactNode) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 16, paddingHorizontal: 18, borderRadius: 20, backgroundColor: c.surfaceRaised }}>
      <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
        <Text variant="label" weight="600">{title}</Text>
        <Text variant="caption" muted numberOfLines={1}>{sub}</Text>
      </View>
      {action}
    </View>
  );

  return (
    <View style={{ gap: 8, marginBottom: 24 }}>
      <Text variant="title" style={{ marginBottom: -2 }}>Account</Text>
      {editing === 'name' ? (
        <View style={{ gap: 10, padding: 18, borderRadius: 20, backgroundColor: c.surfaceRaised }}>
          <Field label="Your name" value={value} onChangeText={setValue} autoComplete="name" textContentType="name" autoFocus />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button size="sm" disabled={busy || !value.trim()} onPress={save}>{busy ? 'Saving…' : 'Save'}</Button>
            <Button size="sm" variant="quiet" fill={c.bg} onPress={() => setEditing(null)}>Cancel</Button>
          </View>
        </View>
      ) : row('Name', account.name || 'Not set', <Button size="sm" variant="quiet" fill={c.bg} onPress={() => open('name')}>Edit</Button>)}
      {row('Email', account.email || '—', null)}
      {editing === 'password' ? (
        <View style={{ gap: 10, padding: 18, borderRadius: 20, backgroundColor: c.surfaceRaised }}>
          <Field label="New password" value={value} onChangeText={setValue} secureTextEntry autoComplete="new-password" textContentType="newPassword" autoFocus />
          <Text variant="caption" muted>At least 8 characters.</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button size="sm" disabled={busy || value.length < 8} onPress={save}>{busy ? 'Saving…' : 'Change password'}</Button>
            <Button size="sm" variant="quiet" fill={c.bg} onPress={() => setEditing(null)}>Cancel</Button>
          </View>
        </View>
      ) : row('Password', 'Used to sign in on a new device', <Button size="sm" variant="quiet" fill={c.bg} onPress={() => open('password')}>Change</Button>)}
      {note ? <Text variant="caption" weight="600" color={note.ok ? c.turf : c.kennelRed}>{note.text}</Text> : null}
      <Press onPress={() => router.push('/delete-account')} scale={false} accessibilityRole="button"
        style={{ alignItems: 'center', justifyContent: 'center', height: 52, marginTop: 4, borderRadius: 9999, backgroundColor: c.surfaceRaised }}>
        <Text variant="label" weight="600" color={c.kennelRed}>Delete account</Text>
      </Press>
    </View>
  );
}
