import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
const require=createRequire(import.meta.url),React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),{transformSync}=require('esbuild');
const tsx=name=>transformSync(readFileSync(new URL('../components/studio/'+name+'.tsx',import.meta.url),'utf8'),{loader:'tsx',format:'cjs',jsx:'automatic'}).code;
function load(name,extra={}){
  const module={exports:{}};
  runInNewContext(tsx(name),{module,exports:module.exports,require:dep=>dep.endsWith('.module.css')?{__esModule:true,default:new Proxy({},{get:(_,key)=>String(key)})}:Object.hasOwn(extra,dep)?extra[dep]:require(dep)});
  return module.exports;
}
const {ConfirmDialog,ConfirmAcknowledgement}=load('confirm-dialog');
const html=props=>renderToStaticMarkup(React.createElement(ConfirmDialog,{open:true,title:'Radera Vila 1?',onConfirm(){},onCancel(){},...props}));

test('an open dialog names its title and body for assistive technology and starts with the safe choice first',()=>{
  const out=html({description:'Klippet flyttas till arkivet.',consequences:['Används: Grundloop'],confirmLabel:'Radera'});
  const [,id]=out.match(/aria-labelledby="([^"]+)-title"/);
  assert.match(out,new RegExp(`<h2 id="${id}-title"`));assert.match(out,new RegExp(`aria-describedby="${id}-body"`));assert.match(out,new RegExp(`<div id="${id}-body"`));
  assert.match(out,/data-danger="true"/);assert.match(out,/<li>Används: Grundloop<\/li>/);
  assert.ok(out.indexOf('>Avbryt<')<out.indexOf('>Radera<'),'cancel precedes the destructive button');
  assert.doesNotMatch(out,/<dialog[^>]*\sopen/,'modal opening is done through showModal, not the open attribute');
});
test('a closed dialog renders no content and a dialog without confirm label only informs',()=>{
  assert.match(html({open:false,confirmLabel:'Radera'}),/^<dialog [^>]*><\/dialog>$/);
  const informing=html({error:'Ett publicerat bolagspaket behöver klippet.',cancelLabel:'Behåll i arkivet'});
  assert.match(informing,/role="alert"[^>]*>Ett publicerat bolagspaket/);assert.match(informing,/>Behåll i arkivet</);
  assert.equal((informing.match(/<button/g)??[]).length,1);
});
test('checking replaces the consequences and disables confirm; busy renames confirm and locks cancel',()=>{
  const checking=html({checking:true,checkingLabel:'Kontrollerar…',consequences:['Dold rad'],confirmLabel:'Radera'});
  assert.match(checking,/role="status"[^>]*>.*Kontrollerar…/);assert.doesNotMatch(checking,/Dold rad/);assert.match(checking,/aria-busy="true"/);
  assert.match(checking,/<button type="button" class="danger" disabled=""[^>]*>Radera</);
  const busy=html({busy:true,busyLabel:'Raderar…',confirmLabel:'Radera'});
  assert.match(busy,/<button type="button" class="cancel" disabled=""/);assert.match(busy,/>Raderar…</);assert.doesNotMatch(busy,/>Radera</);
  const disabled=html({confirmLabel:'Radera',confirmDisabled:true,danger:false});
  assert.match(disabled,/class="primary" disabled=""/);
});
test('the acknowledgement is a labelled checkbox, never a free-text id field',()=>{
  const out=renderToStaticMarkup(React.createElement(ConfirmAcknowledgement,{checked:false,label:'Jag förstår att filerna raderas permanent',onChange(){}}));
  assert.match(out,/<label class="check"><input type="checkbox"/);assert.match(out,/Jag förstår att filerna raderas permanent/);assert.doesNotMatch(out,/type="text"/);
});
