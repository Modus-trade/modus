import { Button, Host, Menu } from '@expo/ui/swift-ui';
import { tint } from '@expo/ui/swift-ui/modifiers';
import * as DocumentPicker from 'expo-document-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';
import { Haptics } from './settings';
import { colors } from './theme';

export type PickedFile = { uri: string; name: string; mimeType?: string; size?: number };

const ALLOWED = ['pdf', 'png', 'jpg', 'jpeg', 'docx', 'xlsx', 'txt'];
const MAX = 10 * 1024 * 1024;

/** Сервер принимает png/jpg: фото iPhone (HEIC) пересохраняем в JPEG и уменьшаем. */
async function toJpeg(asset: ImagePicker.ImagePickerAsset, index: number): Promise<PickedFile> {
  const ctx = ImageManipulator.manipulate(asset.uri);
  if (asset.width > 2400) ctx.resize({ width: 2400 });
  const image = await ctx.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 });
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  return { uri: saved.uri, name: `photo-${stamp}${index ? `-${index}` : ''}.jpg`, mimeType: 'image/jpeg' };
}

export async function takePhoto(): Promise<PickedFile[]> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) {
    Alert.alert('Нет доступа к камере', 'Разрешите доступ к камере в настройках iPhone.');
    return [];
  }
  try {
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 });
    if (result.canceled) return [];
    return Promise.all(result.assets.map(toJpeg));
  } catch {
    Alert.alert('Камера недоступна', 'На этом устройстве нельзя сделать фото.');
    return [];
  }
}

export async function choosePhotos(): Promise<PickedFile[]> {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: 5, quality: 1 });
  if (result.canceled) return [];
  return Promise.all(result.assets.map(toJpeg));
}

export async function chooseFiles(): Promise<PickedFile[]> {
  const result = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true });
  if (result.canceled) return [];
  const ok = result.assets.filter((a) => ALLOWED.includes(a.name.split('.').pop()?.toLowerCase() ?? '') && (a.size ?? 0) <= MAX);
  if (ok.length < result.assets.length) Alert.alert('Часть файлов пропущена', 'Можно прикрепить pdf, png, jpg, docx, xlsx, txt до 10 МБ.');
  return ok.map((a) => ({ uri: a.uri, name: a.name.replace(/\.jpeg$/i, '.jpg'), mimeType: a.mimeType, size: a.size }));
}

/** Нативное меню iOS: камера, галерея, файлы. */
export function AttachMenu({ onPick, label = 'Прикрепить', compact }: { onPick: (files: PickedFile[]) => void; label?: string; compact?: boolean }) {
  const run = (fn: () => Promise<PickedFile[]>) => async () => {
    Haptics.selectionAsync();
    const files = await fn();
    if (files.length) onPick(files);
  };
  return (
    <Host matchContents>
      <Menu label={compact ? '' : label} systemImage="paperclip" modifiers={[tint(compact ? colors.label : colors.label)]}>
        <Button label="Сделать фото" systemImage="camera" onPress={run(takePhoto)} />
        <Button label="Выбрать фото" systemImage="photo.on.rectangle" onPress={run(choosePhotos)} />
        <Button label="Файл" systemImage="doc" onPress={run(chooseFiles)} />
      </Menu>
    </Host>
  );
}
