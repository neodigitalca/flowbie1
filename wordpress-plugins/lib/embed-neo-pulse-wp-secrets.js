import { spawnSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

export function embedNeoPulseWpSecrets() {
  const script = join(ROOT, 'scripts', 'embed-wp-secrets.mjs');
  const result = spawnSync(process.execPath, [script], {
    cwd: ROOT,
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    throw new Error('embed-wp-secrets.mjs failed');
  }
}
