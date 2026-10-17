import {basename, dirname, resolve} from 'node:path';

export function studioRoots(cwd = process.cwd()) {
  cwd = resolve(cwd);
  return basename(cwd) === 'studio' && basename(dirname(cwd)) === 'apps'
    ? {appRoot: cwd, repositoryRoot: resolve(cwd, '../..')}
    : {appRoot: resolve(cwd, 'apps/studio'), repositoryRoot: cwd};
}
