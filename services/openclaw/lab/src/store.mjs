import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { validateCatalog } from '../../../../packages/director/engine.mjs';

export class StoreError extends Error {
  constructor(code, statusCode, errors = []) { super(code); this.code = code; this.statusCode = statusCode; this.errors = errors; }
}

export async function catalogStore(seedPath, dataDir) {
  const path = join(dataDir, 'catalog.json');
  await mkdir(dataDir, { recursive: true });
  const load = async () => {
    let raw;
    try { raw = await readFile(path, 'utf8'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; raw = await readFile(seedPath, 'utf8'); }
    const catalog = JSON.parse(raw);
    const result = validateCatalog(catalog);
    if (!result.valid) throw new StoreError('catalog_invalid', 422, result.errors);
    return catalog;
  };
  await load();
  let queue = Promise.resolve();
  return {
    load,
    save(next, expectedRevision) {
      const operation = queue.then(async () => {
        const current = await load();
        if (typeof expectedRevision !== 'string' || expectedRevision !== current.revision) throw new StoreError('catalog_conflict_reload_first', 409);
        const result = validateCatalog(next);
        if (!result.valid) throw new StoreError('catalog_invalid', 422, result.errors);
        const saved = { ...next, revision: `lab-${randomUUID()}` };
        // A recoverable snapshot and an atomic rename protect the last working configuration.
        await mkdir(join(dataDir, 'history'), { recursive: true });
        await writeFile(join(dataDir, 'history', `${Date.now()}-${randomUUID()}.json`), `${JSON.stringify(current, null, 2)}\n`, { flag: 'wx' });
        const temp = `${path}.${randomUUID()}.tmp`;
        await writeFile(temp, `${JSON.stringify(saved, null, 2)}\n`, { flag: 'wx' });
        await rename(temp, path);
        return saved;
      });
      queue = operation.catch(() => {});
      return operation;
    },
  };
}
