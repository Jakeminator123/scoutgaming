import { readFileSync, writeFileSync } from 'node:fs';

const data = JSON.parse(readFileSync(new URL('./snapshot.json', import.meta.url), 'utf8'));
const template = readFileSync(new URL('./map-template.html', import.meta.url), 'utf8');
if (data.items.length !== 224 || new Set(data.items.map(x => x.id)).size !== 224
    || data.nodes.length !== 16 || data.dealers.length !== 4) {
  throw new Error('Unexpected inventory snapshot');
}
if (template.split('__DATA__').length !== 2) throw new Error('Expected one data placeholder');
const embedded = JSON.stringify(data).replace(/</g, '\\u003c');
writeFileSync(new URL('./map.html', import.meta.url), template.replace('__DATA__', () => embedded));
console.log('Built map.html from the recorded inventory snapshot.');
