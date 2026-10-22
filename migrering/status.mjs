import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export function validate(data) {
  const fail = (text) => { throw new Error(text); };
  if (data.schemaVersion !== 1) fail('Okänd statusversion');
  if (!Array.isArray(data.activities) || data.activities.length !== 20) fail('Förväntar 20 aktiviteter');
  const stages = new Set(data.stages.map((s) => s.id));
  if (stages.size !== 5) fail('Förväntar fem unika etapper');
  const byId = new Map(data.activities.map((a) => [a.id, a]));
  if (byId.size !== data.activities.length) fail('Dubbla aktivitets-ID');
  const statuses = new Set(['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'VERIFIED', 'BLOCKED']);
  for (const a of data.activities) {
    if (!/^(J\d{2}|K\d{2}|O\d{2})$/.test(a.id)) fail('Ogiltigt ID: ' + a.id);
    if (!stages.has(a.stage) || !statuses.has(a.status) || a.weight !== 5) fail('Ogiltig etapp/status/vikt: ' + a.id);
    if (!['jakob', 'kevin', 'orkestrator'].includes(a.owner)) fail('Ogiltig ägare: ' + a.id);
    if (!Array.isArray(a.dependsOn) || a.dependsOn.some((id) => !byId.has(id))) fail('Okänt beroende: ' + a.id);
    if (!Array.isArray(a.evidence)) fail('Saknar bevislista: ' + a.id);
    if (a.status === 'BLOCKED' && !a.blocker?.trim()) fail('Beskriv blockeraren: ' + a.id);
    if (a.status === 'VERIFIED') {
      if (!/^[a-f0-9]{40}$/.test(a.head ?? '') || !a.reviewer?.trim() || !a.branch?.trim() ||
          !a.pr?.trim() || !a.evidence.length || a.evidence.some((e) => typeof e !== 'string' || !e.trim())) {
        fail('VERIFIED kräver full SHA, branch, PR, granskare och verifieringsbevis: ' + a.id);
      }
      if (a.dependsOn.some((id) => byId.get(id).status !== 'VERIFIED')) fail('Beroenden inte verifierade: ' + a.id);
    }
  }
  const visited = new Set();
  const active = new Set();
  function visit(id) {
    if (active.has(id)) fail('Cirkulärt beroende: ' + id);
    if (visited.has(id)) return;
    active.add(id);
    byId.get(id).dependsOn.forEach(visit);
    active.delete(id);
    visited.add(id);
  }
  byId.forEach((_, id) => visit(id));
  for (const id of stages) {
    if (data.activities.filter((a) => a.stage === id).length !== 4) fail('Etappen ska ha fyra aktiviteter: ' + id);
  }
  return data;
}

export function render(data) {
  validate(data);
  const done = (items) => items.filter((a) => a.status === 'VERIFIED').reduce((n, a) => n + a.weight, 0);
  const percent = (items) => Math.round(done(items) / items.reduce((n, a) => n + a.weight, 0) * 100);
  const rows = ['# Migrationsstatus', '', 'Genererad från [status.json](status.json). Uppdaterad ' + data.updatedAt + '.',
    '', '**Verifierad migrering: ' + done(data.activities) + '% (' + data.activities.filter((a) => a.status === 'VERIFIED').length + '/20 aktiviteter).**',
    '', 'Detta mäter godkända leveranser. Det är inte en uppskattning av förbrukad arbetstid. Planfiler ger inga migrationspoäng.',
    '', '| Etapp | Verifierat inom etappen | Kumulativt etappmål | Grind |', '| --- | ---: | ---: | --- |'];
  let priorComplete = true;
  data.stages.forEach((s, index) => {
    const items = data.activities.filter((a) => a.stage === s.id);
    priorComplete = priorComplete && items.every((a) => a.status === 'VERIFIED');
    rows.push('| ' + s.id + ' ' + s.name + ' | ' + percent(items) + '% | ' + (index + 1) * 20 + '% | ' + (priorComplete ? 'Godkänd' : 'Ej godkänd') + ' |');
  });
  rows.push('', '| Ansvar | Verifierat inom ansvaret |', '| --- | ---: |');
  for (const owner of ['jakob', 'kevin', 'orkestrator']) rows.push('| ' + owner + ' | ' + percent(data.activities.filter((a) => a.owner === owner)) + '% |');
  rows.push('', '| ID | Aktivitet | Ansvar | Status |', '| --- | --- | --- | --- |');
  for (const a of data.activities) rows.push('| ' + a.id + ' | ' + a.title + ' | ' + a.owner + ' | ' + a.status + ' |');
  rows.push('', '## Uppdatering', '', 'Orkestratorn uppdaterar status.json efter granskad leverans och kör node migrering/status.mjs --write.',
    'VERIFIED kräver full kod-SHA, branch, PR, oberoende granskare och konkreta test-/runtimebevis. Skriptet validerar uppgifterna strukturellt; granskaren bedömer bevisen.',
    'En ändring som ogiltigförklarar ett bevis återöppnar aktiviteten och berörda beroenden; procenten får sjunka.',
    '', '[Masterplan](MASTERPLAN.md) · [Jakobs aktiviteter](jakob-main-migrering/AKTIVITETER.md) · [Kevins aktiviteter](kevin-ks-migrering/AKTIVITETER.md)', '');
  return rows.join('\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const args = process.argv.slice(2);
  if (args.some((arg) => !['--write', '--check'].includes(arg)) || args.length > 1) throw new Error('Använd status.mjs [--write|--check]');
  const output = render(JSON.parse(readFileSync(new URL('./status.json', import.meta.url), 'utf8')));
  const target = new URL('./STATUS.md', import.meta.url);
  if (args.includes('--write')) writeFileSync(target, output);
  else if (args.includes('--check')) {
    if (readFileSync(target, 'utf8').replaceAll('\r\n', '\n') !== output) throw new Error('STATUS.md är inaktuell; kör --write');
    process.stdout.write('Status och beräkning är konsekventa.\n');
  } else process.stdout.write(output);
}
