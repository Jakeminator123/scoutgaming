'use client';

import {useEffect,useRef,useState,type ReactNode} from 'react';
import {CompositionPreview} from './composition-preview';
import {DealerClipPreview} from './dealer-video-surface';
import {validatePublicOperatorPreview} from '../../../packages/presentation/contracts/operator-preview-contract.mjs';
import type {PublicOperatorPreview} from '../../../packages/presentation/contracts/operator-preview-contract.mjs';
import type {EditableBranding,PartnerAppearanceInitial} from './partner-appearance-state.mjs';
import styles from './partner-appearance.module.css';

// Scenen så som spelaren ser den: paketets frysta lager för valt spelbord och dealer.
// Med initiallyEnabled laddas den direkt när ytan är aktiv (Partnerportalen och Admin);
// annars först på knappen. Saknas media visas ett tomläge i samma ruta.
export function PartnerAppearancePreview({server,branding,scope,operatorSlug,language='sv',onStale,active=true,initiallyEnabled=false,compact=false,onMedia}: {
  server:PartnerAppearanceInitial;branding:EditableBranding;scope:string;operatorSlug:string;language?:string;onStale:()=>void;active?:boolean;initiallyEnabled?:boolean;compact?:boolean;onMedia?:(payload:PublicOperatorPreview|null)=>void;
}) {
  const en=language==='en',t=(sv:string,english:string)=>en?english:sv;
  const [attempt,setAttempt]=useState(0);
  const [enabled,setEnabled]=useState(initiallyEnabled && active),[selectedLayout,setLayout]=useState<'desktop'|'mobile'>('desktop'),[chosenRoom,setChosenRoom]=useState('');
  useEffect(()=>{if(!active)setEnabled(false);else if(initiallyEnabled)setEnabled(true);},[active,initiallyEnabled]);
  const [state,setState]=useState<{identity:string;status:'loading'|'ready'|'unavailable';payload?:PublicOperatorPreview}>({identity:'',status:'loading'});
  const stale=useRef(onStale);stale.current=onStale;
  const defaultLane=branding.lane??server.presentation?.lanes[0]?.id;
  const room=server.rooms?.find(row=>row.id===(scope||chosenRoom))??server.rooms?.find(row=>row.presentationLaneId===defaultLane);
  // Older responses omit game. Desktop is valid for both games; only verified
  // blackjack rooms offer the mobile composition used by that player.
  const layout=room?.game==='blackjack'?selectedLayout:'desktop';
  const lane=server.presentation?.lanes.find(row=>row.id===room?.presentationLaneId);
  const defaults=lane?.id===defaultLane?branding:{};
  const selected={...defaults,...(room?branding.roomOverrides?.[room.id]:{})};
  const roomDealers=room?server.roomDealerChoices?.[room.id]:undefined;
  const chosenDealer=selected.dealer??lane?.layers.dealer.default??'';
  const dealerId=chosenDealer&&lane?.layers.dealer.allowed.includes(chosenDealer)&&(!roomDealers||roomDealers.includes(chosenDealer))?chosenDealer:'';
  const identity=[operatorSlug,room?.id,server.packageRevision,dealerId].join(':');
  useEffect(()=>{
    if(!enabled||!room||!lane||!dealerId)return;
    let current=true;const abort=new AbortController();
    setState({identity,status:'loading'});
    void(async()=>{
      try {
        const url=`/api/operators/${encodeURIComponent(operatorSlug)}/rooms/${encodeURIComponent(room.id)}/preview?dealer=${encodeURIComponent(dealerId)}&revision=${server.packageRevision}`;
        const response=await fetch(url,{credentials:'same-origin',cache:'no-store',signal:abort.signal,headers:{accept:'application/json'}});
        if(!current)return;
        if(response.status===409){stale.current();throw new Error('stale preview');}
        if(!response.ok)throw new Error('preview unavailable');
        const raw:unknown=await response.json();if(!current)return;
        let payload:PublicOperatorPreview;
        try{payload=validatePublicOperatorPreview(raw,{operatorSlug,roomId:room.id,packageRevision:server.packageRevision,dealerId});}
        catch(error){stale.current();throw error;}
        setState({identity,status:'ready',payload});
      } catch {if(current)setState({identity,status:'unavailable'});}
    })();
    return()=>{current=false;abort.abort();};
    // The descriptor is bound to these four values. Local layer choices use its frozen allowlist.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[identity,enabled,attempt]);
  const current=state.identity===identity?state:{identity,status:'loading' as const};
  const payload=enabled&&active&&current.status==='ready'?current.payload:null;
  const mediaCallback=useRef(onMedia);mediaCallback.current=onMedia;
  useEffect(()=>{mediaCallback.current?.(payload??null);},[payload]);
  const tableId=selected.table??lane?.layers.table.default,backgroundId=selected.background??lane?.layers.background.default;
  const table=payload?.media.tables.find(row=>row.id===tableId),background=payload?.media.backgrounds.find(row=>row.id===backgroundId);
  const media=(row:typeof table)=>row?{url:row.src,label:row.label,contentType:row.contentType}:null;
  const missingLayers=payload?.independentLayers&&Boolean(tableId&&!table||backgroundId&&lane?.layers.background.mode!=='baked'&&!background);
  const composition=(overlay?:ReactNode)=>payload?.settings?<CompositionPreview minimal language={language} dealer={payload.media.dealer?{url:payload.media.dealer.src,label:payload.dealer.label,contentType:payload.media.dealer.contentType}:null} table={media(table)} background={media(background)} settings={payload.settings} layout={layout} overlay={overlay} show={{dealer:Boolean(payload.media.dealer),table:Boolean(table),background:Boolean(background)}} compositing={payload.media.dealer?.compositing} framing={payload.media.dealer?.framing}/>:null;
  const empty=(text:ReactNode,role?:'status'|'alert')=><div className={styles.stageEmpty} data-layout={layout} role={role}><span>{text}</span></div>;
  const previewControls = <div className={styles.segment} role="group" aria-label={t('Visa som','Show as')}>
    <button type="button" aria-pressed={layout==='desktop'} onClick={()=>setLayout('desktop')}>{t('Dator','Desktop')}</button>
    {room?.game==='blackjack'&&<button type="button" aria-pressed={layout==='mobile'} onClick={()=>setLayout('mobile')}>{t('Mobil','Mobile')}</button>}
  </div>;
  const reload = <button type="button" className={styles.linkButton} data-action="open-preview" onClick={()=>{if(!dealerId)return;setEnabled(true);setAttempt(value=>value+1);}} disabled={!dealerId||enabled&&current.status==='loading'}>{enabled?t('Ladda om','Reload'):t('Visa förhandsvisning','Show preview')}</button>;
  return <section className={styles.preview} aria-label={t('Så ser spelaren det','What the player sees')}>
    <header className={styles.previewHeader}><h4>{t('Så ser spelaren det','What the player sees')}</h4>{room&&lane?<div className={styles.previewTools}>{previewControls}{reload}</div>:null}</header>
    {!scope?<label className={styles.row}>{t('Visa spelbord','Show table')}<select aria-label={t('Förhandsvisa spelbord','Preview table')} value={room?.id??''} onChange={event=>setChosenRoom(event.target.value)}>{server.rooms?.map(row=><option key={row.id} value={row.id}>{row.label}</option>)}</select></label>:null}
    {!room||!lane?empty(t('Det finns inget öppet spelbord med den här scenen att visa.','There is no open table with this scene to show.')):<>
      {!dealerId?empty(chosenDealer?t('Det sparade dealervalet kan inte användas på det här spelbordet. Välj en av dealerna.','The saved dealer choice cannot be used at this table. Choose one of the dealers.'):t('Scenen saknar ett publicerat dealerval. Välj en dealer.','This scene has no published dealer choice. Choose a dealer.'),'status'):null}
      {room.game==='roulette'&&<p className={styles.hint}>{t('Roulette använder Desktop 16:9 även på mobil.','Roulette uses Desktop 16:9 on mobile too.')}</p>}
      {dealerId&&!enabled?empty(t('Förhandsvisningen startar när du trycker på Visa förhandsvisning.','The preview starts when you press Show preview.')):null}
      {enabled&&dealerId&&current.status==='loading'?<div className={styles.stageEmpty} data-layout={layout} role="status" aria-busy="true"><span className={styles.shimmer}/><span>{t('Hämtar scenen…','Loading the scene…')}</span></div>:null}
      {enabled&&dealerId&&current.status==='unavailable'?empty(t('Förhandsvisningen kunde inte hämtas just nu. Utkastet finns kvar.','The preview could not be loaded right now. Your draft is preserved.'),'alert'):null}
      {enabled&&dealerId&&payload?<>
        {!payload.media.dealer?<p className={styles.hint}>{t('Dealern saknar vila i förhandsvisningen. Övriga lager visas.','The dealer has no idle clip in the preview. Other layers are shown.')}</p>:null}
        {missingLayers?<p role="alert" className={styles.hint}>{t('Ett valt lager saknar bild i förhandsvisningen. Bilden är ofullständig.','A selected layer has no image in the preview. The picture is incomplete.')}</p>:null}
        {payload.independentLayers&&payload.settings?composition()
          :payload.media.dealer?<DealerClipPreview key={payload.media.dealer.src} url={payload.media.dealer.src} compositing={payload.media.dealer.compositing} framing={payload.media.dealer.framing} label={payload.dealer.label}/>:null}
      </>:null}
    </>}
  </section>;
}
