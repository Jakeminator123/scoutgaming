import {StudioPlayer} from './player.js';
import {installLaneUI} from './lanes.js';
const $=id=>document.getElementById(id), $$=s=>[...document.querySelectorAll(s)];
const params=new URLSearchParams(location.hash.slice(1));let token=params.get('token')||sessionStorage.getItem('studio-token');
if(token){sessionStorage.setItem('studio-token',token);history.replaceState(null,'',location.pathname);}
let catalog={dealers:[],assets:[]},scene=null,player=null,saveTimer,toastTimer,lastJobs=new Set(),uploadBusy=false,laneUI=null,saveQueue=Promise.resolve();
const titles={studio:['2 / VÄLJ & SPELA','Bygg en lane. Spara passningen.','Välj dealer, rum och bord. Prova utdelningen och spara en egen lane.'],media:['1 / IMPORTERA','Lägg in material. Skapa webbkopior.','Originalen bevaras. De två medföljande dealerpaketen är redan konverterade.'],delivery:['3 / SPARA & EXPORTERA','En lane att lämna vidare.','Exportera en redigerbar kopia. Uppladdning till /control och nivå 2 tar vi senare.']};
function node(tag,text,cls){const el=document.createElement(tag);if(text!=null)el.textContent=text;if(cls)el.className=cls;return el;}
function toast(message,error=false){clearTimeout(toastTimer);const el=$('toast');el.textContent=message;el.classList.add('visible');el.style.borderColor=error?'#b76565':'';toastTimer=setTimeout(()=>el.classList.remove('visible'),error?10000:5500);}
function handle(fn){return async(...args)=>{try{return await fn(...args);}catch(e){toast(e.message||String(e),true);console.error(e);}};}
async function api(path,body){const res=await fetch('/api/'+path,{method:body===undefined?'GET':'POST',headers:{'X-Studio-Token':token||'',...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)});const json=await res.json();if(!res.ok)throw Error(json.error||'Begäran misslyckades.');return json;}
const mb=n=>(Number(n||0)/1e6).toFixed(2)+' MB';
const dealer=()=>catalog.dealers.find(d=>d.id===scene?.dealer);
function options(select,items,selected){select.replaceChildren();for(const [value,label]of items){const opt=node('option',label);opt.value=value;select.append(opt);}select.value=selected??'';}
function markChanged(kind='geometry'){
  if(kind==='geometry'||kind==='key'||kind==='media'){scene.approval={geometry:false,edges:false,phone:false,desktop:false};$$('.approval').forEach(c=>c.checked=false);}
  player.setScene(scene);updateApproval();clearTimeout(saveTimer);$('saved-status').textContent='Osparade ändringar…';saveTimer=setTimeout(()=>save().catch(e=>toast(e.message,true)),600);
}
async function save(){if(!scene)return;clearTimeout(saveTimer);const snapshot=structuredClone(scene);saveQueue=saveQueue.catch(()=>{}).then(()=>api('scene',snapshot));await saveQueue;$('saved-status').textContent='Arbetsutkast sparat lokalt · '+new Date().toLocaleTimeString('sv-SE',{hour:'2-digit',minute:'2-digit'});}
function updateApproval(){const reviewed=['geometry','edges','phone','desktop'].every(k=>scene.approval[k]===true);$('approval-label').textContent=reviewed?'MANUELLT GRANSKAD · EJ DRIFTTESTAD':'PROVSCEN · VISUELL GRANSKNING KVAR';$('approval-label').className='badge '+(reviewed?'reviewed':'amber');}
async function refresh(useSaved=false){
  const oldDealer=scene?.dealer;const data=await api('state');catalog=data;
  if(!scene||useSaved)scene=data.scene;
  if(!catalog.dealers.some(d=>d.id===scene.dealer))scene.dealer=catalog.dealers[0]?.id||null;
  bindScene();renderInventory();
  player.setScene(scene);await player.setDealer(dealer(),scene.variant);await player.setAssets(catalog.assets);
  updateExport();laneUI?.render();
}
function selectVariant(){const d=dealer();options($('variant-select'),[['active','Senaste konverterade / aktiv'],...Object.entries(d?.variants||{}).map(([id,v])=>[id,v.label+' · '+mb(v.bytes)])],scene.variant);
  const v=d?.variants[scene.variant==='active'?d.active_variant:scene.variant];const facts=$('dealer-facts');facts.replaceChildren();
  facts.append(node('strong',(d?.label||'Ingen dealer')+' / '+Object.keys(d?.clips||{}).length+' videoklipp'),node('br'),document.createTextNode('Referensplan 1080×1920 · 24 fps'),node('br'),document.createTextNode('Vald leverans '+mb(v?.bytes)));
  if(d&&!d.clips.deal_poshole)facts.append(node('p','Hålkort saknas i denna leverans.','warning'));
  if(d?.validation.errors.length)facts.append(node('p',d.validation.errors.join('\n'),'error'));
}
function bindScene(){
  scene.backgroundTransform??={mobile:{scale:1,x:0,y:0},desktop:{scale:1,x:0,y:0}};
  const rows=catalog.dealers.map(d=>[d.id,d.label+(d.id!==d.source_key?' · '+d.id.slice(-8):'')]);options($('dealer-select'),rows,scene.dealer);options($('convert-dealer'),rows,$('convert-dealer').value||scene.dealer);
  selectVariant();renderLayers();buildKeyControls();buildTransforms();buildSplit();
  $('table-mode').value=scene.tableMode||'separate';
  $('layer-mode').value=scene.layerMode;$('background-fit').value=scene.backgroundFit;$('anchors').checked=scene.anchors;$('frame-base').value=scene.frameBase??'';$('key-enabled').checked=scene.key.enabled;
  options($('inspect-select'),Object.values(dealer()?.clips||{}).map(c=>[c.id,c.id+' · '+c.frames+' rutor']),$('inspect-select').value||'deal_pos1');
  for(const role of ['matte','handmatte'])options($(role+'-select'),[['','Ingen / standard'],...catalog.assets.filter(a=>a.role===role).map(a=>[a.id,a.label])],scene[role]);
  $$('.approval').forEach(c=>c.checked=!!scene.approval[c.dataset.key]);
  updateLayout();updateMode();updateApproval();renderSeats();cueInfo();renderCoordinates();
}
function updateLayout(){for(const l of ['mobile','desktop'])$('layout-'+l).classList.toggle('active',scene.layout===l);$('stage-wrap').classList.toggle('desktop',scene.layout==='desktop');}
function updateMode(){$$('.mode').forEach(b=>b.classList.toggle('active',b.dataset.mode===scene.key.mode));}
function renderLayers(){
  const names={background:'Bakgrund',table:'Bord',cards:'Spelkort',dealer:'Dealer',foreground:'Främre bordskant',overlay:'Överlägg'};
  const roles=['background','table','cards','dealer','foreground','overlay'];const root=$('layer-list'),advanced=$('advanced-layers');root.replaceChildren();advanced.replaceChildren();
  roles.forEach((role,i)=>{const row=node('div',null,'layer-row'),head=node('label',null,'layer-heading'),check=node('input');check.type='checkbox';check.checked=scene.show[role];
    check.disabled=role==='table'&&scene.tableMode==='baked';
    check.onchange=()=>{scene.show[role]=check.checked;buildTransforms();markChanged();};head.append(node('span',String(i+1).padStart(2,'0'),'index'),check,document.createTextNode(names[role]));row.append(head);
    if(!['cards','dealer'].includes(role)){const sel=node('select');sel.setAttribute('aria-label',names[role]);options(sel,[['','Inget lager'],...catalog.assets.filter(a=>a.role===role).map(a=>[a.id,a.label])],scene[role]);
      sel.onchange=handle(async()=>{scene[role]=sel.value||null;if(scene[role]&&!(role==='table'&&scene.tableMode==='baked')){scene.show[role]=true;renderLayers();}buildTransforms();markChanged();await player.setAssets(catalog.assets);});row.append(sel);}
    else row.append(node('small',role==='cards'?'Från klippinfo.json · samma koordinatplan':(scene.layerMode==='split'?'Två maskpass · samma avkodade video':'Video + greenscreen-shader'),'muted'));
    (['background','table'].includes(role)?root:advanced).append(row);});
}
function range(container,label,value,min,max,step,change,format=v=>Number(v).toFixed(2)){
  const wrap=node('div',null,'range-control'),line=node('label',null,'range-label'),out=node('output',format(value)),input=node('input');input.type='range';input.min=min;input.max=max;input.step=step;input.value=value;input.setAttribute('aria-label',label);
  line.append(document.createTextNode(label),out);input.oninput=()=>{out.textContent=format(input.value);change(Number(input.value));};wrap.append(line,input);container.append(wrap);return input;
}
function buildKeyControls(){const c=$('key-controls');c.replaceChildren();range(c,'Grön tröskel',scene.key.threshold,0,.85,.01,v=>{scene.key.threshold=v;markChanged('key');});range(c,'Kantmjukhet',scene.key.softness,.005,.5,.005,v=>{scene.key.softness=v;markChanged('key');});range(c,'Extra spillreduktion',scene.key.despill,0,1,.02,v=>{scene.key.despill=v;markChanged('key');});}
function transform(){const target=$('transform-target').value;return target==='stage'?scene.stage[scene.layout]:target==='background'?scene.backgroundTransform[scene.layout]:scene[target+'Transform'];}
function buildTransforms(){const c=$('transform-controls');c.replaceChildren();const target=$('transform-target').value,t=transform(),group=['stage','background'].includes(target);
  const hints={stage:'Dealer, kort och separat bord följs åt. Utsnittet sparas för '+(scene.layout==='mobile'?'mobil':'desktop')+'. Kontrollera att ytterplatserna ryms.',background:'Endast rummet ändras. Sparas för '+(scene.layout==='mobile'?'mobil':'desktop')+'. Ett bord inbakat i bilden följer också med — kontrollera då passningen igen.',table:'Bordet ändras i förhållande till händer och kort. Samma passning används i båda vyerna.'};
  $('transform-hint').textContent=hints[target]||'Lagret följer spelplanets utsnitt.';
  if(target!=='stage'&&(!scene[target]||!scene.show[target])){c.append(node('p','Välj och visa lagret först.','hint'));return;}
  range(c,'Horisontellt',t.x,-1,1,.002,v=>{t.x=v;markChanged();},v=>(Number(v)*100).toFixed(1)+' %');range(c,'Vertikalt',t.y,-1,1,.002,v=>{t.y=v;markChanged();},v=>(Number(v)*100).toFixed(1)+' %');
  const key=group?'scale':'width';range(c,group?'Storlek':'Bord/lager · bredd',t[key],group?.25:.05,target==='background'?3:group?2.5:4,.005,v=>{t[key]=v;markChanged();},v=>(Number(v)*100).toFixed(1)+' %');}
function renderCoordinates(){const root=$('coordinate-info'),d=dealer(),meta=d?.metadata;root.replaceChildren();
  if(!meta?.positioner){root.append(node('p','Importera matchande klippinfo.json för kortpositioner.'));return;}
  root.append(node('p',`Källans referensyta: ${meta.bild}. Kort: ${meta.kort_bredd} × ${meta.kort_hojd} px. X räknas från vänster, Y uppifrån. Mittpunkter — samma plan som videon.`));
  const table=node('table'),head=node('tr');for(const text of ['Plats','X','Y'])head.append(node('th',text));table.append(head);
  for(const [seat,p]of Object.entries(meta.positioner)){const row=node('tr');for(const text of [seat==='dealer'?'Dealer / hålkort':seat,p.cx,p.cy])row.append(node('td',text));table.append(row);}root.append(table,node('p','Markeringarna visar metadata, inte ett visuellt godkännande. Kontrollera handkontakt i klippgranskningen.','hint'));
}
function buildSplit(){const c=$('split-control');c.replaceChildren();range(c,'Grov splitlinje (utan handmask)',scene.splitY,0,1,.002,v=>{scene.splitY=v;markChanged();},v=>Math.round(Number(v)*1920)+' px');}
function renderSeats(){const root=$('seat-buttons');root.replaceChildren();for(const [target,label]of [...Array.from({length:7},(_,i)=>[String(i+1),String(i+1)]),['dealer','D'],['hole','↓']]){
  const b=node('button',label);b.title=target==='hole'?'Hålkort – svart baksida':target==='dealer'?'Dela till dealern':'Dela till spelare '+target;b.disabled=!dealer()?.clips['deal_pos'+target];b.onclick=handle(()=>deal(target));root.append(b);}}
function demoCard(){return {r:$('demo-rank').value,s:$('demo-suit').value,demo:true};}
function deal(target){player.enqueueDeal(target,demoCard(),$('return-idle').checked);}
function cueInfo(){const c=dealer()?.clips[$('inspect-select').value];$('cue-info').textContent=c?`${c.frames} rutor · ${c.start} → ${c.end}. Källans stillaläge: ${c.land_frame_source??'ej angivet'}. ${scene.frameBase===null?'Rutkonvention inte bekräftad.':scene.frameBase+'-baserat index valt.'} Valör visas fortfarande först efter klippslut.`:'Inget klipp valt.';}
function status(s){$('playback-state').textContent=(s.inspection?'GRANSKNING':s.state)+(s.clip?' · '+s.clip:' · stillbild')+(s.queue?' · kö '+s.queue:'');$('frame-status').textContent=(s.clip?`${s.frame+1}/${s.frames} rutor · `:'')+s.dropped+' tappade · '+s.renderer;$('pause').textContent=s.paused?'Fortsätt':'Pausa';if(s.frames){$('frame-slider').max=s.frames-1;$('frame-slider').value=s.frame;}}
function updateExport(){const d=dealer(),v=d?.variants[scene.variant==='active'?d.active_variant:scene.variant];$('export-summary').textContent=`${d?.label||'Ingen dealer'} · ${v?.label||'Ingen variant'} · ${mb(v?.bytes)}\nMobil 1080×1920 / desktop 1920×1080. Samma portrait-spelplan centreras utan att sträckas.\nBord/lager: ${catalog.assets.find(a=>a.id===scene.table)?.label||'inget bord'}`;}
function renderInventory(){const root=$('inventory');root.replaceChildren();for(const d of catalog.dealers){const card=node('article',null,'inventory-card'),left=node('div'),right=node('div');left.append(node('div',d.label,'inventory-title'),node('div',d.id,'muted'),node('p',Object.keys(d.clips).length+' klipp · 24 fps · oförändrad källkopia'));
    for(const w of [...d.validation.errors,...d.warnings])left.append(node('p',w,'warning'));
    if(d.validation.missing_clips.length)left.append(node('p','Delmängd: '+d.validation.missing_clips.join(', ')+' saknas. Det är tillåtet för prov, men inte komplett leverans.','warning'));
    for(const [id,v]of Object.entries(d.variants)){const row=node('div',null,'variant-row'),info=node('div');info.append(node('strong',v.label),node('br'),node('small',mb(v.bytes)+(id!=='source'?' · '+(100*(1-v.bytes/d.variants.source.bytes)).toFixed(1)+' % mindre än källpaketet':'')));row.append(info);
      if(v.report){const a=node('a','Rapport');a.href='/media/'+v.report;a.target='_blank';a.rel='noopener';row.append(a);}right.append(row);}
    card.append(left,right);root.append(card);}
  if(!catalog.dealers.length)root.append(node('p','Importera ett dealerpaket för att börja.'));
}
async function pollJobs(){try{const jobs=await api('jobs'),root=$('jobs');if(!jobs.length){root.replaceChildren(node('p','Inga nya jobb i den här sessionen. Färdiga varianter och rapporter finns i biblioteket.','muted'));return;}
  root.replaceChildren();let changed=false;
  for(const j of [...jobs].reverse()){const box=node('div',null,'job'),head=node('header');head.append(node('strong',j.label),node('span',({queued:'I kö',running:'Arbetar',done:'Klart',error:'Fel',cancelled:'Avbrutet'})[j.status]));box.append(head,node('p',j.message,j.status==='error'?'error':null));
    const progress=node('progress');progress.max=1;progress.value=j.progress;box.append(progress);
    if(['queued','running'].includes(j.status)){const b=node('button','Avbryt','linkbutton');b.onclick=handle(()=>api('cancel',{job:j.id}));box.append(b);}
    if(j.result?.report){const report=j.result.report;box.append(node('div',mb(report.source_bytes)+' → '+mb(report.output_bytes)+' · '+report.reduction_percent+' % mindre · '+report.records.length+' videoklipp kontrollerade','result'));}
    if(j.result?.zip){const a=node('a','Hämta webbpaket (.zip)');a.href='/media/'+j.result.zip;box.append(a);const view=node('a','Öppna exporterad spelare');view.href='/media/'+j.result.viewer;view.target='_blank';view.rel='noopener';view.style.marginLeft='18px';box.append(view);$('export-result').replaceChildren(box.cloneNode(true));}
    root.append(box);
    if(['done','error','cancelled'].includes(j.status)&&!lastJobs.has(j.id)){lastJobs.add(j.id);if(j.status==='done'){changed=true;toast(j.label+' är klar.');}else toast(j.message,true);}
  }
  if(changed)await refresh();
}catch(e){console.warn(e.message);}}
async function upload(file,purpose,params={}){if(!file)return;if(uploadBusy)throw Error('En filöverföring pågår redan.');uploadBusy=true;
  const query=new URLSearchParams({purpose,...params});const progress=node('progress');progress.max=1;$('upload-progress').replaceChildren(progress);
  try{return await new Promise((resolve,reject)=>{const xhr=new XMLHttpRequest();xhr.open('POST','/api/upload?'+query);xhr.setRequestHeader('X-Studio-Token',token||'');xhr.setRequestHeader('X-File-Name',encodeURIComponent(file.name));xhr.setRequestHeader('Content-Type','application/octet-stream');xhr.upload.onprogress=e=>{if(e.lengthComputable)progress.value=e.loaded/e.total;};xhr.onload=()=>{let result;try{result=JSON.parse(xhr.responseText);}catch{reject(Error('Servern returnerade ett ogiltigt svar.'));return;}xhr.status<300?resolve(result):reject(Error(result.error||'Importen misslyckades.'));};xhr.onerror=()=>reject(Error('Kunde inte nå den lokala servern.'));xhr.send(file);});}finally{uploadBusy=false;progress.value=1;}}
async function loadDoc(name){
  const d=await api('docs?name='+encodeURIComponent(name)),root=$('doc-content');root.replaceChildren();let table=null;
  for(const line of d.text.split('\n')){
    if(line.startsWith('|')){
      const cells=line.split('|').slice(1,-1).map(s=>s.trim().replaceAll('`',''));
      if(cells.every(s=>/^[-: ]+$/.test(s)))continue;
      const first=!table;if(first){table=node('table');root.append(table);}
      const row=node('tr');for(const cell of cells)row.append(node(first?'th':'td',cell));table.append(row);
    }else{table=null;if(!line.trim())continue;const heading=line.match(/^(#{1,3}) (.*)/);root.append(node(heading?'h3':'p',heading?heading[2]:line.replaceAll('`','')));}
  }
}
function tab(name){$$('.tab').forEach(el=>el.classList.toggle('active',el.id===name));$$('.nav').forEach(el=>el.classList.toggle('active',el.dataset.tab===name));const [e,t,s]=titles[name];$('eyebrow').textContent=e;$('page-title').textContent=t;$('page-subtitle').textContent=s;if(name==='delivery'){updateExport();loadDoc('FORMATLASNING.md').catch(e=>toast(e.message,true));}if(name==='media')pollJobs();}
async function init(){
  if(!token)throw Error('Starta med STARTA.cmd. Sessionen saknas i denna webbläsarflik.');
  player=new StudioPlayer($('stage'),{onStatus:status,onError:m=>toast(m,true)});window.studioDebug={get player(){return player;},get scene(){return scene;},get catalog(){return catalog;}};
  await refresh(true);await loadDoc('FORMATLASNING.md');tab('studio');
  laneUI=installLaneUI({getScene:()=>scene,getCatalog:()=>catalog,api,save,refresh,upload,handle,toast,setScene:async value=>{clearTimeout(saveTimer);await saveQueue.catch(()=>{});player.stop();scene=value;await refresh();}});laneUI.render();
  $('table-mode').onchange=()=>{scene.tableMode=$('table-mode').value;scene.show.table=scene.tableMode==='separate';renderLayers();markChanged();};
  $$('.nav').forEach(b=>b.onclick=()=>tab(b.dataset.tab));$$('.doc').forEach(b=>b.onclick=handle(async()=>{$$('.doc').forEach(x=>x.classList.toggle('active',x===b));await loadDoc(b.dataset.doc);}));
  $('dealer-select').onchange=handle(async()=>{scene.dealer=$('dealer-select').value;scene.variant='active';markChanged('media');bindScene();await player.setDealer(dealer(),scene.variant);updateExport();});
  $('variant-select').onchange=handle(async()=>{scene.variant=$('variant-select').value;markChanged('media');await player.setDealer(dealer(),scene.variant);selectVariant();updateExport();});
  for(const layout of ['mobile','desktop'])$('layout-'+layout).onclick=()=>{scene.layout=layout;markChanged('view');updateLayout();buildTransforms();};
  $$('.mode').forEach(b=>b.onclick=()=>{scene.key.mode=b.dataset.mode;markChanged('view');updateMode();});
  $('key-enabled').onchange=()=>{scene.key.enabled=$('key-enabled').checked;markChanged('key');};
  $('layer-mode').onchange=()=>{scene.layerMode=$('layer-mode').value;renderLayers();markChanged();};
  $('background-fit').onchange=()=>{scene.backgroundFit=$('background-fit').value;markChanged();};
  $('reset-background').onclick=()=>{scene.backgroundTransform[scene.layout]={scale:1,x:0,y:0};buildTransforms();markChanged();};
  $('anchors').onchange=()=>{scene.anchors=$('anchors').checked;markChanged('view');};$('transform-target').onchange=buildTransforms;
  for(const role of ['matte','handmatte'])$(role+'-select').onchange=handle(async()=>{scene[role]=$(role+'-select').value||null;markChanged();await player.setAssets(catalog.assets);});
  $('pose-idle').onclick=()=>player.enqueueState('idle');$('pose-ready').onclick=()=>player.enqueueState('ready');$('stop').onclick=()=>player.stop();$('pause').onclick=handle(async()=>{player.paused?await player.resume():player.pause();});
  $('all-seats').onclick=handle(()=>{for(const target of ['7','6','5','4','3','2','1','dealer'])if(dealer()?.clips['deal_pos'+target])player.enqueueDeal(target,demoCard(),false);player.enqueueState('idle');});
  $('clear-cards').onclick=()=>player.clearCards();$('inspect-select').onchange=cueInfo;
  $('inspect').onclick=handle(async()=>{await player.inspect($('inspect-select').value);cueInfo();});
  $('frame-slider').oninput=handle(()=>player.seekFrame(Number($('frame-slider').value)));
  $('frame-prev').onclick=handle(()=>player.seekFrame(player.frame-1));$('frame-next').onclick=handle(()=>player.seekFrame(player.frame+1));
  $('frame-base').onchange=()=>{scene.frameBase=$('frame-base').value===''?null:Number($('frame-base').value);markChanged('media');cueInfo();};
  $('fullscreen').onclick=handle(()=>document.fullscreenElement?document.exitFullscreen():$('stage-wrap').requestFullscreen());
  $('snapshot').onclick=handle(()=>{player.render();$('stage').toBlob(blob=>{const url=URL.createObjectURL(blob),a=node('a');a.href=url;a.download='croupier-'+scene.layout+'-'+Date.now()+'.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);});});
  $('save').onclick=handle(async()=>{await save();toast('Scenen är sparad lokalt.');});
  $('reset-scene').onclick=handle(async()=>{if(!confirm('Återställ scenens placering och lager? Originalen och konverteringarna behålls.'))return;player.stop();scene=await api('reset-scene',{});await refresh();});
  $('add-layer').onclick=()=>$('asset-dialog').showModal();$('close-dialog').onclick=()=>$('asset-dialog').close();$('pick-asset').onclick=()=>$('asset-input').click();
  $('asset-input').onchange=handle(async()=>{const role=$('asset-role').value,result=await upload($('asset-input').files[0],'asset',{role});if(!result)return;scene[role]=result.asset.id;if(role in scene.show&&!(role==='table'&&scene.tableMode==='baked'))scene.show[role]=true;markChanged();$('asset-dialog').close();$('asset-input').value='';await save();await refresh();toast('Lagret är importerat. Passa in och granska det mot klippen.');});
  $('import-dealer').onclick=()=>$('zip-input').click();$('zip-input').onchange=handle(async()=>{await upload($('zip-input').files[0],'dealer');$('zip-input').value='';toast('Paketet läses in. Följ jobbet nedan.');await pollJobs();});
  const drop=$('drop-zone');drop.ondragover=e=>{e.preventDefault();drop.classList.add('over');};drop.ondragleave=()=>drop.classList.remove('over');drop.ondrop=handle(async e=>{e.preventDefault();drop.classList.remove('over');const file=e.dataTransfer.files[0];if(file&&!file.name.toLowerCase().endsWith('.zip'))throw Error('Dra in en ZIP med dealerpaketet.');await upload(file,'dealer');await pollJobs();});
  $('convert').onclick=handle(async()=>{await api('convert',{dealer:$('convert-dealer').value,preset:$('convert-preset').value,detailed:$('detailed-qc').checked});toast('Konverteringen har startat. Originalen bevaras.');await pollJobs();});
  $('attach-meta').onclick=()=>$('metadata-input').click();$('metadata-input').onchange=handle(async()=>{await upload($('metadata-input').files[0],'metadata',{dealer:$('convert-dealer').value});$('metadata-input').value='';await refresh();toast('Metadata är matchad mot klippens bildruteantal.');});
  $('refresh-library').onclick=handle(()=>refresh());
  $$('.approval').forEach(c=>c.onchange=()=>{scene.approval[c.dataset.key]=c.checked;markChanged('approval');});
  for(const [id,approved]of [['export-preview',false],['export-reviewed',true]])$(id).onclick=handle(async()=>{await save();await api('export',{scene,approved});toast('Webbpaketet skapas. En länk visas här när det är klart.');await pollJobs();});
  $('open-exports').onclick=handle(async()=>{const r=await api('open-exports',{});toast(r.path);});
  $('shutdown').onclick=handle(async()=>{if(confirm('Avsluta den lokala servern? Pågående konverteringar avbryts; originalen behålls.')){await save();await api('shutdown',{});player.stop();toast('Studio är avslutat. Den här fliken kan stängas.');}});
  let drag=null;const canvas=$('stage');canvas.onpointerdown=e=>{if(!$('drag-enabled').checked)return;const t=transform();drag={x:e.clientX,y:e.clientY,tx:t.x,ty:t.y,t};canvas.setPointerCapture(e.pointerId);};
  canvas.onpointermove=e=>{if(!drag)return;const box=canvas.getBoundingClientRect(),g=player.compositor.geometry(scene),group=['stage','background'].includes($('transform-target').value);
    const dx=(e.clientX-drag.x)/box.width,dy=(e.clientY-drag.y)/box.height;
    drag.t.x=Math.max(-2,Math.min(2,drag.tx+dx*(group?1:g.dims[0]/(1080*g.s))));drag.t.y=Math.max(-2,Math.min(2,drag.ty+dy*(group?1:g.dims[1]/(1920*g.s))));player.render();buildTransforms();};
  canvas.onpointerup=()=>{if(drag){drag=null;markChanged();}};canvas.onpointercancel=()=>{drag=null;};
  document.addEventListener('keydown',e=>{if(/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)||$('asset-dialog').open)return;
    if(/^F[1-8]$/.test(e.key)){e.preventDefault();handle(()=>deal(e.key==='F8'?'dealer':e.key.slice(1)))();}
    if(e.key==='Escape')player.stop();});
  setInterval(pollJobs,2000);pollJobs();
}
init().catch(e=>toast(e.message,true));
