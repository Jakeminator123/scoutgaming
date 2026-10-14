import {applyImportProposals,importContentType,importFileError,importClassification,importRowError,planImportFiles} from './dealer-import.mjs';
import {uploadNativeVideo} from '../../../../lab/lib/upload-native-video.mjs';
import {uploadMediaBatch} from '../../../../lab/lib/media-upload-batch.mjs';

async function nativeRequest(path,options={}) {
  const response=await fetch(path,{...options,credentials:'same-origin',cache:'no-store',redirect:'error',headers:{accept:'application/json',...(options.body?{'content-type':'application/json'}:{})}});
  const result=await response.json();
  if(!response.ok)throw Error([401,403].includes(response.status)?'Logga in som nivå 1 igen.':result.error||'Importen kunde inte slutföras.');
  return result;
}
export async function prepareChatImport({files,dealerId,context,background},{request,id=()=>crypto.randomUUID()}) {
  const catalog=await request('/api/dealers/import-proposal');
  if(!catalog.dealers.some(row=>row.id===dealerId))throw Error('Välj en registrerad dealer.');
  if(!files.length||files.length>Math.min(catalog.limits.maxFiles,30))throw Error('Välj 1–30 filer.');
  if(planImportFiles(files,[],30).duplicates)throw Error('Samma fil finns flera gånger. Ta bort dubbletten ur listan.');
  const rows=files.map(file=>{
    const error=importFileError(file,catalog.limits.maxFileBytes);
    if(error)throw Error(`${file.name}: ${error}`);
    return {id:id(),file,label:file.name.replace(/\.[^.]+$/,'').slice(0,120),slotId:'',background,state:'ready'};
  });
  const reply=await request('/api/dealers/import-proposal',{method:'POST',body:JSON.stringify({intent:'mapping',dealerId,context,
    files:rows.map(row=>({id:row.id,name:row.file.name,size:row.file.size,type:importContentType(row.file.name)}))})});
  if(reply.dealerId!==dealerId||reply.intent!=='mapping'||!Array.isArray(reply.rows))throw Error('Sorteringssvaret kunde inte verifieras.');
  // Low-confidence proposals stay unassigned. User corrections choose exact
  // catalogue slots; model prose and file contents never grant upload rights.
  const mapped=applyImportProposals(rows,reply.rows.map(row=>({...row,slotId:row.confidence==='low'?null:row.slotId})),catalog.slots);
  return {rows:mapped,catalog,dealerId};
}
export async function saveChatImport(batch,{request,upload=uploadNativeVideo,onChange=()=>{},runBatch=uploadMediaBatch,signal}) {
  const {rows,catalog,dealerId}=batch;
  const errors=rows.map(row=>({row,message:importRowError(row,dealerId,catalog)})).filter(row=>row.message);
  if(errors.length)throw Error(`${errors[0].row.file.name}: ${errors[0].message}`);
  const fresh=await request('/api/dealers/import-proposal');
  const prepared=rows.filter(row=>row.state==='ready').map(row=>({row,classification:importClassification(row,dealerId,fresh)}));
  if(!prepared.length)return 0;
  if(prepared.some(({row,classification})=>JSON.stringify(classification)!==JSON.stringify(importClassification(row,dealerId,catalog))))throw Error('Fackens betydelse har ändrats. Sortera på nytt.');
  const capability=await request('/api/videos');
  if(capability.uploadMode!=='private-client-blob')throw Error('Privat medielagring är inte ansluten.');
  return runBatch(prepared,{signal,onChange:(id,patch)=>{Object.assign(rows.find(row=>row.id===id),patch);onChange(id,patch);},
    upload:(file,classification,progress)=>upload(file,classification,importContentType(file.name),{signal,onUploadProgress:progress})});
}

// Installed only by the authenticated N1 widget. Server readers, grants and
// upload verification recheck the session; the model never calls these writers.
export function installChatImport({root,form,input,send,source,isAdmin,authorize,working,status,add}) {
  const box=document.createElement('section');box.className='file-import';box.hidden=true;
  box.innerHTML='<p>Dra upp till 30 filmer hit eller <button type="button" class="pick">Välj filer</button></p><input type="file" hidden multiple accept=".mp4,.webm"><label>Dealer<select class="dealer"><option value="">Välj dealer…</option></select></label><label>Filmernas bakgrund<select class="background"><option value="green-screen">Grön bakgrund</option><option value="alpha">Transparent bakgrund</option></select></label><div class="file-list"></div><p class="file-note">Skicka sorterar och sparar klippen i klippbanken. Oklara fack visas här för rättning. Publicering görs separat.</p>';
  form.prepend(box);
  const fileInput=box.querySelector('input'),dealer=box.querySelector('.dealer'),background=box.querySelector('.background'),list=box.querySelector('.file-list');
  const base=new URL(source).pathname.replace(/assistant-widget\.js$/,'');
  let files=[],batch=null,busy=false,loaded=false,controller=null,refreshing=null;
  const request=(path,options)=>nativeRequest(base+path.replace(/^\/api\//,'api/'),{...options,signal:controller?.signal});
  const updateSend=()=>{send.textContent=files.length?'Sortera och placera':'Skicka';};
  function render(){
    list.replaceChildren();
    for(const file of files){
      const row=batch?.rows.find(row=>row.file===file),line=document.createElement('div'),label=document.createElement('span');
      label.textContent=file.name;line.append(label);
      if(row){
        const slot=document.createElement('select');slot.setAttribute('aria-label','Fack för '+file.name);slot.disabled=busy||row.state!=='ready';
        for(const item of [{id:'',label:'Välj fack…'},...batch.catalog.slots.filter(item=>!item.pose)]){const option=document.createElement('option');option.value=item.id;option.textContent=item.label;slot.append(option);}
        slot.value=row.slotId;slot.addEventListener('change',()=>{row.slotId=slot.value;render();});line.append(slot);
        const note=document.createElement('small');note.textContent=row.state==='saved'?'Sparad':row.state==='saving'?`Laddar upp ${row.progress??0} %`:importRowError(row,batch.dealerId,batch.catalog)||'Klar att placera';line.append(note);
      }
      const remove=document.createElement('button');remove.type='button';remove.textContent='Ta bort ur listan';remove.disabled=busy;remove.addEventListener('click',()=>{files=files.filter(item=>item!==file);if(batch)batch.rows=batch.rows.filter(row=>row.file!==file);render();});line.append(remove);list.append(line);
    }
    updateSend();
  }
  function attach(selected){
    if(busy||!isAdmin())return;
    try{const planned=planImportFiles(Array.from(selected),files.map(file=>({file,state:'ready'})),30);files=[...files,...planned.files];batch=null;render();status(`${files.length} filmer valda. Välj dealer och skriv vad som ska placeras.`);}
    catch(error){status(error.message);}
  }
  box.querySelector('.pick').addEventListener('click',()=>fileInput.click());
  fileInput.addEventListener('change',()=>{attach(fileInput.files);fileInput.value='';});
  const panel=root.querySelector('.panel');
  panel.addEventListener('dragover',event=>{if(isAdmin()&&event.dataTransfer.types.includes('Files'))event.preventDefault();});
  panel.addEventListener('drop',event=>{if(isAdmin()&&event.dataTransfer.files.length){event.preventDefault();attach(event.dataTransfer.files);}});
  dealer.addEventListener('change',()=>{batch=null;render();});
  background.addEventListener('change',()=>{if(batch)batch.rows.forEach(row=>{if(row.state==='ready')row.background=background.value;});render();});
  form.addEventListener('submit',async event=>{
    if(!files.length||!isAdmin())return;
    event.preventDefault();event.stopImmediatePropagation();if(busy)return;
    if(!dealer.value){status('Välj vilken dealer filmerna hör till.');dealer.focus();return;}
    busy=true;controller=new AbortController();working(true);dealer.disabled=true;background.disabled=true;box.querySelector('.pick').disabled=true;
    try{
      if(!await authorize()||!isAdmin())throw Error('Sessionen ändrades. Välj filerna igen.');
      if(!batch){add('user',input.value.trim()||`Placera ${files.length} filmer hos ${dealer.selectedOptions[0].textContent}.`);status('Sorterar filmerna…');batch=await prepareChatImport({files,dealerId:dealer.value,context:input.value.slice(0,4000),background:background.value},{request});}
      if(batch.rows.some(row=>importRowError(row,batch.dealerId,batch.catalog))){status('Några filer behöver rättas i listan. Dina övriga placeringar finns kvar.');return;}
      status('Placerar filmerna…');
      const count=await saveChatImport(batch,{request,signal:controller.signal,onChange:()=>render()});
      add('assistant',`${count} filmer sparades i ${dealer.selectedOptions[0].textContent}s klippbank.`);input.value='';
      files=files.filter(file=>batch.rows.find(row=>row.file===file)?.state!=='saved');batch.rows=batch.rows.filter(row=>row.state!=='saved');
      if(!files.length)batch=null;
      status(files.length?'Kontrollera filerna med fel. Inga automatiska återförsök görs.':'Klart. Dra in nästa omgång när du vill.');
    }catch(error){status(error.message+' Inget automatiskt återförsök görs.');}
    finally{busy=false;controller=null;working(false);dealer.disabled=false;background.disabled=false;box.querySelector('.pick').disabled=false;render();}
  },true);
  const reset=()=>{controller?.abort();files=[];batch=null;loaded=false;dealer.replaceChildren(new Option('Välj dealer…',''));render();};
  window.addEventListener('beforeunload',event=>{if(files.length||busy){event.preventDefault();event.returnValue='';}});
  window.addEventListener('pagehide',()=>controller?.abort());
  return {reset,async refresh(force=false){
    box.hidden=!isAdmin();if(box.hidden||busy||loaded&&!force)return;
    if(refreshing)return refreshing;
    refreshing=(async()=>{try{const catalog=await request('/api/dealers/import-proposal');if(!isAdmin())return;
      const requested=dealer.value||new URL(location.href).searchParams.get('dealer');
      dealer.replaceChildren(new Option('Välj dealer…',''));
      for(const row of catalog.dealers){const option=document.createElement('option');option.value=row.id;option.textContent=row.label;dealer.append(option);}
      if(catalog.dealers.some(row=>row.id===requested))dealer.value=requested;loaded=true;
    }catch(error){status(error.message);}finally{refreshing=null;}})();
    return refreshing;
  }};
}
