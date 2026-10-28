import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import * as navigation from '../../../packages/navigation/admin-navigation.mjs';

const require=createRequire(import.meta.url),React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),{transformSync}=require('esbuild');

function loadHelp(){
  const source=readFileSync(new URL('../client/admin/components/studio/admin-help.tsx',import.meta.url),'utf8');
  const module={exports:{}};
  runInNewContext(transformSync(source,{loader:'tsx',format:'cjs',jsx:'automatic'}).code,{module,exports:module.exports,
    require:name=>name==='react'?React:name==='react/jsx-runtime'?require(name):name.endsWith('runtime/navigation')?{__esModule:true,default:props=>React.createElement('a',props)}:name.endsWith('lib/admin-navigation')?navigation:require(name)});
  return module.exports;
}

// Hjälp follows the shared menu: every page the menu offers is explained, and only living addresses are linked.
test('Hjälp lists every menu page with its description and links to the user guide and the glossary',()=>{
  const {AdminHelp}=loadHelp();
  const html=renderToStaticMarkup(React.createElement(AdminHelp));
  const hrefs=[...html.matchAll(/href="([^"]+)"/g)].map(match=>match[1].replaceAll('&amp;','&'));
  for(const link of [...navigation.adminNavigationGroups,...navigation.adminSystemGroups].flatMap(group=>group.links)){
    assert.ok(hrefs.includes(link.href),link.href);
    assert.ok(typeof link.description==='string'&&link.description.length>0,link.label+' needs a description');
    assert.ok(html.includes(link.description.replace(/&/g,'&amp;')),link.label);
  }
  assert.ok(hrefs.includes('/admin'));
  assert.ok(hrefs.includes('https://github.com/Jakeminator123/scoutgaming/blob/main/apps/studio/docs/README.md'));
  assert.ok(hrefs.includes('https://github.com/Jakeminator123/scoutgaming/blob/main/apps/studio/docs/TERMINOLOGI.md'));
  assert.equal(hrefs.some(href=>/^\/(?:control|lab)(?:\/|$)|\/admin\/(?:publication|compositions|videos|rehearsal|probe|events|admin\/operators)(?:[?#]|$)/.test(href)),false,'no retired addresses');
  assert.match(html,/<h1[^>]*>Hjälp<\/h1>/);
});
