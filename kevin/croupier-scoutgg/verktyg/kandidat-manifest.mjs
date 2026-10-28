// Lists the candidate takes of a dealer for the local clip review (/studio/klipp.html?dealer=<id>):
// public/media/dealers/<id>/kandidater/<take>/<variant>.mp4  →  kandidater/manifest.json
// Run: node verktyg/kandidat-manifest.mjs adebayor
import { readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
const id = process.argv[2] || 'adebayor';
const root = path.join(process.cwd(), 'public', 'media', 'dealers', id, 'kandidater');
const takes = [];
for (const take of readdirSync(root).filter(d => statSync(path.join(root, d)).isDirectory()).sort()) {
  const files = readdirSync(path.join(root, take)).filter(f => /\.(mp4|webm)$/i.test(f)).sort();
  for (const f of files) takes.push({ take, variant: f.replace(/\.(mp4|webm)$/i, ''), url: `/media/dealers/${id}/kandidater/${take}/${f}`, size: statSync(path.join(root, take, f)).size });
}
writeFileSync(path.join(root, 'manifest.json'), JSON.stringify({ dealer: id, made: new Date().toISOString(), takes }, null, 1));
console.log(`${takes.length} kandidater i ${takes.length ? new Set(takes.map(t => t.take)).size : 0} tagningar → ${path.relative(process.cwd(), path.join(root, 'manifest.json'))}`);
