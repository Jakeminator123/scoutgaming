import {useEffect,useRef,useState} from 'react';
import {ControlResourceLifecycle,type LifecycleSnapshot} from '../../../../../lab/components/control-resource-lifecycle';

export function RegisteredResourceLifecycle({operatorId,disabled,onChanged}:{operatorId:string;disabled:boolean;onChanged:()=>void}){
  const revision=useRef(''),operations=useRef(new Set<string>());
  const [busy,setBusy]=useState(false);
  useEffect(()=>{if(!busy)return;const unload=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};
    const leave=(event:Event)=>event.preventDefault();
    window.addEventListener('beforeunload',unload);window.addEventListener('scout:navigate',leave);
    return()=>{window.removeEventListener('beforeunload',unload);window.removeEventListener('scout:navigate',leave);};},[busy]);
  function changed(snapshot:LifecycleSnapshot){const previous=revision.current;revision.current=snapshot.administrationRevision;if(previous&&previous!==snapshot.administrationRevision)onChanged();}
  function operation(key:string,value:boolean){if(value)operations.current.add(key);else operations.current.delete(key);setBusy(operations.current.size>0);}
  return <section className="rounded border border-sg-line p-4 space-y-4" aria-label="Bolagets och rummens papperskorg">
    <h2 className="font-semibold">Papperskorg · bolag och rum</h2>
    {disabled&&<p>Spara eller lös ditt Studio-utkast innan du ändrar bolag och rum.</p>}
    <ControlResourceLifecycle operatorId={operatorId} kind="operator" available disabled={disabled||busy} onBusyChange={value=>operation('operator',value)} onChanged={changed}/>
    <ControlResourceLifecycle operatorId={operatorId} kind="rooms" available disabled={disabled||busy} onBusyChange={value=>operation('rooms',value)} onChanged={changed}/>
  </section>;
}
