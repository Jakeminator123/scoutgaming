import test from 'node:test';
import assert from 'node:assert/strict';
import {dealerClipGuide} from '../web/public/dealer-clip-guide.mjs';
import {forgeSlots} from '../lab/lib/dealer-forge-catalog.mjs';
import {createSeedProject} from '../packages/presentation/contracts/studio-model.mjs';
import {dealerMediaSlots} from '../lab/lib/dealer-media-library.mjs';

test('every current Forge slot has a visual explanation without granting media acceptance',()=>{
  const slots=forgeSlots(createSeedProject()),original=structuredClone(slots);
  for (const slot of slots) {
    const guide=dealerClipGuide(slot);
    assert.equal(guide.slotId,slot.id);
    assert.equal(guide.known,true,slot.id);
    assert.ok(guide.title.length&&guide.summary.length&&guide.steps.length,slot.id);
    assert.equal(guide.verification.status,'guide-only');
    assert.ok(guide.verification.checks.some(check=>check.includes('hash')));
  }
  assert.deepEqual(slots,original,'reading the guide must not change a slot or project');
});

test('human seats are one based while the exact internal destination stays unchanged',()=>{
  for(const [situation,seat] of [['box2',3],['box3',4]]) {
    const guide=dealerClipGuide({id:`deal.player.centre/${situation}`,eventId:'deal.player.centre',situation,start:'REDO',end:'REDO'});
    assert.equal(guide.title,`Ge kort · plats ${seat}`);
    assert.ok(guide.steps.some(step=>step.detail.includes(`plats ${seat}`)));
    assert.ok(guide.filenames.examples.includes(`pos${seat}.mp4`));
    assert.ok(guide.filenames.note.includes(`${situation} är det interna namnet för plats ${seat}`));
  }
  assert.equal(dealerClipGuide({id:'deal.player.left/box3'}).known,false,'a neighbouring bank must not explain the wrong destination');
});

test('deal pose versions describe sequence requirements separately from optional library takes',()=>{
  const guide=dealerClipGuide({id:'deal.player.centre/box3',start:'REDO',end:'REDO'});
  assert.deepEqual(guide.poses.versions.filter(row=>row.requirement==='required').map(row=>[row.start,row.end]),[['REDO','REDO']]);
  assert.deepEqual(guide.poses.versions.filter(row=>row.requirement==='conditional').map(row=>[row.start,row.end]),[['VILA','REDO'],['REDO','VILA'],['VILA','VILA']]);
  assert.equal(guide.variations.library,'multiple-takes');
  assert.equal(guide.variations.runtime,'not-verified');
  assert.match(guide.variations.note,/samma plats och samma start-\/slutpose/);
  assert.match(guide.variations.note,/egen kalibrering bunden till dess hash/);
  assert.match(guide.variations.note,/livevariation.*ännu inte verifierad/);
  assert.match(guide.filenames.note,/poseversioner, inte slumpvariationer/);
});

test('flip never invents REDO and exposes the source versus Forge template difference',()=>{
  const unposed=dealerClipGuide({id:'reveal.dealer/dealer-hole'});
  assert.equal(unposed.poses.start,null);assert.equal(unposed.poses.end,null);
  assert.equal(unposed.poses.status,'not-specified');
  assert.deepEqual(unposed.poses.versions,[{label:'Kevins källversion',start:'VILA',end:'VILA',requirement:'conditional'}]);
  const forge=dealerClipGuide({id:'reveal.dealer/dealer-hole',start:'REDO',end:'REDO'});
  assert.equal(forge.poses.status,'slot-template');
  assert.match(forge.poses.note,/Kevins flip använder VILA → VILA/);
  assert.match(forge.poses.note,/Forge-mallen anger REDO → REDO/);
  assert.equal(forge.verification.status,'guide-only');
  const source=dealerClipGuide({id:'reveal.dealer/dealer-hole',start:'VILA',end:'VILA'});
  assert.equal(source.poses.start,'VILA');assert.equal(source.poses.end,'VILA');
  assert.equal(dealerClipGuide({id:'reveal.dealer/dealer-up'}).known,false,'only the existing hidden card is turned');
});

test('the hidden card keeps its two Kevin pose versions separate from a conflicting Forge template',()=>{
  const source=dealerClipGuide({id:'deal.dealer/dealer-hole'});
  assert.deepEqual(source.poses.versions.map(row=>[row.start,row.end]),[['REDO','VILA'],['VILA','VILA']]);
  assert.deepEqual(source.filenames.examples,['hole.mp4','hole-i.mp4']);
  const forge=dealerClipGuide({id:'deal.dealer/dealer-hole',start:'REDO',end:'REDO'});
  assert.equal(forge.poses.status,'slot-template');
  assert.deepEqual(forge.poses.versions.filter(row=>row.requirement==='required').map(row=>[row.label,row.start,row.end]),[['Vald slotmall','REDO','REDO']]);
  assert.match(forge.poses.note,/hole.mp4 går från REDO till VILA/);
  assert.match(forge.poses.note,/olika slutpose/);
});

test('images have no movement variation and layers follow background, dealer, table order',()=>{
  for(const id of ['pose/vila','pose/redo','layer/table','layer/background','roulette.reference/VILA']) {
    const guide=dealerClipGuide({id});
    assert.equal(guide.variations.library,'none',id);
    assert.equal(guide.variations.runtime,'not-applicable',id);
  }
  assert.deepEqual(dealerClipGuide({id:'layer/table'}).steps.map(step=>step.title),['Bakgrund','Dealer','Bord']);
  assert.equal(dealerClipGuide({id:'unknown-still',kind:'image'}).variations.library,'none');
});

test('moving reactions, transitions and speech may have takes without implying automatic live variation',()=>{
  for (const id of ['settle.win/','turn.player/','transition.shoe/to-shoe','transition.shoe/from-shoe','speak.other/greeting']) {
    const guide=dealerClipGuide({id});
    assert.equal(guide.variations.library,'multiple-takes',id);
    assert.equal(guide.variations.runtime,'not-verified',id);
  }
  const to=dealerClipGuide({id:'transition.shoe/to-shoe'}),from=dealerClipGuide({id:'transition.shoe/from-shoe'});
  assert.deepEqual([to.poses.start,to.poses.end,from.poses.start,from.poses.end],['VILA','REDO','REDO','VILA']);
  const idle=dealerClipGuide({id:'idle.ready/'});
  assert.equal(idle.variations.runtime,'configured-policy');
  assert.match(idle.variations.note,/ny fil väljs inte automatiskt/);
});

test('inactivity text selection is distinct from filenames used for a technical probe',()=>{
  const guide=dealerClipGuide({id:'speak.other/probe',category:'speech'});
  assert.equal(guide.title,'Inaktivitetsreplik');
  assert.equal(guide.trigger.title,'OpenClaw vid inaktivitet');
  assert.match(guide.filenames.note,/filnamn med probe betyder tekniskt prov/);
  assert.deepEqual(guide.filenames.examples,[],'a technical probe filename must not recommend an inactivity take');
  assert.match(guide.trigger.detail,/skapar ingen ny trigger/);
  assert.equal(dealerClipGuide({id:'probe.mp4'}).known,false,'filenames must never become runtime slots');
  assert.equal(dealerClipGuide({id:'pos4.mp4'}).known,false);
});

test('OpenClaw chooses default speech text while a recorded take keeps its exact own audio',()=>{
  const guide=dealerClipGuide({id:'speak.goodluck/goodluck',kind:'speech'});
  assert.equal(guide.speech.defaultSource,'openclaw-text');
  assert.equal(guide.speech.recordedAlternative,'own-audio');
  assert.match(guide.speech.note,/egen exakta text och sitt eget ljud/);
  assert.ok(guide.verification.checks.some(check=>check.includes('läppsynk')));
  assert.match(guide.variations.note,/loopa inte en inspelad mening/);
});

test('roulette guides keep their own unverified poses and never map to a blackjack destination',()=>{
  for (const slot of dealerMediaSlots(createSeedProject(),'roulette')) {
    const guide=dealerClipGuide(slot);
    assert.equal(guide.known,true,slot.id);
    if(slot.eventId!=='roulette.reference') {
      assert.equal(guide.poses.start,null);assert.equal(guide.poses.end,null);
      assert.equal(guide.poses.status,'not-specified');
      assert.equal(guide.variations.runtime,'not-verified');
    }
  }
  const reference=dealerClipGuide({id:'roulette.reference/VILA'});
  assert.equal(reference.poses.start,null);assert.equal(reference.poses.end,null);
  assert.equal(reference.poses.status,'not-specified','a filename or situation label does not supply the observed reference pose');
  const specified=dealerClipGuide({id:'roulette.reference/VILA',start:'VILA',end:'VILA'});
  assert.equal(specified.poses.start,'VILA');assert.equal(specified.poses.end,'VILA');assert.equal(specified.poses.status,'slot-template');
  assert.equal(dealerClipGuide({id:'deal.player.centre/box3',game:'roulette'}).known,false);
});

test('unknown slots stay unverified and editing a returned guide cannot change the next one',()=>{
  const unknown=dealerClipGuide({id:'new-action/unknown',label:'pos4.mp4'});
  assert.equal(unknown.known,false);assert.equal(unknown.poses.status,'not-specified');
  assert.equal(unknown.variations.runtime,'not-verified');assert.equal(unknown.verification.status,'guide-only');
  const first=dealerClipGuide({id:'speak.other/greeting'});first.speech.note='changed';first.verification.checks.length=0;
  const next=dealerClipGuide({id:'speak.other/greeting'});
  assert.ok(next.verification.checks.length>0);assert.notEqual(next.speech.note,'changed');
});
