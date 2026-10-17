import {ADMIN_WORKSPACE_TOOLS} from '../../packages/navigation/admin-workspace-routes.mjs';
import {STANDARD_OPERATOR_ROLES} from './operator-admin-api.mjs';

// A read adapter for the existing editors, never another store or write path.
export async function serveAdminWorkspaceData(request,{authorize,runtime,connectedLane=false}) {
  await authorize(request);
  const url=new URL(request.url);
  const section=url.pathname.match(/^\/(?:studio\/)?api\/admin\/workspace\/([a-z-]+)$/)?.[1];
  if(request.method!=='GET'||url.search||!Object.hasOwn(ADMIN_WORKSPACE_TOOLS,section))return new Response(null,{status:400});
  const native=await runtime();
  const [saved,videos]=await Promise.all([native.gamePolicy.readSaved(),native.videoRegistry()]);
  let operators=[],directory=null;
  if(section==='companies'||section==='publication'){
    const [listed,entries]=await Promise.all([native.listLaneOperators(),native.listOperatorDirectory()]);
    operators=listed;
    directory={operators:entries,standardRoles:STANDARD_OPERATOR_ROLES.map(role=>({id:role.id,label:role.label,permissions:[...role.permissions]}))};
  }
  return Response.json({project:saved.project,videos,status:{configured:true,provider:'neon',message:'Sparat register'},
    connectedLane,operators,directory,storeAvailable:true},
    {headers:{'Cache-Control':'private, no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff'}});
}
