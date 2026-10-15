import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

export interface ProcessedPhoto {
  /** URI persistente para mostrar la prenda (archivo local en iPhone, data URI en web). */
  uri: string;
  /** JPEG en base64 (sin prefijo) listo para enviar a Gemini. */
  base64: string;
}

const MAX_WIDTH = Platform.OS === 'web' ? 720 : 1000;
const QUALITY = Platform.OS === 'web' ? 0.62 : 0.72;

export type PickSource = 'camera' | 'library';

/** Abre la cámara o la fototeca del iPhone. Devuelve null si el usuario cancela. */
export async function pickPhoto(source: PickSource): Promise<string | null> {
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    quality: 1,
    allowsEditing: true,
    aspect: [3, 4],
    // Solicita a iOS una representación compatible (JPEG) en lugar del HEIC original.
    preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
    exif: false,
  };

  if (Platform.OS !== 'web') {
    const perm =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      throw new Error(
        source === 'camera'
          ? 'Sin permiso de cámara. Actívalo en Ajustes de iOS > Cápsula Ejecutiva.'
          : 'Sin permiso de fototeca. Actívalo en Ajustes de iOS > Cápsula Ejecutiva.',
      );
    }
  }

  const result =
    source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled || !result.assets?.length) return null;
  return result.assets[0].uri;
}

/**
 * Convierte cualquier formato de entrada (incluido HEIC/HEIF de iPhone) a JPEG,
 * reduce la resolución y comprime. En iPhone guarda el archivo en el directorio
 * de documentos de la app (persistente); en web lo convierte en data URI.
 */
export async function processAndStorePhoto(sourceUri: string, id: string): Promise<ProcessedPhoto> {
  const ctx = ImageManipulator.manipulate(sourceUri);
  ctx.resize({ width: MAX_WIDTH });
  const ref = await ctx.renderAsync();
  const saved = await ref.saveAsync({ format: SaveFormat.JPEG, compress: QUALITY, base64: true });
  if (!saved.base64) throw new Error('No se pudo codificar la imagen en JPEG.');

  if (Platform.OS === 'web') {
    return { uri: `data:image/jpeg;base64,${saved.base64}`, base64: saved.base64 };
  }

  const dir = new Directory(Paths.document, 'closet');
  if (!dir.exists) dir.create({ intermediates: true });
  const dest = new File(dir, `${id}.jpg`);
  if (dest.exists) dest.delete();
  new File(saved.uri).copySync(dest);
  return { uri: dest.uri, base64: saved.base64 };
}

export function deleteStoredPhoto(uri: string): void {
  if (Platform.OS === 'web' || !uri.startsWith('file:')) return;
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    // El archivo ya no existe: nada que limpiar.
  }
}
