import test from 'node:test';
import assert from 'node:assert/strict';
import { withSharedRoomEntry } from '../services/game/shared-room-entry.mjs';
const page='<html lang="sv" data-game-room-id="room-a" data-game-dealer="dealer-a"><body><script type="module" src="app.mjs"></script><script src="/studio/assistant-widget.js" defer></script></body></html>';

test('shared room entry selects one shared application and preserves saved room/media context',()=>{
  const result=withSharedRoomEntry(page,{enabled:true,selection:{roomId:'room-a'}});
  assert.match(result,/data-shared-room="1"/);assert.match(result,/src="\/shared-room-app\.mjs"/);
  assert.doesNotMatch(result,/src="app\.mjs"/);
  assert.ok(result.includes('data-game-room-id="room-a" data-game-dealer="dealer-a"'));
  assert.ok(result.includes('<script src="/studio/assistant-widget.js" defer></script>'));
});
test('normal entries and entries with no real room keep their existing application',()=>{
  assert.equal(withSharedRoomEntry(page,{selection:{roomId:'room-a'}}),page);
  assert.equal(withSharedRoomEntry(page,{enabled:true,selection:{}}),page);
});
test('a missing, duplicate or mismatched entry cannot fall back to a legacy writer in shared mode',()=>{
  for(const html of [page.replace('room-a','room-b'),page.replace('app.mjs','unknown.mjs'),
    page.replace('</body>','<script type="module" src="app.mjs"></script></body>'),
    page.replace('<html','<html data-shared-room="1"')]){
    assert.throws(()=>withSharedRoomEntry(html,{enabled:true,selection:{roomId:'room-a'}}));
  }
  assert.throws(()=>withSharedRoomEntry(page,{enabled:true,selection:{roomId:'../room-a'}}));
});
