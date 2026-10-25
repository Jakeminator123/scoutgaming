"use client"
import {useEffect,useRef,useState} from 'react';
import type {StudioProject} from '../../../../../../packages/presentation/contracts/studio-model.mjs';
import {appearanceReceipt,type PartnerAppearanceInitial} from '../../../../components/partner-appearance-state.mjs';
import {importPublishedSceneLayout,publishSavedScene,scenePublicationPreview,sameSceneValue} from '../../../../lib/scene-publication.mjs';

export function ScenePublication({project,savedProject,compositionId,operatorId,operatorSlug,operatorName,blocked,dirty,onEdit,onBusyChange}:{
  project:StudioProject;savedProject:StudioProject|null;compositionId:string;operatorId?:string;operatorSlug?:string;operatorName?:string;
  blocked:boolean;dirty:boolean;onEdit:(project:StudioProject)=>void;onBusyChange:(busy:boolean)=>void;
}){
  const [current,setCurrent]=useState<PartnerAppearanceInitial|null>(null),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const [loading,setLoading]=useState(false),[busy,setBusy]=useState(false),[attempt,setAttempt]=useState(0);
  const identity=[operatorId,operatorSlug,compositionId].join(':'),live=useRef(identity);live.current=identity;
  const lock=useRef(false),mounted=useRef(true);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  useEffect(()=>{
    setCurrent(null);setError('');setNotice('');
    if(!operatorId||!operatorSlug)return;
    let active=true;const abort=new AbortController();setLoading(true);
    void fetch('/studio/api/partner/branding?operator='+encodeURIComponent(operatorSlug),{credentials:'same-origin',cache:'no-store',signal:abort.signal,headers:{accept:'application/json'}})
      .then(async response=>{const value=await response.json();if(!active)return;if(!response.ok||!appearanceReceipt(value,operatorId)||!value.presentation)throw Error('Bolagets publicering kunde inte läsas.');setCurrent(value);})
      .catch(cause=>{if(active)setError(cause.message);}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;abort.abort();};
  },[identity,attempt]);
  const snapshot=current?.operatorId===operatorId?current:null;
  const expected=snapshot&&savedProject?scenePublicationPreview(savedProject,compositionId,snapshot.presentation):null;
  const changed=Boolean(expected&&!sameSceneValue(expected,snapshot?.presentation));
  const rooms=snapshot?.rooms?.filter(room=>room.presentationLaneId===compositionId)??[];
  const disabled=blocked||dirty||busy||loading||!snapshot||snapshot.canConfigure!==true;
  async function publish(){
    if(disabled||lock.current||!snapshot||!savedProject||!changed)return;
    lock.current=true;setBusy(true);onBusyChange(true);setError('');setNotice('');const captured=identity;
    try{const saved=await publishSavedScene({project:savedProject,compositionId,initial:snapshot,operatorSlug:operatorSlug!});
      if(mounted.current&&live.current===captured){setCurrent(saved);setNotice(`Placeringen är publicerad som version ${saved.packageRevision}.`);}
    }catch(cause){if(mounted.current&&live.current===captured){setCurrent(null);setError((cause as Error).message);}}
    finally{lock.current=false;if(mounted.current)setBusy(false);onBusyChange(false);}
  }
  return <section className="studio-scene-publication" aria-label="Publicera scenens placering">
    <h3>Publicera placeringen</h3>
    <p>{operatorId?`${operatorName??operatorId} · ${rooms.map(room=>room.label).join(', ')||'ingen publicerad koppling till mallen'}`:'Välj spelbolag under Rum och publicering för att uppdatera dess rum.'}</p>
    <p>Spara mallen först. Publiceringen uppdaterar placeringen i alla bolagets rum som använder mallen. Materialval, klipp och sparade materialutkast behålls.</p>
    {dirty&&<p role="status">Spara projektutkastet före publicering.</p>}
    <div className="flex flex-wrap gap-2">
      <button className="studio-button" disabled={disabled||!changed||!rooms.length} onClick={()=>void publish()}>Publicera sparad placering</button>
      <button className="studio-button" disabled={blocked||busy||loading||!operatorId} onClick={()=>setAttempt(value=>value+1)}>Läs in publicerad version</button>
    </div>
    {snapshot?.presentation?.lanes.some(lane=>lane.id===compositionId)&&<details><summary>Återanvänd publicerad placering</summary><p>Läs in bolagets publicerade placering som utgångspunkt i den gemensamma mallen. Materialval och andra sammansättningar ändras inte.</p>
      <button className="studio-button" disabled={disabled} onClick={()=>{if(disabled||!snapshot?.presentation)return;try{onEdit(importPublishedSceneLayout(project,compositionId,snapshot.presentation));setNotice('Placeringen är inläst i projektutkastet. Spara mallen för att behålla den.');}catch(cause){setError((cause as Error).message);}}}>Läs in placering i mallen</button>
    </details>}
    {loading&&<p role="status">Läser publicerad version…</p>}{notice&&<p role="status">{notice}</p>}{error&&<p role="alert">{error}</p>}
  </section>;
}
