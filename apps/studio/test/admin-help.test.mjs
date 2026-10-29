import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import * as navigation from '../../../packages/navigation/admin-navigation.mjs';

const require=createRequire(import.meta.url),React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),{transformSync}=require('esbuild');

// The help page and the real hub primitives, with Link rendered as a plain anchor.
function loadHelp(){
  const runtime={__esModule:true,default:props=>React.createElement('a',props),usePathname:()=>'/admin/guide',useSearchParams:()=>new URLSearchParams()};
  const compile=(file,resolve)=>{
    const module={exports:{}};
    runInNewContext(transformSync(readFileSync(new URL(file,import.meta.url),'utf8'),{loader:'tsx',format:'cjs',jsx:'automatic'}).code,{module,exports:module.exports,
      require:name=>name==='react'?React:name==='react/jsx-runtime'?require(name):name.endsWith('runtime/navigation')?runtime:resolve(name)});
    return module.exports;
  };
  // The hub layout builds on the kit (./kit, ./dialog, ./menu) and the client's packages.
  const clientRequire=createRequire(new URL('../client/admin/components/ui/hub.tsx',import.meta.url));
  const ui={},uiRequire=name=>name.startsWith('./')?(ui[name]??=compile('../client/admin/components/ui/'+name.slice(2)+'.tsx',uiRequire)):clientRequire(name);
  const hub=compile('../client/admin/components/ui/hub.tsx',uiRequire);
  return compile('../client/admin/components/studio/admin-help.tsx',name=>name==='../ui/hub'?hub:name.startsWith('../ui/')?uiRequire('./'+name.slice('../ui/'.length)):name.endsWith('lib/admin-navigation')?navigation:clientRequire(name));
}

// Hjälp follows the shared menu: every page the menu offers is explained, and only living addresses are linked.
test('Hjälp lists every menu page with its description and links to the user guide and the glossary',()=>{
  const {AdminHelp}=loadHelp();
  const html=renderToStaticMarkup(React.createElement(AdminHelp));
  const hrefs=[...html.matchAll(/href="([^"]+)"/g)].map(match=>match[1].replaceAll('&amp;','&'));
  assert.equal(navigation.adminSystemGroups,undefined,'System is one menu page; its tabs are not separate menu groups');
  for(const link of navigation.adminNavigationGroups.flatMap(group=>group.links)){
    assert.ok(hrefs.includes(link.href),link.href);
    assert.ok(typeof link.description==='string'&&link.description.length>0,link.label+' needs a description');
    assert.ok(html.includes(link.description.replace(/&/g,'&amp;')),link.label);
  }
  assert.ok(hrefs.includes('/admin'));
  assert.ok(hrefs.includes('https://github.com/Jakeminator123/scoutgaming/blob/main/apps/studio/docs/README.md'));
  assert.ok(hrefs.includes('https://github.com/Jakeminator123/scoutgaming/blob/main/apps/studio/docs/TERMINOLOGI.md'));
  assert.equal(hrefs.some(href=>/^\/(?:control|lab)(?:\/|$)|\/admin\/(?:publication|compositions|videos|rehearsal|probe|events|admin\/operators|clips|assets|structure|deletion|drift|ekonomi|players|replies|dealer-agent|dealer-studio|ai\/models|admin\/accounts|admin\/api)(?:[?#]|$)/.test(href)),false,'no retired addresses');
  for(const tab of navigation.adminSystemTabs)assert.ok(html.includes(tab.label),'the System tabs are explained: '+tab.label);
  assert.match(html,/<h1[^>]*>Hjälp<\/h1>/);
  // Översikt is the home page, not one of the menu's choices, so the card states no count that can drift from the menu.
  assert.doesNotMatch(html,/Menyn \(\d+ val\)/);
  assert.doesNotMatch(html,/API-nycklar saknar bolag/,'every API key belongs to a company since game migration 012');
});
