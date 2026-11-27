import {
  onIdTokenChanged, signInAnonymously, signInWithEmailAndPassword, signOut, type User,
} from 'firebase/auth';
import { useEffect, useState } from 'react';
import { auth } from '../firebase/app.ts';
import { storeBackendConfigured } from '../firebase/config.ts';

/** Shoppers get an anonymous account only when they first need one. */
export async function ensureShopper(): Promise<User> {
  await auth.authStateReady();
  return auth.currentUser ?? (await signInAnonymously(auth)).user;
}

export const signInOperator = (email: string, password: string) => signInWithEmailAndPassword(auth, email, password);
export const signOutUser = () => signOut(auth);

export interface Session {
  ready: boolean;
  user: User | null;
  /** From the ID token claim. The UI uses it for display; Security Rules enforce it. */
  isAdmin: boolean;
}

export function useSession(): Session {
  const [session, setSession] = useState<Session>({ ready: !storeBackendConfigured, user: null, isAdmin: false });
  useEffect(() => {
    if (!storeBackendConfigured) return;
    return onIdTokenChanged(auth, async (user) => {
      const isAdmin = user ? (await user.getIdTokenResult()).claims.admin === true : false;
      setSession({ ready: true, user, isAdmin });
    });
  }, []);
  return session;
}
