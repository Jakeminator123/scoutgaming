import {useEffect,useState} from 'react';
import {ControlLanesPage,type LaneOperatorChoice} from '../../../../../lab/components/control-lanes-page';
import type {OperatorDirectory} from '../../../../../lab/components/control-operator-directory';
import {ControlActivityPage} from '../../../../../lab/components/control-activity-page';
import {ControlPreviewPage} from '../../../../../lab/components/control-preview-page';
import {ControlEventsPage} from '../../../../../lab/components/control-events-page';
import {ControlTreePage} from '../../../../../lab/components/control-tree-page';
import {ControlProbePage} from '../../../../../lab/components/control-probe-page';
import {ControlRepliesPage} from '../../../../../lab/components/control-replies-page';
import {ControlVideosPage} from '../../../../../lab/components/control-videos-page';
import {ControlGuidePage} from '../../../../../lab/components/control-guide-page';

import {ControlOpenClawChat} from '../../../../../lab/components/control-openclaw-chat';
import {LabStudio} from '../../../../../lab/components/lab-studio';
import type {StudioProject} from '../../../../../packages/presentation/contracts/studio-model.mjs';
import type { ConnectionStatus } from '../../../../../lab/components/studio-types';
import type { VideoInventory } from '../../../../../packages/presentation/contracts/media-inventory.mjs';
import {studioNavigationContextFromQuery} from '../../../../../lab/lib/studio-navigation.mjs';
import {ADMIN_WORKSPACE_TOOLS} from '../../../../../lab/lib/admin-workspace-routes.mjs';
import {labUrl} from '../../../../../lab/lib/lab-url.mjs';
import {withAdminContext} from '../../../runtime/admin-routing.mjs';
import {ConnectedServices} from './connected-services';

type Workspace={project:StudioProject;videos:VideoInventory;status:ConnectionStatus;connectedLane:boolean;
  operators:LaneOperatorChoice[];directory:OperatorDirectory|null;storeAvailable:boolean};
const groups=[
  {title:'Bolag och rum',description:'Team, rum och sparade mallar.',items:['companies','publication','compositions']},
  {title:'Dealers och material',description:'Dealerinställningar, klipp och tal.',items:['dealer-studio','videos','replies','media-review']},
  {title:'Provspelning och regler',description:'Prova sparade scener och granska spelhändelser.',items:['rehearsal','events','probe','dealer-agent','guide']},
];
export function WorkspaceToolsHome(){return <section className="admin-system-page" aria-labelledby="workspace-tools-title">
  <header className="admin-system-header"><div><p className="sg-eyebrow">System</p><h1 id="workspace-tools-title">Verktyg</h1>
    <p>Fördjupade inställningar för samma dealers, bolag och rum.</p></div>
    <nav className="admin-system-actions" aria-label="Klipp och import"><a className="studio-button" href={withAdminContext('/admin/clips?tool=import',location.search)}>Lägg till dealer eller filmer</a><a className="studio-button" href={withAdminContext('/admin/clips',location.search)}>Öppna klippkartan</a></nav>
  </header>
  <div className="grid gap-5 lg:grid-cols-3">{groups.map(group=><section className="admin-system-card" key={group.title}><h2>{group.title}</h2><p>{group.description}</p>
    <ul className="mt-4 flex flex-col gap-3">{group.items.map(key=><li key={key}><a className="studio-button" href={withAdminContext('/admin/'+key,location.search)}>{ADMIN_WORKSPACE_TOOLS[key as keyof typeof ADMIN_WORKSPACE_TOOLS]}</a></li>)}</ul>
  </section>)}</div></section>;}

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
  let content;
  switch(section){
    case 'companies':case 'publication':content=<ControlLanesPage {...common} initialRoomId={initialRoomId} onContextChange={()=>refreshContext(value=>value+1)} operators={data.operators} directory={data.directory} storeAvailable={data.storeAvailable} initialTab={section==='companies'?'companies':'publish'}/>;break;
    case 'compositions':content=<ControlPreviewPage {...common} initialGame={get('game')==='roulette'?'roulette':'blackjack'}/>;break;
    case 'dealer-studio':content=<LabStudio {...common} initialView={get('view')} initialCategory={get('category')}/>;break;
    case 'rehearsal':content=<ControlActivityPage {...common} initialOperatorSlug={get('operator')}/>;break;
    case 'events':content=get('event')?<ControlEventsPage {...common} initialTab={get('tab')}/>:<ControlTreePage {...common}/>;break;
    case 'videos':content=<ControlVideosPage {...common}/>;break;
    case 'replies':content=<ControlRepliesPage dealers={data.project.dealers} initialDealerId={get('dealer')} initialCategory={get('category')} initialNavigationContext={studioNavigationContextFromQuery(q)}/>;break;
    case 'media-review':content=<ConnectedServices path="/admin/media-review" dealerId={get('dealer')}/>;break;
    case 'probe':content=<ControlProbePage {...common}/>;break;
    case 'guide':content=<ControlGuidePage {...common}/>;break;
    case 'dealer-agent':content=<ControlOpenClawChat {...common} standaloneVoicePreviewAvailable={false}/>;break;
    default:return <p role="alert">Verktyget finns inte.</p>;
  }
  return <div className="admin-workspace-tool"><nav className="admin-system-actions border-b border-sg-line px-6 py-3" aria-label="Arbetsytor">
    <a href={withAdminContext('/admin/tools',location.search)} className="studio-button">Alla verktyg</a><a className="studio-button" href={withAdminContext('/admin/dealers',location.search)}>Dealerregister</a>
    <a className="studio-button" href={withAdminContext('/admin/clips',location.search)}>Klippkarta</a></nav>{content}</div>;
}
