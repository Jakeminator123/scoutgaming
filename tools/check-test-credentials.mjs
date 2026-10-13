import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

// A narrow regression guard for incident 38176586, not a substitute for
// GitGuardian. Only source locations are returned, never matched credentials.
export function findNeonCredentialLiterals(source) {
  const pattern = /\bpostgres(?:ql)?:\/\/[^\s/'"`@:]+:[^\s/'"`@]+@[a-z0-9.-]+\.neon\.tech(?=[:/?#\s'"`]|$)/gi;
  return [...source.matchAll(pattern)].map(match => ({
    line: source.slice(0, match.index).split('\n').length,
    code: 'static_neon_test_credentials',
  }));
}

export function checkTestCredentials(root) {
  const findings = [];
  const walk = directory => {
    for (const entry of readdirSync(directory, {withFileTypes:true})) {
      const file = join(directory, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (entry.isFile() && /\.(?:[cm]?js|tsx?|json)$/.test(entry.name)) {
        for (const finding of findNeonCredentialLiterals(readFileSync(file,'utf8'))) {
          findings.push({file:relative(root,file).replaceAll('\\','/'), ...finding});
        }
      }
    }
  };
  for (const directory of ['test', 'lab/test']) walk(join(root,directory));
  return findings;
}
