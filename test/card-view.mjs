import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeCardView,cardViewDepth} from '../packages/presentation/contracts/card-view.mjs';
import {defaultBlackjackTableGeometry,defaultCompositionSettings,validateCompositionSettings} from '../packages/presentation/contracts/composition-settings.mjs';
test('saved card display validates each table format and survives round-trip',()=>{
 const board=defaultBlackjackTableGeometry('00000000-0000-4000-8000-000000000002');
 board.mobile.cardView='table';board.desktop.cardView='raised';
 const settings={...defaultCompositionSettings(),blackjackTables:[board]};
 const saved=validateCompositionSettings(JSON.parse(JSON.stringify(settings)));
 assert.equal(saved.blackjackTables[0].mobile.cardView,'table');assert.equal(saved.blackjackTables[0].desktop.cardView,'raised');
 assert.equal(cardViewDepth(saved.blackjackTables[0].mobile.cardView),.62);assert.equal(cardViewDepth(saved.blackjackTables[0].desktop.cardView),1);
 for(const invalid of ['other',null,{},true]){const next=structuredClone(settings);next.blackjackTables[0].mobile.cardView=invalid;assert.throws(()=>validateCompositionSettings(next));}
 assert.equal(normalizeCardView('invalid'),'raised');
});
