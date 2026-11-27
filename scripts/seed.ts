// Loads the demonstration catalogue and store configuration.
//   Emulator:     set FIRESTORE_EMULATOR_HOST=127.0.0.1:8080, then  npm run seed
//   Real project: set GOOGLE_APPLICATION_CREDENTIALS (key kept outside the repo) and
//                 GCLOUD_PROJECT, then  npm run seed -- --yes
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { PRODUCTS, SAMPLE_REVIEWS, SHIPPING_CONFIG, STORE_CONFIG } from '../src/data/seed/catalogue.ts';

const emulator = process.env.FIRESTORE_EMULATOR_HOST;
const projectId = process.env.GCLOUD_PROJECT ?? (emulator ? 'demo-hybridcart' : undefined);

if (!emulator && (!projectId || !process.argv.includes('--yes'))) {
  console.error('Refusing to write. For a real project set GCLOUD_PROJECT and pass --yes. For the emulator set FIRESTORE_EMULATOR_HOST=127.0.0.1:8080.');
  process.exit(1);
}

initializeApp(emulator ? { projectId } : { projectId, credential: applicationDefault() });
const db = getFirestore();
const batch = db.batch();

for (const { id, ...product } of PRODUCTS) batch.set(db.doc(`products/${id}`), product);
for (const { id, productId, ...review } of SAMPLE_REVIEWS) {
  batch.set(db.doc(`products/${productId}/reviews/${id}`), {
    ...review, productId, aiSuggestion: null, aiReason: null, moderatedBy: null,
  });
}
batch.set(db.doc('config/shipping'), SHIPPING_CONFIG);
batch.set(db.doc('config/store'), STORE_CONFIG);

await batch.commit();
console.log(`Seeded ${PRODUCTS.length} products and ${SAMPLE_REVIEWS.length} sample reviews into ${projectId}${emulator ? ' (emulator)' : ''}.`);
