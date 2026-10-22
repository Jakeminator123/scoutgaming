'use client';
import {useEffect,useRef,useState} from 'react';
import type {StudioProject} from '../../../packages/presentation/contracts/studio-model.mjs';
import type {StudioNavigationContext} from '../lib/studio-navigation.mjs';
import {studioHistory} from '../lib/studio-history.mjs';
import {resolveStudioDealerId} from './studio-types';
import {DealerMaterialCreator} from './dealer-forge-page';
import {StudioDealerRequired} from './studio-dealer-required';
import {StudioNavigation} from './studio-navigation';
import {PageTemplate} from './page-template.mjs';

export function DealerMaterialPage({project,dealerId,navigationContext,disabled}:{project:StudioProject;dealerId?:string;navigationContext:StudioNavigationContext;disabled:boolean}){
  const selected=resolveStudioDealerId(project,dealerId);
  const [pending,setPending]=useState({dirty:false,busy:false});
  const pendingRef=useRef(pending);pendingRef.current=pending;
  useEffect(()=>{
    const canLeave=()=>!pendingRef.current.dirty&&!pendingRef.current.busy;
    const release=studioHistory(window).guardTraversal(canLeave);
    const guard=(event:Event)=>{if(!canLeave())event.preventDefault();};
    const unload=(event:BeforeUnloadEvent)=>{if(!canLeave()){event.preventDefault();event.returnValue='';}};
    window.addEventListener('studio:before-navigate',guard);window.addEventListener('beforeunload',unload);
    return()=>{release();window.removeEventListener('studio:before-navigate',guard);window.removeEventListener('beforeunload',unload);};
  },[]);
  if(!selected)return <StudioDealerRequired project={project} title="Skapa material"/>;
  const dealer=project.dealers.find(row=>row.id===selected)!;
  return <PageTemplate eyebrow="Studio" title={dealer.label} intro="Skapa material för den här dealern."><div className="sg-page-body">
    <StudioNavigation {...navigationContext} dealerId={selected} dealerLabel={dealer.label} active="generate"/>
    {pending.dirty&&<p role="status">Spara eller ångra materialutkastet innan du lämnar sidan.</p>}
    <DealerMaterialCreator key={selected} dealerId={selected} disabled={disabled} onPendingChange={setPending} navigationContext={navigationContext}/>
  </div></PageTemplate>;
}
