'use client';
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {validateProject,type StudioProject,type LayerAsset} from '../../../packages/presentation/contracts/studio-model.mjs';
import type {MaterialTrashImpact} from '../lib/material-trash.mjs';
import {layerAssetReferences} from '../lib/layer-asset-removal.mjs';
import {labUrl} from '../lib/lab-url.mjs';
import {requestJson} from './studio-types';

export function validMaterialTrashImpact(value:unknown,id:string,archived:boolean):value is MaterialTrashImpact {
 const row=value as MaterialTrashImpact|null;
 return Boolean(row&&row.id===id&&row.archived===archived&&/^[a-f0-9]{64}$/.test(row.token)&&typeof row.label==='string'
  &&['table','background'].includes(row.role)&&Array.isArray(row.compositions)&&Array.isArray(row.rooms)&&Array.isArray(row.operators)
  &&row.compositions.every(item=>typeof item?.id==='string'&&typeof item.label==='string')
  &&row.rooms.every(item=>typeof item?.id==='string'&&typeof item.name==='string'&&typeof item.operatorId==='string')
  &&row.operators.every(item=>typeof item?.id==='string'&&typeof item.name==='string'));
}
export function LayerAssetManager({project,role,disabled,onSaved,onBusyChange,expanded=false,filterAsset,renderAsset}: {
 project:StudioProject;role:'table'|'background';disabled:boolean;expanded?:boolean;
 filterAsset?:(asset:LayerAsset)=>boolean;
 renderAsset?:(asset:LayerAsset,actions:{disabled:boolean;onTrash:()=>void})=>ReactNode;
 onEdit?:(change:(project:StudioProject)=>StudioProject)=>void;
 onSaved?:(project:StudioProject)=>void;onBusyChange?:(busy:boolean)=>void;
}){
 const [plan,setPlan]=useState<{impact:MaterialTrashImpact;revision:string}|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[uncertain,setUncertain]=useState(false);
 const confirmation=useRef<HTMLFieldSetElement>(null);
 useEffect(()=>{if(plan)confirmation.current?.focus();},[plan]);
 const lock=useRef(false),epoch=useRef(0),callbacks=useRef({onSaved,onBusyChange});callbacks.current={onSaved,onBusyChange};
 useEffect(()=>()=>{epoch.current++;callbacks.current.onBusyChange?.(false);},[]);
 useEffect(()=>{setPlan(null);},[project.revision]);
 const assets=(project.layerAssets??[]).filter(asset=>asset.role===role&&(!filterAsset||filterAsset(asset))),trash=(project.layerAssetTrash??[]).filter(entry=>entry.asset.role===role&&(!filterAsset||filterAsset(entry.asset)));
 const blocked=disabled||busy||uncertain,heading=<>Hantera {role==='table'?'bord':'bakgrunder'} · {assets.length} filer</>;
 const Container=expanded?'section':'details';
 async function run(id:string,archived:boolean,apply=false){
  if(blocked||lock.current||!onSaved||apply&&(!plan||plan.revision!==project.revision||plan.impact.id!==id||plan.impact.archived!==archived))return;
  const ticket=epoch.current;lock.current=true;setBusy(true);callbacks.current.onBusyChange?.(true);setError('');setNotice('');
  try{
   const body={id,archived,expectedRevision:project.revision,...(apply?{impactToken:plan!.impact.token}:{})};
   const result=await requestJson<{impact:unknown;ok?:boolean;project?:StudioProject}>('/api/admin/'+(apply?'material-trash':'material-trash-check'),{method:'POST',body:JSON.stringify(body)});
   if(ticket!==epoch.current)return;
   if(!validMaterialTrashImpact(result.impact,id,archived)||result.impact.role!==role)throw Error('invalid_receipt');
   if(!apply){setPlan({impact:result.impact,revision:project.revision});return;}
   if(result.ok!==true||!result.project)throw Error('invalid_receipt');
   validateProject(result.project);
   const saved=await requestJson<{project:StudioProject}>('/api/project');validateProject(saved.project);
   if(saved.project.revision!==result.project.revision||saved.project.revision===project.revision
    ||(saved.project.layerAssetTrash?.some(entry=>entry.asset.id===id)===true)!==archived
    ||(saved.project.layerAssets?.some(asset=>asset.id===id)===true)===archived)throw Error('invalid_receipt');
   if(ticket!==epoch.current)return;
   callbacks.current.onSaved?.(saved.project);setPlan(null);setNotice(archived?'Filen ligger i papperskorgen. Berörda kopplingar är borttagna.':'Filen är återställd i biblioteket. Välj den på nytt där den ska användas.');
  }catch{
   if(ticket===epoch.current){setPlan(null);setUncertain(true);setError('Åtgärden kunde inte bekräftas. Läs in aktuella uppgifter innan du fortsätter.');}
  }finally{lock.current=false;if(ticket===epoch.current)setBusy(false);callbacks.current.onBusyChange?.(false);}
 }
 async function refresh(){
  if(lock.current||disabled)return;lock.current=true;setBusy(true);callbacks.current.onBusyChange?.(true);
  const ticket=epoch.current;
  try{const saved=await requestJson<{project:StudioProject}>('/api/project');validateProject(saved.project);
   if(ticket===epoch.current){callbacks.current.onSaved?.(saved.project);setUncertain(false);setError('');setPlan(null);}
  }catch{if(ticket===epoch.current)setError('Aktuella uppgifter kunde inte läsas. Försök igen.');}
  finally{lock.current=false;if(ticket===epoch.current)setBusy(false);callbacks.current.onBusyChange?.(false);}
 }
 if(!onSaved)return <p><a href={labUrl('/control/library?tab='+(role==='table'?'tables':'backgrounds'))}>Hantera {role==='table'?'bord':'bakgrunder'} och papperskorg i biblioteket</a></p>;
 return <Container>{expanded?<h3>{heading}</h3>:<summary>{heading}</summary>}
  {!renderAsset&&<p>Flytta en fil till papperskorgen. Kontrollera först vilka sammansättningar och publicerade spelrum som påverkas. Ändringen sparas direkt.</p>}
  {error?<p role="alert">{error} <button type="button" disabled={disabled||busy} onClick={()=>void refresh()}>Läs in aktuella uppgifter</button></p>:null}
  {notice?<p role="status">{notice}</p>:null}
  {assets.length?<ul className={renderAsset?'material-card-list':undefined}>{assets.map(asset=><li key={asset.id}>{renderAsset?renderAsset(asset,{disabled:blocked,onTrash:()=>void run(asset.id,true)}):<><strong>{asset.label}</strong> · {layerAssetReferences(project,asset.id).map(row=>row.label).join(', ')||'Oanvänd i utkast'} <button type="button" disabled={blocked} onClick={()=>void run(asset.id,true)}>Flytta till papperskorgen</button></>}</li>)}</ul>:<p>Inga filer i det här urvalet.</p>}
  <details><summary>Papperskorg · {trash.length}</summary><p>Återställning lägger tillbaka filen i biblioteket. Gamla val och publiceringar återställs inte automatiskt.</p>
   {trash.length?<ul>{trash.map(entry=><li key={entry.asset.id}>{entry.asset.label} <button type="button" disabled={blocked} onClick={()=>void run(entry.asset.id,false)}>Återställ</button></li>)}</ul>:<p>Papperskorgen är tom.</p>}
  </details>
  {plan&&plan.revision===project.revision?<fieldset ref={confirmation} tabIndex={-1} disabled={blocked}><legend>{plan.impact.archived?'Flytta till papperskorgen':'Återställ'}: {plan.impact.label}</legend>
   {plan.impact.archived?<><p>Filen kopplas loss från {plan.impact.compositions.length} sammansättningar, även arkiverade dealerutkast. Berörda spelrum avpubliceras och flyttas till papperskorgen.</p>
    {plan.impact.compositions.length?<ul>{plan.impact.compositions.map((item,index)=><li key={item.id+':'+index}>{item.label}</li>)}</ul>:null}
    {plan.impact.rooms.length?<ul>{plan.impact.rooms.map(room=><li key={room.id}>{room.name} · {plan.impact.operators.find(operator=>operator.id===room.operatorId)?.name}</li>)}</ul>:<p>Inga publicerade spelrum påverkas.</p>}
    {plan.impact.operators.length?<p>Publiceringen ändras hos: {plan.impact.operators.map(item=>item.name).join(', ')}.</p>:null}
    <p>Originalfilen och publicerad historik behålls.</p></>:<p>Filen blir valbar igen. Sammansättningar och spelrum förblir oförändrade.</p>}
   <button type="button" onClick={()=>void run(plan.impact.id,plan.impact.archived,true)}>Bekräfta</button> <button type="button" onClick={()=>setPlan(null)}>Avbryt</button>
  </fieldset>:null}
 </Container>;
}
