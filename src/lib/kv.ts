import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

/**
 * Almacenamiento clave-valor persistente.
 * - iOS/Android: AsyncStorage (base local del teléfono).
 * - Web/PWA: IndexedDB (sin el límite de ~5 MB de localStorage, necesario para guardar fotos).
 */

const DB_NAME = 'capsula-ejecutiva';
const STORE = 'kv';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

async function idb<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = run(tx.objectStore(STORE));
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
  });
}

const useIdb = Platform.OS === 'web' && typeof indexedDB !== 'undefined';

export async function kvGet(key: string): Promise<string | null> {
  if (useIdb) {
    const v = await idb<string | undefined>('readonly', (s) => s.get(key));
    return v ?? null;
  }
  return AsyncStorage.getItem(key);
}

export async function kvSet(key: string, value: string): Promise<void> {
  if (useIdb) {
    await idb('readwrite', (s) => s.put(value, key));
    return;
  }
  await AsyncStorage.setItem(key, value);
}

export async function kvDelete(key: string): Promise<void> {
  if (useIdb) {
    await idb('readwrite', (s) => s.delete(key));
    return;
  }
  await AsyncStorage.removeItem(key);
}

export async function kvGetJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await kvGet(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function kvSetJson(key: string, value: unknown): Promise<void> {
  return kvSet(key, JSON.stringify(value));
}
