'use strict';
(() => {
  const data = JSON.parse(document.querySelector('#atlas-data').textContent);
  const $ = selector => document.querySelector(selector);
  const nodes = new Map(data.nodes.map(n => [n.id, n]));
  const modules = new Map();
  const incoming = new Map(), outgoing = new Map();
  for (const n of data.nodes) {
    if (!modules.has(n.module)) modules.set(n.module, []);
    modules.get(n.module).push(n);
  }
  for (const edge of data.edges) {
    if (!outgoing.has(edge.source)) outgoing.set(edge.source, []);
    if (!incoming.has(edge.target)) incoming.set(edge.target, []);
    outgoing.get(edge.source).push(edge);
    incoming.get(edge.target).push(edge);
  }
  const colors = ['#86abff', '#bd9df6', '#65d0c8', '#dfb77a', '#8dbcf2', '#e1a8ba'];
  const typeNames = {import:'Import', call:'Anrop', http:'HTTP / WS', data:'Data', test:'Test/fixtur', document:'Dokumenterat ansvar'};
  const state = {view:'overview', chain:'team', focus:null, selected:null, filter:'all', graph:null, transform:{x:0,y:0,k:1}};
  let graphWidth = 1000, graphHeight = 720, graphBounds={x:0,y:0,width:1000,height:720};
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function button(label, callback, small) {
    const b = el('button', 'list-button', label);
    if (small) b.append(el('small', '', small));
    b.onclick = callback;
    return b;
  }
  function svg(tag, attrs, text) {
    const n = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [key,value] of Object.entries(attrs || {})) n.setAttribute(key, value);
    if (text !== undefined) n.textContent = text;
    return n;
  }
  function shorten(text, max=29) {return text.length > max ? text.slice(0,max-1)+'…' : text;}
  function badge(text, kind='') {return el('span', 'badge '+kind, text);}
  function testLabel(path){return nodes.get(path)?.testRole==='support'?'Stöd / fixtur':'Testområde · ej körstatus';}
  function closeDetail(){$('#inspector').classList.remove('open');$('.workspace').classList.remove('has-detail');}
  function note(text, kind='') {return el('div','pill-note '+kind,text);}
  function showDetail(title, label, intro) {
    const d=$('#detail');d.replaceChildren();d.append(el('div','detail-eyebrow',label));
    const close=button('Stäng detalj',closeDetail);
    close.classList.add('mobile-close');
    d.append(close,el('h2','',title));
    if(intro)d.append(el('p','intro',intro));
    $('#inspector').classList.add('open');
    $('.workspace').classList.add('has-detail');
    return d;
  }
  function proofBox(proof) {
    const p=el('div','proof');
    if(proof.line){
      const a=el('a','',proof.path+':'+proof.line);a.href=proof.url||proof.local;a.target='_blank';a.rel='noopener noreferrer';p.append(a);
      p.append(el('small','',proof.dirty?'Ändrad arbetskopia · lokal fil, raden anges ovan':'GitHub på visad SHA · kräver nät när länken öppnas'));
      if(proof.local&&proof.url){const local=el('a','','Öppna lokal fil');local.href=proof.local;local.target='_blank';local.rel='noopener';p.append(local);}
    }else p.append(el('span','',proof.path),el('small','','Kodankaret behöver översyn; ingen rad eller aktuellt bevis hävdas.'));
    return p;
  }
  function proofFor(path,line){return {path,line,dirty:nodes.get(path)?.dirty,local:data.root+'/'+path.split('/').map(encodeURIComponent).join('/'),url:nodes.get(path)?.dirty?null:'https://github.com/Jakeminator123/scoutgaming/blob/'+data.revision+'/'+path.split('/').map(encodeURIComponent).join('/')+'#L'+line};}
  function pagedList(parent, items, render, pageSize=18) {
    const box=el('div');parent.append(box);let count=0;
    const more=el('button','list-button');
    function add(){const next=items.slice(count,count+pageSize);for(const item of next)box.append(render(item));count+=next.length;more.textContent='Visa fler ('+(items.length-count)+' kvar)';if(count>=items.length)more.remove();}
    more.onclick=add;parent.append(more);add();
  }
  function relatedTests(paths) {
    const tests=new Map();
    for(const path of paths)for(const edge of incoming.get(path)||[])if(edge.type==='test')tests.set(edge.source,edge);
    return [...tests.values()];
  }
  function title(text,sub,eyebrow){$('#title').textContent=text;$('#subtitle').textContent=sub;$('#eyebrow').textContent=eyebrow;}
  function setView(view, reset=true){
    state.view=view;state.selected=null;if(reset)state.focus=null;
    document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===view)));
    document.querySelectorAll('.domain').forEach(b=>b.classList.remove('active'));
    $('#coverage').hidden=view!=='coverage';$('#canvas-wrap').hidden=view==='coverage';
    $('#chain').hidden=view!=='chains';$('#back').hidden=true;$('#edge-filter').hidden=view==='coverage';
    if(view==='overview'){
      title('Från spelare till serverbeslut','Följ anrop, gemensamma kontrakt och data genom produkten.','01 / SYSTEMÖVERSIKT');
      $('#crumb').textContent='Produktvägen · handgranskade samband';
      setGraph(data.graphs.find(g=>g.id==='runtime')||emptyGraph());
      showWelcome();
    }else if(view==='chains'){
      const graph=data.graphs.find(g=>g.id===state.chain)||data.graphs[0]||emptyGraph();
      title(graph.title,'En avgränsad kodkedja med riktning och återkontrollerade källankare.','02 / ANSVAR I KOD');
      $('#crumb').textContent='Handgranskad kodkedja';$('#chain').value=graph.id;setGraph(graph);showWelcome();
    }else if(view==='network'){
      title('Kodens beroenden','Börja i en modul. Öppna en fil för dess direkta konsumenter och imports.','03 / STATISK KODINVENTERING');
      $('#crumb').textContent='Moduler · grupperade filreferenser';setGraph(moduleGraph());showWelcome();
    }else{title('Vad finns belagt – och vad saknas?','Testreferenser och dokumenterade provkrav är ingångar till granskning, inte testresultat.','04 / PROV OCH INVENTERING');$('#crumb').textContent='Källunderlag, inte en hälsopoäng';renderCoverage();showWelcome();}
  }
  function emptyGraph(){return {id:'empty',nodes:[],edges:[],note:'Inga handgranskade relationer i detta repo.'};}
  function moduleGraph(scope=null){
    const labels={apps:'Appar',packages:'Domänpaket',services:'Backend',test:'Prov & fixturer',tools:'Verktyg',ops:'Drift'};
    const groups=scope?[...modules.keys()].filter(m=>m===scope||m.startsWith(scope+'/')).sort():[...new Set([...modules.keys()].map(m=>m.split('/')[0]))].sort();
    const counts=new Map();
    for(const e of data.edges){let source=nodes.get(e.source).module,target=nodes.get(e.target).module;if(!scope){source=source.split('/')[0];target=target.split('/')[0];}if(source===target||!groups.includes(source)||!groups.includes(target))continue;const key=[source,target,e.type].join('|');if(!counts.has(key))counts.set(key,{id:key,source,target,type:e.type,level:'static',references:[]});counts.get(key).references.push(e);}
    return {id:'modules',kind:scope?'modules':'groups',nodes:groups.map((id,i)=>({id,label:scope?id.split('/').at(-1):labels[id]||id,place:scope?id:'Öppna '+id+' för moduler',col:i%3,row:Math.floor(i/3),count:scope?modules.get(id).length:data.nodes.filter(n=>n.id.startsWith(id+'/')).length})),edges:[...counts.values()].map(e=>({...e,label:e.references.length+' '+typeNames[e.type].toLowerCase()})),note:scope?'Referenser mellan moduler i '+scope+'. Välj modul för även externa konsumenter.':'Grupperade statiska referenser. Öppna en kodgrupp, därefter modul och fil.'};
  }
  function openGroup(scope){
    closeDetail();state.selected=null;
    title('Kodgrupp: '+scope,'Välj en modul för dess filer, konsumenter och testreferenser.','03 / MODULER');
    $('#crumb').textContent='Kodnät / '+scope;$('#back').hidden=false;setGraph(moduleGraph(scope));
  }
  function openModule(module){
    const files=modules.get(module)||[];const d=showDetail(module,'MODUL / KODANSVAR',files.length+' inventerade JS/TS-filer. Modulnamnet anger kodgrupp; dokumenterade ansvarsgränser finns till vänster.');
    d.append(badge(files.filter(n=>n.test).length+' testfiler'));
    const links=data.edges.filter(e=>nodes.get(e.source).module===module&&nodes.get(e.target).module!==module);
    d.append(badge(links.length+' referenser ut'));
    const consumers=[...new Set(data.edges.filter(e=>nodes.get(e.target).module===module&&nodes.get(e.source).module!==module).map(e=>nodes.get(e.source).module))];
    if(consumers.length){d.append(el('h3','','Konsumeras av moduler · '+consumers.length));pagedList(d,consumers,m=>button(m,()=>openModule(m)),8);}
    d.append(el('h3','','Filer · öppna närmaste samband'));
    pagedList(d,files,(n)=>button(n.id,()=>openFile(n.id),n.test?testLabel(n.id):n.lines+' rader'+(n.dirty?' · ändrad arbetskopia':'')));
    d.append(note('Ingen statisk kant är inte bevis för att en fil saknar konsument.'));
  }
  function openFile(path){
    if(!nodes.has(path))return;
    state.view='network';state.focus=path;state.selected=path;
    document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view==='network')));
    $('#coverage').hidden=true;$('#canvas-wrap').hidden=false;$('#chain').hidden=true;$('#edge-filter').hidden=false;$('#back').hidden=false;
    title(nodes.get(path).label,'Direkta referenser in och ut. Pilar går från konsument till beroende.','03 / FILENS NÄRMASTE SAMBAND');$('#crumb').textContent=path;
    const ins=incoming.get(path)||[],outs=outgoing.get(path)||[];
    const ordered=[...new Set([...ins.map(e=>e.source),...outs.map(e=>e.target)])].filter(p=>p!==path);
    const visible=ordered.slice(0,36);const present=new Set([path,...visible]);
    const edges=[...new Set([...ins,...outs])].filter(e=>present.has(e.source)&&present.has(e.target)).map((e,i)=>({...e,id:'ref-'+i,label:e.mode==='dynamic'?'import()':e.mode==='type'?'typimport':typeNames[e.type],level:'static'}));
    const left=visible.filter(p=>ins.some(e=>e.source===p)),right=visible.filter(p=>!left.includes(p));
    const height=Math.max(left.length,right.length,1);
    const graph={id:'file',kind:'file',nodes:[{...nodes.get(path),place:nodes.get(path).module,col:1,row:Math.max(0,(height-1)/2),center:true},...left.map((p,i)=>({...nodes.get(p),place:nodes.get(p).module,col:0,row:i})),...right.map((p,i)=>({...nodes.get(p),place:nodes.get(p).module,col:2,row:i}))],edges,note:ordered.length>visible.length?'Visar '+visible.length+' av '+ordered.length+' grannar. Alla finns i detaljlistorna.':'Alla '+ordered.length+' direkta grannar visas. Inga transitiva anrop antas.'};
    setGraph(graph);fileDetail(path);
  }
  function fileDetail(path){
    const n=nodes.get(path),ins=incoming.get(path)||[],outs=outgoing.get(path)||[];
    const d=showDetail(n.label,'FIL / '+n.module,path);
    d.append(badge(n.test?testLabel(path):'Produkt / verktyg'),badge(n.dirty?'Ändrad arbetskopia':'Spårad fil',n.dirty?'warn':''));
    d.append(proofBox(proofFor(path,1)));
    const contracts=data.contracts.filter(c=>c.files.some(p=>path===p||path.startsWith(p+'/')));
    if(contracts.length){d.append(el('h3','','Dokumenterat ansvar'));for(const c of contracts)d.append(button(c.name,()=>openContract(c)));}
    const tests=relatedTests([path]);
    d.append(el('h3','','Direkt från testområdet · '+tests.length));
    if(tests.length)pagedList(d,tests,e=>button(e.source,()=>openFile(e.source),testLabel(e.source)+' · rad '+e.line+' · '+e.mode),8);
    else d.append(note('Ingen direkt import från testområdet hittad. Indirekta, HTTP- och browserprov kan ändå finnas.','warn'));
    d.append(el('h3','','Konsumenter · '+ins.length));
    pagedList(d,ins,e=>button(e.source,()=>openFile(e.source),typeNames[e.type]+' · rad '+e.line),10);
    d.append(el('h3','','Beroenden · '+outs.length));
    pagedList(d,outs,e=>button(e.target,()=>openFile(e.target),e.mode+' · rad '+e.line),10);
    const unknown=data.unknown.filter(e=>e.source===path);
    if(unknown.length){d.append(el('h3','','Olösta referenser · '+unknown.length));pagedList(d,unknown,e=>{const p=el('div','proof',e.reason+' · rad '+e.line);p.append(proofBox(proofFor(path,e.line)));return p;},8);}
  }
  function openContract(c){
    document.querySelectorAll('.domain').forEach(b=>b.classList.toggle('active',b.dataset.contract===c.id));
    const d=showDetail(c.name,'DOKUMENTERAT ANSVAR',c.responsibility);
    for(const [label,key] of [['Kod att börja i','code'],['Data och drift','data'],['Beteenden att verifiera','checks']]){const block=el('section','detail-block');block.append(el('h3','',label));const p=el('p');p.innerHTML=c[key];block.append(p);d.append(block);}
    d.append(note('Provbeskrivningen kommer från START-HERE. Inga prov har körts av kartgeneratorn.'));
    const files=data.nodes.filter(n=>!n.test&&c.files.some(p=>n.id===p||n.id.startsWith(p+'/')));
    const tests=relatedTests(files.map(n=>n.id));
    d.append(el('h3','','Testområdets referenser till ingångarna · '+tests.length));
    pagedList(d,tests,e=>button(e.source,()=>openFile(e.source),testLabel(e.source)+' · statisk import'),8);
    d.append(el('h3','','Inventerade ingångsfiler · '+files.length));
    pagedList(d,files,n=>button(n.id,()=>openFile(n.id)),10);
    d.append(proofBox({path:'START-HERE.md',line:c.line,local:data.root+'/START-HERE.md',url:data.sourceDirty?null:'https://github.com/Jakeminator123/scoutgaming/blob/'+data.revision+'/START-HERE.md#L'+c.line,dirty:data.sourceDirty}));
  }
  function selectNode(node){
    state.selected=node.id;markSelection();
    if(state.graph.kind==='groups'){openGroup(node.id);return;}
    if(state.graph.kind==='modules'){openModule(node.id);return;}
    if(state.graph.kind==='file'){fileDetail(node.id);return;}
    const d=showDetail(node.label,'DEL I HANDGRANSKAD KEDJA',node.place);
    d.append(badge('Semantiskt samband','semantic'));
    const ins=state.graph.edges.filter(e=>e.target===node.id),outs=state.graph.edges.filter(e=>e.source===node.id);
    for(const [heading,list] of [['Konsumenter',ins],['Anropar / använder',outs]]){d.append(el('h3','',heading+' · '+list.length));for(const edge of list)d.append(button(edge.label,()=>selectEdge(edge),typeNames[edge.type]+' · '+(edge.status==='anchored'?'kodankare matchar':'behöver granskas')));}
    d.append(el('h3','','Filer i berörda kodbevis'));
    pagedList(d,node.files||[],path=>button(path,()=>openFile(path),'Visa imports, konsumenter och testreferenser'),8);
    d.append(note('Kodankaren stödjer den handskrivna tolkningen. Generatorn avgör inte anropssemantik, aktiva flaggor eller driftsstatus.'));
  }
  function selectEdge(edge){
    state.selected=edge.id;markSelection();
    const from=state.graph.nodes.find(n=>n.id===edge.source),to=state.graph.nodes.find(n=>n.id===edge.target);
    const d=showDetail(from.label+' → '+to.label,'RIKTAD RELATION',edge.explanation||edge.label);
    d.append(badge(typeNames[edge.type]||edge.kind),badge(edge.level==='semantic'?'Handgranskad tolkning':'Statisk syntaxreferens',edge.level==='semantic'?'semantic':''));
    if(edge.conditional)d.append(badge('Villkorad väg','warn'));
    if(edge.status==='needs-review')d.append(note('Minst ett kodankare saknas eller är tvetydigt. Relationen måste granskas igen.','warn'));
    else if(edge.level==='semantic')d.append(note('Kodankaren matchar entydigt i aktuell arbetskopia. Detta verifierar ankaren, inte att sambandet körs.'));
    if(edge.level==='static')d.append(note('En import visar en källkodsreferens. Typimport, dynamisk import och require visas separat; körning och bindning har inte bevisats.'));
    if(edge.evidence){d.append(el('h3','','Kodankare · '+edge.evidence.length));for(const p of edge.evidence)d.append(proofBox(p));}
    if(edge.references){d.append(el('h3','','Filreferenser · '+edge.references.length));pagedList(d,edge.references,e=>{const block=el('div','detail-block');block.append(button(e.source+' → '+e.target,()=>openFile(e.source),e.mode+' · rad '+e.line),proofBox(proofFor(e.source,e.line)));return block;},10);}
    if(edge.line){d.append(proofBox(proofFor(edge.source,edge.line)),button('Öppna konsumenten',()=>openFile(edge.source)),button('Öppna beroendet',()=>openFile(edge.target)));}
  }
  function showWelcome(){
    const d=showDetail('Läs kartan i lager','UNDERLAG / '+data.revision.slice(0,12),'Börja med produktvägen, välj ett ansvar och följ sedan en kodkedja till konkreta filer.');
    d.append(el('div','detail-block'));d.lastChild.append(el('h3','','01 · Ansvar'),el('p','','De sex områdena hämtas ur START-HERE. Här finns beslut, ingångsfiler och beteenden att verifiera.'));
    for(const [name,text] of [['02 · Samband','De handgranskade kedjorna visar HTTP, anrop, import och data. Varje kodankare återkontrolleras mot arbetskopian.'],['03 · Kodnät','Automatiska JS/TS-referenser visar konsumenter, beroenden och testfiler. Öppna en modul eller sök på filnamn.']]){const b=el('div','detail-block');b.append(el('h3','',name),el('p','',text));d.append(b);}
    d.append(note('Tal är pausat enligt ansvarstabellen. Visade talvägar beskriver kodens möjligheter, inte godkänd rumsdistribution eller läppsynk.','warn'));
    d.append(button('Se inventering och begränsningar',showLimits));
    closeDetail();
  }
  function showLimits(){
    const d=showDetail('Vad underlaget säger','INVENTERING OCH BEGRÄNSNINGAR',data.limits);
    d.append(note('Frånvaro av en kant betyder aldrig att koden är död. Testreferenser är inte testtäckning eller ett godkänt resultat.','warn'));
    for(const text of ['Git-spårade, icke ignorerade JS/TS-filer under apps, packages, services, test, tools och ops läses. .ignore, .gitignore, privata mappar och symlänkar respekteras.','Filer större än 1 MB och icke UTF-8 hoppas över. JSON-, CSS-, Python-, HTML-, SQL- och genererade resursreferenser analyseras inte som kod.','Parsern känner igen vanliga import/export-from, import() med literal och require(). Mallsträngarnas interpolationer analyseras inte. Den verifierar inte namnens bindning.','Handgranskade kodankare är exakta, entydiga radmatchningar. En matchande rad garanterar inte att den semantiska beskrivningen fortfarande är korrekt.','Utdata innehåller sökvägar och radnummer, inga godtyckliga källtextutdrag eller innehållet i olösta uttryck. Externa paket räknas, men expanderas inte.'])d.append(el('p','',text));
    const block=el('div','detail-block');block.append(el('h3','','Snapshot'),el('p','',data.revision),el('p','',data.generated),el('p','',data.stats.dirty+' inventerade kodfiler ändrade efter HEAD'+(data.sourceDirty?' · START-HERE ändrad':'')));d.append(block);
    for(const [reason,count] of Object.entries(data.stats.skipped))d.append(badge(count+' '+reason,'warn'));
    d.append(button('Öppna prov och luckor',()=>setView('coverage')));
  }
  function renderCoverage(){
    const c=$('#coverage');c.replaceChildren();
    c.append(note('Denna vy mäter referensinventeringen. Den mäter inte hur stor andel beteenden som testats, gått igenom CI eller accepterats i produkten.'));
    const grid=el('div','coverage-grid');c.append(grid);
    for(const contract of data.contracts){
      const files=data.nodes.filter(n=>!n.test&&contract.files.some(p=>n.id===p||n.id.startsWith(p+'/')));
      const referenced=files.filter(n=>relatedTests([n.id]).length);
      const card=el('article','coverage-card');card.append(el('h2','',contract.name));
      const score=el('div','score',referenced.length+' / '+files.length);score.append(el('small','','ingångsfiler med direkt referens från testområdet'));card.append(score);
      card.append(el('p','',contract.tests.length+' dokumenterade provlänkar. '+(files.length-referenced.length)+' ingångsfiler saknar sådan direkt referens. Hjälpare och fixturer ingår.'));
      card.append(button('Granska ansvar och provkrav',()=>openContract(contract)));grid.append(card);
    }
    c.append(el('h3','','Andra spårade kod- och konfigurationsfiler · '+data.otherFiles.length));
    c.append(el('p','','Sökbara till filnivå. Python, SQL, shell, CSS, JSON, HTML och konfiguration inventeras med sökväg; deras samband analyseras inte.'));
    const extensionCounts=new Map();for(const f of data.otherFiles)extensionCounts.set(f.extension,(extensionCounts.get(f.extension)||0)+1);
    for(const [extension,count] of extensionCounts)c.append(badge(count+' '+extension));
    const reasonCounts=new Map();for(const u of data.unknown)reasonCounts.set(u.reason,(reasonCounts.get(u.reason)||0)+1);
    c.append(el('h3','','Olösta referenser · '+data.unknown.length));
    for(const [reason,count] of reasonCounts)c.append(badge(count+' '+reason,'warn'));
    const table=el('table','coverage-table');table.innerHTML='<thead><tr><th>Fil</th><th>Orsak</th><th>Rad</th></tr></thead>';const body=el('tbody');table.append(body);c.append(table);
    let shown=0;const more=el('button','list-button');
    function add(){for(const u of data.unknown.slice(shown,shown+30)){const tr=el('tr'),file=el('td'),reason=el('td','',u.reason),line=el('td','',String(u.line));file.append(button(u.source,()=>openFile(u.source)));tr.append(file,reason,line);body.append(tr);}shown=Math.min(shown+30,data.unknown.length);more.textContent='Visa fler olösta referenser ('+(data.unknown.length-shown)+' kvar)';if(shown>=data.unknown.length)more.remove();}
    more.onclick=add;c.append(more);add();
    if(data.issues.length){c.append(el('h3','','Handgranskade kodankare behöver översyn'));for(const issue of data.issues)c.append(button(issue.path,()=>{state.chain=issue.graph;setView(issue.graph==='runtime'?'overview':'chains');const edge=state.graph.edges.find(e=>e.id===issue.edge);if(edge)selectEdge(edge);},issue.graph+' · '+issue.reason));}
  }
  function setGraph(graph){
    if(graph.id==='runtime'){
      const positions={studio:[0,0],web:[1,0],ingress:[2,0],neon:[0,1],engine:[1,1],director:[2,1],blob:[0,2],gateway:[2,2]};
      graph={...graph,nodes:graph.nodes.map(n=>({...n,col:positions[n.id]?.[0]??n.col,row:positions[n.id]?.[1]??n.row}))};
    }
    state.graph=graph;draw();fit();$('#graph-caption').textContent=graph.note||'';
  }
  function draw(){
    const graph=state.graph,scene=$('#scene');scene.replaceChildren();
    const size=graph.kind==='file'?{w:232,h:76,gx:312,gy:112}:graph.id==='runtime'?{w:226,h:86,gx:300,gy:135}:{w:226,h:92,gx:306,gy:145};
    const positions=new Map(graph.nodes.map(n=>[n.id,{x:28+n.col*size.gx,y:38+n.row*size.gy,w:size.w,h:size.h}]));
    graphWidth=Math.max(600,...[...positions.values()].map(p=>p.x+p.w+50));graphHeight=Math.max(420,...[...positions.values()].map(p=>p.y+p.h+78));
    if(graph.id==='runtime'){
      scene.append(svg('text',{x:28,y:14,class:'scene-label'},'PUBLIKA YTOR → SERVERBESLUT → DATA'));
    }
    const visibleEdges=graph.edges.filter(e=>state.filter==='all'||e.type===state.filter);
    for(const [index,edge] of visibleEdges.entries()){
      const a=positions.get(edge.source),b=positions.get(edge.target);if(!a||!b)continue;
      let path,lx,ly;
      if(Math.abs(a.y-b.y)<12){
        const right=b.x>a.x,ax=right?a.x+a.w:a.x,bx=right?b.x:b.x+b.w,ay=a.y+a.h/2,by=b.y+b.h/2;
        if(Math.abs(a.x-b.x)>size.gx*1.2){const arc=Math.min(a.y,b.y)-32-(index%3)*12;path=`M ${ax} ${ay} C ${ax+(right?48:-48)} ${arc}, ${bx+(right?-48:48)} ${arc}, ${bx} ${by}`;lx=(ax+bx)/2;ly=arc+12;}
        else{path=`M ${ax} ${ay} L ${bx} ${by}`;lx=(ax+bx)/2;ly=ay-9;}
      }else if(Math.abs(a.x-b.x)<10){
        const down=b.y>a.y,ay=down?a.y+a.h:a.y,by=down?b.y:b.y+b.h;
        if(Math.abs(a.y-b.y)>size.gy*1.2){const rail=a.x+a.w+28+(index%3)*12;path=`M ${a.x+a.w} ${a.y+a.h/2} C ${rail} ${a.y+a.h/2}, ${rail} ${b.y+b.h/2}, ${b.x+b.w} ${b.y+b.h/2}`;lx=rail+5;ly=(a.y+b.y+a.h)/2;}
        else{path=`M ${a.x+a.w/2} ${ay} L ${b.x+b.w/2} ${by}`;lx=a.x+a.w/2+9;ly=(ay+by)/2;}
      }else{
        const down=b.y>a.y,ax=a.x+a.w/2,bx=b.x+b.w/2,ay=down?a.y+a.h:a.y,by=down?b.y:b.y+b.h,mid=(ay+by)/2;
        path=`M ${ax} ${ay} C ${ax} ${mid}, ${bx} ${mid}, ${bx} ${by}`;lx=(ax+bx)/2;ly=mid-8;
      }
      const g=svg('g',{class:'edge-group','data-edge':edge.id,tabindex:'0',role:'button','aria-label':`${edge.source} → ${edge.target}: ${edge.label||typeNames[edge.type]}`});
      g.append(svg('path',{d:path,class:'edge-path '+(edge.level==='semantic'?'semantic':'')}),svg('path',{d:path,class:'edge-hit'}));
      if(graph.kind!=='modules'||visibleEdges.length<20){const label=shorten(edge.level==='semantic'?typeNames[edge.type]:edge.label||typeNames[edge.type],20),width=Math.max(64,label.length*6+20);g.append(svg('rect',{x:lx-width/2,y:ly-16,width,height:25,rx:5,fill:'transparent','pointer-events':'all',cursor:'pointer'}),svg('text',{x:lx,y:ly,class:'edge-label','text-anchor':'middle'},label));}
      g.onclick=event=>{event.stopPropagation();selectEdge(edge);};g.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();selectEdge(edge);}};scene.append(g);
    }
    for(const [index,n] of graph.nodes.entries()){
      const p=positions.get(n.id);const group=svg('g',{transform:`translate(${p.x},${p.y})`,class:'graph-node','data-node':n.id,tabindex:'0',role:'button','aria-label':n.label+' · '+(n.place||n.module||'')});
      group.append(svg('rect',{width:p.w,height:p.h,rx:13,class:'node-bg'}),svg('rect',{x:0,y:18,width:3,height:p.h-36,rx:1.5,fill:n.test?'#bc9df4':colors[index%colors.length]}));
      group.append(svg('circle',{cx:23,cy:26,r:9,fill:'#2b3c59'}),svg('text',{x:23,y:30,'text-anchor':'middle',class:'node-icon'},n.test?'✓':n.id==='neon'?'▤':n.id==='blob'?'◇':'↗'));
      group.append(svg('text',{x:40,y:30,class:'node-title'},shorten(n.label,24)),svg('text',{x:17,y:54,class:'node-subtitle'},shorten(n.place||n.module||'',34)));
      if(p.h>80)group.append(svg('text',{x:17,y:77,class:'node-number'},n.count!==undefined?n.count+' filer':n.id==='engine'?'Kort · sko · saldo · utfall':n.id==='director'||n.id==='gateway'||n.id==='ingress'?'Talväg · villkorad / pausad':'Välj för konsumenter och bevis'));
      const title=svg('title',{},n.label+'\n'+(n.place||n.module||n.id));group.append(title);
      group.onclick=event=>{event.stopPropagation();selectNode(n);};group.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();selectNode(n);}};scene.append(group);
    }
    if(!graph.nodes.length)scene.append(svg('text',{x:55,y:100,fill:'#a9b9d4'},'Inga relationer i detta underlag.'));
    markSelection();graphBounds=scene.getBBox();applyTransform();
  }
  function markSelection(){
    const related=state.graph?.edges.filter(e=>e.source===state.selected||e.target===state.selected)||[];
    const activeEdge=state.graph?.edges.find(e=>e.id===state.selected);
    document.querySelectorAll('[data-node]').forEach(n=>{const id=n.getAttribute('data-node');n.classList.toggle('selected',id===state.selected||Boolean(activeEdge&&(activeEdge.source===id||activeEdge.target===id)));n.classList.toggle('dimmed',Boolean(state.selected&&id!==state.selected&&!activeEdge&&!related.some(e=>e.source===id||e.target===id)));});
    document.querySelectorAll('[data-edge]').forEach(e=>{const selected=e.getAttribute('data-edge')===state.selected;e.querySelector('.edge-path').classList.toggle('selected',selected);e.querySelector('.edge-label')?.classList.toggle('selected',selected);e.classList.toggle('dimmed',Boolean(state.selected&&!selected&&!related.some(r=>r.id===e.getAttribute('data-edge'))));});
  }
  function applyTransform(){const t=state.transform;$('#scene').setAttribute('transform',`translate(${t.x},${t.y}) scale(${t.k})`);$('#zoom').value=Math.round(t.k*100)+'%';}
  function fit(){const rect=$('#canvas').getBoundingClientRect();if(!rect.width||!rect.height)return;const b=graphBounds,k=Math.max(.08,Math.min(1.25,(rect.width-46)/Math.max(1,b.width),(rect.height-70)/Math.max(1,b.height)));state.transform={k,x:(rect.width-b.width*k)/2-b.x*k,y:Math.max(14,(rect.height-65-b.height*k)/2)-b.y*k};applyTransform();}
  function zoom(factor,cx,cy){const rect=$('#canvas').getBoundingClientRect(),t=state.transform;cx??=rect.width/2;cy??=rect.height/2;const k=Math.max(.08,Math.min(3,t.k*factor)),ratio=k/t.k;t.x=cx-(cx-t.x)*ratio;t.y=cy-(cy-t.y)*ratio;t.k=k;applyTransform();}
  let drag=null;
  $('#canvas').addEventListener('pointerdown',event=>{if(event.target.closest('.graph-node,.edge-group'))return;drag={x:event.clientX,y:event.clientY};$('#canvas').setPointerCapture(event.pointerId);$('#canvas').classList.add('dragging');});
  $('#canvas').addEventListener('pointermove',event=>{if(!drag)return;state.transform.x+=event.clientX-drag.x;state.transform.y+=event.clientY-drag.y;drag={x:event.clientX,y:event.clientY};applyTransform();});
  function endDrag(){drag=null;$('#canvas').classList.remove('dragging');}
  $('#canvas').addEventListener('pointerup',endDrag);$('#canvas').addEventListener('pointercancel',endDrag);
  $('#canvas').addEventListener('wheel',event=>{event.preventDefault();const r=$('#canvas').getBoundingClientRect();zoom(Math.exp(-event.deltaY*.0015),event.clientX-r.left,event.clientY-r.top);},{passive:false});
  $('#plus').onclick=()=>zoom(1.2);$('#minus').onclick=()=>zoom(1/1.2);$('#fit').onclick=fit;
  $('#back').onclick=()=>setView('network');$('#help').onclick=showLimits;$('#home').onclick=event=>{event.preventDefault();setView('overview');};
  $('#edge-filter').onchange=event=>{state.filter=event.target.value;draw();};
  document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view));
  for(const graph of data.graphs.filter(g=>g.category==='code')){const o=el('option','',graph.title);o.value=graph.id;$('#chain').append(o);}
  $('#chain').onchange=event=>{state.chain=event.target.value;setView('chains');};
  $('#domain-count').textContent=String(data.contracts.length);
  data.contracts.forEach((c,i)=>{const b=el('button','domain');b.dataset.contract=c.id;const label=el('span');label.append(el('strong','',c.name),el('small','',c.files.length+' kodingångar · '+c.tests.length+' provlänkar'));b.append(el('span','index',String(i+1).padStart(2,'0')),label);b.onclick=()=>openContract(c);$('#domains').append(b);});
  let searchTimer;
  $('#search').addEventListener('input',event=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>search(event.target.value),100);});
  function search(value){
    const q=value.trim().toLocaleLowerCase('sv'),box=$('#search-results');box.replaceChildren();box.hidden=!q;if(!q)return;
    const contracts=data.contracts.filter(c=>c.responsibility.toLocaleLowerCase('sv').includes(q));
    for(const c of contracts)box.append(button(c.name,()=>openContract(c),'Ansvarsområde'));
    const found=[...data.nodes,...data.otherFiles].filter(n=>n.id.toLowerCase().includes(q));
    box.append(el('div','empty',found.length+' filer matchar · visar högst 60'));
    for(const n of found.slice(0,60))box.append(button(n.id,()=>{if(nodes.has(n.id))openFile(n.id);else openUnparsed(n);box.hidden=true;},n.status?'Samband ej analyserade':n.test?testLabel(n.id):'Kodfil'));
  }
  function openUnparsed(file){const d=showDetail(file.id,'INVENTERAD SÖKVÄG / '+file.extension,'Denna filtyp är med i filinventeringen. Importer, anrop och testkopplingar har inte analyserats.');d.append(badge('Samband ej analyserade','warn'),note('Frånvaro av kanter säger ingenting om användning eller provtäckning.','warn'));const a=el('a','','Öppna lokal fil');a.href=data.root+'/'+file.id.split('/').map(encodeURIComponent).join('/');a.target='_blank';a.rel='noopener';d.append(a);}
  for(const [number,label,warn] of [[data.stats.scanned,'inventerade JS/TS-filer'],[data.stats.edges,'statiska referenser'],[data.stats.semantic,'handgranskade samband'],[data.stats.unknown,'olösta referenser',true]]){const m=el('div','metric'+(warn?' warn':''));m.append(el('strong','',number.toLocaleString('sv')),el('span','',label));$('#metrics').append(m);}
  $('#status').textContent=(data.issues.length?data.issues.length+' kodankare behöver översyn · ':'')+data.generated+' · '+data.stats.tracked+' spårade filer · '+data.stats.excluded+' undantagna · '+data.stats.dirty+' ändrade kodfiler';
  new ResizeObserver(()=>fit()).observe($('#canvas-wrap'));
  document.addEventListener('keydown',event=>{if(event.key==='Escape'){closeDetail();$('#search-results').hidden=true;}});
  setView('overview');
})();
