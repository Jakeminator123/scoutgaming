import {useEffect,useRef,useState} from 'react';
import {ArrowUpRight} from 'lucide-react';
import Link from '../../../runtime/navigation';
import {Button,cn,TechnicalDetails} from '../ui/kit';
import {Dialog} from '../ui/dialog';
import {publishRoomRelease,readRoomRelease,roomReleaseAreas,roomReleaseBlocker,roomReleaseButton,roomReleaseCanPublish,roomReleaseNotice,roomReleaseReceiptText,
  type RoomReleasePreview,type RoomReleaseReceipt} from '../../lib/room-release.mjs';
import {runBlockerAction} from '../../lib/blocker-view.mjs';

// Spelbordets enda publicering (ADMIN-FORENKLING §7): en primär knapp, rutan "Det här ändras
// jämfört med live" och ett kvitto. Servern (lib/room-release.mjs) gör alla kontroller; här
// skickas förhandsvisningens token och revisioner, och inget försök upprepas automatiskt.
// Föräldern sätter `key` per bolag och spelbord, så kvitto, fel och ruta aldrig följer med till ett annat spelbord.
type Status='idle'|'loading'|'ready'|'error';
export type RoomReleaseProps={operatorId:string;roomId:string;roomName:string;
  /** Öppet, publicerat blackjack-spelbord; annars svarar servern 404 och inget läses. */
  eligible:boolean;
  /** Varför publiceringen väntar (osparade ändringar, pågående sparning); tom när den kan göras. */
  blockedBy?:string;
  /** Ändras när editorn sparat eller registret lästs om: jämförelsen läses då igen. */
  refreshKey?:string;
  playUrl?:string|null;rooms?:{id:string;name:string}[];
  /** Dealerns namn ur registret; bakgrund och bordsgrafik visas med id. */
  dealerName?:(id:string)=>string;
  onBusyChange?:(busy:boolean)=>void;onPublished?:(receipt:RoomReleaseReceipt)=>void};

const linkClass='inline-flex items-center gap-1 font-semibold text-sg-accent-text no-underline hover:underline';

export function RoomRelease({operatorId,roomId,roomName,eligible,blockedBy='',refreshKey='',playUrl,rooms=[],dealerName,onBusyChange,onPublished}:RoomReleaseProps) {
  const [status,setStatus]=useState<Status>('idle');
  const [preview,setPreview]=useState<RoomReleasePreview|null>(null);
  const [readError,setReadError]=useState('');
  const [open,setOpen]=useState(false);
  const [publishing,setPublishing]=useState(false);
  const [publishError,setPublishError]=useState('');
  const [notice,setNotice]=useState('');
  // Ett hinder med en knapp som åtgärdar det direkt (Mät omätta klipp): räknare, sedan ny jämförelse.
  const [fixing,setFixing]=useState('');
  // Efter ett fel (eller okänt utfall) måste förhandsvisningen läsas in igen innan nästa försök.
  const [mustReload,setMustReload]=useState(false);
  const [receipt,setReceipt]=useState<RoomReleaseReceipt|null>(null);
  const [reads,setReads]=useState(0);
  const lock=useRef(false),callbacks=useRef({onBusyChange,onPublished});
  callbacks.current={onBusyChange,onPublished};
  const receiptRef=useRef<HTMLDivElement>(null),announced=useRef('');
  // Efter en lyckad publicering flyttas fokus till kvittot (rutan har stängts).
  useEffect(()=>{if(receipt)receiptRef.current?.focus();},[receipt]);

  useEffect(()=>{
    if(!eligible){setStatus('idle');setPreview(null);return undefined;}
    const controller=new AbortController();
    setStatus('loading');setReadError('');
    readRoomRelease({operatorId,roomId,signal:controller.signal}).then(result=>{
      if(controller.signal.aborted)return;
      if(result.ok){setPreview(result.preview);setStatus('ready');setMustReload(false);}
      else{setPreview(null);setReadError(result.error);setStatus('error');}
    }).catch(()=>{});
    return ()=>controller.abort();
  },[operatorId,roomId,eligible,refreshKey,reads]);

  if(!eligible)return <section aria-label="Publicera spelbordet" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sg-border bg-sg-surface px-4 py-3 shadow-sg">
    <p className="m-0 text-[13px] text-sg-muted">Spelbordet kan publiceras när det är öppet och ingår i bolagets publicerade tilldelning.</p>
    <Button variant="primary" disabled data-action="room-release">Publicera</Button>
  </section>;

  const button=roomReleaseButton({status,preview,blockedBy});
  const reload=()=>{setPublishError('');setNotice('');setReads(value=>value+1);};
  async function fix(dealerIds:string[]){
    if(lock.current)return;
    lock.current=true;setFixing('Mäter…');
    try{const result=await runBlockerAction({label:'',href:null,run:'measure'},{dealerIds,onProgress:({done,total})=>setFixing(`Mäter ${done}/${total}…`)});
      reload();setFixing(result.ok?result.message??'':'');if(!result.ok)setPublishError(result.error??'');}
    finally{lock.current=false;}
  }
  function openDialog(){setPublishError('');setOpen(true);reload();}
  async function publish(){
    if(!preview||lock.current||mustReload||blockedBy||!roomReleaseCanPublish(preview))return;
    lock.current=true;setPublishing(true);setPublishError('');callbacks.current.onBusyChange?.(true);
    try{
      const result=await publishRoomRelease({preview});
      if(!result.ok){if(roomReleaseNotice(result))setNotice(result.error);else setPublishError(result.error);setMustReload(true);return;}
      setReceipt(result.receipt);setOpen(false);
      callbacks.current.onPublished?.(result.receipt);
      reload();
    }finally{lock.current=false;setPublishing(false);callbacks.current.onBusyChange?.(false);}
  }
  const dealerId=preview?.candidate?.dealerId??preview?.live?.dealerId??null;
  // Spelbordens namn för området Utseende (bolagets utkast kan gälla flera spelbord).
  const areas=roomReleaseAreas(preview,{dealerName,rooms});
  const blockers=preview?.blockers??[];
  const canPublish=status==='ready'&&!mustReload&&!blockedBy&&!publishing&&roomReleaseCanPublish(preview);
  // Statusregionen annonserar bara slutlägen och fel, inte "Jämför med live…" vid varje omläsning.
  if(status==='ready'||status==='error')announced.current=status==='error'?readError:button.hint;

  return <section aria-label="Publicera spelbordet" className="grid gap-3">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sg-border bg-sg-surface px-4 py-3 shadow-sg">
      <div className="min-w-0">
        <p className="m-0 text-[13px] font-semibold text-sg-text">{preview?`Live · version ${preview.revisions.package}`:'Publicering'}</p>
        <p className="m-0 text-[12.5px] text-sg-muted" aria-hidden="true">{status==='error'?readError:button.hint}</p>
        <p role="status" className="sr-only">{announced.current}</p>
      </div>
      <Button variant="primary" data-action="room-release" disabled={button.disabled||publishing} onClick={openDialog}>{publishing?'Publicerar…':button.label}</Button>
    </div>
    <div role="status" data-release-receipt="">{receipt&&<div ref={receiptRef} tabIndex={-1} className="grid gap-1 rounded-lg bg-sg-ok-bg px-3.5 py-2.5 text-[13px] text-sg-ok outline-none">
      <p className="m-0"><strong className="font-semibold">{roomReleaseReceiptText(receipt)}</strong></p>
      {playUrl&&<p className="m-0"><a className={linkClass} href={playUrl} target="_blank" rel="noopener">Öppna spelbordet <ArrowUpRight size={13} aria-hidden="true"/></a></p>}
      <TechnicalDetails className="mt-1" items={[['configVersion',receipt.configVersion],['Paketrevision före',String(receipt.previousPackageRevision)],
        ['Paketrevision efter',String(receipt.packageRevision)],['Publicerat (UTC)',receipt.publishedAt],['Av',receipt.actor]]}/>
    </div>}</div>
    <Dialog open={open} size="lg" busy={publishing} ariaBusy={status==='loading'||publishing} onClose={()=>setOpen(false)}
      title="Det här ändras jämfört med live"
      description={`${roomName}${preview?` · live version ${preview.revisions.package}`:''}`}
      footer={<>
        <Button onClick={()=>setOpen(false)} disabled={publishing}>Avbryt</Button>
        <Button onClick={reload} disabled={publishing||status==='loading'}>Läs in igen</Button>
        <Button variant="primary" data-action="room-release-confirm" disabled={!canPublish} onClick={()=>void publish()}>{publishing?'Publicerar…':'Publicera nu'}</Button>
      </>}>
      {status==='loading'?<p role="status" className="m-0 text-sg-muted">Jämför sparat läge med live…</p>
        :status==='error'?<p role="alert" className="m-0 rounded-lg bg-sg-danger-bg px-3 py-2 text-sg-danger">{readError}</p>
        :preview&&<div className="grid gap-4">
          {blockers.length>0&&<div role="alert" className="grid gap-1.5 rounded-lg border border-sg-danger-line bg-sg-danger-bg px-3.5 py-3 text-[13.5px] text-sg-danger">
            <p className="m-0 font-semibold">{blockers.length===1?'Ett hinder':blockers.length+' hinder'} före publicering</p>
            <ul className="m-0 grid gap-1 pl-4">{blockers.map((blocker,index)=>{const view=roomReleaseBlocker(blocker,{roomId,dealerId,dealerName:dealerId&&dealerName?dealerName(dealerId):'',rooms,language:preview.gameConfig?.language});
              return <li key={index} data-blocker={blocker.code}>{view.text}{view.run==='measure'&&dealerId?<> <Button size="sm" data-action="blocker-measure" disabled={fixing.endsWith('…')||publishing} onClick={()=>void fix([dealerId])}>{view.linkLabel}</Button></>
                :view.run==='reload'?<> <Button size="sm" onClick={reload} disabled={publishing}>{view.linkLabel}</Button></>
                :view.href&&<> <Link className={cn(linkClass,'text-sg-danger')} href={view.href}>{view.linkLabel} →</Link></>}</li>;})}</ul>
            {fixing&&<p role="status" className="m-0 text-sg-text">{fixing}</p>}
          </div>}
          {!preview.changed&&!blockers.length&&<p className="m-0 text-sg-muted">Sparat läge är detsamma som live. Inget att publicera.</p>}
          <dl className="m-0 grid grid-cols-[max-content_minmax(0,1fr)] gap-x-6 gap-y-2.5">
            {areas.map(area=><div key={area.area} className="contents" data-area={area.area} data-changed={area.changed||undefined}>
              <dt className="font-semibold text-sg-text">{area.label}</dt>
              <dd className="m-0 min-w-0">{area.changed?<ul className="m-0 grid gap-0.5 pl-4">{area.rows.map((row,index)=><li key={index}>{row}</li>)}</ul>
                :<span className="text-sg-muted">oförändrat</span>}</dd>
            </div>)}
          </dl>
          {(preview.materialWarnings?.length??0)>0&&<p role="note" className="m-0 rounded-lg bg-sg-warn-bg px-3 py-2 text-[13px] text-sg-warn">Bolagets eget material har varningar som följer med publiceringen.</p>}
        </div>}
      {notice&&<p role="status" data-release-notice="" className="mb-0 mt-3 rounded-lg bg-sg-surface-2 px-3 py-2 text-[13.5px] text-sg-muted">{notice}</p>}
      {publishError&&<p role="alert" className="mb-0 mt-3 rounded-lg bg-sg-danger-bg px-3 py-2 text-[13.5px] text-sg-danger">{publishError}</p>}
    </Dialog>
  </section>;
}
