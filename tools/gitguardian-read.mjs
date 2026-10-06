#!/usr/bin/env node
// Local, read-only GitGuardian connection. No scans, writes, secret endpoints,
// arbitrary URLs, raw provider errors or secret-bearing result objects.
// Schema: https://api.gitguardian.com/docs (sources/source incidents/locations)
// Cursor links: https://docs.gitguardian.com/api-docs/pagination
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {lstat,realpath} from 'node:fs/promises';
import {homedir} from 'node:os';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

export const GITGUARDIAN_BINDING=Object.freeze({workspaceId:795524,sourceId:30689542,repository:'Jakeminator123/scoutgaming'});
export const GITGUARDIAN_TOKEN_FILE=resolve(homedir(),'.codex/private-connections/gitguardian-795524.dpapi');
const base='https://api.gitguardian.com/v1',sourcePath='/sources/'+GITGUARDIAN_BINDING.sourceId;
const incidentPath=sourcePath+'/incidents/secrets',pageSize=100,maxPages=200,maxRows=20000;
const int=v=>Number.isSafeInteger(v)&&v>=0,id=v=>int(v)&&v>0;
const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const fail=(code,statusCode)=>{throw Object.assign(Error(code),{safeCode:code,...(int(statusCode)?{statusCode}:{})});};
const need=(v,c)=>{if(!v)fail(c);};
const safeFailure=e=>({safeCode:/^gg_read_[a-z0-9_]+$/.test(e?.safeCode??'')?e.safeCode:'gg_read_unavailable',
  ...(int(e?.statusCode)&&e.statusCode<=599?{statusCode:e.statusCode}:{})});
const date=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(v)&&Number.isFinite(Date.parse(v));
const knownStatus=new Set(['TRIGGERED','ASSIGNED','IGNORED','RESOLVED']);
function safeFile(v){return typeof v==='string'&&v.length>0&&v.length<=512&&/^[A-Za-z0-9_. /-]+$/.test(v)
  &&!v.startsWith('/')&&!v.split('/').some(p=>!p||p==='.'||p==='..')
  &&!/(?:sk-|ggpat_|gh[pousr]_|github_pat_|AIza|postgres(?:ql)?:)/.test(v)?v:null;}

// Only source-bound GETs are possible. Pagination cannot change origin, repo,
// incident membership, source filter or endpoint. Page size is bounded by
// the official1..100 schema. Never return the URL.
export function validateGitGuardianReadURL(address,{allowedIncidentIds=new Set()}={}){
  let u;try{u=new URL(address);}catch{fail('gg_read_url_denied');}
  need(u.origin==='https://api.gitguardian.com'&&!u.username&&!u.password&&!u.hash&&u.port===''&&u.pathname.startsWith('/v1/'),'gg_read_url_denied');
  const path=u.pathname.slice(3);let type;
  if(path===sourcePath){need(u.search==='','gg_read_url_denied');return'source';}
  if(path===incidentPath)type='incidents';
  else{const m=/^\/incidents\/secrets\/([1-9][0-9]{0,14})\/locations$/.exec(path);
    need(m&&allowedIncidentIds.has(Number(m[1])),'gg_read_url_denied');type='locations';}
  const keys=[...u.searchParams.keys()];need(new Set(keys).size===keys.length
    &&keys.every(k=>['cursor','per_page',...(type==='locations'?['source']:[])].includes(k)),'gg_read_url_denied');
  const perPage=u.searchParams.get('per_page');
  // Official cursor links may omit per_page (documented default20). Accept
  // only the documented1..100 range; all response pages remain capped at100.
  need(perPage===null?u.searchParams.has('cursor'):/^(?:[1-9][0-9]?|100)$/.test(perPage),'gg_read_url_denied');
  const cursor=u.searchParams.get('cursor');need(cursor===null||(cursor.length>0&&cursor.length<=4096&&!/[\x00-\x20\x7f]/.test(cursor)),'gg_read_url_denied');
  if(type==='locations')need(u.searchParams.get('source')===String(GITGUARDIAN_BINDING.sourceId),'gg_read_url_denied');
  return type;
}
export function nextGitGuardianPage(link,current,{allowedIncidentIds=new Set()}={}){
  if(link===null||link===undefined||link==='')return null;
  need(typeof link==='string'&&link.length<=16000,'gg_read_pagination_invalid');
  const parts=link.split(/,\s*(?=<)/),next=[];
  for(const part of parts){const m=/^\s*<([^<>]+)>\s*;\s*rel="(next|previous|prev|first|last)"\s*$/.exec(part);
    need(m,'gg_read_pagination_invalid');if(m[2]==='next')next.push(m[1]);}
  need(next.length<=1,'gg_read_pagination_invalid');if(!next.length)return null;
  validateGitGuardianReadURL(next[0],{allowedIncidentIds});
  const before=new URL(current),after=new URL(next[0]);need(after.pathname===before.pathname&&after.searchParams.has('cursor'),'gg_read_pagination_invalid');
  return next[0];
}
// DPAPI CurrentUser plaintext is captured by the child-process API, never
// echoed to the terminal, environment, argv, MCP output or error details.
export async function readProtectedGitGuardianToken(){
  need(process.platform==='win32','gg_read_windows_connection_required');
  try{
    const s=await lstat(GITGUARDIAN_TOKEN_FILE);need(s.isFile()&&!s.isSymbolicLink()&&s.size>0&&s.size<=65536
      &&await realpath(GITGUARDIAN_TOKEN_FILE)===GITGUARDIAN_TOKEN_FILE,'gg_read_protected_connection_required');
    const path=GITGUARDIAN_TOKEN_FILE.replaceAll("'","''");
    const command=`$ErrorActionPreference='Stop';try { $bytes=[IO.File]::ReadAllBytes('${path}'); $plain=[Security.Cryptography.ProtectedData]::Unprotect($bytes,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser); [Console]::Out.Write([Text.Encoding]::UTF8.GetString($plain)); [Array]::Clear($plain,0,$plain.Length) } catch { exit 2 }`;
    const result=await promisify(execFile)('pwsh.exe',['-NoLogo','-NoProfile','-NonInteractive','-Command',command],
      {encoding:'utf8',timeout:10000,maxBuffer:8192,windowsHide:true});
    need(typeof result.stdout==='string'&&/^[A-Za-z0-9._~-]{20,512}$/.test(result.stdout),'gg_read_protected_connection_invalid');
    return result.stdout;
  }catch{fail('gg_read_protected_connection_unavailable');}
}
function bindingSource(row){
  need(plain(row)&&row.id===GITGUARDIAN_BINDING.sourceId&&row.type==='github'
    &&row.full_name===GITGUARDIAN_BINDING.repository&&row.url==='https://github.com/'+GITGUARDIAN_BINDING.repository,
    'gg_read_source_binding_mismatch');
  need(int(row.open_incidents_count)&&int(row.closed_incidents_count),'gg_read_source_counts_unknown');
  return{open:row.open_incidents_count,closed:row.closed_incidents_count};
}
function incidentMetadata(row){
  need(plain(row)&&id(row.id)&&knownStatus.has(row.status)&&date(row.date),'gg_read_incident_schema_unknown');
  const incidentURL=`https://dashboard.gitguardian.com/workspace/${GITGUARDIAN_BINDING.workspaceId}/incidents/${row.id}`;
  need(row.gitguardian_url===incidentURL,'gg_read_workspace_binding_mismatch');
  return{id:row.id,status:row.status,repository:GITGUARDIAN_BINDING.repository,file:null,line:null,
    time:row.date,incidentURL};
}
function locationMetadata(row,incident){
  need(plain(row)&&id(row.id)&&row.incident_id===incident.id&&plain(row.source)
    &&row.source.id===GITGUARDIAN_BINDING.sourceId&&row.source.type==='github'
    &&row.source.full_name===GITGUARDIAN_BINDING.repository,'gg_read_location_binding_mismatch');
  need(Array.isArray(row.matches)&&date(row.last_updated_at),'gg_read_location_schema_unknown');
  const file=safeFile(row.filepath),lines=[...new Set(row.matches.map(m=>id(m?.line_start)&&m.line_start<=100000000?m.line_start:null))];
  if(!lines.length)lines.push(null);
  return lines.map(line=>({...incident,file,line,time:row.last_updated_at}));
}
export function createGitGuardianReader({fetchImpl=fetch,tokenProvider=readProtectedGitGuardianToken,now=Date.now}={}){
  need(typeof fetchImpl==='function'&&typeof tokenProvider==='function'&&typeof now==='function','gg_read_adapter_required');
  async function get(address,allowedIncidentIds){
    validateGitGuardianReadURL(address,{allowedIncidentIds});
    let response;try{const token=await tokenProvider();need(typeof token==='string'&&/^[A-Za-z0-9._~-]{20,512}$/.test(token),'gg_read_protected_connection_invalid');
      response=await fetchImpl(address,{method:'GET',headers:{Authorization:'Token '+token,'X-Privacy-Mode':'true',Accept:'application/json'},
        redirect:'error',signal:AbortSignal.timeout(20000)});
    }catch(e){if(e?.safeCode)throw e;fail('gg_read_transport_unavailable');}
    // Never read API error bodies, even when they are valid JSON.
    if(response?.status!==200)fail('gg_read_http_unavailable',response?.status);
    need(/^application\/json(?:\s*;|$)/i.test(response.headers?.get('content-type')??''),'gg_read_response_schema_unknown');
    let bytes=0,rows=[];try{
      for await(const chunk of response.body){bytes+=chunk.byteLength;need(bytes<=4194304,'gg_read_response_too_large');rows.push(chunk);}
      const data=JSON.parse(Buffer.concat(rows).toString('utf8'));return{data,link:response.headers.get('link')};
    }catch(e){if(e?.safeCode)throw e;fail('gg_read_response_schema_unknown');}
  }
  async function pages(address,allowedIncidentIds,project,onPage){
    const seen=new Set();let page=0,total=0;
    while(address){need(page<maxPages&&!seen.has(address),'gg_read_pagination_incomplete');seen.add(address);
      const packet=await get(address,allowedIncidentIds);need(Array.isArray(packet.data)&&packet.data.length<=pageSize,'gg_read_list_schema_unknown');
      const projected=packet.data.map(project);need(total+projected.length<=maxRows,'gg_read_pagination_incomplete');
      const next=nextGitGuardianPage(packet.link,address,{allowedIncidentIds});
      await onPage(projected);page++;total+=projected.length;address=next;
    }return page;
  }
  const common=()=>({workspaceId:GITGUARDIAN_BINDING.workspaceId,sourceId:GITGUARDIAN_BINDING.sourceId,
    repository:GITGUARDIAN_BINDING.repository,observedAtMs:now()});
  async function readSourceBinding(){
    try{bindingSource((await get(base+sourcePath,new Set())).data);return{purpose:'gitguardian-source-binding-v1',...common(),
      sourceBinding:'verified',incidentCoverage:'not-read'};}
    catch(e){return{purpose:'gitguardian-source-binding-v1',...common(),sourceBinding:'not-verified',incidentCoverage:'not-read',coverageGaps:[safeFailure(e)]};}
  }
  async function readRepoIncidents(){
    const report={purpose:'gitguardian-repository-incidents-v1',...common(),sourceBinding:'not-verified',
      incidentCoverage:'not-read',locationCoverage:'not-read',pagesRead:{incidents:0,locations:0},incidents:[],coverageGaps:[]};
    const allowed=new Set(),incidentRows=[];let counts;
    try{
      counts=bindingSource((await get(base+sourcePath,allowed)).data);report.sourceBinding='verified';
      await pages(base+incidentPath+'?per_page=100',allowed,incidentMetadata,async rows=>{
        for(const row of rows){need(!allowed.has(row.id),'gg_read_incident_observation_changed');allowed.add(row.id);incidentRows.push(row);}
        report.incidents=[...incidentRows];report.incidentCoverage='partial';report.pagesRead.incidents++;});
      const open=incidentRows.filter(r=>r.status==='TRIGGERED'||r.status==='ASSIGNED').length;
      need(open===counts.open&&incidentRows.length-open===counts.closed,'gg_read_incident_count_mismatch');
      report.incidentCoverage='complete-for-source';
      const output=[];
      for(const incident of incidentRows){
        try{const rows=[],seenLocations=new Set();await pages(base+'/incidents/secrets/'+incident.id+'/locations?source=30689542&per_page=100',
          allowed,row=>{const metadata=locationMetadata(row,incident);
            need(!seenLocations.has(row.id),'gg_read_location_observation_changed');seenLocations.add(row.id);return metadata;},
          async page=>{rows.push(...page.flat());report.pagesRead.locations++;});
          if(rows.length)output.push(...rows);
          else{output.push(incident);report.coverageGaps.push({safeCode:'gg_read_location_metadata_unavailable',incidentId:incident.id});}
          if(rows.some(r=>r.file===null||r.line===null))report.coverageGaps.push({safeCode:'gg_read_location_metadata_incomplete',incidentId:incident.id});
        }catch(e){output.push(incident);report.coverageGaps.push({...safeFailure(e),incidentId:incident.id});}
      }
      report.incidents=output;
      const end=bindingSource((await get(base+sourcePath,allowed)).data);
      need(end.open===counts.open&&end.closed===counts.closed,'gg_read_incident_observation_changed');
      report.locationCoverage=report.coverageGaps.length?'partial':'complete-for-source';
    }catch(e){report.coverageGaps.push(safeFailure(e));if(report.incidentCoverage==='complete-for-source')report.incidentCoverage='partial';}
    report.coverageGaps=[...new Map(report.coverageGaps.map(g=>[JSON.stringify(g),g])).values()];
    return report;
  }
  return Object.freeze({readSourceBinding,readRepoIncidents});
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2);let result;
  if(args.length===1&&['--source','--incidents'].includes(args[0])){const reader=createGitGuardianReader();result=await reader[args[0]==='--source'?'readSourceBinding':'readRepoIncidents']();}
  else result={safeCode:'gg_read_usage',usage:'node tools/gitguardian-read.mjs --source|--incidents'};
  console.log(JSON.stringify(result));if(result.coverageGaps?.length||result.safeCode)process.exitCode=2;
}
