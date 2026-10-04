import test from 'node:test';
import assert from 'node:assert/strict';
import { GAME_LANES, gameLaneSelection, gameLaneConfiguration, gameLaneFromDocument, validateGameLanes } from '../web/public/game-lanes.mjs';
import { decorateGameEntryHtml, playerLoginDestination } from '../web/public/game-entry-contract.mjs';
import { validateDocumentValue } from '../web/storage/studio-contract.mjs';

test('only Mobile is initially registered; retired dealer URLs cannot reactivate Kevin', () => {
  assert.deepEqual(gameLaneSelection('', 'mobile-phone'), {lane:'mobile-phone',dealer:'astrid',presentation:'local'});
  assert.deepEqual(gameLaneSelection('', 'original'), {lane:'mobile-phone',dealer:'astrid',presentation:'local'});
  for (const dealer of ['vera','astrid','amira','mei']) {
    assert.equal(gameLaneSelection('?dealer='+dealer, 'mobile-phone').dealer,'astrid');
    assert.equal(gameLaneSelection('?dealer='+dealer, 'mobile-phone').presentation,'local');
  }
  assert.equal(gameLaneSelection('?dealer=astrid&presentation=local','original').lane,'mobile-phone');
  assert.equal(gameLaneSelection('?lane=mobile-phone','original').dealer,'astrid');
  assert.throws(() => gameLaneSelection('', 'unknown'));
});

test('saved lane definitions are bounded, unique and bind an adapter; empty catalogue closes entry', () => {
  const another = {...GAME_LANES[0],id:'another',label:'Another lane'};
  assert.deepEqual(gameLaneSelection('?lane=another','mobile-phone',[...GAME_LANES,another]),{lane:'another',dealer:'astrid',presentation:'local'});
  assert.deepEqual(gameLaneFromDocument({gameLane:'another',gameDealer:'astrid',gamePresentation:'local'}),{lane:'another',dealer:'astrid',presentation:'local'});
  for (const change of [{id:'original'},{id:'../bad'},{renderer:'remote-script'},{dealer:'mei'},{mediaCollection:'https://external.invalid'}]) {
    assert.throws(()=>validateGameLanes([{...another,...change}]));
  }
  assert.throws(()=>validateGameLanes([another,another]));
  assert.deepEqual(gameLaneConfiguration({gameLanes:[],gameLane:null}),{gameLanes:[],gameLane:null});
  assert.throws(()=>gameLaneSelection('',null,[]));
  assert.throws(()=>gameLaneConfiguration({gameLanes:[another],gameLane:'mobile-phone'}));
  assert.equal(gameLaneSelection('?lane=original&dealer=vera','another',[another]).lane,'another');
});

test('lane metadata and login cannot introduce arbitrary HTML, redirects or privileges', () => {
  const env={CROUPIER_STUDIO_NEON_POLICY:'1'};
  assert.match(decorateGameEntryHtml('<html>',env,gameLaneSelection('','mobile-phone')),/data-game-lane="mobile-phone" data-game-dealer="astrid" data-game-presentation="local"/);
  assert.throws(() => decorateGameEntryHtml('<html>',env,{lane:'mobile-phone',dealer:'"><script>',presentation:'local'}));
  assert.equal(playerLoginDestination(new URL('https://game.invalid/blackjack?lane=mobile-phone&returnTo=https://evil.invalid&playerId=forged&launch=a.b.c')),'/player-login?lane=mobile-phone');
  assert.equal(playerLoginDestination(new URL('https://game.invalid/blackjack')),'/player-login');
  for (const lane of ['evil',null,{},['mobile-phone']]) assert.throws(() => validateDocumentValue('administration',{gameLane:lane},'r1'));
  assert.equal(validateDocumentValue('administration',{gameLane:'mobile-phone'},'r1').gameLane,'mobile-phone');
});
