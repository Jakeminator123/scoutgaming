import test from 'node:test';
import assert from 'node:assert/strict';
import { gameLaneSelection } from '../web/public/game-lanes.mjs';
import { decorateGameEntryHtml, playerLoginDestination } from '../web/public/game-entry-contract.mjs';
import { validateDocumentValue } from '../web/storage/studio-contract.mjs';

test('clean Blackjack uses the saved lane while existing four-dealer links retain their presentation', () => {
  assert.deepEqual(gameLaneSelection('', 'mobile-phone'), {lane:'mobile-phone',dealer:'astrid',presentation:'local'});
  assert.deepEqual(gameLaneSelection('', 'original'), {lane:'original',dealer:'vera',presentation:'original'});
  for (const dealer of ['vera','astrid','amira','mei']) {
    assert.equal(gameLaneSelection('?dealer='+dealer, 'mobile-phone').dealer,dealer);
    assert.equal(gameLaneSelection('?dealer='+dealer, 'mobile-phone').presentation,'original');
  }
  assert.equal(gameLaneSelection('?dealer=astrid&presentation=local','original').lane,'mobile-phone');
  assert.equal(gameLaneSelection('?lane=mobile-phone','original').dealer,'astrid');
  assert.throws(() => gameLaneSelection('', 'unknown'));
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
