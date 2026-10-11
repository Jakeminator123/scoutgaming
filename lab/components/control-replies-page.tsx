'use client';

import {useEffect,useRef,useState,type MouseEvent} from 'react';
import {labUrl} from '../lib/lab-url.mjs';
import {studioNavigationContextFromQuery,studioNavigationHref,type StudioNavigationContext} from '../lib/studio-navigation.mjs';
import {REPLY_CATEGORIES} from '../../web/public/speech-reply-library.mjs';
import type {SpeechReplyItem as ReplyItem} from '../../web/speech-reply-library.mjs';
import {PageTemplate} from './page-template.mjs';
import {StudioNavigation} from './studio-navigation';
import {requestJson} from './studio-types';
import styles from './control-replies-page.module.css';

const categories=(REPLY_CATEGORIES as readonly {id:string;label:string}[]).map(({id,label})=>[id,label] as const);
type Category=typeof categories[number][0];
type Dealer={id:string;label:string};
type ReplyList={items:ReplyItem[];nextCursor:string|null};
const categoryIds=new Set<string>(categories.map(([id])=>id));
const validCategory=(value:string|undefined|null)=>value&&categoryIds.has(value)?value:'';
const sameCategories=(left:readonly string[],right:readonly string[])=>[...left].sort().join('|')===[...right].sort().join('|');
const labelFor=(value:string)=>categories.find(([id])=>id===value)?.[1]??value;
const reviewLabels:Record<string,string>={pending:'Ej granskad',approved:'Godkänd',rejected:'Underkänd'};
const dateLabel=(value:string)=>Number.isFinite(Date.parse(value))?new Intl.DateTimeFormat('sv-SE',{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/Stockholm'}).format(new Date(value)):'Datum saknas';
const itemPath=(id:string,dealerId:string)=>`/api/replies/${encodeURIComponent(id)}?dealer=${encodeURIComponent(dealerId)}`;
const mediaPath=(id:string,dealerId:string,kind:'audio'|'video')=>labUrl(`/api/replies/${encodeURIComponent(id)}/${kind}?dealer=${encodeURIComponent(dealerId)}`);
function failureMessage(cause:unknown){
  const status=(cause as {statusCode?:number})?.statusCode;
  if(status===401)return 'Din inloggning har gått ut. Logga in igen för att läsa svarsbiblioteket.';
  if(status===403)return 'Du saknar behörighet att öppna svarsbiblioteket.';
  if(status===503)return 'Svarsbiblioteket är inte tillgängligt just nu. Försök igen senare.';
  return 'Svarsbiblioteket kunde inte läsas. Försök igen.';
}
function checkedItem(value:ReplyItem,dealerId:string,expectedId?:string):ReplyItem{
  if(!value||typeof value.id!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value.id)||(expectedId!==undefined&&value.id!==expectedId)||value.dealerId!==dealerId||!Number.isSafeInteger(value.revision)||value.revision<1||typeof value.exactText!=='string'||!value.exactText.trim()||typeof value.language!=='string'||typeof value.createdAt!=='string'||!Number.isFinite(Date.parse(value.createdAt))||!Array.isArray(value.categories)||value.categories.some(category=>!categoryIds.has(category))||new Set(value.categories).size!==value.categories.length||value.reviewStatus!=='pending'||!/^[a-f0-9]{64}$/.test(value.profileRevision))throw Error('reply_response_invalid');
  for(const kind of ['audio','video'] as const){const media=value.media?.[kind];if(!media||typeof media.available!=='boolean'||!/^[a-f0-9]{64}$/.test(media.sha256)||!Number.isSafeInteger(media.size)||media.size<1||media.contentType!==(kind==='audio'?'audio/wav':'video/mp4'))throw Error('reply_response_invalid');}
  return value;
}

export function ControlRepliesPage({dealers,initialDealerId,initialCategory,initialNavigationContext={}}:{dealers:Dealer[];initialDealerId?:string;initialCategory?:string;initialNavigationContext?:StudioNavigationContext}){
  const [dealerId,setDealerId]=useState(dealers.some(row=>row.id===initialDealerId)?initialDealerId!:initialDealerId?'':dealers[0]?.id??'');
  const [category,setCategory]=useState(validCategory(initialCategory));
  const [navigationContext,setNavigationContext]=useState<StudioNavigationContext>(initialNavigationContext);
  const [items,setItems]=useState<ReplyItem[]>([]);
  const [nextCursor,setNextCursor]=useState<string|null>(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [drafts,setDrafts]=useState<Record<string,Category[]>>({});
  const [conflicts,setConflicts]=useState<Record<string,boolean>>({});
  const [writingId,setWritingId]=useState('');
  const [reload,setReload]=useState(0);
  const [mediaErrors,setMediaErrors]=useState<Record<string,boolean>>({});
  const listRequest=useRef<AbortController|null>(null),writeRequest=useRef<AbortController|null>(null),serial=useRef(0),writeSerial=useRef(0),writeLock=useRef(false);
  const dirty=Object.keys(drafts).length>0;
  const context=useRef({dealerId,category,dirty,writing:false,href:''});
  context.current={...context.current,dealerId,category,dirty,writing:Boolean(writingId)||writeLock.current};
  const dealer=dealers.find(row=>row.id===dealerId);
  const visibleItems=items.filter(item=>item.dealerId===dealerId&&(!category||item.categories.includes(category)||Boolean(drafts[item.id])||conflicts[item.id]));
  const draftsRef=useRef(drafts);draftsRef.current=drafts;

  function listUrl(cursor=''){
    const query=new URLSearchParams({dealer:dealerId});if(category)query.set('category',category);if(cursor)query.set('cursor',cursor);
    return '/api/replies?'+query;
  }
  useEffect(()=>{
    listRequest.current?.abort();const controller=new AbortController();listRequest.current=controller;
    const request=++serial.current;setItems([]);setNextCursor(null);setError('');setNotice('');setConflicts({});setMediaErrors({});
    if(!dealerId){setLoading(false);return()=>{++serial.current;listRequest.current?.abort();};}
    setLoading(true);
    requestJson<ReplyList>(listUrl(),{cache:'no-store',signal:controller.signal}).then(result=>{
      if(controller.signal.aborted||request!==serial.current)return;
      if(!Array.isArray(result.items)||!(result.nextCursor===null||typeof result.nextCursor==='string'))throw Error('reply_response_invalid');
      setItems(result.items.map(item=>checkedItem(item,dealerId)));setNextCursor(result.nextCursor);
    }).catch(cause=>{if(!controller.signal.aborted&&request===serial.current)setError(failureMessage(cause));}).finally(()=>{if(!controller.signal.aborted&&request===serial.current)setLoading(false);});
    return()=>{++serial.current;listRequest.current?.abort();};
  },[dealerId,category,reload]);
  useEffect(()=>{
    context.current.href=window.location.href;
    const unload=(event:BeforeUnloadEvent)=>{if(context.current.dirty||context.current.writing||writeLock.current){event.preventDefault();event.returnValue='';}};
    const restore=()=>{
      const query=new URLSearchParams(window.location.search),nextDealer=query.get('dealer')??dealers[0]?.id??'',nextCategory=validCategory(query.get('category'));
      if(context.current.dirty||context.current.writing||writeLock.current){window.history.replaceState(null,'',context.current.href);setNotice('Spara eller ångra kategorivalen innan du byter dealer eller filter.');return;}
      setDealerId(dealers.some(row=>row.id===nextDealer)?nextDealer:'');setCategory(nextCategory);setNavigationContext(studioNavigationContextFromQuery(query));setDrafts({});context.current.href=window.location.href;
    };
    window.addEventListener('beforeunload',unload);window.addEventListener('popstate',restore);
    return()=>{window.removeEventListener('beforeunload',unload);window.removeEventListener('popstate',restore);++writeSerial.current;writeRequest.current?.abort();};
  },[]);
  function choose(nextDealer:string,nextCategory:string){
    if(dirty||writeLock.current){setNotice('Spara eller ångra kategorivalen innan du byter dealer eller filter.');return;}
    const nextContext=nextDealer===dealerId?navigationContext:{laneId:navigationContext.laneId};
    setDealerId(nextDealer);setCategory(nextCategory);setNavigationContext(nextContext);setDrafts({});
    const url=new URL(studioNavigationHref('/control/replies',{...nextContext,dealerId:nextDealer}),window.location.href);if(nextCategory)url.searchParams.set('category',nextCategory);
    window.history.pushState(null,'',url);context.current.href=url.href;
  }
  function navigate(event:MouseEvent<HTMLAnchorElement>){
    if(dirty||writeLock.current){event.preventDefault();setNotice('Spara eller ångra kategorivalen innan du lämnar svarsbiblioteket.');}
  }
  function toggle(item:ReplyItem,id:Category){
    if(writeLock.current)return;
    setDrafts(current=>{const chosen=current[item.id]??item.categories,next=chosen.includes(id)?chosen.filter(value=>value!==id):[...chosen,id];const result={...current};if(sameCategories(next,item.categories))delete result[item.id];else result[item.id]=next;return result;});setNotice('');
  }
  async function more(){
    if(loading||!nextCursor||writeLock.current)return;
    listRequest.current?.abort();const controller=new AbortController();listRequest.current=controller;const request=++serial.current;setLoading(true);setError('');
    try{const result=await requestJson<ReplyList>(listUrl(nextCursor),{cache:'no-store',signal:controller.signal});if(controller.signal.aborted||request!==serial.current)return;
      if(!Array.isArray(result.items)||!(result.nextCursor===null||typeof result.nextCursor==='string'))throw Error('reply_response_invalid');
      const rows=result.items.map(item=>checkedItem(item,dealerId));setItems(current=>[...current,...rows.filter(item=>!current.some(existing=>existing.id===item.id))]);setNextCursor(result.nextCursor);
    }catch(cause){if(!controller.signal.aborted&&request===serial.current)setError(failureMessage(cause));}finally{if(!controller.signal.aborted&&request===serial.current)setLoading(false);}
  }
  function acceptCurrent(item:ReplyItem){
    setItems(current=>current.map(row=>row.id===item.id?item:row));
    setDrafts(current=>{const next={...current};if(next[item.id]&&sameCategories(next[item.id],item.categories))delete next[item.id];return next;});
  }
  async function latest(item:ReplyItem){
    if(writeLock.current)return;writeLock.current=true;setWritingId(item.id);setError('');
    const controller=new AbortController();writeRequest.current=controller;const request=++writeSerial.current;
    try{const result=await requestJson<{item:ReplyItem}>(itemPath(item.id,dealerId),{cache:'no-store',signal:controller.signal});if(controller.signal.aborted||request!==writeSerial.current)return;
      const current=checkedItem(result.item,dealerId,item.id);acceptCurrent(current);setConflicts(old=>({...old,[item.id]:false}));setNotice('Senaste kategorierna visas. Ditt val är kvar om det skiljer sig; jämför och spara igen eller ångra.');
    }catch(cause){if(!controller.signal.aborted)setError(failureMessage(cause));}finally{if(request===writeSerial.current){writeLock.current=false;setWritingId('');}}
  }
  async function saveCategories(item:ReplyItem){
    const chosen=draftsRef.current[item.id];if(writeLock.current||!chosen||conflicts[item.id])return;
    writeLock.current=true;setWritingId(item.id);setError('');setNotice('');
    const controller=new AbortController();writeRequest.current=controller;const request=++writeSerial.current;
    try{const result=await requestJson<{item:ReplyItem}>(`/api/replies/${encodeURIComponent(item.id)}`,{method:'PATCH',cache:'no-store',signal:controller.signal,body:JSON.stringify({dealerId,categories:chosen,expectedRevision:item.revision})});if(controller.signal.aborted||request!==writeSerial.current)return;
      const current=checkedItem(result.item,dealerId,item.id);acceptCurrent(current);setNotice('Kategorierna är sparade.');
    }catch(cause){
      if(controller.signal.aborted||request!==writeSerial.current)return;
      setConflicts(old=>({...old,[item.id]:true}));
      if((cause as {statusCode?:number})?.statusCode===409){setNotice('Kategorierna har ändrats i en annan vy. Hämta senaste versionen och jämför med ditt val.');return;}
      // A lost write response may still have committed. Reconcile by reading;
      // never repeat a write whose outcome is unknown.
      try{const result=await requestJson<{item:ReplyItem}>(itemPath(item.id,dealerId),{cache:'no-store',signal:controller.signal});if(controller.signal.aborted||request!==writeSerial.current)return;
        const current=checkedItem(result.item,dealerId,item.id);acceptCurrent(current);setConflicts(old=>({...old,[item.id]:false}));setNotice(sameCategories(chosen,current.categories)?'Kategorierna är sparade; resultatet har bekräftats genom en ny läsning.':'Sparandet kunde inte bekräftas. Senaste kategorierna visas; jämför med ditt val innan du försöker igen.');
      }catch{if(!controller.signal.aborted)setError('Sparandet kunde inte bekräftas. Ditt val är kvar. Hämta senaste versionen innan du försöker spara igen.');}
    }finally{if(request===writeSerial.current){writeLock.current=false;setWritingId('');}}
  }
  return <PageTemplate eyebrow="// STUDIO" title="Svarsbibliotek" intro="Här visas sparade svar för vald dealer, med exakt text, ljud och läppsynkvideo. Kategorier hjälper dig att ordna biblioteket.">
    <main className="sg-page-body">
      <div className={styles.controls}><label>Dealer<select aria-label="Dealer i svarsbiblioteket" value={dealerId} disabled={Boolean(writingId)} onChange={event=>choose(event.target.value,category)}><option value="">Välj dealer</option>{dealers.map(row=><option key={row.id} value={row.id}>{row.label}</option>)}</select></label>
        <label>Kategori<select aria-label="Filtrera svarskategori" value={category} disabled={Boolean(writingId)} onChange={event=>choose(dealerId,event.target.value)}><option value="">Alla kategorier</option>{categories.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
        <button type="button" className="sg-btn sg-btn-secondary" disabled={loading||dirty||Boolean(writingId)||!dealerId} onClick={()=>setReload(value=>value+1)}>Uppdatera</button>
      </div>
      <StudioNavigation {...navigationContext} active="replies" dealerId={dealerId} dealerLabel={dealer?.label} onNavigate={navigate}/>
      {dirty?<p role="status" className={styles.feedback}>Du har osparade kategorival. Spara eller ångra dem innan du byter dealer, filter eller sida.</p>:null}
      {error?<p role="alert" className={styles.error}>{error}</p>:null}{notice?<p role="status" className={styles.feedback}>{notice}</p>:null}
      {!dealerId?<p className={styles.empty}>Välj en dealer för att läsa dess svarsbibliotek.</p>:null}
      {loading&&!visibleItems.length?<p role="status" className={styles.empty}>Läser svarsbiblioteket…</p>:null}
      {dealerId&&!loading&&!error&&!visibleItems.length?<p className={styles.empty}>{nextCursor?'Inga träffar bland hämtade svar. Välj Visa fler svar för att fortsätta läsa biblioteket.':category?'Inga sparade svar i den här kategorin för '+dealer?.label+'.':'Inga sparade svar för '+dealer?.label+' ännu. Här visas svar när de har sparats i biblioteket.'}</p>:null}
      <div className={styles.list}>{visibleItems.map(item=>{
        const chosen=drafts[item.id]??item.categories,pending=Boolean(writingId),edited=Boolean(drafts[item.id]);
        return <article key={dealerId+':'+item.id} className={styles.reply} aria-label={'Svar '+item.id}>
          <div className={styles.heading}><h2>{dealer?.label} · {item.language||'Språk saknas'}</h2><span className={styles.review}>{reviewLabels[item.reviewStatus]??'Okänd granskningsstatus'}</span></div>
          <p className={styles.exactText}>{item.exactText}</p>
          <dl className={styles.metadata}><div><dt>Skapat</dt><dd><time dateTime={item.createdAt}>{dateLabel(item.createdAt)}</time></dd></div><div><dt>Profilrevision</dt><dd><code>{item.profileRevision||'Saknas'}</code></dd></div></dl>
          <div className={styles.media}><section><h3>Ljud</h3>{item.media.audio.available&&!mediaErrors[item.id+':audio']?<audio key={item.id+':'+item.media.audio.sha256} controls preload="none" src={mediaPath(item.id,dealerId,'audio')} aria-label={'Ljud för svar '+item.id} onError={()=>setMediaErrors(current=>({...current,[item.id+':audio']:true}))}/>:<p>Ljudet är inte tillgängligt.</p>}</section><section><h3>Läppsynkvideo</h3>{item.media.video.available&&!mediaErrors[item.id+':video']?<video key={item.id+':'+item.media.video.sha256} controls playsInline preload="none" src={mediaPath(item.id,dealerId,'video')} aria-label={'Läppsynk för svar '+item.id} onError={()=>setMediaErrors(current=>({...current,[item.id+':video']:true}))}/>:<p>Videon är inte tillgänglig.</p>}</section></div>
          <fieldset className={styles.categories} disabled={pending}><legend>Kategorier</legend><div>{categories.map(([id,label])=><label key={id}><input type="checkbox" checked={chosen.includes(id)} onChange={()=>toggle(item,id)}/>{label}</label>)}</div></fieldset>
          {edited||conflicts[item.id]?<p className={styles.saved}>Senast sparat: {item.categories.length?item.categories.map(labelFor).join(', '):'Ingen kategori'}.</p>:null}
          {conflicts[item.id]?<p role="status">Hämta senaste versionen innan du sparar. Dina kategorival är kvar.</p>:null}
          <div className={styles.actions}><button type="button" className="sg-btn sg-btn-primary" disabled={!edited||pending||conflicts[item.id]} onClick={()=>void saveCategories(item)}>{writingId===item.id?'Arbetar…':'Spara kategorier'}</button><button type="button" className="sg-btn sg-btn-secondary" disabled={!edited||pending} onClick={()=>{setDrafts(current=>{const next={...current};delete next[item.id];return next;});setNotice('Kategorivalen är ångrade.');}}>Ångra kategorival</button>{conflicts[item.id]?<button type="button" className="sg-btn sg-btn-secondary" disabled={pending} onClick={()=>void latest(item)}>Hämta senaste versionen</button>:null}</div>
        </article>;
      })}</div>
      {nextCursor?<button type="button" className="sg-btn sg-btn-secondary" disabled={loading||Boolean(writingId)} onClick={()=>void more()}>{loading?'Läser fler…':'Visa fler svar'}</button>:null}
    </main>
  </PageTemplate>;
}
