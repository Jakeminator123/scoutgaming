import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {dealerClipGuide} from '../../../../../packages/presentation/contracts/dealer-clip-guide.mjs';
const require=createRequire(import.meta.url),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const module={exports:{}};
runInNewContext(require('esbuild').transformSync(readFileSync(new URL('../components/studio/clip-guide.tsx',import.meta.url),'utf8'),{loader:'tsx',format:'cjs',jsx:'automatic'}).code,
  {module,exports:module.exports,require:name=>name==='../../../../../../packages/presentation/contracts/dealer-clip-guide.mjs'?{dealerClipGuide}:require(name)});
const render=slot=>renderToStaticMarkup(React.createElement(module.exports.ClipGuide,{slot}));
const deal={id:'deal.player.left/box0',eventId:'deal.player.left',situation:'box0',title:'Plats 1',description:'Kort till plats 1',sourceType:'deal',family:null};

test('one native disclosure separates optional takes from pose requirements and keeps exact identifiers inside',()=>{
  const slot=Object.freeze({...deal,start:'VILA',end:'REDO'}),html=render(slot);
  assert.equal((html.match(/<details/g)??[]).length,1);
  assert.match(html,/<summary[^>]*>Klippguide/);
  assert.equal((html.match(/Krävs för denna mall/g)??[]).length,1);
  assert.match(html,/Valfria tagningar/);assert.match(html,/livevariation för givning är ännu inte verifierad/);
  assert.match(html,/Guide · ingen medieacceptans/);assert.match(html,/egen kalibrering bunden till dess hash/);
  assert.ok(html.indexOf(slot.id)>html.indexOf('</summary>'));
  const sequence=html.match(/<ol[^>]*>[\s\S]*?<\/ol>/)?.[0]??'';
  assert.match(sequence,/Start/);assert.match(sequence,/Handling/);assert.match(sequence,/Slut/);
  assert.match(sequence,/Vila/);assert.match(sequence,/Redo vid kortskon/);assert.doesNotMatch(sequence,/Okänd pose/);
  assert.equal(slot.start,'VILA');assert.equal(slot.end,'REDO');
});

test('missing or unrecognized poses stay unknown even for a known transition template',()=>{
  for(const extra of [{},{start:'unverified',end:'invented'}]){
    const html=render({...deal,id:'transition.shoe/to-shoe',eventId:'transition.shoe',situation:'to-shoe',sourceType:'transition',...extra});
    const sequence=html.match(/<ol[^>]*>[\s\S]*?<\/ol>/)?.[0]??'';
    assert.equal((sequence.match(/Okänd pose/g)??[]).length,2);
    assert.match(html,/De visar inte hur en viss film faktiskt börjar eller slutar/);
  }
});

test('roulette reference stays a still and unknown slots make no playback or calibration promise',()=>{
  const reference=render({...deal,id:'roulette.reference/VILA',eventId:'roulette.reference',situation:'VILA',game:'roulette'});
  assert.match(reference,/Referensbild · ingen rörelsesekvens/);assert.doesNotMatch(reference,/<ol/);
  const unknown=render({...deal,id:'future/unknown',eventId:'future',situation:'unknown'});
  assert.match(unknown,/Okänd handling/);assert.match(unknown,/Ingen automatisk uppspelning eller variation är verifierad/);
  assert.match(unknown,/Guide · ingen medieacceptans/);
});
