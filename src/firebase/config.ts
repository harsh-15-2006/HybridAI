// Environment-based configuration. No project values are hard-coded.
const env: Partial<ImportMetaEnv> & Record<string, string | boolean | undefined> = import.meta.env ?? {};

const str = (key: string) => (typeof env[key] === 'string' ? (env[key] as string).trim() : '');

export const useEmulators = str('VITE_USE_EMULATORS') === 'true';

const realConfig = {
  apiKey: str('VITE_FIREBASE_API_KEY'),
  authDomain: str('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: str('VITE_FIREBASE_PROJECT_ID'),
  appId: str('VITE_FIREBASE_APP_ID'),
  storageBucket: str('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: str('VITE_FIREBASE_MESSAGING_SENDER_ID'),
};

/** Placeholder values accepted by the local emulators. They reach no real project. */
const demoConfig = {
  apiKey: 'demo-api-key',
  authDomain: 'demo-hybridcart.firebaseapp.com',
  projectId: 'demo-hybridcart',
  appId: '1:000000000000:web:demo',
  storageBucket: '',
  messagingSenderId: '000000000000',
};

const hasRealConfig = Boolean(realConfig.apiKey && realConfig.projectId && realConfig.appId);

export type BackendMode = 'live' | 'emulator' | 'unconfigured';
export const backendMode: BackendMode = useEmulators ? 'emulator' : hasRealConfig ? 'live' : 'unconfigured';

export const firebaseConfig = backendMode === 'live' ? realConfig : demoConfig;

export const recaptchaSiteKey = str('VITE_RECAPTCHA_ENTERPRISE_SITE_KEY');
export const appCheckDebug = env.DEV ? str('VITE_APPCHECK_DEBUG') : '';

/** Cloud inference needs a real project. On-device inference does not call the network. */
export const cloudAiConfigured = backendMode === 'live';
/** Orders, auth and the live catalogue need either a real project or the emulators. */
export const storeBackendConfigured = backendMode !== 'unconfigured';
