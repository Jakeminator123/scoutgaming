import {basename, resolve} from 'node:path';

export function studioRoots(cwd = process.cwd()) {
  return basename(cwd) === 'studio'
    ? {appRoot: cwd, repositoryRoot: resolve(cwd, '../..')}
    : {appRoot: resolve(cwd, 'apps/studio'), repositoryRoot: cwd};
}
