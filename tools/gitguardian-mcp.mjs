#!/usr/bin/env node
// Dependency-free MCP stdio, JSON-RPC JSON lines. Startup/initialize/list do
// not read the protected token or call GitGuardian. Two read-only tools only.
import {createInterface} from 'node:readline';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createGitGuardianReader} from './gitguardian-read.mjs';

const toolNames=['read_source_binding','read_repo_incidents'];
export const GITGUARDIAN_MCP_TOOLS=Object.freeze(toolNames.map(name=>({name,
  description:name==='read_source_binding'?'Verify GitGuardian source30689542 binds Jakeminator123/scoutgaming. Metadata only.':
    'Read every incident status for source30689542, with paginated file/line metadata. No secrets, snippets or mutations.',
  inputSchema:{type:'object',properties:{},additionalProperties:false},
  annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:true}})));
const protocols=['2025-11-25','2025-06-18','2025-03-26','2024-11-05'];
export function createGitGuardianRpc({reader=createGitGuardianReader()}={}){
  let initialized=false;
  const error=(id,code,message)=>({jsonrpc:'2.0',id,error:{code,message}});
  return async value=>{
    const id=value?.id??null;
    if(!value||typeof value!=='object'||Array.isArray(value)||value.jsonrpc!=='2.0'||typeof value.method!=='string'
      ||(Object.hasOwn(value,'id')&&!(typeof value.id==='string'||Number.isSafeInteger(value.id))))return error(null,-32600,'Invalid Request');
    if(!Object.hasOwn(value,'id'))return null;
    let result;
    if(value.method==='initialize'){
      if(initialized||typeof value.params?.protocolVersion!=='string')return error(id,-32602,'Invalid params');
      initialized=true;result={protocolVersion:protocols.includes(value.params.protocolVersion)?value.params.protocolVersion:protocols[0],
        capabilities:{tools:{}},serverInfo:{name:'croupier-gitguardian-readonly',version:'1.0.0'}};
    }else if(!initialized)return error(id,-32000,'Initialize required');
    else if(value.method==='ping')result={};
    else if(value.method==='tools/list')result={tools:GITGUARDIAN_MCP_TOOLS};
    else if(value.method==='tools/call'){
      const p=value.params,a=p?.arguments??{};
      if(!p||!toolNames.includes(p.name)||!a||typeof a!=='object'||Array.isArray(a)||Object.keys(a).length
        ||Object.keys(p).some(k=>!['name','arguments','_meta'].includes(k)))return error(id,-32602,'Invalid params');
      let data;try{data=await reader[p.name==='read_source_binding'?'readSourceBinding':'readRepoIncidents']();}
      catch{data={safeCode:'gg_read_unavailable',incidentCoverage:'not-read'};}
      result={content:[{type:'text',text:JSON.stringify(data)}],structuredContent:data,
        isError:Boolean(data.safeCode||data.coverageGaps?.length)};
    }else return error(id,-32601,'Method not found');
    return{jsonrpc:'2.0',id,result};
  };
}
export async function runGitGuardianMcp({input=process.stdin,output=process.stdout,rpc=createGitGuardianRpc()}={}){
  const lines=createInterface({input,crlfDelay:Infinity});
  for await(const line of lines){
    let response;
    if(Buffer.byteLength(line)>65536)response={jsonrpc:'2.0',id:null,error:{code:-32600,message:'Invalid Request'}};
    else{try{const message=JSON.parse(line);response=await rpc(message);}catch{response={jsonrpc:'2.0',id:null,error:{code:-32700,message:'Parse error'}};}}
    if(response)output.write(JSON.stringify(response)+'\n');
  }
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(process.argv.length!==2)process.exitCode=2;
  else await runGitGuardianMcp().catch(()=>{process.exitCode=2;});
}
