'use client';

import {useEffect,useRef,useState} from 'react';
import {CompositionPreview} from './composition-preview';
import {DealerClipPreview} from './dealer-video-surface';
import {validatePublicOperatorPreview} from '../../../packages/presentation/contracts/operator-preview-contract.mjs';
import type {PublicOperatorPreview} from '../../../packages/presentation/contracts/operator-preview-contract.mjs';
import type {EditableBranding,PartnerAppearanceInitial} from './partner-appearance-state.mjs';
import type {CompositionSettings} from '../../../packages/presentation/contracts/composition-settings.mjs';
import {adjustPublishedMobilePlacement} from '../../../packages/presentation/contracts/published-mobile-placement.mjs';
import {compositionAnchorFrames,projectAnchorRects} from '../../../packages/presentation/runtime/composition-anchors.mjs';
import {layoutGameOverlay} from '../../../packages/presentation/runtime/game-overlay-layout.mjs';
import {cardViewDepth} from '../../../packages/presentation/contracts/card-view.mjs';
import {calibration} from '../../../packages/presentation/contracts/calibration.mjs';
import styles from './partner-appearance.module.css';

function MobilePlacementOverlay({settings,tableId,width,height,language}:{settings:CompositionSettings;tableId:string;width:number;height:number;language:string}) {
  const geometry=settings.blackjackTables?.find(row=>row.tableId===tableId);
  if(!geometry)return null;
  // A scaled phone preview uses the same image aspect and game placement math.
  // Its CSS width does not shrink the phone's real touch targets.
  const viewport={width:390,height:390*16/9},boxes=[2,3,4];
  const frames=compositionAnchorFrames(settings,'mobile',{width,height});
  const planes=projectAnchorRects(geometry.mobile,frames,viewport);
  const result=layoutGameOverlay({tableGeometry:geometry,tableLayout:'mobile',rect:planes.cardsRect,...planes},boxes,{left:0,top:0,right:viewport.width,bottom:viewport.height},{compact:true});
  const positions=(result as {positions:Record<string,{cx:number;cy:number}>}).positions;
  const cardWidth=calibration.width*result.scale,cardHeight=calibration.height*result.scale*cardViewDepth(result.cardView);
  return <svg viewBox={`0 0 ${viewport.width} ${viewport.height}`} role="img" aria-label={language==='en'?'Mobile cards and betting positions':'Mobil · kort och insatsplatser'} style={{position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none'}}>
    {boxes.map((box,index)=>{const point=positions[String(box+1)],seat=result.seats[index],x=result.x+point.cx*result.scale,y=result.y+point.cy*result.scale;
      return <g key={box}><rect data-mobile-card={box} x={x-cardWidth/2} y={y-cardHeight/2} width={cardWidth} height={cardHeight} rx={3} fill="#f8fafc" stroke="#334155"/>
        <g data-mobile-bet={box} transform={`translate(${seat.x} ${seat.y})`}><rect x={-49} y={-22} width={98} height={44} rx={8} fill="#0f172a66" stroke="#fbbf24" strokeDasharray="3 3"/><ellipse rx={22*result.controlScale} ry={16*result.controlScale} fill="#14532d" stroke="#fde047"/><text textAnchor="middle" dominantBaseline="central" fontSize={12} fill="white">{index+1}</text></g>
      </g>;})}
  </svg>;
}

export function PartnerAppearancePreview({server,branding,scope,operatorSlug,language='sv',onStale,active=true,initiallyEnabled=false,compact=false,onMedia,mobilePlacement}: {
  server:PartnerAppearanceInitial;branding:EditableBranding;scope:string;operatorSlug:string;language?:string;onStale:()=>void;active?:boolean;initiallyEnabled?:boolean;compact?:boolean;onMedia?:(payload:PublicOperatorPreview|null)=>void;
  mobilePlacement?:{tableId:string;offsetY:number};
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
  const layout=room?.game==='blackjack'?(mobilePlacement?'mobile':selectedLayout):'desktop';
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
  let placementSettings:CompositionSettings|null=null;
  if(mobilePlacement&&payload?.settings&&room?.game==='blackjack'&&mobilePlacement.tableId===tableId){
    try{placementSettings=adjustPublishedMobilePlacement(payload.settings,tableId,mobilePlacement.offsetY);}catch{/* Invalid offsets never render a guessed placement. */}
  }
  const tableAsset=server.presentation?.assets.find(row=>row.id===tableId&&row.role==='table');
  const placementOverlay=placementSettings&&tableAsset&&tableAsset.width>0&&tableAsset.height>0
    ?<MobilePlacementOverlay settings={placementSettings} tableId={tableAsset.id} width={tableAsset.width} height={tableAsset.height} language={language}/>:undefined;
  const media=(row:typeof table)=>row?{url:row.src,label:row.label,contentType:row.contentType}:null;
  const missingLayers=payload?.independentLayers&&Boolean(tableId&&!table||backgroundId&&lane?.layers.background.mode!=='baked'&&!background);
  const previewControls = <div className={styles.actions}><button type="button" className="sg-btn" data-action="open-preview" aria-label={enabled?(compact?t('Uppdatera förhandsvisning','Refresh preview'):t('Ladda om förhandsvisning','Reload preview')):t('Visa förhandsvisning','Show preview')} onClick={()=>{if(!dealerId)return;setEnabled(true);setAttempt(value=>value+1);}} disabled={!dealerId||enabled&&current.status==='loading'}>{enabled?(compact?t('Uppdatera','Refresh'):t('Ladda om förhandsvisning','Reload preview')):t('Visa förhandsvisning','Show preview')}</button><button type="button" className="sg-btn" disabled={Boolean(mobilePlacement)} aria-pressed={layout==='desktop'} onClick={()=>setLayout('desktop')}>Desktop</button>{room?.game==='blackjack'&&<button type="button" className="sg-btn" aria-pressed={layout==='mobile'} onClick={()=>setLayout('mobile')}>{t('Mobil','Mobile')}</button>}</div>;
  return <section className={styles.preview} aria-label={t('Förhandsvisning av valda lager','Selected layers preview')}>
    {compact?<header className={styles.previewHeader}><h4>{t('Förhandsvisning','Preview')}</h4>{room&&lane&&previewControls}</header>:<h4>{t('Förhandsvisning av valda lager','Selected layers preview')}</h4>}
    {!compact&&<p className={styles.hint}>{t('Visar valda lager och grundloop från paketets frysta media. Bordsfärgens gränssnittsdetaljer och spelets händelser ingår inte i denna bild.','Shows selected layers and the idle clip from the package’s frozen media. Table-colour interface details and game events are not shown in this image.')}</p>}
    {!scope?<label className={styles.row}>{t('Förhandsvisa rum','Preview room')}<select aria-label={t('Förhandsvisa rum','Preview room')} value={room?.id??''} onChange={event=>setChosenRoom(event.target.value)}>{server.rooms?.map(row=><option key={row.id} value={row.id}>{row.label}</option>)}</select></label>:null}
    {!room||!lane?<p>{t('Det finns inget publicerat spelrum för denna sammansättning att förhandsvisa.','There is no published room for this presentation to preview.')}</p>:<>
      {!compact&&<p>{room.label} · {t('paketversion','package version')} {server.packageRevision}</p>}
      {!dealerId?<p role="status" className={styles.hint}>{chosenDealer?t('Det sparade dealervalet kan inte användas i det här rummet. Välj en tillåten dealer i inställningarna ovan, eller be intern personal uppdatera publiceringen.','The saved dealer choice cannot be used in this room. Choose an allowed dealer in the settings above, or ask internal staff to update the publication.'):t('Sammansättningen saknar ett publicerat dealerval. Välj en dealer i inställningarna ovan, eller be intern personal publicera ett val.','This composition has no published dealer choice. Choose a dealer in the settings above, or ask internal staff to publish a choice.')}</p>:null}
      {!compact&&previewControls}
      {room.game==='roulette'&&<p className={styles.hint}>{t('Roulette använder Desktop 16:9 även på mobil.','Roulette uses Desktop 16:9 on mobile too.')}</p>}
      {enabled&&dealerId&&current.status==='loading'?<p role="status">{t('Hämtar frysta lager…','Loading frozen layers…')}</p>:null}
      {enabled&&dealerId&&current.status==='unavailable'?<p role="alert">{t('Förhandsvisningen kunde inte hämtas för denna version och dealer. Utkastet finns kvar.','The preview could not be loaded for this version and dealer. Your draft is preserved.')}</p>:null}
      {enabled&&dealerId&&payload?<>
        {!payload.media.dealer?<p className={styles.hint}>{t('Denna dealer saknar tillgänglig fryst grundloop i förhandsvisningen. Övriga tillgängliga lager visas.','This dealer has no frozen idle clip available in the preview. Other available layers are shown.')}</p>:null}
        {missingLayers?<p role="alert">{t('Ett valt lager saknar tillgänglig förhandsvisningsfil. Bilden är ofullständig.','A selected layer has no available preview file. This image is incomplete.')}</p>:null}
        {mobilePlacement&&!placementOverlay?<p role="alert">{t('Mobilplaceringen kan inte förhandsvisas för detta bord och denna version.','Mobile placement cannot be previewed for this table and version.')}</p>:null}
        {payload.independentLayers&&payload.settings&&(!mobilePlacement||placementOverlay)?<CompositionPreview language={language} dealer={payload.media.dealer?{url:payload.media.dealer.src,label:payload.dealer.label,contentType:payload.media.dealer.contentType}:null} table={media(table)} background={media(background)} settings={placementSettings??payload.settings} layout={layout} overlay={placementOverlay} show={{dealer:Boolean(payload.media.dealer),table:Boolean(table),background:Boolean(background)}} compositing={payload.media.dealer?.compositing} framing={payload.media.dealer?.framing}/>
          :!mobilePlacement&&payload.media.dealer?<DealerClipPreview key={payload.media.dealer.src} url={payload.media.dealer.src} compositing={payload.media.dealer.compositing} framing={payload.media.dealer.framing} label={payload.dealer.label}/>:null}
      </>:null}
    </>}
    {compact&&<details className={styles.previewHelp}><summary>{t('Om förhandsvisningen','About the preview')}</summary><p className={styles.hint}>{t('Visar valda lager och grundloop från paketets frysta media. Bordsfärgens gränssnittsdetaljer och spelets händelser ingår inte i denna bild.','Shows selected layers and the idle clip from the package’s frozen media. Table-colour interface details and game events are not shown in this image.')}</p></details>}
  </section>;
}
