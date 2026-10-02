#!/usr/bin/env node
// The verified backup format stays compatible with pre-consolidation copies.
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { backupLissabonState, verifyLissabonBackup } from './backup-lissabon-state.mjs';
export const backupLabState = backupLissabonState;
export const verifyLabBackup = verifyLissabonBackup;
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length !== 2 || args[0] !== '--destination') {
    console.error('Usage: node tools/backup-lab-state.mjs --destination <absolute-directory-outside-checkout>');
    process.exitCode = 2;
  } else {
    backupLabState({ destination: args[1] }).then(({ files, bytes }) => {
      console.log(JSON.stringify({ status: 'verified', files, bytes, manifest: 'manifest.json' }));
    }).catch(error => { console.error(error.code || 'backup_failed'); process.exitCode = 1; });
  }
}
