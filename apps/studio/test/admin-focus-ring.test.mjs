import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync,readFileSync} from 'node:fs';
import {join,relative} from 'node:path';
import {fileURLToPath} from 'node:url';

// Designregel (WCAG 1.4.11): en fokusring ska ha minst 3:1 mot ytan den ligger på. Lime (#d6ff3a)
// är fast i båda lägena och ger ungefär 1,15:1 mot vit yta i ljust läge, så en limefärgad fokusring
// syns knappt där. Fokusringar i Admin och i de delade komponenterna (som Admins Tailwind också
// läser, se @source i client/admin/app/globals.css) använder därför --sg-mark, som har ett värde
// per läge i packages/ui/tokens.css och kontrasttestas i ui-tokens.test.mjs. Lime får finnas kvar
// som accentfärg (knappfyllning, vald markering med skugga), bara inte som fokusringens färg.
// Ett källprov räcker här eftersom regeln gäller vilken klass som skrivs, inte hur sidan beter sig;
// admin-chart-focus.test.mjs mäter den faktiska kontrasten i en webbläsare när den finns.
const studio=fileURLToPath(new URL('..',import.meta.url));
const roots=['client/admin','components'].map(dir=>join(studio,dir));
const sources=root=>readdirSync(root,{withFileTypes:true,recursive:true})
  .filter(entry=>entry.isFile()&&/\.(tsx?|jsx|mjs)$/.test(entry.name)&&!/\.test\.mjs$/.test(entry.name))
  .map(entry=>join(entry.parentPath??entry.path,entry.name))
  .filter(file=>!file.includes(`${'/'}node_modules${'/'}`));

// En fokusklass är en Tailwind-klass med focus, focus-visible eller focus-within någonstans i
// varianten (även has-[:focus-visible]: och [&_x:focus-visible]:) som sätter ringens färg.
const focusRingColour=/[^\s'"`]*focus[^\s'"`]*:ring-sg-(?!offset)[a-z-]+/g;

test('fokusringar i Admin och delade komponenter använder --sg-mark, aldrig lime', () => {
  const found=[];
  for(const root of roots)for(const file of sources(root)){
    const lines=readFileSync(file,'utf8').split('\n');
    lines.forEach((line,index)=>{for(const [klass] of line.matchAll(focusRingColour)){
      if(!klass.endsWith(':ring-sg-mark'))found.push(`${relative(studio,file)}:${index+1} ${klass}`);
    }});
  }
  assert.deepEqual(found,[],'fokusringens färg ska vara ring-sg-mark (focusRing i client/admin/components/ui/kit.tsx)');
});

test('focusRing i kit.tsx och Admins Tailwind-tema pekar på --sg-mark', () => {
  const kit=readFileSync(join(studio,'client/admin/components/ui/kit.tsx'),'utf8');
  assert.match(kit.match(/export const focusRing='([^']+)'/)?.[1]??'',/(^| )focus-visible:ring-sg-mark( |$)/);
  assert.match(readFileSync(join(studio,'client/admin/app/globals.css'),'utf8'),/--color-sg-mark:\s*var\(--sg-mark\);/);
});

test('provet känner igen limefärgade fokusringar', () => {
  const bad=['focus-visible:ring-sg-lime','focus:ring-sg-lime','focus-within:ring-sg-lime','has-[:focus-visible]:ring-sg-lime','[&_svg:focus-visible]:ring-sg-lime'];
  for(const klass of bad)assert.deepEqual([...`x ${klass} y`.matchAll(focusRingColour)].map(match=>match[0]),[klass]);
  assert.deepEqual([...'focus-visible:ring-offset-sg-surface hover:ring-sg-lime bg-sg-lime'.matchAll(focusRingColour)],[]);
});
