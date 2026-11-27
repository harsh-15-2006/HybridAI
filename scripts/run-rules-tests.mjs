import { spawnSync } from 'node:child_process';

const result = spawnSync('npx vitest run', { stdio: 'inherit', shell: true, env: { ...process.env, RULES_TESTS: '1' } });
process.exit(result.status ?? 1);
