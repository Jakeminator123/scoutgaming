// Local, read-only MCP. No engine commands, arbitrary URLs, files or secrets.
import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {z} from 'zod';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {classifyManifest} from './media-registry.mjs';
import {integrationIndex} from './integration-index.mjs';

export function createIntegrationMcp({index,readEvents}={}){
 const server=new McpServer({name:'croupier-integration',version:'1.0.0'});
 const result=value=>({content:[{type:'text',text:JSON.stringify(value)}]});
 server.registerResource('event-clip-index','croupier://integration/index',{mimeType:'application/json',description:'Versioned graph of server authorities, events and media; legacy media is training-only'},async uri=>({contents:[{uri:uri.href,mimeType:'application/json',text:JSON.stringify(index)}]}));
 server.registerTool('search_integration',{description:'Find game events, related clips, source modules and owners. Static configuration is not playback evidence.',inputSchema:{query:z.string().min(1).max(100)},annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false}},async({query})=>{
  const nodes=index.nodes.filter(n=>JSON.stringify(n).toLowerCase().includes(query.toLowerCase())).slice(0,50);
  const ids=new Set(nodes.map(n=>n.id)),edges=index.edges.filter(e=>ids.has(e.from)||ids.has(e.to));
  return result({revision:index.revision,nodes,edges});
 });
 server.registerTool('read_event_trace',{description:'Read recent sanitized server event relationships. Scheduled clips are not confirmed playback. No player identities, cards, balances or chat.',inputSchema:{room:z.string().regex(/^[a-zA-Z0-9_-]{1,40}$/).default('astrid')},annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false}},async({room})=>{
  if(!readEvents)return {...result({error:'Live game source is not configured'}),isError:true};
  try{return result(await readEvents(room));}catch{return {...result({error:'Game event source unavailable'}),isError:true};}
 });
 return server;
}
export function gameEventReader({baseUrl,token,fetchImpl=fetch}){
 const origin=new URL(baseUrl);
 if((origin.protocol!=='https:'&&!(origin.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(origin.hostname)))||origin.pathname!=='/'||origin.username||origin.password||origin.hash||origin.search||!token)throw Error('Invalid game audit connection');
 return async room=>{
  const url=new URL('/api/internal/game-audit/integration',origin);url.searchParams.set('room',room);
  const response=await fetchImpl(url,{headers:{Authorization:`Bearer ${token}`},redirect:'error',signal:AbortSignal.timeout(5000)});
  if(!response.ok)throw Error('Audit unavailable');
  const value=await response.json();
  return {indexRevision:value.index.revision,events:value.events};
 };
}
async function main(){
 const source=JSON.parse(readFileSync(new URL('../public/media/manifest.json',import.meta.url),'utf8'));
 const {registry}=classifyManifest(source);
 const index=integrationIndex(registry);
 const readEvents=process.env.CROUPIER_GAME_URL?gameEventReader({baseUrl:process.env.CROUPIER_GAME_URL,token:process.env.GAME_AUDIT_TOKEN}):undefined;
 const server=createIntegrationMcp({index,readEvents});await server.connect(new StdioServerTransport());
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(()=>{console.error('MCP startup failed. Check local configuration.');process.exitCode=1;});
