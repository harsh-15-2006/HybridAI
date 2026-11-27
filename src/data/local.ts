// Device-only state: cart, compare list, preferences, privacy setting, AI activity ledger.
// Kept in IndexedDB in this browser. Nothing here is ever uploaded by this module.
import { openDB, type IDBPDatabase } from 'idb';
import { useSyncExternalStore } from 'react';
import type { CartLine, PrivacySetting, Product, Profile } from '../domain/types.ts';
import type { LedgerEntry } from '../ai/types.ts';

export interface LocalState {
  ready: boolean;
  cart: CartLine[];
  compare: string[];
  profile: Profile | null;
  privacy: PrivacySetting;
  ledger: LedgerEntry[];
}

let state: LocalState = { ready: false, cart: [], compare: [], profile: null, privacy: 'ask', ledger: [] };
const listeners = new Set<() => void>();

let dbPromise: Promise<IDBPDatabase> | null = null;
function db() {
  dbPromise ??= openDB('hybridcart', 1, { upgrade: (d) => void d.createObjectStore('kv') });
  return dbPromise;
}

async function persist(key: string, value: unknown) {
  if (typeof indexedDB === 'undefined') return;
  try {
    await (await db()).put('kv', value, key);
  } catch (error) {
    console.warn('Could not save on this device', error);
  }
}

function emit(patch: Partial<LocalState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function getLocal(): LocalState {
  return state;
}

export function setLocal<K extends Exclude<keyof LocalState, 'ready'>>(key: K, value: LocalState[K]) {
  emit({ [key]: value } as Partial<LocalState>);
  void persist(key, value);
}

export function addLedgerEntry(entry: LedgerEntry) {
  setLocal('ledger', [entry, ...state.ledger].slice(0, 200));
}

export async function hydrateLocal(defaultPrivacy: PrivacySetting) {
  if (typeof indexedDB === 'undefined') return emit({ ready: true, privacy: defaultPrivacy });
  try {
    const d = await db();
    const [cart, compare, profile, privacy, ledger] = await Promise.all(
      ['cart', 'compare', 'profile', 'privacy', 'ledger'].map((k) => d.get('kv', k)),
    );
    emit({
      ready: true,
      cart: cart ?? [],
      compare: compare ?? [],
      profile: profile ?? null,
      privacy: privacy ?? defaultPrivacy,
      ledger: ledger ?? [],
    });
  } catch {
    emit({ ready: true, privacy: defaultPrivacy });
  }
}

export async function saveCatalogueSnapshot(products: Product[]) {
  await persist('catalogue', products);
}

export async function loadCatalogueSnapshot(): Promise<Product[] | null> {
  if (typeof indexedDB === 'undefined') return null;
  return (await (await db()).get('kv', 'catalogue')) ?? null;
}

export function useLocal(): LocalState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getLocal,
    getLocal,
  );
}
