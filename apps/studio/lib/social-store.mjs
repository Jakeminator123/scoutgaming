import { readFile, mkdir, writeFile, rename, unlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import lockfile from 'proper-lockfile';
import seed from '../policies/social.seed.json' with { type: 'json' };
import { validateSocialPolicy } from '../../../packages/director/social.mjs';
import { StudioError } from './project-store.mjs';

export function createSocialPolicy() { return structuredClone(seed); }
export function checkedPolicy(policy) {
  try { return validateSocialPolicy(policy); }
  catch { throw new StudioError('Ogiltig social policy. Kontrollera namn, instruktion, känslighet och taltext.', 422); }
}

// Independent of the user's existing project: no automatic project migration.
export function createSocialStore(dataDir = resolve(process.cwd(), 'data')) {
  const file = join(dataDir, 'social-policy.json');
  const load = async () => {
    try { return checkedPolicy(JSON.parse(await readFile(file, 'utf8'))); }
    catch (error) {
      if (error.code === 'ENOENT') return checkedPolicy(createSocialPolicy());
      throw new StudioError('Den sparade sociala policyn är ogiltig. Originalet har inte ersatts.', 422);
    }
  };
  return { load, async save(next, expectedRevision) {
    const checked = checkedPolicy(next);
    await mkdir(dataDir, { recursive: true });
    let compromised = false; let release;
    try { release = await lockfile.lock(dataDir, { lockfilePath: join(dataDir, '.social-policy.lock'), stale: 10000, update: 2000, retries: 0, onCompromised: () => { compromised = true; } }); }
    catch (error) {
      if (error.code === 'ELOCKED') throw new StudioError('Den sociala policyn sparas redan. Försök igen strax.', 423);
      throw error;
    }
    let temp;
    try {
      const current = await load();
      if (expectedRevision !== current.revision) throw new StudioError('Den sociala policyn har ändrats. Läs in den igen innan du sparar.', 409);
      const saved = { ...checked, revision: `social-${randomUUID()}` };
      const history = join(dataDir, 'social-history');
      await mkdir(history, { recursive: true });
      await writeFile(join(history, `${Date.now()}-${randomUUID()}.json`), JSON.stringify(current, null, 2) + '\n', { flag: 'wx' });
      temp = join(dataDir, `social-${randomUUID()}.tmp`);
      await writeFile(temp, JSON.stringify(saved, null, 2) + '\n', { flag: 'wx' });
      if (compromised) throw new StudioError('Skrivlåset ändrades. Policyn har inte ersatts.', 423);
      await rename(temp, file); temp = undefined;
      return saved;
    } finally {
      if (temp) await unlink(temp).catch(() => {});
      await release();
    }
  } };
}
