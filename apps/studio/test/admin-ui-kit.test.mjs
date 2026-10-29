import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync,readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {runInNewContext} from 'node:vm';

// The Admin kit (client/admin/components/ui, docs/plans/DESIGNSYSTEM.md) rendered on the server: each part
// keeps its role, label and state for assistive technology, and colours come only from --sg-* tokens.
// Keyboard and focus in a real browser: admin-kit-browser.test.mjs.
const client=new URL('../client/',import.meta.url),ui=new URL('admin/components/ui/',client);
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

test('Button renders a typed button, and asChild styles the link itself',()=>{
  const button=html(kit.Button,{variant:'ghost',size:'sm'},'Återställ');
  assert.match(button,/^<button type="button" class="[^"]*bg-transparent[^"]*h-8[^"]*">Återställ<\/button>$/);
  const link=html(kit.Button,{asChild:true,variant:'primary'},h('a',{href:'/admin/companies'},'Bolag'));
  assert.match(link,/^<a href="\/admin\/companies" class="[^"]*bg-sg-lime[^"]*">Bolag<\/a>$/,'no button around the link');
});

test('Badge is a dot and a word; the off state has a hollow dot',()=>{
  const live=html(kit.Badge,{tone:'live',dot:true},'öppet');
  assert.match(live,/bg-sg-live-bg/);assert.match(live,/<span class="[^"]*bg-current[^"]*" aria-hidden="true"><\/span>öppet/);
  assert.match(html(kit.Badge,{tone:'off',dot:true},'Inte anslutet'),/<span class="[^"]*border-current[^"]*" aria-hidden="true"><\/span>Inte anslutet/);
});

test('Card, PageHeader and EmptyState keep the page template order and one action',()=>{
  assert.match(html(kit.Card,{title:'Arkiverade bolag',aside:'1 bolag'},'x'),/<section class="[^"]*rounded-\[10px\][^"]*"><div[^>]*><h2[^>]*>Arkiverade bolag<\/h2><div[^>]*>1 bolag<\/div><\/div>x<\/section>/);
  const head=html(kit.PageHeader,{eyebrow:'Bolag',title:'Bolag och spelbord',intro:'Ingress',actions:h('button',null,'Nytt bolag'),tabs:h('nav',null,'flikar'),note:'Rad'});
  const order=['>Bolag<','<h1','>Ingress<','>Nytt bolag<','<nav','>Rad<'].map(text=>head.indexOf(text));
  assert.ok(order.every((index,i)=>index>=0&&(i===0||index>order[i-1])),`eyebrow, title, intro, actions, tabs, note: ${order}`);
  assert.match(head,/<h1 class="[^"]*font-display[^"]*text-\[30px\]/);
  const empty=html(kit.EmptyState,{title:'Papperskorgen är tom',text:'En mening.',action:h('a',{href:'/x'},'Till alla spelbord')});
  assert.match(empty,/^<div role="status" class="[^"]*border-dashed/);assert.equal((empty.match(/<a /g)??[]).length,1);
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

test('Table and DataTable are dense, sortable and right-align numbers in mono',()=>{
  const table=html(kit.DataTable,{label:'Bolag',rows:[{id:'a',name:'Alfa',rooms:2}],rowKey:row=>row.id,initialSort:{id:'name',dir:'asc'},columns:[
    {id:'name',header:'Bolag',sort:row=>row.name,cell:row=>row.name},{id:'rooms',header:'Spelbord',numeric:true,cell:row=>row.rooms}]});
  assert.match(table,/<table aria-label="Bolag" class="[^"]*text-\[13px\]/);assert.match(table,/aria-sort="ascending"/);
  assert.match(table,/<td class="[^"]*text-right[^"]*font-mono[^"]*tabular-nums[^"]*">2<\/td>/);
});

test('Tooltip adds no wrapper and renders its text only when shown; Sheet is a 460px side panel by default',()=>{
  assert.equal(html(kit.Tooltip,{content:'Låst av Scoutgaming'},h('button',{type:'button'},'Dealer')),'<button type="button" data-state="closed">Dealer</button>');
  const sheet=html(kit.Sheet,{open:true,title:'Återställ hos Alfa',description:'Kommer tillbaka pausat.',onClose(){}},'Innehåll');
  assert.match(sheet,/style="width:min\(460px,100vw\)"/);assert.match(sheet,/aria-labelledby="(sheet-\d+)-title"[\s\S]*<h2 id="\1-title"[^>]*>Återställ hos Alfa/);
  assert.match(sheet,/aria-label="Stäng panelen"/);
  assert.match(html(kit.Sheet,{open:false,title:'x',onClose(){}}),/^<dialog [^>]*><\/dialog>$/);
});

// Kit colours are --sg-* tokens: no hex in the kit, and every sg-* colour class it uses is mapped in Admin's
// Tailwind theme (otherwise Tailwind drops the class without a word).
test('the kit uses token colours only, and each one is in Admin\'s Tailwind theme',()=>{
  const theme=readFileSync(new URL('admin/app/globals.css',client),'utf8');
  const missing=new Set(),hex=[];
  for(const file of readdirSync(ui).filter(name=>name.endsWith('.tsx')&&name!=='chart.tsx')){
    const source=readFileSync(new URL(file,ui),'utf8');
    for(const [match] of source.matchAll(/#[0-9a-f]{3,8}\b/gi))hex.push(`${file}: ${match}`);
    for(const [,name] of source.matchAll(/(?<![\w-])(?:[\w-]+:)*(?:bg|text|border|ring|ring-offset|outline|fill|stroke|decoration|divide|from|to|via|shadow|backdrop:bg)-(sg-[a-z0-9-]+)(?:\/\d+)?(?![\w-])/g)){
      if(!new RegExp(`--(?:color|shadow)-${name}:`).test(theme))missing.add(`${file}: ${name}`);
    }
  }
  assert.deepEqual(hex,[],'colours come from packages/ui/tokens.css');
  assert.deepEqual([...missing],[],'add --color-sg-* to client/admin/app/globals.css');
});
