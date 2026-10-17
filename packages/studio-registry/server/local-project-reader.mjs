import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createEmptyProject, normalizeProject } from '../../presentation/contracts/studio-model.mjs';
import { StudioError } from '../../shared/studio-error.mjs';

// Read-only local authoring input; callers explicitly choose its directory.
export function createLocalProjectReader(dataDir) {
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
  return { load };
}
