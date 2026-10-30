#!/usr/bin/env node
// Foreign branch guard: the required GitHub check that refuses a pull request into main or an
// environment branch (preview) when its head is someone else's branch (kevin*, codex/kevin-*, john*,
// emil*, ... from tools/repository-policy.json and inbox/people.json, same patterns as merge-pr.mjs)
// or when it was opened by another GitHub account than Jakob's (people.json jakob.github).
// It also stops GitHub's merge button, which skips tools/merge-pr.mjs.
//
// .github/workflows/foreign-branch-guard.yml runs it on pull_request_target with a checkout of main,
// so neither the workflow nor the policy it reads can be changed by the pull request it judges.
//   HEAD_REF=<branch> PR_AUTHOR=<login> BASE_REF=<branch> node tools/foreign-branch-guard.mjs
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { environmentBranches } from './check-push-target.mjs';
import { foreignBranchPatterns, matchesGlob } from './merge-pr.mjs';

export function foreignBranchGuard({ head, author, base, policy, people }) {
  const reasons = [];
  const branch = String(head ?? '');
  const login = String(author ?? '');
  const owner = people?.jakob?.github;
  const guarded = base === policy?.branch || environmentBranches(policy).includes(base);
  if (!guarded) return { ok: true, reasons: [`bas ${base || 'okänd'} är varken ${policy?.branch} eller en miljöbranch; ingen spärr`] };
  if (!branch) reasons.push('headbranchen är okänd');
  const foreign = foreignBranchPatterns({ policy, people }).find(pattern => matchesGlob(branch, pattern));
  if (foreign) reasons.push(`headbranchen ${branch} matchar ${foreign}: någon annans branch mergas aldrig till ${base}`);
  if (typeof owner !== 'string' || !owner) reasons.push('ägarens GitHub-konto saknas i inbox/people.json på main');
  else if (login !== owner) reasons.push(`PR:en är öppnad av ${login || 'okänt konto'}, inte ${owner}: bara ${owner} öppnar PR:er mot ${base}`);
  return reasons.length ? { ok: false, reasons } : { ok: true, reasons: [`${branch} av ${login} mot ${base}`] };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const read = path => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));
    const verdict = foreignBranchGuard({ head: process.env.HEAD_REF, author: process.env.PR_AUTHOR, base: process.env.BASE_REF,
      policy: read('tools/repository-policy.json'), people: read('inbox/people.json') });
    for (const reason of verdict.reasons) console.log(`${verdict.ok ? 'ok' : '::error title=Foreign branch guard::'} ${reason}`);
    if (!verdict.ok) {
      console.log('Nekad: den här PR:en får inte mergas till main eller preview. Arbetet förs över av Jakob på en egen jakob/*-branch.');
      process.exitCode = 1;
    }
  } catch (error) {
    console.log(`::error title=Foreign branch guard::${error.message}`);
    process.exitCode = 1;
  }
}
