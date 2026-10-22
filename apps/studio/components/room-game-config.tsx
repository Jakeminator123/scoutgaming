'use client';
import {useEffect,useRef,useSyncExternalStore} from 'react';
import {createRoomGameConfigController,type RoomGameReceipt} from '../lib/room-game-config-client.mjs';
import styles from './admin-publication-page.module.css';

export function RoomGameConfig({operatorId,roomId,roomName,disabled=false,onBusyChange,onDirtyChange,onPublished}:{operatorId:string;roomId:string;roomName:string;disabled?:boolean;onBusyChange?:(busy:boolean)=>void;onDirtyChange?:(dirty:boolean)=>void;onPublished?:(receipt:RoomGameReceipt)=>void}) {
  const ref=useRef<ReturnType<typeof createRoomGameConfigController>|null>(null);
  if(!ref.current)ref.current=createRoomGameConfigController();
  const controller=ref.current,state=useSyncExternalStore(controller.subscribe,controller.getSnapshot,controller.getSnapshot);
  const callbacks=useRef({onBusyChange,onDirtyChange,onPublished});callbacks.current={onBusyChange,onDirtyChange,onPublished};
  const current=state.context?.operatorId===operatorId&&state.context?.roomId===roomId;
  const dirty=current&&controller.dirty(),receipt=current?state.receipt:null;
  const busy=current&&state.busy;
  useEffect(()=>{void controller.configure({operatorId,roomId});return()=>controller.cancel();},[controller,operatorId,roomId]);
  useEffect(()=>{callbacks.current.onBusyChange?.(busy);return()=>callbacks.current.onBusyChange?.(false);},[busy]);
  useEffect(()=>{callbacks.current.onDirtyChange?.(dirty);return()=>callbacks.current.onDirtyChange?.(false);},[dirty]);
  const off=disabled||busy||!current;
  async function act(action:'refresh'|'save'|'publish'){if(off)return;callbacks.current.onBusyChange?.(true);try{const next=await controller[action]();if(action==='publish'&&next)callbacks.current.onPublished?.(next);}finally{callbacks.current.onBusyChange?.(controller.getSnapshot().busy);}}
  function edit(field:'language'|'limitPreset',value:string){controller.edit(field,value);callbacks.current.onDirtyChange?.(controller.dirty());}
  return <section className={styles.card} aria-label="Spelinställningar för rummet">
    <h2>Spelinställningar · {roomName}</h2>
    <p>Spara ett utkast och publicera när det är klart. En pågående runda behåller sin publicerade version.</p>
    <div className={styles.contextLine}>
      <label className={styles.field}>Bordsspråk<select value={state.fields.language} disabled={off||!receipt} onChange={event=>edit('language',event.target.value)}>
        <option value="en">Engelska</option><option value="sv">Svenska</option>
      </select></label>
      <label className={styles.field}>Insatsprofil<select value={state.fields.limitPreset} disabled={off||!receipt} onChange={event=>edit('limitPreset',event.target.value)}>
        <option value="casual">Casual · 1–500</option><option value="prive">Privé · 5–2 000</option><option value="high">High · 100–25 000</option>
      </select></label>
    </div>
    <p>Insatstid: 20 sekunder. Beslutstid: 15 sekunder. Beloppen är demoenheter.</p>
    {current&&state.error?<p role="alert">{state.error}</p>:null}
    {current&&state.message?<p role="status">{state.message}</p>:null}
    {receipt&&!receipt.publication.ready?<p role="status">Publicering kräver ett sparat utkast och exakt inspelat material för valt språk. Kontrollera rummets sammansättning.</p>:null}
    <div className={styles.actions}>
      <button type="button" className="sg-btn sg-btn-secondary" disabled={off} onClick={()=>void act('refresh')}>Läs in aktuella uppgifter</button>
      <button type="button" className="sg-btn sg-btn-secondary" disabled={off||!receipt||state.stale} onClick={()=>void act('save')}>Spara spelinställningar</button>
      <button type="button" className="sg-btn sg-btn-primary" disabled={off||!receipt?.draft||state.stale||dirty||!receipt?.publication.ready} onClick={()=>void act('publish')}>Publicera spelinställningar</button>
    </div>
    {busy?<p role="status">Hämtar eller sparar spelinställningar…</p>:null}
    {receipt?<details><summary>Versioner</summary><p>Sparat utkast: {receipt.draft?.revision??'Inget'}. Publicerad spelversion: {receipt.published?.configVersion??'Ingen'}. Paketversion: {receipt.packageRevision}.</p></details>:null}
  </section>;
}
