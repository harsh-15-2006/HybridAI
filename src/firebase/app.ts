import { initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { appCheckDebug, backendMode, firebaseConfig, recaptchaSiteKey } from './config.ts';

export const app = initializeApp(firebaseConfig);

// App Check must be initialised before any protected service is used.
export let appCheckActive = false;
if (backendMode === 'live' && typeof window !== 'undefined') {
  if (appCheckDebug) {
    (self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean | string }).FIREBASE_APPCHECK_DEBUG_TOKEN =
      appCheckDebug === 'true' ? true : appCheckDebug;
  }
  // With a debug token the provider key is not used for attestation.
  if (recaptchaSiteKey || appCheckDebug) {
    initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(recaptchaSiteKey || 'debug-only'),
      isTokenAutoRefreshEnabled: true,
    });
    appCheckActive = true;
  }
}

export const db = getFirestore(app);
export const auth = getAuth(app);

if (backendMode === 'emulator') {
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
}
