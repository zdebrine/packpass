import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import type { PickedDoc } from '@/data/types';

/** The vaccine-docs bucket's limit (supabase/config.toml file_size_limit). */
export const MAX_RECORD_BYTES = 10 * 1024 * 1024;

/** A photo of the vet record, kept large enough to read (1600 px wide JPEG). */
export async function pickRecordPhoto(): Promise<PickedDoc | null> {
  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
  if (r.canceled || !r.assets[0]) return null;
  const a = r.assets[0];
  const edit = ImageManipulator.manipulate(a.uri);
  if (a.width > 1600) edit.resize({ width: 1600 });
  const out = await (await edit.renderAsync()).saveAsync({ format: SaveFormat.JPEG, compress: 0.85, base64: true });
  if (!out.base64) return null;
  return { name: 'Vet record.jpg', mime: 'image/jpeg', uri: `data:image/jpeg;base64,${out.base64}` };
}

/** A PDF the vet sent. Throws 'too_big' over the bucket's 10 MB limit. */
export async function pickRecordPdf(): Promise<PickedDoc | null> {
  const r = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
  if (r.canceled || !r.assets[0]) return null;
  const a = r.assets[0];
  if (a.size && a.size > MAX_RECORD_BYTES) throw new Error('too_big');
  // The web picker already returns a data URI; on phones, read the cached copy.
  const uri = Platform.OS === 'web' ? a.uri : `data:application/pdf;base64,${await new File(a.uri).base64()}`;
  return { name: a.name || 'Vet record.pdf', mime: 'application/pdf', uri };
}
