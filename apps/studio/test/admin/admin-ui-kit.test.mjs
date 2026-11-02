import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {runInNewContext} from 'node:vm';

// The Admin kit rendered on the server: each part keeps its role, label and state
// for assistive technology.
// Keyboard and focus in a real browser: admin-kit-browser.test.mjs.
const client=new URL('../../client/',import.meta.url),ui=new URL('admin/components/ui/',client);
const require=createRequire(new URL('package.json',client));
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),{buildSync}=require('esbuild');
const kit=(()=>{
  const {outputFiles:[bundle]}=buildSync({stdin:{contents:['kit','tabs','table','form','dropdown-menu','dialog','page-header','data-table'].map(name=>`export * from './${name}';`).join('\n'),resolveDir:fileURLToPath(ui),loader:'ts'},
    bundle:true,write:false,format:'cjs',platform:'node',jsx:'automatic',external:['react','react-dom','react/*','react-dom/*'],logLevel:'silent'});
  const module={exports:{}};
  runInNewContext(bundle.text,{module,exports:module.exports,require,console,setTimeout,clearTimeout});
  return module.exports;
})();
const html=(type,props={},...children)=>renderToStaticMarkup(React.createElement(type,props,...children));
const h=React.createElement;
const attribute=(markup,name)=>markup.match(new RegExp(`${name}="([^"]*)"`))?.[1];

test('Button renders a typed button, and asChild preserves the link destination',()=>{
  const button=html(kit.Button,{variant:'ghost',size:'sm'},'Återställ');
  assert.match(button,/<button\b[^>]*type="button"[^>]*>Återställ<\/button>/);
  const link=html(kit.Button,{asChild:true,variant:'primary'},h('a',{href:'/admin/companies'},'Bolag'));
  assert.match(link,/<a\b[^>]*href="\/admin\/companies"[^>]*>Bolag<\/a>/);
  assert.doesNotMatch(link,/<button\b/,'a navigation link must not be nested in a button');
});

test('Badge hides decorative dots from assistive technology while keeping the status text',()=>{
  for(const [tone,label] of [['live','öppet'],['off','Inte anslutet']]){
    const badge=html(kit.Badge,{tone,dot:true},label);
    assert.match(badge,/<span\b[^>]*aria-hidden="true"[^>]*><\/span>/);
    assert.ok(badge.includes(label));
  }
});

test('Card, PageHeader and EmptyState expose their headings, content and actions',()=>{
  const card=html(kit.Card,{title:'Arkiverade bolag',aside:'1 bolag'},'Innehåll');
  assert.match(card,/<h2\b[^>]*>Arkiverade bolag<\/h2>/);
  for(const text of ['1 bolag','Innehåll'])assert.ok(card.includes(text));
  const head=html(kit.PageHeader,{eyebrow:'Bolag',title:'Bolag och spelbord',intro:'Ingress',actions:h('button',null,'Nytt bolag'),tabs:h('nav',null,'flikar'),note:'Rad'});
  assert.match(head,/<h1\b[^>]*>Bolag och spelbord<\/h1>/);
  for(const text of ['Bolag','Ingress','Nytt bolag','flikar','Rad'])assert.ok(head.includes(text));
  const empty=html(kit.EmptyState,{title:'Papperskorgen är tom',text:'En mening.',action:h('a',{href:'/x'},'Till alla spelbord')});
  assert.match(empty,/role="status"/);
  assert.match(empty,/<a\b[^>]*href="\/x"[^>]*>Till alla spelbord<\/a>/);
});

test('Radix tabs, menu, select, checkbox and switch carry their roles and states',()=>{
  const tabs=html(kit.Tabs,{defaultValue:'a'},h(kit.TabsList,{'aria-label':'Visa'},h(kit.TabsTrigger,{value:'a'},'Bolag'),h(kit.TabsTrigger,{value:'b'},'Spelbord')),h(kit.TabsContent,{value:'a'},'Innehåll'));
  assert.match(tabs,/role="tablist"[^>]*aria-label="Visa"|aria-label="Visa"[^>]*role="tablist"/);
  assert.match(tabs,/role="tab" aria-selected="true"[^>]*data-state="active"[^>]*>Bolag</);assert.match(tabs,/role="tab" aria-selected="false"[^>]*>Spelbord</);
  assert.match(tabs,/role="tabpanel"[^>]*>Innehåll</);
  const menu=html(kit.DropdownMenu,null,h(kit.DropdownMenuTrigger,null,'Åtgärder'),h(kit.DropdownMenuContent,null,h(kit.DropdownMenuItem,null,'Öppna')));
  assert.equal(attribute(menu,'aria-haspopup'),'menu');assert.doesNotMatch(menu,/Öppna/,'a closed menu renders no items');
  const select=html(kit.Select,{defaultValue:'sv'},h(kit.SelectTrigger,{'aria-label':'Språk'},h(kit.SelectValue,null)),h(kit.SelectContent,null,h(kit.SelectItem,{value:'sv'},'Svenska')));
  assert.match(select,/role="combobox"/);assert.match(select,/aria-label="Språk"/);
  assert.match(html(kit.Checkbox,{checked:true,'aria-label':'Välj'}),/role="checkbox" aria-checked="true"/);
  assert.match(html(kit.Switch,{checked:false,'aria-label':'Öppet'}),/role="switch" aria-checked="false"/);
});

test('Field labels its control and describes it with the hint and the error',()=>{
  const field=html(kit.Field,{label:'Namn',hint:'Syns för spelarna.',error:'Namnet saknas.'},h(kit.Input,{name:'name'}));
  const id=attribute(field,'for');
  assert.ok(id);assert.match(field,new RegExp(`<input[^>]*id="${id}"`));
  const described=field.match(/<input[^>]*aria-describedby="([^"]+)"/)[1].split(' ');
  for(const part of described)assert.match(field,new RegExp(`<p id="${part}"`));
  assert.equal(described.length,2);assert.match(field,/aria-invalid="true"/);assert.match(field,/role="alert"[^>]*>Namnet saknas\./);
});

test('DataTable exposes its label, sort state and row values',()=>{
  const table=html(kit.DataTable,{label:'Bolag',rows:[{id:'a',name:'Alfa',rooms:2}],rowKey:row=>row.id,initialSort:{id:'name',dir:'asc'},columns:[
    {id:'name',header:'Bolag',sort:row=>row.name,cell:row=>row.name},{id:'rooms',header:'Spelbord',numeric:true,cell:row=>row.rooms}]});
  assert.match(table,/<table\b[^>]*aria-label="Bolag"/);assert.match(table,/aria-sort="ascending"/);
  assert.match(table,/<td\b[^>]*>Alfa<\/td>/);assert.match(table,/<td\b[^>]*>2<\/td>/);
});

test('Closed Tooltip keeps its trigger; Sheet exposes its accessible title and close action',()=>{
  const tooltip=html(kit.Tooltip,{content:'Låst av Scoutgaming'},h('button',{type:'button'},'Dealer'));
  assert.match(tooltip,/<button\b[^>]*type="button"[^>]*>Dealer<\/button>/);
  assert.doesNotMatch(tooltip,/Låst av Scoutgaming/);
  const sheet=html(kit.Sheet,{open:true,title:'Återställ hos Alfa',description:'Kommer tillbaka pausat.',onClose(){}},'Innehåll');
  const titleId=attribute(sheet,'aria-labelledby');
  assert.ok(titleId);assert.match(sheet,new RegExp(`<h2 id="${titleId}"[^>]*>Återställ hos Alfa`));
  assert.match(sheet,/aria-label="Stäng panelen"/);
  assert.doesNotMatch(html(kit.Sheet,{open:false,title:'x',onClose(){}},'Innehåll'),/Innehåll|Stäng panelen/);
});
