#!/usr/bin/env node
// Read-only GitGuardian metadata. Raw scanner output, annotation messages,
// secret values and API error bodies are never returned or written to disk.
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile,lstat} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

export const SECURITY_REPOSITORY='Jakeminator123/scoutgaming';
export function gitguardianBrowserReadPlan(){
  return{purpose:'gitguardian-browser-read-plan-v1',workspaceId:795524,repository:SECURITY_REPOSITORY,sourceId:30689542,
    overviewURL:'https://dashboard.gitguardian.com/workspace/795524/incidents/secrets?view=b6ed3942-60d2-4917-a8f7-eb9339450907&monitoring_status=archived%2Boperator__nin&status=ASSIGNED%2CTRIGGERED%2Boperator__in&sort_date=true&source=30689542%2Boperator__in&page_size=10&page=1',
    knownIncidentURL:'https://dashboard.gitguardian.com/workspace/795524/incidents/37830671',
    scope:'repository-open-incidents',filterPinsVerifiedOn:'2026-10-03',incidentCoverage:'not-read',apiIncidentCoverage:'not-read',
    instruction:'Reuse the existing signed-in Chrome GitGuardian tab. Verify workspace and selected Source Jakeminator123/scoutgaming before reading; if needed select Source, search this exact repository, and select it. Read distinct metadata fields only, never full row/page text or snippets. Report observed pages and gaps; do not save views or change incidents/access.'};
}
const base='https://api.github.com/repos/'+SECURITY_REPOSITORY;
const sha=v=>typeof v==='string'&&/^[a-f0-9]{40}$/.test(v);
const int=v=>Number.isSafeInteger(v)&&v>=0;
const fail=code=>{throw Object.assign(Error(code),{safeCode:code});};
const need=(v,code)=>{if(!v)fail(code);};
const states=new Set(['queued','in_progress','completed','pending','success','failure','error','requested','waiting']);
const conclusions=new Set(['success','failure','neutral','cancelled','skipped','timed_out','action_required','stale','startup_failure']);
const names=new Map(['GitGuardian Security Checks','GitGuardian Secret Detection','GitGuardian Secret Scan','GitGuardian','ggshield']
  .map(n=>[n.toLowerCase(),n]));
const isGG=r=>r?.app?.slug==='gitguardian'||names.has(String(r?.name??r?.context??'').toLowerCase());
function safeName(r){return names.get(String(r.name??r.context??'').toLowerCase())??(r.app?.slug==='gitguardian'?'GitGuardian check (name redacted)':null);}
function safeFile(v){
  return typeof v==='string'&&v.length<=260&&/^[A-Za-z0-9_.\/-]+$/.test(v)&&!v.startsWith('/')
    &&!v.split('/').some(p=>p==='..'||p==='')&&!/(?:sk-|gh[pousr]_|github_pat_|AIza|postgres(?:ql)?:)/.test(v)?v:null;
}
function incidentUrls(r){
  const found=new Set();
  // Extract only the fixed numeric dashboard path. Queries, fragments,
  // credentials and the rest of output.text/summary are discarded.
  for(const value of [r.details_url,r.target_url,r.output?.text,r.output?.summary])if(typeof value==='string'){
    for(const m of value.matchAll(/https:\/\/dashboard\.gitguardian\.com\/workspace\/[1-9][0-9]{0,14}\/incidents\/[1-9][0-9]{0,14}(?=[\s/?#)\]]|$)/g))found.add(m[0]);
  }
  return [...found];
}
export function unwrapGitHubSecurityJson(value){
  try{
    if(typeof value==='string')value=JSON.parse(value);
    need(value?.isError!==true,'security_status_invalid_response');
    if(typeof value?.structuredContent?.content==='string')value=JSON.parse(value.structuredContent.content);
    return value;
  }catch{fail('security_status_invalid_response');}
}
function rows(packet,key){
  packet=unwrapGitHubSecurityJson(packet);
  need(packet&&int(packet.total_count)&&Array.isArray(packet[key])&&packet.total_count>=packet[key].length,'security_status_invalid_response');
  return{values:packet[key],complete:packet.total_count===packet[key].length};
}
function metadata(r,{file=null,line=null,incidentURL=null}={}){
  return{app:r.app?.slug==='gitguardian'?'gitguardian':r.app?.slug==='github-actions'?'github-actions':null,
    name:safeName(r),status:states.has(r.status??r.state)?r.status??r.state:null,
    conclusion:conclusions.has(r.conclusion)?r.conclusion:null,incidentURL,file,line};
}
export function projectGitHubSecurityStatus({commitSha,checkRuns,checkSuites,combinedStatus,annotations={},observedAtMs=Date.now()}={}){
  need(sha(commitSha)&&int(observedAtMs),'security_status_exact_commit_required');
  const runs=rows(checkRuns,'check_runs'),suites=rows(checkSuites,'check_suites'),statuses=rows(combinedStatus,'statuses');
  need([...runs.values,...suites.values].every(r=>r?.head_sha===undefined||r.head_sha===commitSha)
    &&(unwrapGitHubSecurityJson(combinedStatus).sha===undefined||unwrapGitHubSecurityJson(combinedStatus).sha===commitSha),
    'security_status_response_commit_changed');
  const runRows=runs.values.filter(isGG),suiteRows=suites.values.filter(isGG),statusRows=statuses.values.filter(isGG),checks=[];
  for(const r of [...runRows,...statusRows]){
    const urls=incidentUrls(r);if(!urls.length)checks.push(metadata(r));else for(const incidentURL of urls)checks.push(metadata(r,{incidentURL}));
    for(const a of annotations[r.id]??[]){
      const file=safeFile(a?.path),line=int(a?.start_line)&&a.start_line>0?a.start_line:null;
      if(file&&line)checks.push(metadata(r,{file,line}));
    }
  }
  const suiteMetadata=suiteRows.map(r=>metadata(r)),all=[...checks,...suiteMetadata],attention=[];
  if(!suiteRows.length&&!runRows.length&&!statusRows.length)attention.push('gitguardian_app_not_visible');
  if(!runRows.length&&!statusRows.length)attention.push('gitguardian_check_runs_not_visible');
  if(all.some(r=>r.status==='queued'||r.status==='in_progress'||r.status==='pending'))attention.push('gitguardian_check_pending');
  if(all.some(r=>r.status==='failure'||r.status==='error'||['failure','timed_out','action_required','startup_failure'].includes(r.conclusion)))
    attention.push('gitguardian_check_requires_attention');
  if(all.some(r=>r.conclusion==='neutral'||r.conclusion==='skipped'||r.conclusion==='cancelled'||r.conclusion==='stale'))
    attention.push('gitguardian_check_is_not_clean_proof');
  if(all.some(r=>r.status===null||(r.status==='completed'&&r.conclusion===null)))attention.push('gitguardian_check_state_unknown');
  const complete=runs.complete&&suites.complete&&statuses.complete;
  if(!complete)attention.push('github_metadata_incomplete');
  attention.push('gitguardian_incident_list_not_read');
  return{purpose:'gitguardian-safe-github-status-v1',repository:SECURITY_REPOSITORY,commitSha,observedAtMs,
    githubCoverage:complete?'complete-for-this-commit':'partial-for-this-commit',checks,suites:suiteMetadata,attention,
    incidentCoverage:'not-read',incidentAccessRequired:'intended-gitguardian-workspace-incidents:read',browserReadFallback:gitguardianBrowserReadPlan()};
}
export function githubSecurityRequests(commitSha){
  need(sha(commitSha),'security_status_exact_commit_required');
  return ['check-runs','check-suites','status'].map(path=>base+'/commits/'+commitSha+'/'+path+'?per_page=100');
}
export async function collectGitHubSecurityStatus({fetchJson,commitSha,now=Date.now}={}){
  need(typeof fetchJson==='function'&&typeof now==='function','security_status_read_adapter_required');
  if(commitSha===undefined){const branch=unwrapGitHubSecurityJson(await fetchJson(base+'/branches/main'));commitSha=branch?.commit?.sha;}
  need(sha(commitSha),'security_status_exact_commit_required');
  const urls=githubSecurityRequests(commitSha),keys=['check_runs','check_suites','statuses'];
  async function pages(url,key){
    let merged;
    for(let page=1;page<=5;page++){
      const packet=unwrapGitHubSecurityJson(await fetchJson(url+'&page='+page)),part=rows(packet,key);
      if(!merged)merged={total_count:packet.total_count,[key]:[]};
      need(packet.total_count===merged.total_count,'security_status_observation_changed');merged[key].push(...part.values);
      need(merged[key].length<=merged.total_count,'security_status_invalid_response');
      if(merged[key].length===merged.total_count||part.values.length===0)break;
    }
    return merged;
  }
  const packets=await Promise.all(urls.map((url,i)=>pages(url,keys[i])));
  // Annotation messages are not needed to expose file/line; request only for
  // actual GitGuardian run IDs. Annotation pages stay explicitly bounded.
  const annotations={};let annotationCoverage='complete';
  for(const r of packets[0].check_runs.filter(isGG))if(int(r.id)&&r.id>0){
    annotations[r.id]=[];const expected=r.output?.annotations_count;
    if(expected===0)continue;
    try{
      for(let page=1;page<=5;page++){
        const value=unwrapGitHubSecurityJson(await fetchJson(base+'/check-runs/'+r.id+'/annotations?per_page=100&page='+page));
        need(Array.isArray(value),'security_status_invalid_response');annotations[r.id].push(...value);
        if(value.length<100)break;
      }
      if(!int(expected)||annotations[r.id].length!==expected)annotationCoverage='partial';
    }catch{annotationCoverage='unavailable';}
  }
  return{...projectGitHubSecurityStatus({commitSha,checkRuns:packets[0],checkSuites:packets[1],combinedStatus:packets[2],annotations,observedAtMs:now()}),annotationCoverage};
}
const exec=promisify(execFile);
async function githubCliJson(url){
  need(typeof url==='string'&&url.startsWith(base+'/'),'security_status_fixed_repository_required');
  try{
    const r=await exec('gh',['api',url.slice('https://api.github.com/'.length),'--method','GET'],
      {encoding:'utf8',timeout:20000,maxBuffer:8388608,windowsHide:true});
    return unwrapGitHubSecurityJson(r.stdout);
  }catch{fail('security_status_github_cli_access_unavailable');}
}
async function cli(args){
  const values={};for(let i=0;i<args.length;i++){
    const a=args[i];need(['--mcp','--browser','--ref','--from-json'].includes(a)&&!Object.hasOwn(values,a),'security_status_cli_arguments_required');
    values[a]=a==='--mcp'||a==='--browser'?true:args[++i];
  }
  const commitSha=values['--ref'];need(commitSha===undefined||sha(commitSha),'security_status_exact_commit_required');
  if(values['--browser']){need(Object.keys(values).length===1,'security_status_cli_arguments_required');return gitguardianBrowserReadPlan();}
  if(values['--mcp']){
    need(!values['--from-json'],'security_status_cli_arguments_required');
    return{purpose:'gitguardian-github-mcp-read-plan-v1',repository:SECURITY_REPOSITORY,
      freezeRemoteMain:base+'/branches/main',requests:commitSha?githubSecurityRequests(commitSha):[],
      instruction:commitSha?'Use github_fetch GET for these exact URLs; retain safe metadata only.':'Read remote main SHA, then rerun --mcp --ref with that full SHA.',
      incidentCoverage:'not-read',browserReadFallback:gitguardianBrowserReadPlan()};
  }
  if(values['--from-json']){
    const path=resolve(values['--from-json']),info=await lstat(path);
    need(info.isFile()&&!info.isSymbolicLink()&&info.size<=8388608,'security_status_regular_snapshot_required');
    const input=unwrapGitHubSecurityJson(await readFile(path,'utf8'));
    const report=projectGitHubSecurityStatus(input);need(!commitSha||report.commitSha===commitSha,'security_status_snapshot_commit_changed');
    return{...report,source:'provided-snapshot'};
  }
  return{...await collectGitHubSecurityStatus({fetchJson:githubCliJson,commitSha}),source:'github-live-cli'};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{console.log(JSON.stringify(await cli(process.argv.slice(2))));}
  catch(e){console.log(JSON.stringify({purpose:'gitguardian-safe-status-unavailable',repository:SECURITY_REPOSITORY,
    safeCode:e.safeCode??'security_status_unavailable',githubCoverage:'unavailable',incidentCoverage:'not-read',
    fallback:'Use the connected GitHub github_fetch GET; --mcp prints the exact read flow. --browser prints the existing GitGuardian Chrome read fallback.',
    browserReadFallback:gitguardianBrowserReadPlan()}));process.exitCode=2;}
}
