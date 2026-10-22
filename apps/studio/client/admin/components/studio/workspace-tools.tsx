import {useEffect,useState} from 'react';
import {AdminPublicationPage,type PublicationOperatorChoice} from '../../../../components/admin-publication-page';
import type {OperatorDirectory} from '../../../../components/control-operator-directory';
import {ControlActivityPage} from '../../../../components/control-activity-page';
import {ControlPreviewPage} from '../../../../components/control-preview-page';
import {ControlEventsPage} from '../../../../components/control-events-page';
import {ControlTreePage} from '../../../../components/control-tree-page';
import {ControlProbePage} from '../../../../components/control-probe-page';
import {ControlRepliesPage} from '../../../../components/control-replies-page';
import {ControlVideosPage} from '../../../../components/control-videos-page';
import {ControlGuidePage} from '../../../../components/control-guide-page';

import {ControlOpenClawChat} from '../../../../components/control-openclaw-chat';
import {LabStudio} from '../../../../components/lab-studio';
import type {StudioProject} from '../../../../../../packages/presentation/contracts/studio-model.mjs';
import type { ConnectionStatus } from '../../../../components/studio-types';
import type { VideoInventory } from '../../../../../../packages/presentation/contracts/media-inventory.mjs';
import {studioNavigationContextFromQuery} from '../../../../lib/studio-navigation.mjs';
import {ADMIN_DEPTH_TOOLS,ADMIN_WORKSPACE_TOOLS} from '../../../../../../packages/navigation/admin-workspace-routes.mjs';
import {labUrl} from '../../../../lib/lab-url.mjs';
import {withAdminContext} from '../../../runtime/admin-routing.mjs';
import {adminPageLabels,adminToolHome} from '../../lib/admin-navigation';
import {ConnectedServices} from './connected-services';

type Workspace={project:StudioProject;videos:VideoInventory;status:ConnectionStatus;connectedLane:boolean;
  operators:PublicationOperatorChoice[];directory:OperatorDirectory|null;storeAvailable:boolean};
const depthDescriptions:Record<string,string>={
  'media-review':'Godkänn dealerns exakta ljud, video och synk per replik.',
  replies:'Sparade svar per dealer med exakt text, ljud och läppsynk.',
  events:'Vilka klipp och villkor som gäller för varje spelhändelse.',
  guide:'Hjälp och arbetssteg för Admin.',
};
// Fördjupning lists only tools without a menu page of their own.
export function WorkspaceToolsHome(){return <section className="admin-system-page" aria-labelledby="workspace-tools-title">
  <header className="admin-system-header"><div><p className="sg-eyebrow">System</p><h1 id="workspace-tools-title">Fördjupning</h1>
    <p>Fördjupade verktyg för tal, svar och spelhändelser – dealers, bolag och rum hanteras i huvudmenyn.</p></div></header>
  <ul className="admin-system-grid" aria-label="Fördjupning">{ADMIN_DEPTH_TOOLS.map(key=><li className="admin-system-card" key={key}><h2>{ADMIN_WORKSPACE_TOOLS[key as keyof typeof ADMIN_WORKSPACE_TOOLS]}</h2><p>{depthDescriptions[key]}</p>
    <a className="studio-button mt-4" href={withAdminContext('/admin/'+key,location.search)}>Öppna</a></li>)}</ul></section>;}

export function WorkspaceTool({section}:{section:string}){
  const [,refreshContext]=useState(0);
  // Refresh only when Events crosses the overview/editor boundary. Local editor
  // selections must retain their draft; the existing history guard accepts exits first.
  const eventsEditor=section==='events'&&Boolean(new URLSearchParams(location.search).get('event'));
  const [loaded,setLoaded]=useState<{data:Workspace;eventsEditor:boolean}|null>(null),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
  const data=loaded?.eventsEditor===eventsEditor?loaded.data:null;
  useEffect(()=>{
    const controller=new AbortController();setLoaded(null);setError('');
    void (async()=>{try{
      const response=await fetch(labUrl('/api/admin/workspace/'+encodeURIComponent(section)),{credentials:'same-origin',cache:'no-store',redirect:'error',signal:controller.signal});
      if(!response.ok)throw Error([401,403].includes(response.status)?'Logga in som nivå 1 för att öppna verktyget.':'Registret kunde inte läsas. Dina sparade uppgifter är kvar.');
      const value=await response.json();
      if(!value.project?.revision||!Array.isArray(value.project.dealers)||!Array.isArray(value.videos?.videos)||value.status?.configured!==true)throw Error('Serverns svar kunde inte verifieras.');
      if(!controller.signal.aborted)setLoaded({data:value,eventsEditor});
    }catch(cause){if(!controller.signal.aborted)setError((cause as Error).message);}})();
    return()=>controller.abort();
  },[section,attempt,eventsEditor]);
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
    case 'compositions':content=<ControlPreviewPage {...common} initialRoomId={scopedRoomId} initialGame={get('game')==='roulette'?'roulette':'blackjack'}/>;break;
    case 'dealer-studio':content=<LabStudio {...common} initialGame={get('game')} initialView={get('view')} initialCategory={get('category')}/>;break;
    case 'rehearsal':content=<ControlActivityPage {...common} initialOperatorSlug={get('operator')} initialRoomId={scopedRoomId} initialGame={get('game')}/>;break;
    case 'events':content=get('event')?<ControlEventsPage {...common} initialTab={get('tab')}/>:<ControlTreePage {...common}/>;break;
    case 'videos':content=<ControlVideosPage {...common}/>;break;
    case 'replies':content=<ControlRepliesPage dealers={data.project.dealers} initialDealerId={get('dealer')} initialCategory={get('category')} initialNavigationContext={studioNavigationContextFromQuery(q)}/>;break;
    case 'media-review':content=<ConnectedServices path="/admin/media-review" dealerId={get('dealer')}/>;break;
    case 'probe':content=<ControlProbePage {...common}/>;break;
    case 'guide':content=<ControlGuidePage {...common}/>;break;
    case 'dealer-agent':content=<ControlOpenClawChat {...common} standaloneVoicePreviewAvailable={false}/>;break;
    default:return <p role="alert">Verktyget finns inte.</p>;
  }
  // One back link to the menu page this tool belongs to; the clip map keeps the dealer context.
  const home=adminToolHome(section)!;
  return <div className="admin-workspace-tool"><nav className="admin-system-actions border-b border-sg-line px-6 py-3" aria-label="Arbetsytor">
    <a href={withAdminContext(home,location.search)} className="studio-button">{adminPageLabels[home]}</a>
    {home!=='/admin/clips'&&<a className="studio-button" href={withAdminContext('/admin/clips',location.search)}>Klippkarta</a>}</nav>{content}</div>;
}
