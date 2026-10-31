'use client';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {labUrl} from '../lib/lab-url.mjs';
import {companyFailure,isCompanyIdentity,suggestOperatorSlug,useCompanyFormGuard,type CompanyIdentity} from './company-form';
import styles from './company-team.module.css';

export function CompanyCreate({disabled=false,onCreated,onBusyChange}:{disabled?:boolean;onCreated:(operator:CompanyIdentity)=>void;onBusyChange?:(busy:boolean)=>void}) {
  const [name,setName]=useState(''),[slug,setSlug]=useState(''),[slugEdited,setSlugEdited]=useState(false);
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const pending=useRef(false),mounted=useRef(false),callbacks=useRef({onCreated,onBusyChange});
  callbacks.current={onCreated,onBusyChange};
  const saved=useCompanyFormGuard(Boolean(name.trim()||slug.trim()),pending);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;callbacks.current.onBusyChange?.(false);};},[]);
  async function create(event:FormEvent) {
    event.preventDefault();if(pending.current||disabled)return;
    const submitted={name:name.trim(),slug:slug.trim()};
    if(!submitted.name||!submitted.slug)return;
    pending.current=true;setBusy(true);setError('');callbacks.current.onBusyChange?.(true);
    let created:CompanyIdentity|undefined;
    try {
      const response=await fetch(labUrl('/api/admin/operator-create'),{method:'POST',credentials:'same-origin',redirect:'error',headers:{'content-type':'application/json',accept:'application/json'},body:JSON.stringify(submitted)});
      const payload=await response.json().catch(()=>null);
      if(!mounted.current)return;
      if(!response.ok){setError(companyFailure('create',response.status));return;}
      if(!isCompanyIdentity(payload?.operator)||payload.operator.slug!==submitted.slug||payload.operator.name!==submitted.name){setError('Bolaget kunde inte bekräftas. Kontrollera bolagslistan innan du försöker igen.');return;}
      created=payload.operator;setName('');setSlug('');setSlugEdited(false);saved();
    } catch {if(mounted.current)setError('Bolaget kunde inte bekräftas. Kontrollera bolagslistan innan du försöker igen.');}
    finally {pending.current=false;if(mounted.current)setBusy(false);callbacks.current.onBusyChange?.(false);}
    // The returned id is authoritative; it need not equal the requested slug.
    if(created&&mounted.current)callbacks.current.onCreated(created);
  }
  const unavailable=disabled||busy;
  return <form className={styles.stack} aria-label="Skapa bolag" aria-busy={busy} onSubmit={event=>{void create(event);}}>
    {error&&<p role="alert" className={styles.feedback}>{error}</p>}
    <label className={styles.field}>Bolagsnamn<input value={name} disabled={unavailable} onChange={event=>{setName(event.target.value);if(!slugEdited)setSlug(suggestOperatorSlug(event.target.value));}} autoComplete="organization" maxLength={120} required/></label>
    <label className={styles.field}>Adressnamn<input value={slug} disabled={unavailable} onChange={event=>{setSlugEdited(true);setSlug(event.target.value);}} autoComplete="off" spellCheck={false} maxLength={63} pattern="[a-z0-9]+(-[a-z0-9]+)*" required/><small>/partner/{slug||'bolagsnamn'}</small></label>
    <p className={styles.muted}>Standardroller skapas automatiskt. Nästa steg är att bjuda in bolagets team.</p>
    <button className="sg-btn sg-btn-secondary" type="submit" disabled={unavailable}>{busy?'Skapar bolag…':'Skapa bolag och öppna teamet'}</button>
  </form>;
}
