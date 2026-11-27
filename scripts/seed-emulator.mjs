import { spawnSync } from 'node:child_process';

const env = { ...process.env, FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080' };
process.exit(spawnSync('npx tsx scripts/seed.ts', { stdio: 'inherit', shell: true, env }).status ?? 1);
