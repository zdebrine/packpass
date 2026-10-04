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

/** Settings › Account: name, email (confirmed with a code sent to the new address), password, and the way to delete the account. */
export function AccountSection() {
  const { c } = useTheme();
  const account = useApp((s) => s.account);
  const saveName = useApp((s) => s.saveName);
  const changePassword = useApp((s) => s.changePassword);
  const requestEmailChange = useApp((s) => s.requestEmailChange);
  const confirmEmailChange = useApp((s) => s.confirmEmailChange);
  const [editing, setEditing] = useState<null | 'name' | 'password' | 'email'>(null);
  /** The new address once its code is sent. */
  const [sentTo, setSentTo] = useState<string | null>(null);
  /** Secure email change: the new address's code is in, the current address's code is still needed. */
  const [needsCurrent, setNeedsCurrent] = useState(false);
  const [code, setCode] = useState('');
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  const open = (what: 'name' | 'password' | 'email') => { setEditing(what); setValue(what === 'name' ? account.name : ''); setNote(null); setSentTo(null); setCode(''); setNeedsCurrent(false); };
  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setNote(null);
    try { await fn(); } catch (e) { setNote({ ok: false, text: errorCopy(e) }); } finally { setBusy(false); }
  };
  const sendCode = (to: string) => run(async () => { await requestEmailChange(to); setSentTo(to.trim().toLowerCase()); setNeedsCurrent(false); setCode(''); });
  const confirmEmail = () => run(async () => {
    const done = await confirmEmailChange(sentTo!, code, needsCurrent ? account.email : sentTo!);
    setCode('');
    if (!done) { setNeedsCurrent(true); return; }
    setNote({ ok: true, text: `Your email is now ${sentTo}.` });
    setEditing(null); setSentTo(null); setNeedsCurrent(false);
  });
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
          <Field fill={c.bg} label="Your name" value={value} onChangeText={setValue} autoComplete="name" textContentType="name" autoFocus />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button size="sm" disabled={busy || !value.trim()} onPress={save}>{busy ? 'Saving…' : 'Save'}</Button>
            <Button size="sm" variant="quiet" fill={c.bg} onPress={() => setEditing(null)}>Cancel</Button>
          </View>
        </View>
      ) : row('Name', account.name || 'Not set', <Button size="sm" variant="quiet" fill={c.bg} onPress={() => open('name')}>Edit</Button>)}
      {editing === 'email' ? (
        <View style={{ gap: 10, padding: 18, borderRadius: 20, backgroundColor: c.surfaceRaised }}>
          {sentTo ? (
            <>
              <Text variant="label" weight="600">{needsCurrent ? 'One more code' : 'Enter the code'}</Text>
              <Text variant="caption" muted>{needsCurrent
                ? `To make sure it's you, we also sent a code to ${account.email}. Enter that one to finish.`
                : `We sent a 6-digit code to ${sentTo}. Your email changes once you enter it.`}</Text>
              <Field fill={c.bg} label="Code" value={code} onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad"
                autoComplete="one-time-code" textContentType="oneTimeCode" autoFocus />
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                <Button size="sm" disabled={busy || code.length !== 6} onPress={confirmEmail}>{busy ? 'Checking…' : 'Confirm'}</Button>
                <Button size="sm" variant="quiet" fill={c.bg} disabled={busy} onPress={() => sendCode(sentTo)}>Send again</Button>
                <Button size="sm" variant="quiet" fill={c.bg} onPress={() => setEditing(null)}>Cancel</Button>
              </View>
            </>
          ) : (
            <>
              <Field fill={c.bg} label="New email" value={value} onChangeText={setValue} keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
                autoComplete="email" textContentType="emailAddress" autoFocus />
              <Text variant="caption" muted>{`We'll send a code to the new address. You sign in with ${account.email || 'your current email'} until you enter it.`}</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button size="sm" disabled={busy || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value.trim())} onPress={() => sendCode(value)}>{busy ? 'Sending…' : 'Send code'}</Button>
                <Button size="sm" variant="quiet" fill={c.bg} onPress={() => setEditing(null)}>Cancel</Button>
              </View>
            </>
          )}
        </View>
      ) : row('Email', account.email || '—', <Button size="sm" variant="quiet" fill={c.bg} onPress={() => open('email')}>Change</Button>)}
      {editing === 'password' ? (
        <View style={{ gap: 10, padding: 18, borderRadius: 20, backgroundColor: c.surfaceRaised }}>
          <Field fill={c.bg} label="New password" value={value} onChangeText={setValue} secureTextEntry autoComplete="new-password" textContentType="newPassword" autoFocus />
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
