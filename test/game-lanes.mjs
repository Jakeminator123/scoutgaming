import test from 'node:test';
import assert from 'node:assert/strict';
import { GAME_LANES, gameLaneSelection, gameLaneConfiguration, gameLaneFromDocument, validateGameLanes,
  isOperatorSlug, laneDealerSelection, packageLaneIds, gameChoicesForLane } from '../web/public/game-lanes.mjs';
import { decorateGameEntryHtml, playerLoginDestination } from '../web/public/game-entry-contract.mjs';
import { validateDocumentValue } from '../web/storage/studio-contract.mjs';

test('mobile is default and layer-preview is opt-in', () => {
  assert.deepEqual(gameLaneSelection('', 'mobile-phone'), {lane:'mobile-phone',dealer:'astrid',presentation:'local'});
  assert.deepEqual(gameLaneSelection('', 'original'), {lane:'mobile-phone',dealer:'astrid',presentation:'local'});
  assert.deepEqual(gameLaneSelection('?lane=layer-preview', 'mobile-phone'), { lane: 'layer-preview', dealer: 'paow', presentation: 'layered' });
  assert.deepEqual(gameLaneSelection('?lane=layer-preview&dealer=dragge', 'mobile-phone'), { lane: 'layer-preview', dealer: 'dragge', presentation: 'layered' });
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

const beta = {...GAME_LANES[0],id:'beta',label:'Beta lane'};
const gamma = {...GAME_LANES[0],id:'gamma',label:'Gamma lane'};
const legacy = {schemaVersion:1,id:'legacy',label:'Legacy lane',renderer:'indexed-video',dealer:'vera',mediaCollection:'legacy-dealers'};
const catalogue = [...GAME_LANES,beta,gamma,legacy];

test('allowedLanes narrows the saved catalogue; outside the package falls to its first allowed lane', () => {
  assert.deepEqual(packageLaneIds(['gamma','unknown','beta','gamma'],catalogue),['gamma','beta']);
  assert.throws(() => packageLaneIds('beta',catalogue));
  assert.throws(() => gameLaneSelection('','mobile-phone',catalogue,'beta'));
  // Intersection: the requested lane is honoured only inside the package.
  assert.equal(gameLaneSelection('?lane=gamma','mobile-phone',catalogue,['beta','gamma']).lane,'gamma');
  assert.equal(gameLaneSelection('?lane=mobile-phone','mobile-phone',catalogue,['beta','gamma']).lane,'beta');
  assert.equal(gameLaneSelection('?lane=nope','mobile-phone',catalogue,['beta','gamma']).lane,'beta');
  assert.equal(gameLaneSelection('','mobile-phone',catalogue,['beta','gamma']).lane,'beta');
  assert.equal(gameLaneSelection('?lane=beta&lane=gamma','mobile-phone',catalogue,['gamma','beta']).lane,'gamma');
  // The saved active lane stays the default when the package includes it.
  assert.equal(gameLaneSelection('?lane=nope','mobile-phone',catalogue,['beta','mobile-phone']).lane,'mobile-phone');
  // A package can never add a lane the server does not serve.
  assert.deepEqual(gameLaneSelection('?lane=delta','mobile-phone',catalogue,['delta']),gameLaneSelection('?lane=delta','mobile-phone',catalogue));
  // Empty intersection keeps today's selection exactly.
  for (const query of ['','?lane=beta','?lane=legacy&dealer=mei']) {
    assert.deepEqual(gameLaneSelection(query,'mobile-phone',catalogue,[]),gameLaneSelection(query,'mobile-phone',catalogue));
    assert.deepEqual(gameLaneSelection(query,'mobile-phone',catalogue,['delta']),gameLaneSelection(query,'mobile-phone',catalogue));
  }
  assert.deepEqual(gameLaneSelection('?lane=legacy&dealer=mei','mobile-phone',catalogue,['legacy']),{lane:'legacy',dealer:'mei',presentation:'original'});
  assert.throws(() => gameLaneSelection('','unknown',catalogue,['beta']));
});

test('a presentation lane only narrows the dealers its server lane can render', () => {
  const portrait = GAME_LANES[0];
  assert.equal(laneDealerSelection('?dealer=vera',portrait,{default:'astrid',allowed:['astrid']}),'astrid');
  assert.equal(laneDealerSelection('',portrait,{default:'vera',allowed:['vera','astrid']}),'astrid');
  assert.equal(laneDealerSelection('',portrait,{default:'vera',allowed:['vera']}),null);
  assert.equal(laneDealerSelection('?dealer=mei',legacy,{default:'amira',allowed:['mei','vera']}),'mei');
  assert.equal(laneDealerSelection('?dealer=astrid',legacy,{default:'amira',allowed:['mei','vera']}),'amira');
  assert.equal(laneDealerSelection('?dealer=mei&dealer=vera',legacy,{default:'amira',allowed:['mei','vera']}),'amira');
  assert.equal(laneDealerSelection('',legacy,{default:'amira',allowed:[]}),'amira');
  assert.equal(laneDealerSelection('',legacy,{default:'x',allowed:['x']}),null);
  assert.equal(laneDealerSelection('',legacy,null),null);
  assert.throws(() => laneDealerSelection('',{...legacy,renderer:'remote-script'},{default:'vera',allowed:[]}));
});

test('Dragge and Paow play only on their own portrait lanes and are never indexed dealers', () => {
  const env = {CROUPIER_STUDIO_NEON_POLICY:'1'};
  assert.deepEqual(GAME_LANES.map(lane => [lane.id, lane.renderer, lane.dealer, lane.mediaCollection]), [
    ['mobile-phone','portrait-video','astrid','astrid-presentation'],
    ['mobile-phone-dragge','portrait-video','dragge','dragge-presentation'],
    ['mobile-phone-paow','portrait-video','paow','paow-presentation'],
  ]);
  assert.deepEqual(gameLaneConfiguration({}).gameLane, 'mobile-phone');
  for (const dealer of ['dragge','paow']) {
    const lane = `mobile-phone-${dealer}`;
    assert.deepEqual(gameLaneSelection(`?lane=${lane}`,'mobile-phone'),{lane,dealer,presentation:'local'});
    assert.equal(gameLaneSelection(`?dealer=${dealer}`,'mobile-phone').dealer,'astrid');
    assert.equal(gameLaneSelection(`?lane=legacy&dealer=${dealer}`,'mobile-phone',catalogue).dealer,'vera');
    assert.equal(laneDealerSelection(`?dealer=${dealer}`,legacy,{default:'mei',allowed:['dragge','paow']}),'mei');
    assert.throws(() => validateGameLanes([{...legacy,dealer}]));
    assert.throws(() => validateGameLanes([{...GAME_LANES[0],id:'mixed',dealer}]));
    assert.match(decorateGameEntryHtml('<html>',env,gameLaneSelection(`?lane=${lane}`,'mobile-phone')),
      new RegExp(`data-game-lane="${lane}" data-game-dealer="${dealer}" data-game-presentation="local"`));
    assert.deepEqual(gameLaneFromDocument({gameLane:lane,gameDealer:dealer,gamePresentation:'local'}),{lane,dealer,presentation:'local'});
    assert.throws(() => gameLaneFromDocument({gameLane:'mobile-phone',gameDealer:dealer,gamePresentation:'local'}));
    assert.throws(() => gameLaneFromDocument({gameLane:'legacy',gameDealer:dealer,gamePresentation:'original'}));
    // Administration's Lägg till lane copies the dealer's code lane under a new id.
    const custom = {...GAME_LANES.find(row => row.id === lane), id:`${dealer}-vip`, label:`${dealer} VIP`};
    const saved = gameLaneConfiguration({gameLanes:[GAME_LANES[0],custom],gameLane:custom.id});
    const html = decorateGameEntryHtml('<html>',env,gameLaneSelection('',saved.gameLane,saved.gameLanes));
    const attribute = name => new RegExp(`data-game-${name}="([^"]*)"`).exec(html)?.[1];
    assert.deepEqual(gameLaneFromDocument({gameLane:attribute('lane'),gameDealer:attribute('dealer'),gamePresentation:attribute('presentation')}),
      {lane:custom.id,dealer,presentation:'local'});
    assert.throws(() => gameLaneFromDocument({gameLane:custom.id,gameDealer:'vera',gamePresentation:'local'}));
    const serverLane = GAME_LANES.find(row => row.id === lane);
    assert.deepEqual(gameChoicesForLane([], lane, serverLane).dealers, []);
    const projectLane = {id:lane,layers:{dealer:{default:dealer,allowed:[dealer,'astrid']}}};
    assert.deepEqual(gameChoicesForLane([projectLane], lane, serverLane).dealers, [dealer]);
    assert.deepEqual(gameChoicesForLane([{...projectLane,id:'legacy'}], 'legacy', legacy).dealers, ['astrid']);
  }
});

test('operator context is read-only client data: validated, escaped and never a selector', () => {
  const env = {CROUPIER_STUDIO_NEON_POLICY:'1'};
  for (const slug of ['sg-test','demo-north','a']) assert.equal(isOperatorSlug(slug),true);
  for (const slug of ['','SG','sg_test','-sg','sg-','sg--test','play','api','a'.repeat(64),null,['sg-test']]) assert.equal(isOperatorSlug(slug),false);
  assert.equal(playerLoginDestination(new URL('https://game.invalid/blackjack?operator=sg-test&lane=mobile-phone&launch=a.b.c')),'/player-login?lane=mobile-phone&operator=sg-test');
  for (const query of ['operator=Bad','operator=play','operator=a&operator=b','operator=']) {
    assert.equal(playerLoginDestination(new URL('https://game.invalid/blackjack?lane=mobile-phone&'+query)),'/player-login?lane=mobile-phone');
  }
  const branding = {felt:'#0a5"><script>alert(1)</script>',note:"$& $' $` & <b>"};
  const html = decorateGameEntryHtml('<html lang="sv">',env,{...gameLaneSelection('','mobile-phone'),operator:'sg-test',packageRevision:3,branding});
  assert.equal(html.match(/<script/g),null);
  assert.match(html,/^<html data-game-path="\/blackjack" data-game-lane="mobile-phone" data-game-dealer="astrid" data-game-presentation="local" data-game-operator="sg-test" data-game-package-revision="3" data-game-branding="[^"]*" lang="sv">$/);
  const encoded = /data-game-branding="([^"]*)"/.exec(html)[1];
  const decoded = encoded.replace(/&(amp|quot|#39|lt|gt);/g,(_,name) => ({amp:'&',quot:'"','#39':"'",lt:'<',gt:'>'})[name]);
  assert.deepEqual(JSON.parse(decoded),branding);
  const dataset = {gameLane:'mobile-phone',gameDealer:'astrid',gamePresentation:'local',gameOperator:'sg-test',gamePackageRevision:'3',gameBranding:decoded};
  assert.deepEqual(gameLaneFromDocument(dataset),{lane:'mobile-phone',dealer:'astrid',presentation:'local',operator:'sg-test',packageRevision:3,branding});
  assert.deepEqual(gameLaneFromDocument({...dataset,gamePackageRevision:undefined,gameBranding:undefined}),{lane:'mobile-phone',dealer:'astrid',presentation:'local',operator:'sg-test'});
  assert.match(decorateGameEntryHtml('<html>',env,{...gameLaneSelection('','mobile-phone'),operator:'sg-test'}),/data-game-operator="sg-test">$/);
  for (const change of [{gameOperator:'Bad'},{gameOperator:undefined},{gamePackageRevision:'0'},{gamePackageRevision:'1e3'},
    {gamePackageRevision:'99999999999999999'},{gameBranding:'[]'},{gameBranding:'null'},{gameBranding:'{'},{gameBranding:undefined}]) {
    assert.throws(() => gameLaneFromDocument({...dataset,...change}));
  }
  for (const change of [{operator:'play'},{operator:undefined},{packageRevision:0},{packageRevision:'3'},{branding:[]},{branding:null},
    {branding:{text:'x'.repeat(8000)}}]) {
    assert.throws(() => decorateGameEntryHtml('<html>',env,{...gameLaneSelection('','mobile-phone'),operator:'sg-test',packageRevision:3,branding:{},...change}));
  }
});

test('local for another dealer is allowed only when that lane is portrait-video for her', () => {
  const vera = { schemaVersion: 1, id: 'vera-phone', label: 'Vera phone', renderer: 'portrait-video', dealer: 'vera', mediaCollection: 'vera-presentation' };
  assert.equal(validateGameLanes([vera])[0].mediaCollection, 'vera-presentation');
  assert.throws(() => gameLaneFromDocument({ gameLane: 'vera-phone', gameDealer: 'vera', gamePresentation: 'local' }));
  assert.deepEqual(gameLaneFromDocument({ gameLane: 'vera-phone', gameDealer: 'vera', gamePresentation: 'local' }, [vera]), { lane: 'vera-phone', dealer: 'vera', presentation: 'local' });
  assert.throws(() => gameLaneFromDocument({ gameLane: 'vera-phone', gameDealer: 'mei', gamePresentation: 'local' }, [vera]));
  assert.throws(() => validateGameLanes([{ ...vera, mediaCollection: 'astrid-presentation' }]));
  assert.throws(() => validateGameLanes([{ ...vera, mediaCollection: 'legacy-dealers' }]));
});

test('layered presentation is accepted only on layer-preview', () => {
  assert.deepEqual(gameLaneFromDocument({ gameLane: 'layer-preview', gameDealer: 'paow', gamePresentation: 'layered' }), {
    lane: 'layer-preview', dealer: 'paow', presentation: 'layered',
  });
  assert.deepEqual(gameLaneFromDocument({ gameLane: 'layer-preview', gameDealer: 'dragge', gamePresentation: 'layered' }), {
    lane: 'layer-preview', dealer: 'dragge', presentation: 'layered',
  });
  assert.throws(() => gameLaneFromDocument({ gameLane: 'mobile-phone', gameDealer: 'astrid', gamePresentation: 'layered' }));
  assert.throws(() => gameLaneFromDocument({ gameLane: 'layer-preview', gameDealer: 'astrid', gamePresentation: 'layered' }));
});
