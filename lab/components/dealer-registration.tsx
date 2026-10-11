'use client';
import {useState, type FormEvent} from 'react';
import {DealerSpeechSettings} from './dealer-speech-settings';
import type {VideoInventory} from './studio-types';
import {addDealer, type StudioProject} from '../lib/studio-model.mjs';
export function DealerRegistration({project,onEdit,disabled=false,onAdded,dealerId,inventory,expanded=false,showSpeechSettings=true}:{expanded?:boolean;showSpeechSettings?:boolean;dealerId?:string;inventory?:VideoInventory;project:StudioProject;onEdit:(edit:(current:StudioProject)=>StudioProject)=>void;disabled?:boolean;onAdded?:(id:string)=>void}) {
  const [id,setId]=useState(''),[name,setName]=useState(''),[error,setError]=useState(''),[idEdited,setIdEdited]=useState(false);
  function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); if(disabled)return;
    const dealerId=id.trim(),label=name.trim();
    try {addDealer(project,dealerId,label);onEdit(current=>addDealer(current,dealerId,label));setId('');setName('');setIdEdited(false);setError('');onAdded?.(dealerId);}
    catch(cause){setError(cause instanceof Error?cause.message:'Dealern kunde inte läggas till.');}
  }
  const dealer=project.dealers.find(row=>row.id===dealerId);
  const Container=expanded?'section':'details', Heading=expanded?'h3':'summary';
  return <><Container><Heading>Lägg till dealer</Heading><form onSubmit={submit}><fieldset disabled={disabled}>
    <label className="field">Dealerns namn<input required maxLength={120} value={name} onChange={event=>{setName(event.target.value);if(!idEdited)setId(event.target.value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''));}}/></label>
    <label className="field">Dealer-id<input required maxLength={40} pattern="[a-z][a-z0-9]*(-[a-z0-9]+)*" value={id} onChange={event=>{setIdEdited(true);setId(event.target.value);}}/></label>
    <button className="sg-btn sg-btn-secondary" type="submit">Lägg till</button>
    </fieldset>{error?<p role="alert">{error}</p>:null}</form></Container>{dealer&&showSpeechSettings?<DealerSpeechSettings key={dealer.id} dealer={dealer} inventory={inventory} disabled={disabled} onEdit={onEdit}/>:null}</>;
}
