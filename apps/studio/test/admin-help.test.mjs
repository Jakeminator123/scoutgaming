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
});

// Enkel väg 4: a company has four tabs with Spelbord as the default; retired ids land on the nearest tab and Hjälp lists the four.
test('the company nav has Spelbord, Tilldelning, Team and Inställningar, and old tab ids keep working',()=>{
  assert.deepEqual(navigation.adminCompanyTabs.map(tab=>tab.id),['spelbord','tilldelning','team','installningar']);
  assert.equal(navigation.adminTabId('company',null),'spelbord');
  assert.equal(navigation.adminTabId('company','okand'),'spelbord');
  assert.equal(navigation.adminTabId('company','constructor'),'spelbord','an inherited key is no alias');
  for(const [old,tab] of [['spelare','spelbord'],['integration','spelbord'],['journal','installningar'],['tilldelning','tilldelning'],['team','team']])
    assert.equal(navigation.adminTabId('company',old),tab,old);
  // Aliases are per page: System keeps its own Spelarkonton and Integration tabs.
  assert.equal(navigation.adminTabId('system','spelare'),'spelare');assert.equal(navigation.adminTabId('system','integration'),'integration');
  const {AdminHelp}=loadHelp();
  const html=renderToStaticMarkup(React.createElement(AdminHelp));
  assert.ok(html.includes('Bolagets flikar: Spelbord · Tilldelning · Team · Inställningar.'));
  assert.doesNotMatch(html,/Bolag, fliken (Journal|Integration|Spelare)/);
});

// Enkel väg 5: the dealer has five steps with real done states, and nothing in its nav pretends to work.
const steps=['Skapa','Lägg till klipp','Klipp per fack','Röst och tal','Tilldela'];
test('the dealer flow has five steps and Hjälp lists exactly those',()=>{
  assert.equal(navigation.adminDealerSteps.length,5);
  assert.deepEqual(navigation.adminDealerSteps,steps);
  const {AdminHelp}=loadHelp();
  const html=renderToStaticMarkup(React.createElement(AdminHelp));
  const listed=[...html.matchAll(/<li[^>]*><span[^>]*>(\d)<\/span>([^<]+)<\/li>/g)].map(match=>[Number(match[1]),match[2]]);
  assert.deepEqual(listed,steps.map((step,index)=>[index+1,step]));
  assert.doesNotMatch(html,/Mät landningar|Godkänn|mätningen kommer senare/);
});

test('the dealer nav and its clip map drawer have no disabled "kommer senare" controls',()=>{
  const read=file=>readFileSync(new URL('../client/admin/components/studio/'+file,import.meta.url),'utf8');
  const hub=read('dealer-hub.tsx'),map=read('connected-clip-map.tsx');
  for(const [name,source] of [['dealer-hub.tsx',hub],['connected-clip-map.tsx',map]]){
    // No opening tag (arrow functions skipped) is disabled while its title promises a later feature.
    for(const [tag] of source.matchAll(/<[a-zA-Z][^<]*?(?<!=)>/g))
      if(/\b(?:aria-)?disabled\b/.test(tag))assert.doesNotMatch(tag,/title="[^"]*kommer senare/i,name+': '+tag.slice(0,80));
    assert.doesNotMatch(source,/Godkänn dealern|Mät landningar|Exportera landningsmall|Skapa material|Landningar mätta|Scenförhandsvisning|Tal vid inaktivitet/,name);
  }
  // Redo för spel only shows rows with a real state: klart or saknas.
  assert.match(hub,/<Card title="Redo för spel"/);
  assert.doesNotMatch(hub,/<Chip tone="warn">kommer senare<\/Chip>} title=\{text\}/);
  // The drawer: Klipp, Körregel and Lägg till klipp. Provspela is the dealer nav's flyout; Scen & lager sits in the toolbar.
  const nav=map.match(/<nav className="studio-inspector-nav"[^>]*>([\s\S]*?)<\/nav>/);
  assert.ok(nav,'the drawer nav');
  assert.deepEqual([...nav[1].matchAll(/\}>([A-ZÅÄÖ][^<{]*)/g)].map(match=>match[1]),['Klipp','Körregel','Lägg till klipp']);
});
