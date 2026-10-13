import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowUpRight, Check, FileVideo, MessageCircle, RefreshCw, ShieldCheck, Upload, X } from 'lucide-react';
import { uploadNativeVideo } from '../../../../../lab/lib/upload-native-video.mjs';
import { uploadMediaBatch } from '../../../../../lab/lib/media-upload-batch.mjs';
import { labUrl, appendAssistantHistory, applyImportProposals, compatibleImportSlot, importBatchError, importClassification, importContentType, importErrorMessage, importFileError, uniqueImportFiles,
  type AssistantHistoryEntry, type ImportCatalog, type ImportProposal, type ImportRow, type ImportIntent, type ImportModel } from '../../lib/dealer-import.mjs';

type Answer = {dealerId:string|null;intent:ImportIntent;selectedModel:ImportModel;source:'ai'|'filename-rules'|'unavailable';assistantMessage:string;rows:ImportProposal[];warnings:string[]};
type ChatEntry = {speaker:'Du'|'Assistent';text:string};
async function jsonRequest<T>(path:string, options:RequestInit = {}):Promise<T> {
  const response = await fetch(labUrl(path), {...options, credentials:'same-origin', cache:'no-store', redirect:'error',
    headers:{accept:'application/json', ...(options.body ? {'Content-Type':'application/json'} : {}), ...options.headers}});
  let value;
  try { value = await response.json(); } catch { throw Error('Studio gav inget giltigt svar. Kontrollera din inloggning.'); }
  if (!response.ok) throw Error([401,403].includes(response.status) ? 'Din interna session behöver förnyas. Öppna administrationen igen.' : value.error || 'Studio kunde inte slutföra begäran.');
  return value;
}
function validateCatalog(value:ImportCatalog) {
  if (!value || !Array.isArray(value.dealers) || !Array.isArray(value.slots) || !value.limits
    || !Number.isInteger(value.limits.maxFiles) || value.limits.maxFiles < 1 || value.limits.maxFiles > 10
    || !Number.isInteger(value.limits.maxFileBytes) || value.limits.maxFileBytes > 134217728) throw Error('Studios importkatalog kunde inte verifieras.');
  return value;
}
function LocalPreview({file}:{file:File}) {
  const [url,setUrl] = useState('');
  const [failure,setFailure] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {const next = URL.createObjectURL(file); setUrl(next); return () => URL.revokeObjectURL(next);}, [file]);
  const type = importContentType(file.name);
  function seek(end:boolean) {if (video.current && Number.isFinite(video.current.duration)) {video.current.pause(); video.current.currentTime = end ? Math.max(0,video.current.duration-.05) : 0;}}
  return <div className="dealer-import-preview">
    {url && (type.startsWith('image/') ? <img src={url} alt={`Lokal referens: ${file.name}`} onError={()=>setFailure(true)}/>
      : type.startsWith('audio/') ? <audio src={url} controls preload="metadata" onError={()=>setFailure(true)}/>
      : <><video ref={video} src={url} controls playsInline preload="metadata" onError={()=>setFailure(true)}/>
        <div className="dealer-import-actions"><button type="button" onClick={()=>seek(false)}>Början</button><button type="button" onClick={()=>seek(true)}>Slutet</button></div></>)}
    {failure && <p role="alert">Webbläsaren kan inte visa den här filen. Granska originalet innan du godkänner.</p>}
    <p>Förhandsvisningen stannar på din dator. Assistenten läser filnamn och din kontext, inte bildrutorna.</p>
  </div>;
}

export function DealerImportAssistant({active=true,mode='import',onBusyChange}:{active?:boolean;mode?:'chat'|'import';onBusyChange?:(busy:boolean)=>void}) {
  const [catalog,setCatalog] = useState<ImportCatalog|null>(null), [loadCount,setLoadCount] = useState(0);
  const [loading,setLoading] = useState(true), [error,setError] = useState(''), [notice,setNotice] = useState('');
  const [dealerId,setDealerId] = useState(''), [dealerApproved,setDealerApproved] = useState(false);
  const [rows,setRows] = useState<ImportRow[]>([]), [context,setContext] = useState(''), [question,setQuestion] = useState('');
  const [chat,setChat] = useState<ChatEntry[]>([]), [busy,setBusy] = useState<ImportIntent|'upload'|null>(null);
  const [history,setHistory] = useState<AssistantHistoryEntry[]>([]);
  const [review,setReview] = useState(false), [approved,setApproved] = useState(false);
  const busyRef = useRef(false), controller = useRef<AbortController|null>(null), input = useRef<HTMLInputElement>(null);
  const pending = rows.some(row => row.state !== 'saved');
  const dealer = catalog?.dealers.find(row => row.id === dealerId);
  const uploadRows = rows.filter(row => row.state === 'ready' && !importContentType(row.file.name).startsWith('image/'));
  let reviewError = importBatchError(rows);
  try {if (!reviewError && catalog) uploadRows.forEach(row => importClassification(row,dealerId,catalog));} catch (cause) {reviewError = cause instanceof Error ? cause.message : 'Kontrollera facken.';}

  useEffect(() => {
    const abort = new AbortController(); setLoading(true); setError('');
    jsonRequest<ImportCatalog>('/api/dealers/import-proposal',{signal:abort.signal})
      .then(value=>{if(!abort.signal.aborted)setCatalog(validateCatalog(value));})
      .catch(cause=>{if(!abort.signal.aborted){setCatalog(null);setError(cause.message);}})
      .finally(()=>{if(!abort.signal.aborted)setLoading(false);});
    return ()=>abort.abort();
  },[loadCount]);
  useEffect(()=>()=>controller.current?.abort(),[]);
  useEffect(()=>{onBusyChange?.(busy!==null);},[busy,onBusyChange]);
  useEffect(() => {
    if (!pending && !busy && !question.trim() && !chat.length) return;
    let approvedClick=false;
    const leave = () => busyRef.current ? false : window.confirm('Vill du lämna Studioassistenten? Vid omladdning eller ny sida försvinner samtalet, oskickad text och den lokala fillistan.');
    const beforeUnload = (event:BeforeUnloadEvent) => {event.preventDefault();event.returnValue='';};
    const beforeNavigate = (event:Event) => {
      if(busyRef.current){event.preventDefault();return;}
      // Internal SPA routes preserve this exact session, including the map draft.
      const href=(event as CustomEvent<{href?:string}>).detail?.href;
      if(href&&/^\/admin(?:\/|\?|$)/.test(href)&&!href.startsWith('/admin/lobby'))return;
      if(approvedClick){approvedClick=false;return;}if (!leave()) event.preventDefault();
    };
    const click = (event:MouseEvent) => {
      const anchor = (event.target as Element)?.closest?.('a');
      if (!anchor || anchor.target === '_blank' || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const target = new URL(anchor.href,window.location.href);
      if(!anchor.target&&(anchor.dataset.studioNavigation==='true'||anchor.closest('.preview-admin'))&&target.origin===window.location.origin&&/^\/admin(?:\/|$)/.test(target.pathname)&&!target.pathname.startsWith('/admin/lobby')) {
        if(busyRef.current){event.preventDefault();event.stopPropagation();}return;
      }
      if (!leave()) {event.preventDefault();event.stopPropagation();}
      else if(target.origin === window.location.origin && target.pathname.startsWith('/admin/')) {approvedClick=true;setTimeout(()=>{approvedClick=false;},0);}
    };
    window.addEventListener('beforeunload',beforeUnload);
    window.addEventListener('studio:before-navigate',beforeNavigate);
    document.addEventListener('click',click,true);
    return ()=>{window.removeEventListener('beforeunload',beforeUnload);window.removeEventListener('studio:before-navigate',beforeNavigate);document.removeEventListener('click',click,true);};
  },[pending,busy,question,chat.length]);

  function invalidate() {setReview(false);setApproved(false);setNotice('');}
  function update(id:string, patch:Partial<ImportRow>, changed=true) {setRows(items=>items.map(row=>row.id === id ? {...row,...patch} : row));if(changed)invalidate();}
  function chooseDealer(value:string) {
    if (busyRef.current) return;
    if (rows.length && !window.confirm('Byta dealer? Filernas lokala mappning töms. Samtalet behålls och sparade filer finns kvar hos den tidigare dealern.')) return;
    setDealerId(value);setDealerApproved(false);setRows([]);invalidate();setError('');
  }
  function addFiles(files:FileList|null) {
    if (!files || !catalog || !dealerApproved || busyRef.current) return;
    const selected=uniqueImportFiles(Array.from(files),rows);
    if (rows.length+selected.files.length > catalog.limits.maxFiles) {setError(`Välj högst ${catalog.limits.maxFiles} filer per omgång.`);return;}
    const additions = selected.files.map(file=>{
      const invalid = importFileError(file,catalog.limits.maxFileBytes);
      return {id:crypto.randomUUID(),file,label:file.name.replace(/\.[^.]+$/,'').slice(0,120),slotId:'',background:'',
        state:invalid?'error' as const:'ready' as const,...(invalid?{message:invalid}:{})};
    });
    setRows(items=>[...items,...additions]);setError(selected.duplicates?`${selected.duplicates} filer fanns redan i listan och lades inte till igen.`:'');invalidate();if(input.current)input.current.value='';
  }
  async function ask(intent:ImportIntent,event?:FormEvent) {
    event?.preventDefault();
    if (busyRef.current || !catalog || intent==='mapping'&&(!dealer||!dealerApproved)) return;
    const message=intent==='chat'?question.trim():'';
    if (intent==='chat'?!message:!rows.some(row=>row.state==='ready')) return;
    busyRef.current=true;setBusy(intent);setError('');
    const abort=new AbortController();controller.current=abort;
    const descriptors=rows.filter(row=>row.state==='ready').map(row=>({id:row.id,name:row.file.name,size:row.file.size,type:importContentType(row.file.name)}));
    try {
      const response=await jsonRequest<Answer>('/api/dealers/import-proposal',{method:'POST',signal:abort.signal,
        body:JSON.stringify({intent,dealerId:dealerId||null,files:descriptors,context,history,...(intent==='chat'?{message}:{})})});
      if(response.dealerId!==(dealerId||null) || response.intent!==intent || !Array.isArray(response.rows) || typeof response.assistantMessage!=='string' || !response.assistantMessage.trim()) throw Error('Assistentens svar kunde inte verifieras. Dina filer och val finns kvar.');
      // The chat lane has no ability to change placements, including a malformed
      // server/model answer containing rows. Only an explicit mapping request can.
      if(intent==='mapping'){invalidate();setRows(current=>applyImportProposals(current,response.rows,catalog.slots));}
      setChat(current=>[...current,{speaker:'Du' as const,text:message||'Kartlägg mina klipp.'},
        {speaker:'Assistent' as const,text:response.assistantMessage+(response.warnings?.length?'\n\n'+response.warnings.join('\n'):'')}].slice(-12));
      if(intent==='chat'){
        if(response.source==='ai'){setHistory(current=>appendAssistantHistory(current,message,response.assistantMessage));setQuestion('');}
      }else setNotice(response.source==='ai'?'AI-förslaget är klart. Granska och rätta varje fack.':'Förslaget bygger på filnamnsregler. Granska och rätta varje fack.');
    } catch(cause) {if(!abort.signal.aborted)setError(cause instanceof Error?cause.message:'Assistenten kunde inte svara. Dina filer och val finns kvar.');}
    finally {busyRef.current=false;setBusy(null);controller.current=null;}
  }
  async function save() {
    if (busyRef.current) return;
    const batchError = importBatchError(rows);
    if (batchError) {invalidate();setError(batchError);return;}
    if (!approved || !review || !dealerApproved || !catalog || !dealer || !uploadRows.length) return;
    busyRef.current=true;setBusy('upload');setError('');setNotice('');
    const abort=new AbortController();controller.current=abort;
    try {
      const fresh=validateCatalog(await jsonRequest<ImportCatalog>('/api/dealers/import-proposal',{signal:abort.signal}));
      const prepared=uploadRows.map(row=>({row,classification:importClassification(row,dealerId,fresh)}));
      // A changed meaning of an existing slot requires a new human review.
      if (prepared.some(({row,classification})=>JSON.stringify(classification)!==JSON.stringify(importClassification(row,dealerId,catalog)))) throw Error('Fackens betydelse har ändrats. Läs om katalogen och granska på nytt.');
      const capability=await jsonRequest<{uploadMode?:string}>('/api/videos',{signal:abort.signal});
      if(capability.uploadMode!=='private-client-blob') throw Error('Importen kräver Studios anslutna privata medielagring.');
      const count=await uploadMediaBatch(prepared,{signal:abort.signal,onChange:(id,patch)=>update(id,patch,false),
        upload:(file,classification,onUploadProgress)=>uploadNativeVideo(file,classification,importContentType(file.name),{signal:abort.signal,onUploadProgress})});
      setNotice(`${count} av ${prepared.length} filer sparades hos ${dealer.label}. Sparade filer ligger i de valda facken som alternativ. Välj dem i Control för provspelning och publicering.`);
    } catch(cause) {if(!abort.signal.aborted)setError(cause instanceof Error?cause.message:'Importen kunde inte slutföras. Kontrollera biblioteket.');}
    finally {busyRef.current=false;setBusy(null);controller.current=null;setApproved(false);setReview(false);}
  }

  return <section className={`dealer-import ${mode==='chat'?'is-chat':''}`} aria-labelledby="dealer-import-title">
    <header className="dealer-import-heading"><div><p className="dealer-import-eyebrow">Studio · Registrerade dealers</p>
      <h1 id="dealer-import-title">{mode==='chat'?'Studioassistent':'Låt assistenten sortera klippen'}</h1>
      <p>{mode==='chat'?'Ställ frågor om Studio, dealers och klipp. Samma samtal följer med till bubblan och importvyn.':'Välj dealer, lägg in dina filer och beskriv dem. Granska förslaget innan du sparar i klippbanken.'}</p></div>
      <span className="dealer-import-badge"><ShieldCheck size={15}/> Du godkänner varje import</span>
    </header>
    {loading ? <p role="status">Läser registrerade dealers och exakta klippfack…</p> : !catalog ? <div className="dealer-import-panel">
      <p role="alert">{importErrorMessage(error||'Importkatalogen kunde inte läsas.')}</p><div className="dealer-import-actions"><button onClick={()=>setLoadCount(value=>value+1)}><RefreshCw size={14}/> Försök igen</button><a href="/admin">Logga in igen</a></div>
    </div> : <>
      <div className="dealer-import-layout"><div className="dealer-import-main">
        <section className="dealer-import-panel" aria-labelledby="dealer-import-dealer"><h2 id="dealer-import-dealer">{mode==='chat'?'Dealer som sammanhang · valfritt':<><span>1</span> Välj befintlig dealer</>}</h2>
          <label>Dealer i registret<select value={dealerId} disabled={Boolean(busy)} onChange={event=>chooseDealer(event.target.value)}>
            <option value="">{mode==='chat'?'Allmän fråga · ingen dealer':'Välj en dealer…'}</option>{catalog.dealers.map(row=><option key={row.id} value={row.id}>{row.label} · {row.id}</option>)}
          </select></label>
          {!catalog.dealers.length && <p>Inga aktiva dealers finns i registret. Skapa en dealer i <a href="/control/clips">Control</a> först.</p>}
          {dealer && <label className="dealer-import-check" hidden={mode==='chat'}><input type="checkbox" checked={dealerApproved} disabled={Boolean(busy)} onChange={event=>{setDealerApproved(event.target.checked);invalidate();}}/>
            <span>Jag bekräftar att filerna hör till den befintliga dealern <strong>{dealer.label}</strong> ({dealer.id}).</span></label>}
        </section>
        <section className="dealer-import-panel" aria-labelledby="dealer-import-files" hidden={mode==='chat'}><h2 id="dealer-import-files"><span>2</span> Filer och sammanhang</h2>
          <div className="dealer-import-drop" onDragOver={event=>event.preventDefault()} onDrop={event=>{event.preventDefault();addFiles(event.dataTransfer.files);}}>
            <Upload size={24}/><strong>Upp till {catalog.limits.maxFiles} filer i samma omgång</strong>
            <p>MP4, WebM, MP3, WAV eller referensbilder · max 128 MB per fil</p>
            <label className="dealer-import-file-button">Välj filer<input ref={input} type="file" multiple accept=".mp4,.webm,.mp3,.wav,.png,.jpg,.jpeg,.webp" disabled={!dealerApproved||Boolean(busy)} onChange={event=>addFiles(event.target.files)}/></label>
          </div>
          <label>Din kontext<textarea value={context} maxLength={4000} rows={3} disabled={Boolean(busy)} placeholder="Exempel: Vänster arm mot skon. Box 1–7 är spelarplatser från vänster. Filen redo.png är posen vid skon. Materialet är 1080 × 1920 med grön bakgrund." onChange={event=>{setContext(event.target.value);invalidate();}}/></label>
          <p className="dealer-import-help">Filnamn och kontext kan skickas till den konfigurerade textmodellen när du ber om ett förslag. Endast MP4 och WebM kan sparas just nu, efter ditt godkännande. Ljud och posebilder kan granskas lokalt och få fack, men måste tas bort ur denna import innan videorna kan sparas. Originalfilerna på din dator påverkas inte.</p>
          <p className="dealer-import-help">{catalog.provider.configured?'Kartläggning: Sol 5.6 · High.':'AI-kartläggning är inte ansluten; filnamnsregler används.'}</p>
          <button className="dealer-import-primary" disabled={!dealerApproved||Boolean(busy)||!rows.some(row=>row.state==='ready')} onClick={()=>void ask('mapping')}><MessageCircle size={16}/>{busy==='mapping'?'Kartlägger klippen…':'Kartlägg klipp'}</button>
        </section>
        {rows.length>0 && <section className="dealer-import-panel" aria-labelledby="dealer-import-mapping" hidden={mode==='chat'}><div className="dealer-import-heading"><h2 id="dealer-import-mapping"><span>3</span> Granska {rows.length} filer</h2>
          <button disabled={Boolean(busy)} onClick={()=>{if(window.confirm('Töm den lokala fillistan? Redan sparade filer finns kvar i registret.')){setRows([]);invalidate();}}}>Töm listan</button></div>
          <p className="dealer-import-help">Flera tagningar får ligga i samma fack. Plats 1 i filnamnet motsvarar box0 i registret. Kontrollera innehåll och bakgrund.</p>
          <div className="dealer-import-rows">{rows.map(row=>{
            const type=importContentType(row.file.name), image=type.startsWith('image/'), video=type.startsWith('video/');
            const slot=catalog.slots.find(item=>item.id===row.slotId), editable=row.state==='ready'&&!busy;
            return <article className={`dealer-import-row is-${row.state}`} key={row.id}>
              <div className="dealer-import-row-title"><FileVideo size={17}/><strong>{row.file.name}</strong><small>{(row.file.size/1048576).toFixed(1)} MB</small>
                <button aria-label={`Ta bort ${row.file.name} ur listan`} disabled={Boolean(busy)} onClick={()=>{setRows(current=>current.filter(item=>item.id!==row.id));invalidate();}}><X size={16}/></button></div>
              <div className="dealer-import-row-fields"><label>Namn i banken<input aria-label={`Namn för ${row.file.name}`} value={row.label} maxLength={120} disabled={!editable} onChange={event=>update(row.id,{label:event.target.value})}/></label>
                <label>Exakt fack<select aria-label={`Fack för ${row.file.name}`} value={row.slotId} disabled={!editable} onChange={event=>update(row.id,{slotId:event.target.value,reason:'Du valde det här facket.',confidence:undefined})}>
                  <option value="">Välj fack…</option>{catalog.slots.filter(item=>compatibleImportSlot(row.file,item)).map(item=><option value={item.id} key={item.id}>{item.label} · {item.id}</option>)}
                </select></label>
                {video && <label>Bakgrund<select aria-label={`Bakgrund för ${row.file.name}`} value={row.background} disabled={!editable} onChange={event=>update(row.id,{background:event.target.value})}>
                  <option value="">Bekräfta bakgrund…</option><option value="green-screen">Grön bakgrund</option><option value="alpha">Frilagd alfa · import väntar på stöd</option></select></label>}
              </div>
              {slot && <p className="dealer-import-help">{slot.start&&slot.end?`${slot.start} → ${slot.end} · `:''}{slot.id}</p>}
              {row.reason && <p>{row.confidence==='low'?'Osäkert förslag · ':''}{row.reason}</p>}
              {row.warnings?.map((warning,index)=><p key={index} className="dealer-import-warning">{warning}</p>)}
              {image && <p className="dealer-import-warning">Lokal posereferens. Bilden ersätter ingen låst pose och måste tas bort ur denna import innan videorna kan sparas.</p>}
              {video && row.background==='alpha' && <p className="dealer-import-warning">Assistentens kontroll och granskning av transparent material är inte färdig. Du kan granska filen lokalt, men behöver ta bort den ur denna omgång för att importera övriga filer. Den konverteras inte till grön bakgrund.</p>}
              {type.startsWith('audio/') && <p className="dealer-import-warning">Ljud kan förhandsvisas och få ett fack, men måste tas bort ur denna import innan videorna kan sparas. Endast MP4 och WebM kan sparas.</p>}
              {type && <details><summary>Visa lokal fil · början och slut</summary><LocalPreview file={row.file}/></details>}
              <p role="status" className={row.state==='error'?'dealer-import-error':''}>{row.state==='saving'?`Laddar upp ${row.progress??0} %…`:row.state==='saved'?'✓ Sparad i valt fack':importErrorMessage(row.message||'Väntar på din granskning')}</p>
            </article>;
          })}</div>
          {reviewError && <p className="dealer-import-warning">{reviewError}</p>}
          {!review ? <button className="dealer-import-primary" disabled={Boolean(busy)||!dealerApproved||!uploadRows.length||Boolean(reviewError)} onClick={()=>{setReview(true);setApproved(false);}}>Granska importen · {uploadRows.length} filer</button>
            : <section className="dealer-import-review" aria-labelledby="dealer-import-review-title"><h3 id="dealer-import-review-title">Spara {uploadRows.length} filer hos {dealer?.label}</h3>
              <ul>{uploadRows.map(row=><li key={row.id}><span>{row.file.name}</span><strong>{catalog.slots.find(slot=>slot.id===row.slotId)?.label}</strong></li>)}</ul>
              <p>Varje fil sparas som ett alternativ i det angivna facket. Klippval, låsta poser och publicerade rum ändras inte.</p>
              <label className="dealer-import-check"><input type="checkbox" checked={approved} disabled={Boolean(busy)} onChange={event=>setApproved(event.target.checked)}/><span>Jag har granskat filerna och godkänner dessa placeringar för <strong>{dealer?.label}</strong>.</span></label>
              <div className="dealer-import-actions"><button className="dealer-import-primary" disabled={!approved||Boolean(busy)||Boolean(reviewError)} onClick={()=>void save()}><Check size={16}/>{busy==='upload'?'Sparar…':'Bekräfta och spara'}</button><button disabled={Boolean(busy)} onClick={()=>{setReview(false);setApproved(false);}}>Fortsätt redigera</button></div>
            </section>}
        </section>}
      </div><aside className="dealer-import-panel dealer-import-chat" aria-labelledby="dealer-import-chat-title"><h2 id="dealer-import-chat-title"><MessageCircle size={18}/> Samtal</h2>
        <p className="dealer-import-provider">{catalog.provider.configured?'Chatt: Luna 5.6':'AI-chatt är inte ansluten'}</p>
        <p>Du kan fråga utan att välja dealer. Luna svarar på frågor; Sol High kartlägger klipp när du väljer Kartlägg klipp. Samtalet ändrar inga placeringar.</p>
        <div className="dealer-import-conversation" role="log" aria-label="Samtal med Studioassistenten" aria-live="polite">{chat.length?chat.map((entry,index)=><div key={index} className={entry.speaker==='Du'?'is-user':''}><strong>{entry.speaker}</strong><p>{entry.text}</p></div>):<div><strong>Assistent</strong><p>Vad vill du ha hjälp med i Studio? Du kan fråga direkt. Välj och bekräfta en befintlig dealer först när du vill importera klipp.</p></div>}</div>
        <form onSubmit={event=>void ask('chat',event)}><label>Meddelande till assistenten<textarea value={question} maxLength={2000} rows={3} disabled={Boolean(busy)} placeholder="Vad är skillnaden mellan vila och redo?" onChange={event=>setQuestion(event.target.value)}/></label>
          <button disabled={Boolean(busy)||!question.trim()} type="submit">{busy==='chat'?'Svarar…':'Fråga assistenten'}</button></form>
        <p className="dealer-import-help">De senaste fyra lyckade chattutbytena kan följa med som sammanhang. Samtalet och filvalen sparas inte när sidan laddas om.</p>
        <details><summary>Det här ingår i första steget</summary><p>Filnamn och textkontext ger förslag. Du kan granska början och slutet lokalt. Automatisk bildanalys, posebyte och skapande av rum ingår inte ännu.</p><p>Tal och läppsynk behöver matchande text, ljud, video och provspelning.</p></details>
        <a href={'/control/clips'+(dealerId?'?dealer='+encodeURIComponent(dealerId):'')}>Öppna dealer, tal och läppsynk i Control <ArrowUpRight size={14}/></a>
      </aside></div>
      {error && <p role="alert" className="dealer-import-error dealer-import-panel">{importErrorMessage(error)}</p>}
      {notice && <p role="status" className="dealer-import-notice dealer-import-panel">{notice}</p>}
      {rows.some(row=>row.state==='error') && <p className="dealer-import-help">Filer med fel försöks inte om automatiskt. Kontrollera <a href={'/control/clips'+(dealerId?'?dealer='+encodeURIComponent(dealerId):'')}>dealerns bibliotek</a> innan du lägger till filen igen.</p>}
    </>}
  </section>;
}
