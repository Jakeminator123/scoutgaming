import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import vm from 'node:vm';
import {layerUploadResponseError,layerUploadFailureMessage} from '../../../packages/presentation/contracts/layer-upload-errors.mjs';

const require=createRequire(import.meta.url),{transformSync}=require('next/dist/build/swc');
function loadTs(fileUrl,overrides={},globals={}){
  const output=transformSync(readFileSync(fileUrl,'utf8'),{filename:fileURLToPath(fileUrl),jsc:{parser:{syntax:'typescript',tsx:true},transform:{react:{runtime:'automatic'}}},module:{type:'commonjs'}});
  const module={exports:{}},localRequire=createRequire(fileUrl);
  vm.runInNewContext(output.code,{module,exports:module.exports,structuredClone,URL,URLSearchParams,Request,Headers,AbortController,Error,...globals,
    window:new Proxy({},{get:(_target,key)=>globalThis.window?.[key]}),require:name=>{
      if(Object.hasOwn(overrides,name))return overrides[name];
      if(name.endsWith('.module.css'))return {__esModule:true,default:new Proxy({},{get:(_target,key)=>String(key)})};
      if(name.startsWith('./')||name.startsWith('../'))for(const suffix of ['', '.tsx','.ts','.mjs','.js']){
        const candidate=new URL(name+suffix,fileUrl),path=fileURLToPath(candidate);if(!existsSync(path))continue;
        return /\.(mjs|js|json)$/.test(path)?localRequire(path):loadTs(pathToFileURL(path),overrides);
      }
      return localRequire(name);
    }},{filename:fileURLToPath(fileUrl)});return module.exports;
}

test('upload UI explains known metadata rejection and preserves uncertainty only for unknown commit failures',async()=>{
  for(const [status,body,network,expected,uncertain]of [
    [422,{code:'studio_media_dimensions_mismatch',error:'https://private.invalid/person?secret=fixture'},false,/bildmått/,false],
    [503,{code:'studio_media_inspection_busy'},false,/kontrolleras redan/,false],
    [503,{code:'unknown',error:'https://private.invalid/person?secret=fixture'},false,/kunde inte sparas/,true],
    [0,null,true,/Uppladdningen misslyckades/,true],
  ]){
    let index=0,lastError='',finish;const slots=[];const completed=new Promise(resolve=>{finish=resolve;});
    class FixtureImage {
      naturalWidth=32;naturalHeight=24;
      set src(_value){queueMicrotask(()=>this.onload?.());}
      removeAttribute(){}
    }
    const {LayerLibrary}=loadTs(new URL('../components/layer-library.tsx',import.meta.url),{
      // Kept state per slot, so the chosen file shows its name field and the Ladda upp button.
      react:{useState:value=>{const slot=index++;if(!(slot in slots))slots[slot]=value;return [slots[slot],next=>{slots[slot]=next;if(slot===1)lastError=next;if(slot===0&&next===false)finish();}];},useRef:value=>({current:value}),useEffect:()=>{}},
      '../lib/studio-composition.mjs':{uploadCompositionLayer:async(_file,_metadata,options)=>{options.onCommit();return options.post({operation:'commit'},options.signal);}},
    },{URL:{createObjectURL:()=> 'blob:fixture',revokeObjectURL:()=>{}},Image:FixtureImage,HTMLImageElement:FixtureImage,HTMLVideoElement:class {},setTimeout,clearTimeout,
      fetch:async()=>{if(network)throw new Error('https://private.invalid/person?secret=fixture');return {ok:false,status,json:async()=>body};}});
    const render=()=>{index=0;return LayerLibrary({role:'background',onRegistered:()=>assert.fail('rejected upload cannot register')});};
    function find(node,predicate){if(!node||typeof node!=='object')return null;if(predicate(node))return node;for(const child of [node.props?.children].flat(Infinity)){const match=find(child,predicate);if(match)return match;}return null;}
    const input=find(render(),node=>node.type==='input'&&node.props.type==='file');assert.ok(input);assert.equal(input.props.multiple,undefined,'one file per upload, no client Promise.all');
    input.props.onChange({currentTarget:{files:[{type:'image/png',size:32,name:'fixture_file.png'}],value:'fixture'}});
    const chosen=render(),name=find(chosen,node=>node.type==='input'&&node.props.maxLength===80);
    assert.equal(name.props.value,'fixture file','the name is suggested from the file name');
    assert.equal(find(chosen,node=>node.type==='input'&&node.props.type==='file'),null,'the chosen file replaces the file picker until it is uploaded or cleared');
    find(chosen,node=>node.type==='button'&&node.props.children==='Ladda upp').props.onClick();await completed;
    assert.match(lastError,expected);assert.match(lastError,/Utkastet har behållits/);
    assert.equal(lastError.includes('Filen kan vara registrerad'),uncertain);assert.doesNotMatch(lastError,/private\.invalid|secret|person/);
  }
});

test('cancellation after commit keeps registration uncertainty unless the server rejected metadata',()=>{
  const options={aborted:true,commitStarted:true};
  assert.match(layerUploadFailureMessage(new Error('network'),options),/Filen kan vara registrerad/);
  assert.doesNotMatch(layerUploadFailureMessage(new Error('network'),{aborted:true}),/Filen kan vara registrerad/);
  const rejected=layerUploadResponseError(422,{code:'studio_media_dimensions_mismatch'});
  assert.doesNotMatch(layerUploadFailureMessage(rejected,options),/Filen kan vara registrerad/);
});
