'use client';

import {useEffect,useRef,useState} from 'react';
import {CompositionPreview} from './composition-preview';
import {DealerClipPreview} from './dealer-video-surface';
import {validatePublicOperatorPreview} from '../../../packages/presentation/contracts/operator-preview-contract.mjs';
import type {PublicOperatorPreview} from '../../../packages/presentation/contracts/operator-preview-contract.mjs';
import type {EditableBranding,PartnerAppearanceInitial} from './partner-appearance-state.mjs';
import styles from './partner-appearance.module.css';

export function PartnerAppearancePreview({server,branding,scope,operatorSlug,language='sv',onStale,active=true,initiallyEnabled=false,compact=false,onMedia}: {
  server:PartnerAppearanceInitial;branding:EditableBranding;scope:string;operatorSlug:string;language?:string;onStale:()=>void;active?:boolean;initiallyEnabled?:boolean;compact?:boolean;onMedia?:(payload:PublicOperatorPreview|null)=>void;
}) {
  const en=language==='en',t=(sv:string,english:string)=>en?english:sv;
  const [attempt,setAttempt]=useState(0);
  const [enabled,setEnabled]=useState(initiallyEnabled && active),[selectedLayout,setLayout]=useState<'desktop'|'mobile'>('desktop'),[chosenRoom,setChosenRoom]=useState('');
  useEffect(()=>{if(!active)setEnabled(false);},[active]);
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
  const payload=current.status==='ready'?current.payload:null;
  const mediaCallback=useRef(onMedia);mediaCallback.current=onMedia;
  useEffect(()=>{mediaCallback.current?.(payload??null);},[payload]);
  const tableId=selected.table??lane?.layers.table.default,backgroundId=selected.background??lane?.layers.background.default;
  const table=payload?.media.tables.find(row=>row.id===tableId),background=payload?.media.backgrounds.find(row=>row.id===backgroundId);
  const media=(row:typeof table)=>row?{url:row.src,label:row.label,contentType:row.contentType}:null;
  const missingLayers=payload?.independentLayers&&Boolean(tableId&&!table||backgroundId&&lane?.layers.background.mode!=='baked'&&!background);
  return <section className={styles.preview} aria-label={t('Förhandsvisning av valda lager','Selected layers preview')}>
    <h4>{t('Förhandsvisning av valda lager','Selected layers preview')}</h4>
    {compact?<details className={styles.previewHelp}><summary>{t('Om förhandsvisningen','About the preview')}</summary><p className={styles.hint}>{t('Visar valda lager och grundloop från paketets frysta media. Bordsfärgens gränssnittsdetaljer och spelets händelser ingår inte i denna bild.','Shows selected layers and the idle clip from the package’s frozen media. Table-colour interface details and game events are not shown in this image.')}</p></details>:<p className={styles.hint}>{t('Visar valda lager och grundloop från paketets frysta media. Bordsfärgens gränssnittsdetaljer och spelets händelser ingår inte i denna bild.','Shows selected layers and the idle clip from the package’s frozen media. Table-colour interface details and game events are not shown in this image.')}</p>}
    {!scope?<label className={styles.row}>{t('Förhandsvisa rum','Preview room')}<select aria-label={t('Förhandsvisa rum','Preview room')} value={room?.id??''} onChange={event=>setChosenRoom(event.target.value)}>{server.rooms?.map(row=><option key={row.id} value={row.id}>{row.label}</option>)}</select></label>:null}
    {!room||!lane?<p>{t('Det finns inget publicerat spelrum för denna sammansättning att förhandsvisa.','There is no published room for this presentation to preview.')}</p>:<>
      {!compact&&<p>{room.label} · {t('paketversion','package version')} {server.packageRevision}</p>}
      {!dealerId?<p role="status" className={styles.hint}>{chosenDealer?t('Det sparade dealervalet kan inte användas i det här rummet. Välj en tillåten dealer i inställningarna ovan, eller be intern personal uppdatera publiceringen.','The saved dealer choice cannot be used in this room. Choose an allowed dealer in the settings above, or ask internal staff to update the publication.'):t('Sammansättningen saknar ett publicerat dealerval. Välj en dealer i inställningarna ovan, eller be intern personal publicera ett val.','This composition has no published dealer choice. Choose a dealer in the settings above, or ask internal staff to publish a choice.')}</p>:null}
      <div className={styles.actions}><button type="button" className="sg-btn" data-action="open-preview" onClick={()=>{if(!dealerId)return;setEnabled(true);setAttempt(value=>value+1);}} disabled={!dealerId||enabled&&current.status==='loading'}>{enabled?t('Ladda om förhandsvisning','Reload preview'):t('Visa förhandsvisning','Show preview')}</button><button type="button" className="sg-btn" aria-pressed={layout==='desktop'} onClick={()=>setLayout('desktop')}>Desktop</button>{room.game==='blackjack'&&<button type="button" className="sg-btn" aria-pressed={layout==='mobile'} onClick={()=>setLayout('mobile')}>{t('Mobil','Mobile')}</button>}</div>
      {room.game==='roulette'&&<p className={styles.hint}>{t('Roulette använder Desktop 16:9 även på mobil.','Roulette uses Desktop 16:9 on mobile too.')}</p>}
      {enabled&&dealerId&&current.status==='loading'?<p role="status">{t('Hämtar frysta lager…','Loading frozen layers…')}</p>:null}
      {enabled&&dealerId&&current.status==='unavailable'?<p role="alert">{t('Förhandsvisningen kunde inte hämtas för denna version och dealer. Utkastet finns kvar.','The preview could not be loaded for this version and dealer. Your draft is preserved.')}</p>:null}
      {enabled&&dealerId&&payload?<>
        {!payload.media.dealer?<p className={styles.hint}>{t('Denna dealer saknar tillgänglig fryst grundloop i förhandsvisningen. Övriga tillgängliga lager visas.','This dealer has no frozen idle clip available in the preview. Other available layers are shown.')}</p>:null}
        {missingLayers?<p role="alert">{t('Ett valt lager saknar tillgänglig förhandsvisningsfil. Bilden är ofullständig.','A selected layer has no available preview file. This image is incomplete.')}</p>:null}
        {payload.independentLayers&&payload.settings?<CompositionPreview language={language} dealer={payload.media.dealer?{url:payload.media.dealer.src,label:payload.dealer.label,contentType:payload.media.dealer.contentType}:null} table={media(table)} background={media(background)} settings={payload.settings} layout={layout} show={{dealer:Boolean(payload.media.dealer),table:Boolean(table),background:Boolean(background)}} compositing={payload.media.dealer?.compositing} framing={payload.media.dealer?.framing}/>
          :payload.media.dealer?<DealerClipPreview key={payload.media.dealer.src} url={payload.media.dealer.src} compositing={payload.media.dealer.compositing} framing={payload.media.dealer.framing} label={payload.dealer.label}/>:null}
      </>:null}
    </>}
  </section>;
}
