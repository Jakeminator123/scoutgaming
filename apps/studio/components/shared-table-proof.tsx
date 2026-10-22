'use client';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import styles from './studio-administration.module.css';

type ProofPayload={roomId:string;shoes:{shoeId:string;commitment:string;closedAt?:number|null}[];selected:null|{shoeId:string;commitment:string;closedAt?:number|null;rawProof?:string;verification?:{status:string;disclaimer?:string}};chain:{ok:boolean;complete:boolean;count:number;total:number;reason?:string}};
const validClosedAt=(value:unknown)=>value==null||typeof value==='number'&&Number.isSafeInteger(value)&&value>=0&&value<=8640000000000000;
type ReadProof=(query:Record<string,string>,signal:AbortSignal)=>Promise<unknown>;
export function SharedTableProof({read,roomChoices=[]}:{read:ReadProof;roomChoices?:{id:string;name:string}[]}) {
  const [roomId,setRoomId]=useState(''),[payload,setPayload]=useState<ProofPayload|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const epoch=useRef(0),active=useRef<AbortController|null>(null),alive=useRef(true),reader=useRef(read);reader.current=read;
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;++epoch.current;active.current?.abort();};},[]);
  function changeRoom(id:string){++epoch.current;active.current?.abort();setRoomId(id);setPayload(null);setError('');setBusy(false);}
  async function load(shoeId?:string) {
    if(!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(roomId))return;
    const seq=++epoch.current;active.current?.abort();active.current=new AbortController();setBusy(true);setPayload(null);setError('');
    try {
      const value=await reader.current({roomId,...(shoeId?{shoeId}:{})},active.current.signal) as ProofPayload;
      if(!alive.current||seq!==epoch.current)return;
      if(!value||value.roomId!==roomId||!Array.isArray(value.shoes)||!value.chain||typeof value.chain.ok!=='boolean'||typeof value.chain.complete!=='boolean'
        || !Number.isSafeInteger(value.chain.count)||!Number.isSafeInteger(value.chain.total)
        || value.shoes.some(row=>!row||typeof row.shoeId!=='string'||typeof row.commitment!=='string'||!validClosedAt(row.closedAt))
        || value.selected && (value.selected.shoeId!==shoeId||typeof value.selected.commitment!=='string'||!validClosedAt(value.selected.closedAt)||!value.shoes.some(row=>row.shoeId===shoeId&&row.commitment===value.selected?.commitment&&row.closedAt===value.selected?.closedAt)))throw Error('Skobevisets svar stämmer inte med det valda rummet.');
      setPayload(value);
    }catch(problem){if(alive.current&&seq===epoch.current)setError(problem instanceof Error?problem.message:'Skobeviset kunde inte hämtas.');}
    finally{if(alive.current&&seq===epoch.current)setBusy(false);}
  }
  function submit(event:FormEvent){event.preventDefault();if(!busy)void load();}
  return <section className={styles.section} aria-label="Skobevis och auditkedja">
    <h3>Skobevis och auditkedja</h3>
    <p>Öppna skor visar endast sitt åtagande. Fullständigt skobevis kan hämtas efter stängning.</p>
    <form className={styles.form} onSubmit={submit}>
      {roomChoices.length?<label>Spelrum<select value={roomId} onChange={event=>changeRoom(event.target.value)}><option value="">Välj spelrum</option>{roomChoices.map(room=><option value={room.id} key={room.id}>{room.name}</option>)}</select></label>
        :<label>Spelrummets ID<input value={roomId} maxLength={128} required pattern="[A-Za-z0-9][A-Za-z0-9._:-]{0,127}" onChange={event=>changeRoom(event.target.value)}/></label>}
      <button disabled={busy||!roomId}>Hämta skobevis</button>
    </form>
    {busy?<p role="status">Hämtar skobevis…</p>:null}{error?<p role="alert">{error}</p>:null}
    {payload?<><p role="status">{payload.chain.ok&&payload.chain.complete?'Auditkedjan är verifierad.':!payload.chain.complete?'Auditkedjan är ofullständig och kan inte markeras verifierad.':'Auditkedjan kunde inte verifieras.'} Kontrollerade poster: {payload.chain.count} av {payload.chain.total}.</p>
      {!payload.shoes.length?<p>Inga skor har registrerats för rummet.</p>:<ul>{payload.shoes.map(shoe=><li key={shoe.shoeId}>
        <span>{shoe.shoeId} · {shoe.closedAt!=null?'Stängd':'Öppen'}</span>{' '}
        <button type="button" disabled={busy} onClick={()=>void load(shoe.shoeId)}>Visa åtagande{shoe.closedAt!=null?' och bevis':''}</button>
      </li>)}</ul>}
      {payload.selected?<details open><summary>{payload.selected.closedAt!=null?'Stängd sko':'Öppen sko'} · {payload.selected.shoeId}</summary>
        <p>Åtagande: <code>{payload.selected.commitment}</code></p>
        {payload.selected.closedAt!=null?<><p>Bevisstatus: {payload.selected.verification?.status??'Ej verifierat'}</p>
          {typeof payload.selected.rawProof==='string'?<a href={'data:application/json;charset=utf-8,'+encodeURIComponent(payload.selected.rawProof)} download="skobevis.json">Hämta exakt skobevis (JSON)</a>:<p>Fullständigt bevis kunde inte hämtas.</p>}</>:<p>Kortordning och skobevis lämnas inte ut medan skon är öppen.</p>}
      </details>:null}
      <p>Kontrollen är ett tekniskt integritetsbevis, inte en spelcertifiering.</p>
    </>:null}
  </section>;
}
