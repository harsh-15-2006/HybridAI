// Grants or removes the operator claim. Run only from a trusted machine:
//   npm run set-admin -- operator@example.com [--remove]
// Real project: GOOGLE_APPLICATION_CREDENTIALS + GCLOUD_PROJECT.
// Emulator: FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 (add --create <password> to make the test user).
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const [email, ...flags] = process.argv.slice(2);
const emulator = process.env.FIREBASE_AUTH_EMULATOR_HOST;
const projectId = process.env.GCLOUD_PROJECT ?? (emulator ? 'demo-hybridcart' : undefined);

if (!email || !projectId) {
  console.error('Usage: npm run set-admin -- <email> [--remove]. Set GCLOUD_PROJECT (or FIREBASE_AUTH_EMULATOR_HOST).');
  process.exit(1);
}

initializeApp(emulator ? { projectId } : { projectId, credential: applicationDefault() });
const auth = getAuth();

const createAt = flags.indexOf('--create');
if (createAt >= 0) {
  if (!emulator) {
    console.error('--create is for the emulator only. In a real project add the user in the Firebase console.');
    process.exit(1);
  }
  await auth.createUser({ email, password: flags[createAt + 1] }).catch((e) => {
    if (e.code !== 'auth/email-already-exists') throw e;
  });
}

const user = await auth.getUserByEmail(email);
const admin = !flags.includes('--remove');
await auth.setCustomUserClaims(user.uid, { admin });
console.log(`admin=${admin} set for the user. They must sign in again to refresh their token.`);
