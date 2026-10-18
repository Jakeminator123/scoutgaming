import test from 'node:test';
import assert from 'node:assert/strict';
import {chatPresentationContext} from '../services/game/public/chat-presentation-context.mjs';
const entry={operator:'sg-test',roomId:'published-room',packageRevision:15,dealer:'paow'};
test('registered dealer chat requests carry only the exact document publication context',()=>{
 assert.deepEqual(chatPresentationContext({...entry,privateToken:'never'},'paow'),{operatorSlug:'sg-test',roomId:'published-room',packageRevision:15,dealerId:'paow'});
 for(const patch of [{operator:null},{roomId:null},{packageRevision:0},{packageRevision:'15'},{dealer:'astrid'}])assert.equal(chatPresentationContext({...entry,...patch},'paow'),null);
 assert.equal(chatPresentationContext(entry,'other'),null);
 for(const id of ['nora','astrid','marten'])assert.deepEqual(chatPresentationContext({...entry,dealer:id},id),{operatorSlug:entry.operator,roomId:entry.roomId,packageRevision:15,dealerId:id});
 for(const id of ['vera','mei','amira','johanna'])assert.equal(chatPresentationContext({...entry,dealer:id},id),null);
});
