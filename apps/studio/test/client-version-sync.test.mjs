import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// De delade komponenterna i apps/studio/components byggs både av Next och av
// Admin-bundeln i apps/studio/client; se apps/studio/client/README.md.
const SHARED=['react','react-dom','@types/react','@types/react-dom','esbuild','typescript'];
const read=path=>JSON.parse(readFileSync(new URL(path,import.meta.url),'utf8'));
const version=(manifest,name)=>manifest.dependencies?.[name]??manifest.devDependencies?.[name];

test('Studio och Admin-klienten har exakt samma version av den delade verktygskedjan',()=>{
  const studio=read('../package.json'),client=read('../client/package.json');
  for(const name of SHARED){
    const expected=version(studio,name);
    assert.match(expected??'',/^\d+\.\d+\.\d+$/,`${name} ska vara exakt pinnad i apps/studio/package.json`);
    assert.equal(version(client,name),expected,`${name} ska ha samma version i apps/studio/client/package.json`);
  }
});
