import {useEffect,useRef,useState} from 'react';
import {ControlResourceLifecycle,type LifecycleSnapshot} from '../../../../../lab/components/control-resource-lifecycle';
import {lifecycleSnapshotKey} from '../../lib/studio-resource-lifecycle.mjs';

type RoomContext={id:string;operatorId:string;compositionId:string;game:string};
export function RegisteredResourceLifecycle({operatorId,rooms=[],disabled,onChanged,onBusyChange}:{operatorId:string;rooms?:RoomContext[];disabled:boolean;onChanged:()=>void;onBusyChange?:(busy:boolean)=>void}){
  const revision=useRef(''),operations=useRef(new Set<string>());
  const [busy,setBusy]=useState(false);
  useEffect(()=>{if(!busy)return;const unload=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};
    const leave=(event:Event)=>event.preventDefault();
    window.addEventListener('beforeunload',unload);window.addEventListener('scout:navigate',leave);
    return()=>{window.removeEventListener('beforeunload',unload);window.removeEventListener('scout:navigate',leave);};},[busy]);
  function changed(snapshot:LifecycleSnapshot){const previous=revision.current;revision.current=lifecycleSnapshotKey(snapshot);if(previous&&previous!==revision.current)onChanged();}
  function operation(key:string,value:boolean){if(value)operations.current.add(key);else operations.current.delete(key);const next=operations.current.size>0;setBusy(next);onBusyChange?.(next);}
  return <section className="rounded border border-sg-line p-4 space-y-4" aria-label="Bolagets och rummens papperskorg">
    <h2 className="font-semibold">Papperskorg · bolag och rum</h2>
    {disabled&&<p>Spara eller lös ditt Studio-utkast innan du ändrar bolag och rum.</p>}
    <ControlResourceLifecycle operatorId={operatorId} kind="operator" available disabled={disabled||busy} onBusyChange={value=>operation('operator',value)} onChanged={changed}/>
    <ControlResourceLifecycle operatorId={operatorId} kind="rooms" available disabled={disabled||busy} onBusyChange={value=>operation('rooms',value)} onChanged={changed} navigation={{
      compositionHref:(operator,room)=>{
        const query=new URLSearchParams({operator:operator.id,table:room.id,composition:room.presentationLaneId});
        const context=rooms.find(row=>row.id===room.id&&row.operatorId===operator.id&&row.compositionId===room.presentationLaneId);
        if(context)query.set('game',context.game);
        return '/admin/clips?'+query;
      },
      rehearsalLabel:'Provspela & följ',
    }}/>
  </section>;
}
