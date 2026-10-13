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
import {ControlLayerLibraryPage} from '../../../../../lab/components/control-layer-library-page';
import {ControlOpenClawChat} from '../../../../../lab/components/control-openclaw-chat';
import {LabStudio} from '../../../../../lab/components/lab-studio';
import type {StudioProject} from '../../../../../lab/lib/studio-model.mjs';
import type {ConnectionStatus,VideoInventory} from '../../../../../lab/components/studio-types';
import {studioNavigationContextFromQuery} from '../../../../../lab/lib/studio-navigation.mjs';
import {ADMIN_WORKSPACE_TOOLS} from '../../../../../lab/lib/admin-workspace-routes.mjs';
import {labUrl} from '../../../../../lab/lib/lab-url.mjs';
import {withAdminContext} from '../../../runtime/admin-routing.mjs';
import {ConnectedServices} from './connected-services';

type Workspace={project:StudioProject;videos:VideoInventory;status:ConnectionStatus;connectedLane:boolean;
  operators:LaneOperatorChoice[];directory:OperatorDirectory|null;storeAvailable:boolean};
const groups=[
  {title:'Bolag och rum',items:['companies','publication','compositions']},
  {title:'Dealers och material',items:['dealer-studio','videos','replies','media-review','material-library']},
  {title:'Provspelning och regler',items:['rehearsal','events','probe','dealer-agent','guide']},
];
export function WorkspaceToolsHome(){return <section className="p-6"><h1 className="text-2xl font-semibold">Verktyg</h1>
  <p className="mt-2 text-sg-muted">Välj vad du vill göra. Samma sparade dealers, bolag och rum används i hela Admin.</p>
  <div className="mt-6 grid gap-6 lg:grid-cols-3">{groups.map(group=><section className="studio-detail-panel p-4" key={group.title}><h2>{group.title}</h2>
    <ul className="mt-3 flex flex-col gap-3">{group.items.map(key=><li key={key}><a className="text-sg-lime underline" href={withAdminContext('/admin/'+key,location.search)}>{ADMIN_WORKSPACE_TOOLS[key as keyof typeof ADMIN_WORKSPACE_TOOLS]}</a></li>)}</ul>
  </section>)}</div></section>;}

export function WorkspaceTool({section}:{section:string}){
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
  if(error)return <section className="p-6" role="alert"><p>{error}</p><button className="studio-button" onClick={()=>setAttempt(value=>value+1)}>Försök igen</button></section>;
  if(!data)return <p role="status" className="p-6">Läser sparade uppgifter…</p>;
  const q=new URLSearchParams(location.search),get=(key:string)=>q.get(key)||undefined;
  const common={initialProject:data.project,initialVideos:data.videos,initialStatus:data.status,initialDealerId:get('dealer'),
    initialLaneId:get('composition')??get('lane'),initialOperatorId:get('operator'),initialTableId:get('table'),
    initialEventId:get('event'),initialVariantId:get('variant'),initialSituation:get('situation'),connectedLane:data.connectedLane};
  let content;
  switch(section){
    case 'companies':case 'publication':content=<ControlLanesPage {...common} operators={data.operators} directory={data.directory} storeAvailable={data.storeAvailable} initialTab={section==='companies'?'companies':'publish'}/>;break;
    case 'compositions':content=<ControlPreviewPage {...common}/>;break;
    case 'dealer-studio':content=<LabStudio {...common} initialView={get('view')} initialCategory={get('category')}/>;break;
    case 'rehearsal':content=<ControlActivityPage {...common} initialOperatorSlug={get('operator')}/>;break;
    case 'events':content=get('event')?<ControlEventsPage {...common} initialTab={get('tab')}/>:<ControlTreePage {...common}/>;break;
    case 'videos':content=<ControlVideosPage {...common}/>;break;
    case 'replies':content=<ControlRepliesPage dealers={data.project.dealers} initialDealerId={get('dealer')} initialCategory={get('category')} initialNavigationContext={studioNavigationContextFromQuery(q)}/>;break;
    case 'media-review':content=<ConnectedServices path="/admin/media-review" dealerId={get('dealer')}/>;break;
    case 'probe':content=<ControlProbePage {...common}/>;break;
    case 'guide':content=<ControlGuidePage {...common}/>;break;
    case 'dealer-agent':content=<ControlOpenClawChat {...common} standaloneVoicePreviewAvailable={false}/>;break;
    case 'material-library':content=<ControlLayerLibraryPage {...common} initialRole={get('tab')==='backgrounds'?'background':get('tab')==='tables'?'table':get('role')==='background'?'background':'table'}/>;break;
    default:return <p role="alert">Verktyget finns inte.</p>;
  }
  return <div className="admin-workspace-tool"><div className="flex flex-wrap gap-4 border-b border-sg-line px-6 py-3 text-sm">
    <a href="/admin/tools" className="text-sg-lime">Alla verktyg</a><a href={withAdminContext('/admin/dealers',location.search)}>Dealers</a>
    <a href={withAdminContext('/admin/clips',location.search)}>Klippkarta</a></div>{content}</div>;
}
