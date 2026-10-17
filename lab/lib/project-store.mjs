import { readFile, mkdir, writeFile, rename, unlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createEmptyProject, normalizeProject, validateProject } from '../../packages/presentation/contracts/studio-model.mjs';
import lockfile from 'proper-lockfile';
import { autoArchiveLocalArtifacts } from '../../tools/retention-archive.mjs';

import { StudioError } from '../../packages/shared/studio-error.mjs';
export { StudioError } from '../../packages/shared/studio-error.mjs';

export function createProjectStore(dataDir = resolve(process.cwd(), 'data')) {
  const file = join(dataDir, 'project.json');
  const load = async () => {
    // Old editors permitted incompatible motion bindings. Keep those files
    // readable for explicit UI repair; save and simulation remain strict.
    try { return normalizeProject(JSON.parse(await readFile(file, 'utf8')), { allowIncompatibleAnimations: true, preserveMissingLanes: true }); }
    catch (error) {
      if (error.code === 'ENOENT') return createEmptyProject();
      throw new StudioError('Den sparade projektfilen är ogiltig. Originalet har inte ersatts.', 422);
    }
  };
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
      await autoArchiveLocalArtifacts('projectHistory', { dataDir });
      return saved;
    } finally {
      if (temp) await unlink(temp).catch(() => {});
      await release();
    }
  } };
}
