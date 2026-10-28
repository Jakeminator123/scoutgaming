import {useEffect,useState} from 'react';
import {DealerMaterialPage} from '../../../../components/dealer-material-page';
import {AdminPublicationPage,type PublicationOperatorChoice} from '../../../../components/admin-publication-page';
import type {OperatorDirectory} from '../../../../components/control-operator-directory';
import {ControlRepliesPage} from '../../../../components/control-replies-page';
import {ControlGuidePage} from '../../../../components/control-guide-page';

import {ControlOpenClawChat} from '../../../../components/control-openclaw-chat';
import type {StudioProject} from '../../../../../../packages/presentation/contracts/studio-model.mjs';
import type { ConnectionStatus } from '../../../../components/studio-types';
import type { VideoInventory } from '../../../../../../packages/presentation/contracts/media-inventory.mjs';
import {studioNavigationContextFromQuery} from '../../../../lib/studio-navigation.mjs';
import {labUrl} from '../../../../lib/lab-url.mjs';

type Workspace={project:StudioProject;videos:VideoInventory;status:ConnectionStatus;connectedLane:boolean;
  operators:PublicationOperatorChoice[];directory:OperatorDirectory|null;storeAvailable:boolean};
export function WorkspaceTool({section}:{section:string}){
  const [,refreshContext]=useState(0);
  const [data,setData]=useState<Workspace|null>(null),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();setData(null);setError('');
    void (async()=>{try{
      const response=await fetch(labUrl('/api/admin/workspace/'+encodeURIComponent(section)),{credentials:'same-origin',cache:'no-store',redirect:'error',signal:controller.signal});
      if(!response.ok)throw Error([401,403].includes(response.status)?'Logga in som nivå 1 för att öppna verktyget.':'Registret kunde inte läsas. Dina sparade uppgifter är kvar.');
      const value=await response.json();
      if(!value.project?.revision||!Array.isArray(value.project.dealers)||!Array.isArray(value.videos?.videos)||value.status?.configured!==true)throw Error('Serverns svar kunde inte verifieras.');
      if(!controller.signal.aborted)setData(value);
    }catch(cause){if(!controller.signal.aborted)setError((cause as Error).message);}})();
    return()=>controller.abort();
  },[section,attempt]);
  if(error)return <section className="admin-system-page" role="alert"><p>{error}</p><button className="studio-button" onClick={()=>setAttempt(value=>value+1)}>Försök igen</button></section>;
  if(!data)return <p role="status" className="admin-system-page">Läser sparade uppgifter…</p>;
  const q=new URLSearchParams(location.search),get=(key:string)=>q.get(key)||undefined;
  const common={initialProject:data.project,initialVideos:data.videos,initialStatus:data.status,initialDealerId:get('dealer'),
    initialLaneId:get('composition')??get('lane'),initialOperatorId:get('operator'),initialTableId:get('table'),
    initialEventId:get('event'),initialVariantId:get('variant'),initialSituation:get('situation'),connectedLane:data.connectedLane};
  const roomValues=q.getAll(q.has('room')?'room':'table');
  const initialRoomId=roomValues.length>1?roomValues:roomValues[0];
  const explicitRooms=q.getAll('room'),explicitTables=q.getAll('table');
  const scopedRooms=explicitRooms.length===1&&explicitTables.length===1&&explicitRooms[0]===explicitTables[0]
    ?explicitRooms:[...explicitRooms,...explicitTables];
  const scopedRoomId=scopedRooms.length>1?scopedRooms:scopedRooms[0];
  let content;
  switch(section){
    case 'companies':case 'publication':content=<AdminPublicationPage {...common} initialRoomId={initialRoomId} onContextChange={()=>refreshContext(value=>value+1)} operators={data.operators} directory={data.directory} storeAvailable={data.storeAvailable} initialTab={section==='companies'?'companies':'publish'}/>;break;
    case 'dealer-studio':content=<DealerMaterialPage project={data.project} dealerId={get('dealer')} navigationContext={studioNavigationContextFromQuery(q)} disabled={!data.connectedLane}/>;break;
    case 'replies':content=<ControlRepliesPage dealers={data.project.dealers} initialDealerId={get('dealer')} initialCategory={get('category')} initialNavigationContext={studioNavigationContextFromQuery(q)}/>;break;
    case 'guide':content=<ControlGuidePage {...common}/>;break;
    case 'dealer-agent':content=<ControlOpenClawChat {...common} standaloneVoicePreviewAvailable={false}/>;break;
    default:return <p role="alert">Verktyget finns inte.</p>;
  }
  return <div className="admin-workspace-tool">{content}</div>;
}
