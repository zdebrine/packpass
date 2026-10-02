import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

/**
 * Lets the member pick a dog photo from their library, crops it to the Athlete Card's 4:5 and
 * resizes it to 1080 px wide (about 150 KB), so uploads are quick on a phone connection.
 * Returns a JPEG data URI (shows straight away, survives in the onboarding draft, uploads as is),
 * or null if they back out. The library picker needs no permission prompt on iOS 14+ or Android 13+.
 */
export async function pickDogPhoto(): Promise<string | null> {
  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [4, 5], quality: 1 });
  if (r.canceled || !r.assets[0]) return null;
  const { uri, width, height } = r.assets[0];
  const edit = ImageManipulator.manipulate(uri);
  // The web picker (and some Android galleries) skip the crop step; centre-crop to 4:5 here instead.
  if (width && height && Math.abs(width / height - 0.8) > 0.02) {
    const w = Math.min(width, Math.round(height * 0.8));
    const h = Math.round(w / 0.8);
    edit.crop({ originX: Math.round((width - w) / 2), originY: Math.round((height - h) / 2), width: w, height: h });
  }
  const image = await edit.resize({ width: 1080 }).renderAsync();
  const out = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.8, base64: true });
  return out.base64 ? `data:image/jpeg;base64,${out.base64}` : null;
}
