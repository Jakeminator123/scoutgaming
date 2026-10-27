import { createLocalProjectReader } from '../../../packages/studio-registry/server/local-project-reader.mjs';
import { mkdir, writeFile, rename, unlink } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { validateProject } from '../../../packages/presentation/contracts/studio-model.mjs';
import lockfile from 'proper-lockfile';

import { StudioError } from '../../../packages/shared/studio-error.mjs';
export { StudioError } from '../../../packages/shared/studio-error.mjs';

// Test adapter only: the caller names an absolute temporary directory.
// Neon is the product register; there is no default.
export function createProjectStore(dataDir) {
  if (typeof dataDir !== 'string' || !isAbsolute(dataDir)) throw new StudioError('Lokal projektlagring kräver en uttrycklig absolut katalog. Produkten läser Neon.', 503);
  const file = join(dataDir, 'project.json');
  const { load } = createLocalProjectReader(dataDir);
  return { load, async save(next, expectedRevision) {
    validateProject(next);
    await mkdir(dataDir, { recursive: true });
    let release;
    let compromised = false;
    try { release = await lockfile.lock(dataDir, { lockfilePath: join(dataDir, '.project.lock'), stale: 10000, update: 2000, retries: 0, onCompromised: () => { compromised = true; } }); }
    catch (error) {
      if (error.code === 'ELOCKED') throw new StudioError('Projektet sparas redan. Försök igen om en stund.', 423);
      throw error;
    }
    let temp;
    try {
      const current = await load();
      if (expectedRevision !== current.revision) throw new StudioError('Någon har ändrat projektet. Läs in den nya versionen innan du sparar.', 409);
      if (next.dealers.some(dealer => dealer.id === 'amira') && !current.dealers.some(dealer => dealer.id === 'amira')) {
        throw new StudioError('Amira är avvecklad och kan inte registreras igen.', 422);
      }
      const saved = { ...structuredClone(next), revision: `studio-${randomUUID()}` };
      const history = join(dataDir, 'history');
      await mkdir(history, { recursive: true });
      await writeFile(join(history, `${Date.now()}-${randomUUID()}.json`), JSON.stringify(current, null, 2) + '\n', { flag: 'wx' });
      temp = join(dataDir, `${randomUUID()}.tmp`);
      await writeFile(temp, JSON.stringify(saved, null, 2) + '\n', { flag: 'wx' });
      if (compromised) throw new StudioError('Skrivlåset ändrades. Projektet har inte ersatts.', 423);
      await rename(temp, file);
      temp = undefined;
      return saved;
    } finally {
      if (temp) await unlink(temp).catch(() => {});
      await release();
    }
  } };
}
