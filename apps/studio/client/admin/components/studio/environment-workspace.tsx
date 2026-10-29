import {useCallback,useEffect,useRef,useState} from 'react';
import type {StudioProject} from '../../../../../../packages/presentation/contracts/studio-model.mjs';
import {validateProject} from '../../../../../../packages/presentation/contracts/studio-model.mjs';
import {createStudioClient,type Workspace} from '../../lib/connected-studio.mjs';
import {registerCompositionLayer} from '../../../../lib/studio-composition.mjs';
import {rebaseProjectDraft} from '../../../../lib/project-rebase.mjs';

const client=createStudioClient();
export type EnvironmentWorkspace=ReturnType<typeof useEnvironmentWorkspace>;

// The project draft behind Miljöer och material: one saved baseline and one draft, read once and kept while the
// page stays mounted. Saving uses the project's revision (409 keeps the draft); "Jämför senaste revision" rebases
// the draft on a newer save, as the clip map does. Registered material (uploads, a miljöbild) is merged in.
export function useEnvironmentWorkspace({active,refreshKey,onChanged}:{active:boolean;refreshKey:string|number;onChanged:()=>void}) {
  const [data,setData]=useState<Workspace|null>(null),[base,setBase]=useState<StudioProject|null>(null);
  const [status,setStatus]=useState<'idle'|'loading'|'ready'|'error'>('idle');
  const [busy,setBusy]=useState(false),[childBusy,setChildBusy]=useState(false);
  const [error,setError]=useState(''),[notice,setNotice]=useState(''),[conflicts,setConflicts]=useState<string[]>([]),[stale,setStale]=useState(false);
  const dirty=Boolean(data&&base&&JSON.stringify(data.project)!==JSON.stringify(base));
  const dirtyRef=useRef(dirty);dirtyRef.current=dirty;
  const running=useRef<AbortController|null>(null);
  const work=useCallback(async(task:(signal:AbortSignal)=>Promise<void>)=>{
    running.current?.abort();const controller=new AbortController();running.current=controller;
    setBusy(true);setError('');setNotice('');
    try{await task(controller.signal);}
    catch(cause){if(!controller.signal.aborted){const message=(cause as Error).message;setError(message);if(/annan ändring har sparats/.test(message))setStale(true);}}
    finally{if(running.current===controller){running.current=null;setBusy(false);}}
  },[]);
  const load=useCallback(()=>work(async signal=>{
    setStatus(current=>current==='ready'?current:'loading');
    try{const value=await client.load(signal);if(signal.aborted)return;setData(value);setBase(structuredClone(value.project));setConflicts([]);setStale(false);setStatus('ready');}
    catch(cause){if(!signal.aborted)setStatus(current=>current==='ready'?current:'error');throw cause;}
  }),[work]);
  // A newer save elsewhere (the clip map, the material library) reloads a clean page; a draft is never replaced.
  useEffect(()=>{if(active&&!dirtyRef.current)void load();},[active,refreshKey,load]);
  useEffect(()=>()=>running.current?.abort(),[]);
  useEffect(()=>{
    if(!dirty)return;
    const unload=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};
    window.addEventListener('beforeunload',unload);return()=>window.removeEventListener('beforeunload',unload);
  },[dirty]);
  const edit=useCallback((project:StudioProject)=>{setData(current=>current&&({...current,project}));setNotice('');},[]);
  async function save(){
    if(!data||!dirty||conflicts.length)return;
    await work(async signal=>{const saved=await client.save(data.project,signal);setData(current=>current&&({...current,project:saved}));setBase(structuredClone(saved));setStale(false);
      setNotice('Utkastet är sparat. Spelborden använder det när de publiceras i spelbordet.');onChanged();});
  }
  async function compare(){
    if(!data||!base)return;
    await work(async signal=>{const remote=await client.load(signal);const result=rebaseProjectDraft(base,data.project,remote.project);
      setData({...remote,project:validateProject(result.project)});setBase(structuredClone(remote.project));setConflicts(result.conflicts);setStale(false);
      setNotice('Senaste revisionen är jämförd; dina ändringar är kvar.');});
  }
  function registered(remote:StudioProject,id:string,role:'background'|'table'|'illustration',laneId:string){
    try{
      if(!base||!data)throw Error('Utkastet saknas. Filen är registrerad; läs in sidan igen.');
      const result=registerCompositionLayer(base,data.project,remote,{id,role,laneId});
      setBase(structuredClone(remote));setData({...data,project:result.project});setConflicts(result.conflicts);
      if(result.conflicts.length)setError('Filen är registrerad. Dessa utkastfält behöver granskas: '+result.conflicts.join(', '));
      onChanged();
    }catch(cause){setError((cause as Error).message);}
  }
  function savedRemote(remote:StudioProject){setBase(structuredClone(remote));setData(current=>current&&({...current,project:remote}));onChanged();}
  return {data,base,status,busy:busy||childBusy,dirty,error,notice,conflicts,stale,load,edit,save,compare,registered,savedRemote,setChildBusy,
    keepDraft:()=>setConflicts([]),discard:()=>void load()};
}
