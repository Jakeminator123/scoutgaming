'use client';
import {useRef,useState} from 'react';
import type {StudioProject} from '../../packages/presentation/contracts/studio-model.mjs';
import {rebaseProjectDraft} from '../lib/project-rebase.mjs';
import {requestJson} from './studio-types';
export function ProjectConflict({base,draft,onResolve}:{base:StudioProject;draft:StudioProject;onResolve:(remote:StudioProject,merged:StudioProject)=>void}){
  const [remote,setRemote]=useState<StudioProject|null>(null);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const latest=useRef({base,draft,onResolve});
  latest.current={base,draft,onResolve};
  const conflicts=remote?rebaseProjectDraft(base,draft,remote).conflicts:[];
  async function load(){
    setBusy(true);
    try{
      const result=await requestJson<{project:StudioProject}>('/api/project');
      // The editor stays editable during the read; merge its latest draft.
      const current=latest.current;
      const merged=rebaseProjectDraft(current.base,current.draft,result.project);
      if(!merged.conflicts.length)current.onResolve(result.project,merged.project);
      else setRemote(result.project);
    }catch(cause){setError(String(cause));}finally{setBusy(false);}
  }
  return <aside className="notice" role="alert"><strong>Projektet har ändrats i en annan vy.</strong><p>Dina osparade val finns kvar. Hämta senaste versionen och slå ihop ändringarna före nästa sparning.</p>{remote?<><p>Val som krockar: {conflicts.join(', ')}</p><button type="button" onClick={()=>onResolve(remote,rebaseProjectDraft(base,draft,remote,'local').project)}>Behåll mina val där det krockar</button><button type="button" onClick={()=>onResolve(remote,rebaseProjectDraft(base,draft,remote,'remote').project)}>Använd sparade val där det krockar</button></>:<button type="button" disabled={busy} onClick={()=>void load()}>{busy?'Hämtar…':'Hämta senaste · behåll mitt utkast'}</button>}{error?<p>{error}</p>:null}</aside>;
}
