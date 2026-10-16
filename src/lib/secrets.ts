import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { kvDelete, kvGet, kvSet } from './kv';

const API_KEY = 'gemini_api_key';

/**
 * La API Key de Gemini se guarda en el Keychain de iOS mediante expo-secure-store.
 * En la versión web/PWA no existe Keychain: se guarda localmente en IndexedDB del navegador.
 */
export const secureStorageAvailable = Platform.OS !== 'web';

export async function getApiKey(): Promise<string> {
  if (secureStorageAvailable) {
    return (await SecureStore.getItemAsync(API_KEY)) ?? '';
  }
  return (await kvGet(`secret.${API_KEY}`)) ?? '';
}

export async function setApiKey(value: string): Promise<void> {
  const v = value.trim();
  if (secureStorageAvailable) {
    if (v) await SecureStore.setItemAsync(API_KEY, v, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
    else await SecureStore.deleteItemAsync(API_KEY);
    return;
  }
  if (v) await kvSet(`secret.${API_KEY}`, v);
  else await kvDelete(`secret.${API_KEY}`);
}
