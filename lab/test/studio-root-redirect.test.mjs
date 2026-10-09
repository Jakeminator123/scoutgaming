import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import {publicAbsoluteUrl} from '../lib/lab-url.mjs';

const url=new URL('../app/page.tsx',import.meta.url);
const require=createRequire(url);
const {transformSync}=require('next/dist/build/swc');
const navigation=require('next/dist/client/components/redirect.js');
function load(){
  const {code}=transformSync(readFileSync(url,'utf8'),{filename:'page.tsx',jsc:{parser:{syntax:'typescript',tsx:true}},module:{type:'commonjs'}});
  const module={exports:{}};
  vm.runInNewContext(code,{module,exports:module.exports,URLSearchParams,require:name=>{
    if(name==='next/headers')return {headers:async()=>new Headers({'host':'studio.internal.invalid','x-forwarded-host':'public.example.invalid','x-forwarded-proto':'https'})};
    if(name==='next/navigation')return navigation;
    if(name==='@/lib/lab-url.mjs')return {publicAbsoluteUrl};
    throw Error(name);
  }});
  return module.exports.default;
}
test('technical root redirects permanently to the public clips path without doubling basePath',async()=>{
  const page=load();
  await assert.rejects(page({searchParams:Promise.resolve({})}),error=>error.digest==='NEXT_REDIRECT;replace;https://public.example.invalid/control/clips;308;');
});
test('technical root retains query values and repeated parameters through canonical redirect',async()=>{
  const page=load();
  await assert.rejects(page({searchParams:Promise.resolve({dealer:'vera',event:'a&b',tag:['one','two'],empty:undefined})}),error=>{
    assert.match(error.digest,/;308;$/);
    const destination=new URL(error.digest.split(';')[2]);
    assert.equal(destination.pathname,'/control/clips');
    assert.equal(destination.searchParams.get('event'),'a&b');
    assert.deepEqual(destination.searchParams.getAll('tag'),['one','two']);
    assert.equal(destination.searchParams.get('dealer'),'vera');
    assert.equal(destination.searchParams.has('empty'),false);
    return true;
  });
});
