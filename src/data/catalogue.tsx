// Catalogue with an honest source label: live Firestore, the copy cached on this device,
// or the bundled demonstration catalogue.
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Product, ShippingConfig, StoreConfig } from '../domain/types.ts';
import { db } from '../firebase/app.ts';
import { storeBackendConfigured } from '../firebase/config.ts';
import { loadCatalogueSnapshot, saveCatalogueSnapshot } from './local.ts';
import { PRODUCTS, SHIPPING_CONFIG, STORE_CONFIG } from './seed/catalogue.ts';

export type CatalogueSource = 'live' | 'cached' | 'demo';

export interface Catalogue {
  loading: boolean;
  products: Product[];
  shipping: ShippingConfig;
  store: StoreConfig;
  source: CatalogueSource;
  reload: () => Promise<void>;
}

type State = Omit<Catalogue, 'reload'>;
const initial: State = { loading: true, products: [], shipping: SHIPPING_CONFIG, store: STORE_CONFIG, source: 'demo' };
const Context = createContext<Catalogue>({ ...initial, reload: async () => {} });

const withTimeout = <T,>(promise: Promise<T>, ms: number) =>
  Promise.race([promise, new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);

async function load(): Promise<Partial<State>> {
  if (!storeBackendConfigured) return { products: PRODUCTS, source: 'demo' };
  try {
    const [snap, shipping, store] = await withTimeout(
      Promise.all([getDocs(collection(db, 'products')), getDoc(doc(db, 'config', 'shipping')), getDoc(doc(db, 'config', 'store'))]),
      15000, // slow networks need more than a few seconds
    );
    if (snap.empty) throw new Error('No products. Has the catalogue been seeded?');
    const products = snap.docs.map((d) => ({ ...d.data(), id: d.id }) as Product);
    const order = new Map(PRODUCTS.map((p, i) => [p.id, i]));
    products.sort((a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99));
    await saveCatalogueSnapshot(products);
    return {
      products,
      source: 'live',
      ...(shipping.exists() && { shipping: shipping.data() as ShippingConfig }),
      ...(store.exists() && { store: store.data() as StoreConfig }),
    };
  } catch (error) {
    console.warn('Live catalogue unavailable', error);
    const cached = await loadCatalogueSnapshot();
    return cached ? { products: cached, source: 'cached' } : { products: PRODUCTS, source: 'demo' };
  }
}

export function CatalogueProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(initial);
  const reload = useCallback(async () => {
    const next = await load();
    setState((s) => ({ ...s, ...next, loading: false }));
  }, []);
  useEffect(() => {
    void reload();
    const onOnline = () => void reload();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [reload]);
  return <Context.Provider value={{ ...state, reload }}>{children}</Context.Provider>;
}

export const useCatalogue = () => useContext(Context);
