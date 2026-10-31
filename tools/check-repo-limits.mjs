#!/usr/bin/env node
// Grind mot repotillväxt. Blob lagrar media och Neon produktdata; Git lagrar kod och text.
//
// Regler:
// 1. En spårad fil får vara högst 1 MB (1 048 576 byte). Undantag står i
//    tools/repo-limits-allowlist.json som { path, maxBytes, reason }, sorterade och unika.
//    maxBytes är filens exakta storlek: växer filen stoppas den, krymper den ska maxBytes
//    sänkas, och en post för en fil som är borta eller under gränsen ska bort. Listan
//    krymper alltså. En ny post eller ett höjt maxBytes är ett uttryckligt undantag som
//    granskas i PR:en.
// 2. Ingen ny binär under media/ (bilder, video, ljud och annat Git klassar som binärt).
//    Befintliga filer får ligga kvar, flyttas eller krympa men inte växa.
// 3. Ingen fil under docs/ över 100 kB (102 400 byte). Handoffens omfång granskas
//    efter innehåll, inte radbrytning. Det finns ingen historikmapp; äldre text läses ur Git.
//
// Lägen (alla läser Git-objekt, inte filsystemet):
//   node tools/check-repo-limits.mjs                     hela HEAD-trädet (git ls-tree -r -l)
//   node tools/check-repo-limits.mjs --tree <ref>        hela trädet för <ref>
//   node tools/check-repo-limits.mjs --cached            pre-commit: indexet mot HEAD, bara ändrade filer
//   node tools/check-repo-limits.mjs --ci                CI: exakt eventintervall, alla nya commits/objekt;
//                                                        schema/manuellt: bara det aktuella trädet.
//   node tools/check-repo-limits.mjs --tree HEAD --changed-since HEAD^1
//                                                        slutdiffen plus ändrade allowlistposter,
//                                                        så att en gles blob:none-klon bara hämtar diffens blobbar.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ALLOWLIST = 'tools/repo-limits-allowlist.json';
export const MAX_FILE_BYTES = 1024 * 1024;
export const MAX_DOC_BYTES = 100 * 1024;
export const MEDIA_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif', '.bmp', '.tif', '.tiff', '.ico', '.heic',
  '.mp4', '.mov', '.webm', '.mkv', '.avi', '.m4v', '.wav', '.mp3', '.m4a', '.ogg', '.oga', '.opus', '.flac', '.aac']);

const repository = resolve(fileURLToPath(new URL('..', import.meta.url)));
const mb = bytes => `${(bytes / MAX_FILE_BYTES).toFixed(2)} MB`;
const kb = bytes => `${Math.ceil(bytes / 1024)} kB`;

export function isMediaBinary({ path, binary }) {
  return path.startsWith('media/') && (binary || MEDIA_EXTENSIONS.has(posix.extname(path).toLowerCase()));
}

function validPath(path) {
  return typeof path === 'string' && path.length > 0 && !path.startsWith('/') && !path.includes('\\')
    && !/[\0-\x1f]/.test(path) && !path.split('/').some(part => ['', '.', '..'].includes(part));
}

export function allowlistErrors(allowlist) {
  if (!Array.isArray(allowlist)) return [`${ALLOWLIST} ska vara en lista med { path, maxBytes, reason }`];
  const errors = [];
  allowlist.forEach((entry, index) => {
    if (!entry || typeof entry !== 'object' || Object.keys(entry).sort().join() !== 'maxBytes,path,reason' || !validPath(entry.path)
      || !Number.isSafeInteger(entry.maxBytes) || typeof entry.reason !== 'string' || !entry.reason.trim()) {
      errors.push(`${ALLOWLIST}: post ${index} ska ha exakt path, maxBytes (heltal) och reason`);
    } else if (entry.maxBytes <= MAX_FILE_BYTES) {
      errors.push(`${ALLOWLIST}: ${entry.path} har maxBytes ${entry.maxBytes}, som inte är över gränsen ${MAX_FILE_BYTES}; ta bort posten`);
    }
  });
  const paths = allowlist.map(entry => entry?.path);
  if (new Set(paths).size !== paths.length) errors.push(`${ALLOWLIST}: varje path får bara finnas en gång`);
  if (paths.join('\n') !== [...paths].sort().join('\n')) errors.push(`${ALLOWLIST}: posterna ska vara sorterade efter path`);
  return errors;
}

// files: [{ path, bytes, baseBytes?, added?, moved?, binary? }] for the inspected set.
// bytes null means the path is absent from the checked tree. complete: files is the whole tree.
export function checkRepoLimits({ files, allowlist, complete = false }) {
  const errors = allowlistErrors(allowlist);
  const entries = new Map(Array.isArray(allowlist) ? allowlist.filter(entry => validPath(entry?.path)).map(entry => [entry.path, entry]) : []);
  const seen = new Set();
  for (const file of files) {
    seen.add(file.path);
    const entry = entries.get(file.path);
    if (file.bytes === null || file.bytes === undefined) {
      if (entry) errors.push(`${file.path}: finns inte längre; ta bort posten ur ${ALLOWLIST}`);
      continue;
    }
    if (file.bytes > MAX_FILE_BYTES) {
      if (!entry) errors.push(`${file.path}: ${mb(file.bytes)}, över gränsen 1 MB och utan undantag. `
        + (file.path.startsWith('media/') || MEDIA_EXTENSIONS.has(posix.extname(file.path).toLowerCase())
          ? 'Lägg mediet i Blob via Admin; Git lagrar inte media.'
          : 'Dela upp filen, generera den vid bygget eller lägg den i Blob; ett godkänt undantag kräver en post i ' + ALLOWLIST + '.'));
      else if (Number.isSafeInteger(entry.maxBytes) && file.bytes > entry.maxBytes) errors.push(`${file.path}: växer från ${entry.maxBytes} till ${file.bytes} byte. `
        + 'Allowlistade filer får inte växa; lägg ny version i Blob via Admin i stället.');
      else if (Number.isSafeInteger(entry.maxBytes) && file.bytes < entry.maxBytes) errors.push(`${file.path}: har krympt till ${file.bytes} byte; sänk maxBytes till ${file.bytes} i ${ALLOWLIST}`);
    } else if (entry) {
      errors.push(`${file.path}: är nu ${file.bytes} byte, under gränsen 1 MB; ta bort posten ur ${ALLOWLIST}`);
    }
    if (isMediaBinary(file)) {
      if (file.added && !file.moved) errors.push(`${file.path}: ny binär under media/. Lägg mediet i Blob via Admin; Git lagrar inte media.`);
      else if (Number.isSafeInteger(file.baseBytes) && file.bytes > file.baseBytes) errors.push(`${file.path}: binären under media/ växer från ${file.baseBytes} till ${file.bytes} byte. `
        + 'Lägg den nya versionen i Blob via Admin; Git lagrar inte media.');
    }
    if (file.path.startsWith('docs/') && file.bytes > MAX_DOC_BYTES) {
      errors.push(`${file.path}: ${kb(file.bytes)}, över taket 100 kB för levande dokument. Radera äldre avsnitt; Git har dem (docs/HISTORIK.md).`);
    }
  }
  if (complete) for (const path of entries.keys()) if (!seen.has(path)) errors.push(`${path}: finns inte i trädet; ta bort posten ur ${ALLOWLIST}`);
  return errors;
}

// ---- Git inspection -------------------------------------------------------

function runner(cwd) {
  return (args, input) => execFileSync('git', args, { cwd, input, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'] });
}

function objectSizes(git, oids) {
  const unique = [...new Set(oids)];
  if (!unique.length) return new Map();
  const output = git(['cat-file', '--batch-check=%(objectname) %(objecttype) %(objectsize)'], unique.join('\n') + '\n');
  const sizes = new Map();
  for (const line of output.split('\n').filter(Boolean)) {
    const [oid, type, size] = line.split(' ');
    if (type !== 'blob') throw Error(`Git-objektet ${oid} kunde inte läsas (${type})`);
    sizes.set(oid, Number(size));
  }
  return sizes;
}

function readJson(git, spec, fallback) {
  let text;
  try { text = git(['cat-file', 'blob', spec]); } catch { return fallback; }
  return JSON.parse(text);
}

function parseLsTree(output) {
  // "<mode> <type> <oid> <size>\t<path>" (ls-tree -l) or without size.
  return output.split('\0').filter(Boolean).map(record => {
    const tab = record.indexOf('\t');
    const [mode, type, oid, size] = record.slice(0, tab).trim().split(/\s+/);
    return { mode, type, oid, bytes: size === undefined || size === '-' ? null : Number(size), path: record.slice(tab + 1) };
  });
}

function parseRawDiff(output) {
  const fields = output.split('\0');
  if (fields.at(-1) === '') fields.pop();
  const records = [];
  for (let index = 0; index < fields.length; index += 2) {
    const match = /^:(\d{6}) (\d{6}) ([a-f0-9]{40,64}) ([a-f0-9]{40,64}) ([A-Z])$/.exec(fields[index]);
    if (!match || !fields[index + 1]) throw Error('Oväntad rad i git diff --raw');
    records.push({ baseMode: match[1], mode: match[2], baseOid: match[3], oid: match[4], status: match[5], path: fields[index + 1] });
  }
  return records;
}

function parseNumstat(output) {
  const binary = new Set();
  for (const record of output.split('\0').filter(Boolean)) {
    const match = /^(-|\d+)\t(-|\d+)\t(.+)$/s.exec(record);
    if (match && match[1] === '-' && match[2] === '-') binary.add(match[3]);
  }
  return binary;
}

// Whole tree: one ls-tree process for every size; every allowlist entry is validated.
export function inspectTree({ cwd = repository, tree = 'HEAD' } = {}) {
  const git = runner(cwd);
  const blobs = parseLsTree(git(['ls-tree', '-r', '-l', '-z', tree])).filter(entry => entry.type === 'blob');
  const files = blobs.map(({ path, bytes }) => ({ path, bytes }));
  return { files, allowlist: readJson(git, `${tree}:${ALLOWLIST}`, []), complete: true };
}

// A diff: tree against base (CI) or the index against HEAD (pre-commit, tree null).
export function inspectChanges({ cwd = repository, tree = null, base = 'HEAD' } = {}) {
  const git = runner(cwd);
  const range = tree ? [base, tree] : ['--cached'];
  const common = ['--no-renames', '--no-ext-diff', '--no-textconv', '-z'];
  const records = parseRawDiff(git(['-c', 'diff.relative=false', 'diff', '--raw', '--no-abbrev', ...common, ...range, '--']))
    .filter(record => record.mode !== '160000' && record.baseMode !== '160000');
  // Git prefetches before applying --diff-filter. Limit the pathspec itself to
  // surviving paths so deletions never download retired media. Modified paths
  // still need both sides for the existing binary-growth rule.
  const binary = new Set(), presentPaths = records.filter(record => record.status !== 'D').map(record => record.path);
  for (let offset = 0; offset < presentPaths.length; offset += 128) {
    const batch = git(['--literal-pathspecs', '-c', 'diff.relative=false', 'diff', '--numstat', ...common, ...range, '--', ...presentPaths.slice(offset, offset + 128)]);
    for (const path of parseNumstat(batch)) binary.add(path);
  }
  const target = path => tree ? `${tree}:${path}` : `:${path}`;
  let hasBase = true;
  try { git(['rev-parse', '--verify', '--quiet', `${base}^{tree}`]); } catch { hasBase = false; }
  const allowlist = readJson(git, target(ALLOWLIST), []);
  const baseAllowlist = hasBase ? readJson(git, `${base}:${ALLOWLIST}`, []) : [];
  // Allowlist entries that were added, removed or changed are checked even when their file is not in the diff.
  const key = entry => JSON.stringify([entry?.path, entry?.maxBytes]);
  const before = new Set((Array.isArray(baseAllowlist) ? baseAllowlist : []).map(key));
  const after = new Set((Array.isArray(allowlist) ? allowlist : []).map(key));
  const changedEntries = [...(Array.isArray(allowlist) ? allowlist : []).filter(entry => !before.has(key(entry))),
    ...(Array.isArray(baseAllowlist) ? baseAllowlist : []).filter(entry => !after.has(key(entry)))]
    .map(entry => entry?.path).filter(validPath);
  const inDiff = new Set(records.map(record => record.path));
  const extra = [...new Set(changedEntries)].filter(path => !inDiff.has(path)).sort();
  let extraBlobs = [];
  if (extra.length) {
    // In a blob:none clone the size needs the blob. A numstat diff from the empty tree fetches
    // all of them in one batch instead of one lazy fetch per object.
    if (tree) git(['--literal-pathspecs', 'diff', '--numstat', ...common, git(['hash-object', '-t', 'tree', '--stdin'], '').trim(), tree, '--', ...extra]);
    extraBlobs = tree
      ? parseLsTree(git(['--literal-pathspecs', 'ls-tree', '-r', '-z', tree, '--', ...extra])).filter(entry => entry.type === 'blob')
      : git(['--literal-pathspecs', 'ls-files', '-s', '-z', '--', ...extra]).split('\0').filter(Boolean)
        .map(record => { const tab = record.indexOf('\t'); return { oid: record.slice(0, tab).split(' ')[1], path: record.slice(tab + 1) }; });
  }
  const present = records.filter(record => record.status !== 'D');
  const sizes = objectSizes(git, [...present.map(record => record.oid),
    ...present.filter(record => record.status !== 'A' && !/^0+$/.test(record.baseOid)).map(record => record.baseOid),
    ...extraBlobs.map(blob => blob.oid)]);
  const removed = new Set(records.filter(record => record.status === 'D').map(record => record.baseOid));
  const files = records.map(record => record.status === 'D' ? { path: record.path, bytes: null } : {
    path: record.path,
    bytes: sizes.get(record.oid),
    baseBytes: record.status === 'A' || /^0+$/.test(record.baseOid) ? null : sizes.get(record.baseOid),
    added: record.status === 'A',
    moved: record.status === 'A' && removed.has(record.oid),
    binary: binary.has(record.path),
  });
  const found = new Map(extraBlobs.map(blob => [blob.path, blob]));
  for (const path of extra) {
    const blob = found.get(path);
    files.push(blob ? { path, bytes: sizes.get(blob.oid) } : { path, bytes: null });
  }
  return { files, allowlist, complete: false };
}

// Pre-push checks every new commit, not just the final diff. Only object metadata
// and the named allowlist are read; old media/document contents are never loaded.
// Missing objects fail without lazy fetch. CI alone explicitly hydrates the exact
// new object set and policies/allowance targets that the inspection needs.
export function inspectPush({ cwd = repository, updates, remote, branch = 'main', hydrate = false } = {}) {
  const git = (args, input) => {
    try {
      return execFileSync('git', args, { cwd, input, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
        env: { ...process.env, GIT_NO_LAZY_FETCH: '1', GIT_NO_REPLACE_OBJECTS: '1', GIT_TERMINAL_PROMPT: '0' },
        stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'] });
    } catch {
      throw Error(`Pushgränser: Git-metadata kunde inte läsas (${args[0]}). Hämta den saknade basen eller objekten uttryckligen och försök igen.`);
    }
  };
  const oidPattern = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/;
  const hydrateObjects = oids => {
    if (!hydrate || !oids.length) return;
    const unique = [...new Set(oids)];
    const missing = git(['cat-file', '--batch-check=%(objectname) %(objecttype)'], unique.join('\n') + '\n')
      .trim().split(/\r?\n/).filter(line => line.endsWith(' missing')).map(line => line.split(' ')[0]);
    if (missing.some(oid => !oidPattern.test(oid))) throw Error('CI-gränser: ogiltigt objekt-ID.');
    if (missing.length) git(['fetch', '--no-tags', '--no-recurse-submodules', '--filter=blob:none', '--stdin', 'origin'], missing.join('\n') + '\n');
  };
  const zero = oid => /^0+$/.test(oid);
  const refs = String(updates ?? '').trim().split(/\r?\n/).filter(Boolean).map(line => {
    const fields = line.trim().split(/\s+/);
    if (fields.length !== 4 || !oidPattern.test(fields[1]) || !oidPattern.test(fields[3])
      || !fields[2].startsWith('refs/heads/')) throw Error('Pushgränser: ogiltiga pushreferenser.');
    return { head: fields[1], base: fields[3] };
  }).filter(ref => !zero(ref.head));
  if (!refs.length) return { errors: [], commits: 0, blobs: 0, refs: 0 };
  if (git(['rev-parse', '--is-shallow-repository']).trim() !== 'false') {
    throw Error('Pushgränser: shallow-historik kan dölja nya objekt. Hämta fullständig historik före push.');
  }
  const requireCommit = oid => {
    if (git(['cat-file', '-t', oid]).trim() !== 'commit') throw Error('Pushgränser: pushens bas eller head är ingen känd commit.');
  };
  let advertisedBase;
  const creationBases = head => {
    if (!advertisedBase) {
      if (typeof remote !== 'string' || !remote || remote.startsWith('-') || !/^[\w./-]+$/.test(branch)) {
        throw Error('Pushgränser: verifierbar fjärrbas krävs för första pushen.');
      }
      const rows = git(['ls-remote', '--exit-code', '--refs', remote, `refs/heads/${branch}`]).trim().split(/\r?\n/);
      const fields = rows.length === 1 ? rows[0].split(/\s+/) : [];
      if (fields.length !== 2 || !oidPattern.test(fields[0]) || fields[1] !== `refs/heads/${branch}`) {
        throw Error('Pushgränser: fjärrens huvudbranch kunde inte verifieras.');
      }
      advertisedBase = fields[0];
      requireCommit(advertisedBase);
    }
    // Common ancestors are proven reachable from the advertised remote commit.
    // Never fall back to scanning an entire old history or trusting stale tracking refs.
    const bases = git(['merge-base', '--all', head, advertisedBase]).trim().split(/\r?\n/);
    if (!bases.length || bases.some(oid => !oidPattern.test(oid))) throw Error('Pushgränser: känd gemensam fjärrbas saknas.');
    return bases;
  };
  const trees = new Map(), policies = new Map(), sizes = new Map(), seenCommits = new Set(), seenBlobs = new Set();
  const treeAt = commit => {
    if (!trees.has(commit)) trees.set(commit, new Map(parseLsTree(git(['ls-tree', '-r', '-z', commit]))
      .filter(file => file.type === 'blob').map(file => [file.path, file])));
    return trees.get(commit);
  };
  const sizeOf = oid => {
    if (!sizes.has(oid)) {
      hydrateObjects([oid]);
      const size = objectSizes(git, [oid]).get(oid);
      if (!Number.isSafeInteger(size) || size < 0) throw Error('Pushgränser: objektstorlek saknas.');
      sizes.set(oid, size);
    }
    return sizes.get(oid);
  };
  const policyAt = commit => {
    const blob = treeAt(commit).get(ALLOWLIST);
    if (!blob) return [];
    if (!policies.has(blob.oid)) {
      if (sizeOf(blob.oid) > MAX_FILE_BYTES) throw Error('Pushgränser: allowlistan är större än 1 MB.');
      let policy;
      try { policy = JSON.parse(git(['cat-file', 'blob', blob.oid])); }
      catch { throw Error('Pushgränser: allowlistan kunde inte läsas som lokal JSON.'); }
      const errors = allowlistErrors(policy);
      if (errors.length) throw Error('Pushgränser: ogiltig allowlista: ' + errors.join('\n'));
      policies.set(blob.oid, policy);
    }
    return policies.get(blob.oid);
  };
  const errors = [];
  for (const ref of refs) {
    requireCommit(ref.head);
    const bases = zero(ref.base) ? creationBases(ref.head) : [ref.base];
    for (const base of bases) { requireCommit(base); git(['merge-base', '--is-ancestor', base, ref.head]); }
    const commits = git(['rev-list', '--topo-order', '--reverse', ref.head, '--not', ...bases]).trim().split(/\r?\n/).filter(Boolean);
    if (!commits.length) continue;
    if (hydrate) {
      // Prove the complete commit/tree graph exists before requesting any bytes.
      git(['rev-list', '--objects', '--filter=blob:none', '--missing=error', ref.head, '--not', ...bases]);
      const pending = git(['rev-list', '--objects', '--no-object-names', '--missing=print', ref.head, '--not', ...bases])
        .trim().split(/\r?\n/).filter(line => line.startsWith('?')).map(line => line.slice(1));
      hydrateObjects(pending);
    }
    const objects = git(['rev-list', '--objects', '--no-object-names', ref.head, '--not', ...bases]).trim().split(/\r?\n/).filter(Boolean);
    const newBlobs = new Set();
    // Batch metadata only. An incomplete enumeration or missing object aborts the push.
    const metadata = git(['cat-file', '--batch-check=%(objectname) %(objecttype) %(objectsize)'], objects.join('\n') + '\n').trim().split(/\r?\n/);
    if (metadata.length !== objects.length) throw Error('Pushgränser: ofullständig objektlista.');
    metadata.forEach((line, index) => {
      const [oid, type, size] = line.split(' ');
      if (oid !== objects[index] || !['commit', 'tree', 'blob', 'tag'].includes(type) || !/^\d+$/.test(size)
        || !Number.isSafeInteger(Number(size))) throw Error('Pushgränser: saknad eller ogiltig objektmetadata.');
      if (type === 'blob') { newBlobs.add(oid); seenBlobs.add(oid); sizes.set(oid, Number(size)); }
    });
    const finalTree = treeAt(ref.head), finalPolicy = new Map(policyAt(ref.head).map(entry => [entry.path, entry]));
    for (const commit of commits) {
      seenCommits.add(commit);
      const tree = treeAt(commit), policy = policyAt(commit), paths = new Set();
      for (const file of tree.values()) if (newBlobs.has(file.oid)) paths.add(file.path);
      // Changed allowances must still match their actual files, even if those blobs
      // were already remote. Check each parent so merge-only allowance edits count.
      const parents = git(['rev-list', '--parents', '-n', '1', commit]).trim().split(' ').slice(1);
      for (const parent of parents.length ? parents : [null]) {
        const before = new Map((parent ? policyAt(parent) : []).map(entry => [entry.path, entry.maxBytes]));
        const after = new Map(policy.map(entry => [entry.path, entry.maxBytes]));
        for (const path of new Set([...before.keys(), ...after.keys()])) if (before.get(path) !== after.get(path)) paths.add(path);
      }
      const files = [...paths].map(path => ({ path, bytes: tree.has(path) ? sizeOf(tree.get(path).oid) : null }));
      errors.push(...checkRepoLimits({ files, allowlist: policy }).map(error => `${commit}: ${error}`));
      for (const file of files) if (file.bytes > MAX_FILE_BYTES && newBlobs.has(tree.get(file.path)?.oid)) {
        const final = finalTree.get(file.path), allowance = finalPolicy.get(file.path);
        if (!final || final.oid !== tree.get(file.path).oid || allowance?.maxBytes !== file.bytes || sizeOf(final.oid) !== file.bytes) {
          errors.push(`${commit}: ${file.path}: stor mellanliggande blob saknar samma blob-OID med exakt undantag i pushens slutträd. Tillfälliga undantag får inte dölja nya stora objekt.`);
        }
      }
    }
  }
  return { errors: [...new Set(errors)], commits: seenCommits.size, blobs: seenBlobs.size, refs: refs.length };
}

// GitHub supplies a JSON file, not shell text. Bind every interval to the exact
// checkout and event; never substitute HEAD^1 for an unknown push/PR base.
export function inspectCi({ cwd = repository, env = process.env, event } = {}) {
  const git = (args) => execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, GIT_NO_LAZY_FETCH: '1', GIT_NO_REPLACE_OBJECTS: '1', GIT_TERMINAL_PROMPT: '0' },
    stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const oid = value => typeof value === 'string' && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(value) && !/^0+$/.test(value);
  const head = env.GITHUB_SHA;
  if (!oid(head) || git(['rev-parse', 'HEAD']) !== head) throw Error('CI-gränser: eventets SHA matchar inte checkout.');
  const name = env.GITHUB_EVENT_NAME;
  if (['schedule', 'workflow_dispatch'].includes(name)) {
    // These events have no new interval: intentionally inspect the current tree.
    return { ...inspectTree({ cwd, tree: head }), mode: 'tree' };
  }
  if (!['push', 'pull_request'].includes(name)) throw Error('CI-gränser: okänd eventtyp.');
  const payload = event ?? JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, 'utf8'));
  let base;
  if (name === 'pull_request') {
    const pr = payload.pull_request;
    if (!Number.isSafeInteger(payload.number) || payload.number < 1 || env.GITHUB_REF !== `refs/pull/${payload.number}/merge`
      || !oid(pr?.head?.sha) || !oid(pr?.base?.sha)) throw Error('CI-gränser: ogiltig PR-identitet.');
    // Read raw parent headers: a shallow boundary must not hide a parent.
    const parents = git(['cat-file', 'commit', head]).split('\n\n')[0].split('\n').filter(line => line.startsWith('parent ')).map(line => line.slice(7));
    if (parents.length !== 2 || parents[0] !== pr.base.sha || parents[1] !== pr.head.sha) throw Error('CI-gränser: PR-bas/head matchar inte mergeföräldrarna.');
    base = pr.base.sha;
  } else {
    if (payload.after !== head || !oid(payload.before) || payload.deleted || payload.created
      || !/^refs\/heads\/[A-Za-z0-9_./-]+$/.test(payload.ref ?? '') || payload.ref !== env.GITHUB_REF) throw Error('CI-gränser: okänt eller ogiltigt pushintervall.');
    base = payload.before;
  }
  if (git(['rev-parse', '--is-shallow-repository']) === 'true') {
    // No checkout and no historical media hydration. The server supplies only
    // commit/tree history; inspectPush requests exact new blobs/changed policies.
    git(['fetch', '--no-tags', '--no-recurse-submodules', '--filter=blob:none', '--unshallow', 'origin', head]);
  }
  const result = inspectPush({ cwd, updates: `HEAD ${head} refs/heads/ci ${base}\n`, hydrate: true });
  // Keep the final diff's media-growth, binary and document-line rules as well.
  if (!result.errors.length) result.errors.push(...checkRepoLimits(inspectChanges({ cwd, tree: head, base })));
  return { ...result, mode: 'range' };
}

export function parseArgs(args) {
  const ref = value => typeof value === 'string' && /^[\w./^~-]+$/.test(value) && !value.startsWith('-');
  if (args.length === 0) return { tree: 'HEAD' };
  if (args.length === 1 && args[0] === '--ci') return { ci: true };
  if (args.length === 1 && args[0] === '--cached') return { cached: true };
  if (args.length === 3 && args[0] === '--push') return { push: true, remote: args[2] };
  if (args.length === 2 && args[0] === '--tree' && ref(args[1])) return { tree: args[1] };
  if (args.length === 4 && args[0] === '--tree' && ref(args[1]) && args[2] === '--changed-since' && ref(args[3])) return { tree: args[1], since: args[3] };
  return null;
}

export function main(args = process.argv.slice(2), { cwd = repository } = {}) {
  const options = parseArgs(args);
  if (!options) {
    console.error('Användning: node tools/check-repo-limits.mjs [--ci | --cached | --tree <ref> [--changed-since <ref>] | --push <remote-name> <remote-url>]');
    return 2;
  }
  if (options.ci) {
    const result = inspectCi({ cwd });
    const errors = result.mode === 'tree' ? checkRepoLimits(result) : result.errors;
    for (const error of errors) console.error(error);
    if (!errors.length) console.log(result.mode === 'tree' ? `CI-gränser: hela aktuella trädet kontrollerat (${result.files.length} filer).`
      : `CI-gränser: hela eventintervallet kontrollerat (${result.commits} commits, ${result.blobs} blobbar).`);
    return errors.length ? 1 : 0;
  }
  if (options.push) {
    const result = inspectPush({ cwd, updates: readFileSync(0, 'utf8'), remote: options.remote });
    for (const error of result.errors) console.error(error);
    if (!result.errors.length) console.log(`Pushgränser: ${result.commits} nya commits, ${result.blobs} nya blobbar, ${result.refs} referenser kontrollerade.`);
    return result.errors.length ? 1 : 0;
  }
  const result = options.cached ? inspectChanges({ cwd })
    : options.since ? inspectChanges({ cwd, tree: options.tree, base: options.since })
      : inspectTree({ cwd, tree: options.tree });
  const errors = checkRepoLimits(result);
  for (const error of errors) console.error(error);
  if (errors.length) {
    console.error(`Repogränser: ${errors.length} fel. Regler och undantag: tools/check-repo-limits.mjs och ${ALLOWLIST}.`);
    return 1;
  }
  const where = options.cached ? 'indexet mot HEAD' : options.since ? `${options.tree} mot ${options.since}` : `hela ${options.tree}`;
  console.log(`Repogränser: ${result.files.length} filer kontrollerade (${where}); ${Array.isArray(result.allowlist) ? result.allowlist.length : 0} undantag över 1 MB.`);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exitCode = main(); }
  catch (error) { console.error('Repogränser kunde inte kontrolleras: ' + error.message); process.exitCode = 1; }
}
