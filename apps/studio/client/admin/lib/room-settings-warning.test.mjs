import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
// Preview 29 Oct 2026: a new room stood "öppet · publicerat" in Admin without published game settings, and
// the shared table refused every seat. The room's state chip, the list row and the room page now say so.
const require=createRequire(import.meta.url),React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),{transformSync}=require('esbuild');
const tsx=path=>transformSync(readFileSync(new URL(path,import.meta.url),'utf8'),{loader:'tsx',format:'cjs',jsx:'automatic'}).code;
function load(path,extra={}){
  const module={exports:{}};
  runInNewContext(tsx(path),{module,exports:module.exports,require:dep=>Object.hasOwn(extra,dep)?extra[dep]:require(dep)});
  return module.exports;
}
const navigation={__esModule:true,default:({href,children,...rest})=>React.createElement('a',{href,...rest},children)};
const {RoomStateChip,RoomSettingsWarning,ROOM_SETTINGS_MISSING,roomPreparing,roomSettingsHref}=load('../components/studio/room-settings-warning.tsx',
  {'../../../runtime/navigation':navigation,'../ui/kit':load('../components/ui/kit.tsx')});
const html=(component,props)=>renderToStaticMarkup(React.createElement(component,props));
const room=(patch={})=>({id:'room-1a2b',state:'live',...patch});

test('an open room without published game settings reads "förbereds" with the reason; others keep öppet or pausat',()=>{
  assert.equal(ROOM_SETTINGS_MISSING,'Saknar spelinställningar – spelare kan inte sätta sig');
  const preparing=html(RoomStateChip,{room:room({settingsMissing:true})});
  assert.match(preparing,/>förbereds</);assert.match(preparing,/title="Saknar spelinställningar – spelare kan inte sätta sig"/);
  assert.match(html(RoomStateChip,{room:room()}),/>öppet</);
  assert.match(html(RoomStateChip,{room:room({state:'pending'})}),/>pausat</);
  // A paused room cannot take players anyway; its settings are published once it is open again.
  assert.match(html(RoomStateChip,{room:room({state:'pending',settingsMissing:true})}),/>pausat</);
  assert.equal(roomPreparing(room({settingsMissing:true})),true);assert.equal(roomPreparing(room({state:'pending',settingsMissing:true})),false);
});

test('the room page and the list row warn with a link to the room\'s Spelinställningar tab; a playable room shows nothing',()=>{
  assert.equal(roomSettingsHref({id:'room 1'}),'/admin/rooms/room%201?flik=spel');
  const page=html(RoomSettingsWarning,{room:room({settingsMissing:true})});
  assert.match(page,/role="alert"/);assert.match(page,/Saknar spelinställningar – spelare kan inte sätta sig/);
  assert.match(page,/<a href="\/admin\/rooms\/room-1a2b\?flik=spel"[^>]*>Öppna Spelinställningar<\/a>/);
  const row=html(RoomSettingsWarning,{room:room({settingsMissing:true}),compact:true});
  assert.doesNotMatch(row,/role="alert"/,'a table row is not an alert');
  assert.match(row,/Saknar spelinställningar – spelare kan inte sätta sig/);assert.match(row,/<a href="\/admin\/rooms\/room-1a2b\?flik=spel"[^>]*>Spelinställningar<\/a>/);
  for(const value of [room(),room({state:'pending',settingsMissing:true})])
    for(const compact of [false,true])assert.equal(html(RoomSettingsWarning,{room:value,compact}),'');
});
