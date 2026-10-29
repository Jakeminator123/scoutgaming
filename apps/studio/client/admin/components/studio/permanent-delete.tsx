import {useEffect,useState} from 'react';
import {Trash2} from 'lucide-react';
import {Card,Row,Note} from '../ui/hub';
import {Button,Loading} from '../ui/kit';
import {ConfirmDialog} from '../ui/dialog';

// Radera permanent (bolag, spelbord, scenmall): a self-contained action and two small lists, kept apart from the
// pages' layouts. The server (resource-delete-check, resource-delete) decides; this only shows its answer.
type Kind='operator'|'room'|'composition';
type Target={kind:Kind;id:string;operatorId?:string;name:string};
type Blocker={code:string;items:{id:string;name:string}[]};
type Check={name:string;allowed:boolean;blockers:Blocker[];removes:Record<string,number|boolean>;token:string};
const api='/studio/api/admin/';
const blockerText:Record<string,string>={
  operator_active:'Bolaget är aktivt. Flytta det till papperskorgen först.',
  operator_published:'Bolaget har publicerat innehåll. Versionerna är historik som spel och journal pekar på och raderas inte:',
  operator_rooms_in_trash:'Bolaget har spelbord i papperskorgen. Radera dem först:',
  operator_api_keys:'Bolaget har API-nycklar. Återkalla och ta bort dem under System, Integration:',
  operator_players:'Bolaget har spelare, med saldo och historik som måste finnas kvar:',
  operator_materials:'Bolaget har eget material, som pekar på lagrade filer:',
  operator_check_unreadable:'Kontrollen kan inte läsa allt som kan peka på bolaget, så det raderas inte:',
  room_not_in_trash:'Spelbordet är inte i papperskorgen. Flytta det dit först.',
  composition_used_by_rooms:'Scenmallen används av spelbord:',
  composition_used_by_archived_rooms:'Scenmallen används av spelbord i papperskorgen. Radera eller byt mall på dem först:',
  composition_assigned:'Scenmallen ingår i aktiva bolags tilldelning. Ta bort den ur tilldelningen och publicera först:',
  composition_project_reference:'Något annat i projektet pekar fortfarande på scenmallen.',
};
const errorText:Record<string,string>={
  studio_resource_delete_blocked:'Något hindrar fortfarande raderingen. Kontrollera igen.',
  studio_delete_name_mismatch:'Namnet stämmer inte.',
  studio_conflict:'Uppgifterna har ändrats sedan kontrollen. Stäng och försök igen.',
};
const kindText:Record<Kind,string>={operator:'bolaget',room:'spelbordet',composition:'scenmallen'};
async function post(action:string,body:object) {
  const response=await fetch(api+action,{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json',accept:'application/json'},body:JSON.stringify(body)});
  const value=await response.json().catch(()=>null);
  if(!response.ok)throw Error(errorText[value?.code]??(response.status===403?'Bara Admin får radera.':'Raderingen kunde inte göras just nu.'));
  return value;
}

export function PermanentDeleteButton({target,disabled=false,onDeleted}:{target:Target;disabled?:boolean;onDeleted:()=>void}) {
  const [open,setOpen]=useState(false),[check,setCheck]=useState<Check|null>(null),[typed,setTyped]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const body={kind:target.kind,id:target.id,...(target.kind==='room'?{operatorId:target.operatorId}:{})};
  async function start() {
    setOpen(true);setCheck(null);setTyped('');setError('');
    try{setCheck(await post('resource-delete-check',body));}catch(cause){setError(cause instanceof Error?cause.message:'Kontrollen misslyckades.');}
  }
  async function confirm() {
    if(!check?.allowed||typed.trim()!==check.name.trim())return;
    setBusy(true);setError('');
    try{await post('resource-delete',{...body,confirmName:typed,token:check.token});setOpen(false);onDeleted();}
    catch(cause){setError(cause instanceof Error?cause.message:'Raderingen misslyckades.');}
    finally{setBusy(false);}
  }
  return <>
    <Button size="sm" variant="ghost" disabled={disabled} onClick={()=>void start()} data-action="permanent-delete"><Trash2 aria-hidden="true"/>Radera permanent</Button>
    <ConfirmDialog open={open} title={`Radera ${target.name} permanent`} checking={open&&!check&&!error} checkingLabel="Kontrollerar vad som pekar hit…" error={error} busy={busy} busyLabel="Raderar…"
      confirmLabel={check?.allowed?'Radera permanent':undefined} confirmDisabled={!check?.allowed||typed.trim()!==check.name.trim()} onConfirm={()=>void confirm()} onCancel={()=>setOpen(false)}
      description={check?(check.allowed?`Det här går inte att ångra. ${kindText[target.kind][0].toUpperCase()+kindText[target.kind].slice(1)} tas bort ur alla listor. Uppladdade filer raderas inte.`:`${kindText[target.kind][0].toUpperCase()+kindText[target.kind].slice(1)} kan inte raderas ännu.`):undefined}>
      {check&&!check.allowed&&<ul className="m-0 grid gap-2 p-0">{check.blockers.map(blocker=><li key={blocker.code} className="list-none rounded-lg bg-sg-warn-bg px-3 py-2 text-[13.5px] text-sg-text">
        {blockerText[blocker.code]??'Ett beroende hindrar raderingen.'}
        {blocker.items.length>0&&<ul className="mb-0 mt-1 grid gap-0.5 pl-4">{blocker.items.map(item=><li key={item.id} className="list-disc">{item.name}</li>)}</ul>}
      </li>)}</ul>}
      {check?.allowed&&<label className="grid gap-1.5 text-[13.5px] text-sg-text">Skriv <strong className="font-semibold">{check.name}</strong> för att bekräfta
        <input className="h-9 rounded-md border border-sg-border bg-sg-surface px-3 text-[14px]" value={typed} disabled={busy} autoComplete="off" spellCheck={false} onChange={event=>setTyped(event.target.value)}/></label>}
    </ConfirmDialog>
  </>;
}

type LifecycleRead={operators:{id:string;name:string;status:string;archivedAt:string|null}[];rooms:{id:string;name:string;operatorId:string;archivedAt:string|null}[]};
// Bolag och spelbord › Papperskorg: every archived company and room with Radera permanent.
export function TrashPermanentDelete({disabled=false,onChanged}:{disabled?:boolean;onChanged:()=>void}) {
  const [data,setData]=useState<LifecycleRead|null>(null),[failed,setFailed]=useState(false),[reload,setReload]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();setFailed(false);
    fetch(api+'resource-lifecycle',{credentials:'same-origin',cache:'no-store',headers:{accept:'application/json'},signal:controller.signal})
      .then(response=>response.ok?response.json():Promise.reject(Error()))
      .then(value=>{if(!controller.signal.aborted)setData(value);}).catch(()=>{if(!controller.signal.aborted)setFailed(true);});
    return()=>controller.abort();
  },[reload]);
  const deleted=()=>{setReload(value=>value+1);onChanged();};
  const companies=data?.operators.filter(row=>row.status!=='active')??[],rooms=data?.rooms.filter(row=>row.archivedAt)??[];
  const company=(id:string)=>data?.operators.find(row=>row.id===id)?.name??id;
  return <Card title="Radera permanent" className="mt-4">
    <Note className="mb-3">Radera tar bort spelbordet eller bolaget för gott. Det som publicerats till spelare förblir historik; uppladdade filer raderas inte.</Note>
    {failed?<p role="alert" className="m-0 text-[13px]">Papperskorgen kunde inte läsas. <Button size="sm" onClick={()=>setReload(value=>value+1)}>Försök igen</Button></p>
      :!data?<Loading label="Läser papperskorgen…" rows={2}/>
      :!companies.length&&!rooms.length?<p className="m-0 text-[13px] text-sg-muted">Papperskorgen är tom.</p>
      :<div className="grid">
        {rooms.map(room=><Row key={'room:'+room.id} title={room.name} text={`Spelbord · ${company(room.operatorId)}`} action={<PermanentDeleteButton target={{kind:'room',id:room.id,operatorId:room.operatorId,name:room.name}} disabled={disabled} onDeleted={deleted}/>}/>)}
        {companies.map(row=><Row key={'operator:'+row.id} title={row.name} text="Bolag" action={<PermanentDeleteButton target={{kind:'operator',id:row.id,name:row.name}} disabled={disabled} onDeleted={deleted}/>}/>)}
      </div>}
  </Card>;
}

// Scenmallar och material › Papperskorg: scene templates have no trash, so each one can be deleted when nothing uses it.
export function CompositionPermanentDelete({disabled=false,onChanged}:{disabled?:boolean;onChanged:()=>void}) {
  const [lanes,setLanes]=useState<{id:string;label:string}[]|null>(null),[failed,setFailed]=useState(false),[reload,setReload]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();setFailed(false);
    fetch('/studio/api/project',{credentials:'same-origin',cache:'no-store',headers:{accept:'application/json'},signal:controller.signal})
      .then(response=>response.ok?response.json():Promise.reject(Error()))
      .then(value=>{if(!controller.signal.aborted)setLanes((value?.project?.lanes??[]).map((lane:{id:string;label:string})=>({id:lane.id,label:lane.label})));})
      .catch(()=>{if(!controller.signal.aborted)setFailed(true);});
    return()=>controller.abort();
  },[reload]);
  return <Card title="Scenmallar" aside="Radera permanent">
    <Note className="mb-3">Scenmallar har ingen papperskorg. En scenmall går att radera när inget spelbord och ingen aktiv tilldelning använder den; kontrollen visar vad som hindrar.</Note>
    {failed?<p role="alert" className="m-0 text-[13px]">Scenmallarna kunde inte läsas. <Button size="sm" onClick={()=>setReload(value=>value+1)}>Försök igen</Button></p>
      :!lanes?<Loading label="Läser scenmallarna…" rows={2}/>
      :!lanes.length?<p className="m-0 text-[13px] text-sg-muted">Inga scenmallar.</p>
      :<div className="grid">{lanes.map(lane=><Row key={lane.id} title={lane.label} action={<PermanentDeleteButton target={{kind:'composition',id:lane.id,name:lane.label}} disabled={disabled} onDeleted={()=>{setReload(value=>value+1);onChanged();}}/>}/>)}</div>}
  </Card>;
}
