import test from 'node:test';
import assert from 'node:assert/strict';

// The engine no longer starts a BO handoff; this pins the shared navigation helper
// until its own removal (packages/navigation).
test('player handoff only retains current document returns and approved game selectors',async()=>{
  const {playerHandoffPath:path,playerHandoffDestination:destination}=await import('../packages/navigation/player-handoff.mjs');
  for(const target of ['/play','/play/profil','/play/historik','/play?operator=swedish-games','/game?game=roulette&table=room-evening','/game?table=room-evening','/play/roulette?table=room-evening','/play/blackjack?table=room-evening']) {
    assert.equal(path(target),target);assert.equal(destination(target),'/api/auth/bo/start?next='+encodeURIComponent(target));
  }
  for(const target of ['https://attacker.invalid/play/profil','//attacker.invalid/play/profil','/play\\profil','/play/%70rofil','/other/../play/profil','/api/auth/bo/start','/admin/login','/player-login','/play/profil?returnTo=/admin','/play/profil#secret','/play?operator=a&operator=b','/play\n/profil','/v2?dealer=astrid','/game/extra','/casino.html','/demo']) assert.equal(path(target),null,target);
  assert.equal(path('/play/blackjack?launch=a.b.c&returnTo=https://attacker.invalid&table=room-evening'),'/play/blackjack?table=room-evening');
  assert.equal(path('/game?game=poker&launch=a.b.c&returnTo=https://attacker.invalid&table=room-evening'),'/game?table=room-evening');
  const observed='/play/blackjack?labObserverOrigin='+encodeURIComponent('https://www.fixture.invalid')+'&labObserverChannel=12345678-1234-1234-1234-123456789abc';
  assert.equal(path(observed,{origin:'https://www.fixture.invalid'}),observed);
});
