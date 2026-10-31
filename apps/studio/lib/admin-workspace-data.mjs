import {ADMIN_WORKSPACE_TOOLS} from '../../../packages/navigation/admin-workspace-routes.mjs';
import {STANDARD_OPERATOR_ROLES} from './operator-admin-api.mjs';
import {isCompanyTeamReadQuery} from './studio-admin-contract.mjs';

// Preserve the deployed read contract while old document editors are retired.
const workspaceReadSections=new Set([...Object.keys(ADMIN_WORKSPACE_TOOLS),'compositions','videos','rehearsal','probe','company-team']);
const headers={'Cache-Control':'private, no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff'};

// A read adapter for the existing editors, never another store or write path.
export async function serveAdminWorkspaceData(request,{authorize,runtime,connectedLane=false}) {
  await authorize(request);
  const url=new URL(request.url);
  const section=url.pathname.match(/^\/(?:studio\/)?api\/admin\/workspace\/([a-z-]+)$/)?.[1];
  if(request.method!=='GET'||!workspaceReadSections.has(section))return new Response(null,{status:400});
  const operatorId=url.searchParams.get('operator');
  if(section==='company-team'){
    if(!isCompanyTeamReadQuery(request.method,url))return new Response(null,{status:400});
    const native=await runtime();
    const [operator]=await native.listOperatorDirectory(operatorId);
    if(!operator)return new Response(null,{status:404,headers});
    return Response.json({source:'registered',operator,standardRoles:STANDARD_OPERATOR_ROLES.map(role=>({id:role.id,label:role.label,permissions:[...role.permissions]}))},{headers});
  }
  if(url.search)return new Response(null,{status:400});
  const native=await runtime();
  const [saved,videos]=await Promise.all([native.gamePolicy.readSaved(),native.videoRegistry()]);
  return Response.json({project:saved.project,videos,status:{configured:true,provider:'neon',message:'Sparat register'},
    connectedLane,operators:[],directory:null,storeAvailable:true},{headers});
}
