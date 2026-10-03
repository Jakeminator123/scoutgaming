// Mock GitHub responses and owned temporary JSON only. No credential reads,
// real GitHub/GitGuardian calls, installations or API writes.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,sep,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {projectGitHubSecurityStatus,collectGitHubSecurityStatus,unwrapGitHubSecurityJson,githubSecurityRequests,
  SECURITY_REPOSITORY,gitguardianBrowserReadPlan} from '../tools/security-status.mjs';

const sha='1'.repeat(40),marker=['scanner','sensitive','do-not-print'].join('-');
const cli=fileURLToPath(new URL('../tools/security-status.mjs',import.meta.url));
const packet=(key,list=[],total=list.length)=>({total_count:total,[key]:list});
const input=extra=>({commitSha:sha,checkRuns:packet('check_runs'),checkSuites:packet('check_suites'),
  combinedStatus:packet('statuses'),observedAtMs:1000,...extra});
const gg=(extra={})=>({id:1,app:{slug:'gitguardian'},name:'GitGuardian Security Checks',status:'completed',conclusion:'success',
  output:{annotations_count:0},...extra});
const parse=r=>JSON.parse(r.stdout);

test('queued GitGuardian suite and green ordinary CI expose missing coverage, not a clean incident list',()=>{
  const report=projectGitHubSecurityStatus(input({checkSuites:packet('check_suites',[{app:{slug:'gitguardian'},status:'queued',conclusion:null}]),
    checkRuns:packet('check_runs',[{app:{slug:'github-actions'},name:'CI',status:'completed',conclusion:'success'}])}));
  assert.equal(report.githubCoverage,'complete-for-this-commit');assert.equal(report.incidentCoverage,'not-read');
  assert.equal(report.checks.length,0);assert.equal(report.suites[0].app,'gitguardian');assert.equal(report.suites[0].status,'queued');
  assert.ok(report.attention.includes('gitguardian_check_runs_not_visible'));assert.ok(report.attention.includes('gitguardian_check_pending'));
  assert.ok(report.attention.includes('gitguardian_incident_list_not_read'));
});

test('redaction admits only fixed metadata and numeric incident URLs; scanner bodies, names and queries never escape',()=>{
  const url='https://dashboard.gitguardian.com/workspace/123/incidents/456',report=projectGitHubSecurityStatus(input({
    checkRuns:packet('check_runs',[gg({name:marker,status:'completed',conclusion:'failure',details_url:url+'?token='+marker,
      output:{text:'Raw '+marker+' [incident]('+url+')',summary:marker,annotations_count:1},secret:marker,error:marker})]),
    annotations:{1:[{path:'test/studio-cutover-integration.mjs',start_line:43,end_line:44,message:marker,raw_details:marker,title:marker}]}}));
  assert.equal(report.checks[0].incidentURL,url);assert.equal(report.checks[0].name,'GitGuardian check (name redacted)');
  assert.equal(report.checks[1].file,'test/studio-cutover-integration.mjs');assert.equal(report.checks[1].line,43);
  for(const row of report.checks)assert.deepEqual(Object.keys(row),['app','name','status','conclusion','incidentURL','file','line']);
  assert.ok(!JSON.stringify(report).includes(marker));assert.ok(!JSON.stringify(report).includes('token='));
  assert.ok(report.attention.includes('gitguardian_check_requires_attention'));
});

test('foreign or credential-bearing links and unsafe annotation paths do not become exposed metadata',()=>{
  const forged=['https://dashboard.gitguardian.com.evil/workspace/123/incidents/456',
    'https://'+marker+'@dashboard.gitguardian.com/workspace/123/incidents/456',
    'https://dashboard.gitguardian.com/workspace/123/incidents/456'+marker];
  for(const details_url of forged){
    const report=projectGitHubSecurityStatus(input({checkRuns:packet('check_runs',[gg({details_url})]),annotations:{1:[
      {path:'../outside.mjs',start_line:1,message:marker},{path:'/absolute.mjs',start_line:1},
      {path:'test/'+['gh','p_','A'.repeat(36)].join('')+'.mjs',start_line:1},
      {path:'test/valid.mjs',start_line:0},{path:'test/bad\npath.mjs',start_line:2}]}}));
    assert.deepEqual(report.checks.map(x=>x.incidentURL),[null]);assert.ok(report.checks.every(x=>x.file===null));
    assert.ok(!JSON.stringify(report).includes(marker));
  }
});

test('a successful, neutral or skipped GitGuardian check still says the full incident view has not been read',()=>{
  for(const conclusion of ['success','neutral','skipped']){
    const report=projectGitHubSecurityStatus(input({checkRuns:packet('check_runs',[gg({conclusion})])}));
    assert.equal(report.incidentCoverage,'not-read');assert.ok(report.attention.includes('gitguardian_incident_list_not_read'));
    assert.equal(report.incidentAccessRequired,'intended-gitguardian-workspace-incidents:read');
    if(conclusion!=='success')assert.ok(report.attention.includes('gitguardian_check_is_not_clean_proof'));
  }
  assert.ok(projectGitHubSecurityStatus(input({checkRuns:packet('check_runs',[gg({status:'unrecognized',conclusion:null})])}))
    .attention.includes('gitguardian_check_state_unknown'));
});

test('unread pages, malformed payloads and wrapped connector JSON cannot be mistaken for a complete observation',()=>{
  const report=projectGitHubSecurityStatus(input({checkRuns:packet('check_runs',[],2)}));
  assert.equal(report.githubCoverage,'partial-for-this-commit');assert.ok(report.attention.includes('github_metadata_incomplete'));
  const wrapped={structuredContent:{content:JSON.stringify(packet('check_suites',[{app:{slug:'gitguardian'},status:'queued'}]))}};
  assert.equal(projectGitHubSecurityStatus(input({checkSuites:wrapped})).suites[0].status,'queued');
  assert.throws(()=>unwrapGitHubSecurityJson('{'+marker),e=>e.safeCode==='security_status_invalid_response'&&!e.message.includes(marker));
  assert.throws(()=>projectGitHubSecurityStatus(input({checkRuns:packet('check_runs',[gg()],0)})),/invalid_response/);
  assert.throws(()=>projectGitHubSecurityStatus(input({commitSha:marker})),/exact_commit_required/);
  assert.throws(()=>projectGitHubSecurityStatus(input({checkRuns:{isError:true,structuredContent:{content:JSON.stringify(packet('check_runs'))}}})),/invalid_response/);
  assert.throws(()=>projectGitHubSecurityStatus(input({checkRuns:packet('check_runs',[gg({head_sha:'2'.repeat(40)})])})),/response_commit_changed/);
  assert.throws(()=>projectGitHubSecurityStatus(input({combinedStatus:{...packet('statuses'),sha:'2'.repeat(40)}})),/response_commit_changed/);
});

test('collector freezes remote main and reads exact commit resources plus safe annotation locations',async()=>{
  const calls=[],fetchJson=async url=>{
    calls.push(url);assert.ok(url.startsWith('https://api.github.com/repos/'+SECURITY_REPOSITORY+'/'));
    if(url.endsWith('/branches/main'))return{commit:{sha}};
    if(url.includes('/commits/'+sha+'/check-runs?'))return packet('check_runs',[gg({output:{annotations_count:1,text:marker}})]);
    if(url.includes('/commits/'+sha+'/check-suites?'))return packet('check_suites',[{app:{slug:'gitguardian'},status:'completed',conclusion:'success'}]);
    if(url.includes('/commits/'+sha+'/status?'))return packet('statuses');
    if(url.includes('/check-runs/1/annotations?'))return[{path:'test/fixture.mjs',start_line:9,message:marker,raw_details:marker}];
    throw Error(marker);
  };
  const report=await collectGitHubSecurityStatus({fetchJson,now:()=>1000});assert.equal(report.commitSha,sha);
  assert.equal(report.annotationCoverage,'complete');assert.equal(report.observedAtMs,1000);assert.equal(calls.length,5);
  assert.equal(report.checks[1].file,'test/fixture.mjs');assert.equal(report.checks[1].line,9);assert.ok(!JSON.stringify(report).includes(marker));
});

test('unavailable annotations retain visible check metadata and honestly report missing file/line coverage',async()=>{
  const fetchJson=async url=>{
    if(url.includes('/check-runs/1/annotations?'))throw Error(marker);
    if(url.includes('/check-runs?'))return packet('check_runs',[gg({conclusion:'failure',output:{annotations_count:1}})]);
    return url.includes('/check-suites?')?packet('check_suites'):packet('statuses');
  };
  const report=await collectGitHubSecurityStatus({fetchJson,commitSha:sha});assert.equal(report.annotationCoverage,'unavailable');
  assert.equal(report.checks[0].conclusion,'failure');assert.ok(!JSON.stringify(report).includes(marker));
});

test('GitHub pagination is bounded and a changed observation refuses instead of silently claiming complete coverage',async()=>{
  let runPages=0;const fetchJson=async url=>{
    if(url.includes('/check-runs?')){runPages++;return packet('check_runs',Array.from({length:100},()=>({app:{slug:'github-actions'},name:'ordinary CI'})),501);}
    return url.includes('/check-suites?')?packet('check_suites'):packet('statuses');
  };
  const report=await collectGitHubSecurityStatus({fetchJson,commitSha:sha});assert.equal(runPages,5);
  assert.equal(report.githubCoverage,'partial-for-this-commit');
  let changed=0;await assert.rejects(collectGitHubSecurityStatus({commitSha:sha,fetchJson:async url=>{
    if(url.includes('/check-runs?'))return packet('check_runs',[{}],++changed===1?2:3);
    return url.includes('/check-suites?')?packet('check_suites'):packet('statuses');
  }}),{safeCode:'security_status_observation_changed'});
});

test('invalid remote main identity denies before querying another commit or repository',async()=>{
  let calls=0;await assert.rejects(collectGitHubSecurityStatus({fetchJson:async()=>{calls++;return{commit:{sha:marker}};}}),/exact_commit_required/);
  assert.equal(calls,1);assert.throws(()=>githubSecurityRequests('main'),/exact_commit_required/);
  assert.ok(githubSecurityRequests(sha).every(url=>url.includes('/commits/'+sha+'/')));
});

test('CLI MCP plan performs no authentication or live query and CLI snapshot output stays redacted',async t=>{
  const plan=parse(await promisify(execFile)(process.execPath,[cli,'--mcp','--ref',sha],{shell:false}));
  assert.equal(plan.requests.length,3);assert.equal(plan.repository,SECURITY_REPOSITORY);assert.equal(plan.incidentCoverage,'not-read');
  const dir=await mkdtemp(join(tmpdir(),'security-status-unit-'));t.after(async()=>{
    assert.ok(resolve(dir).startsWith(resolve(tmpdir())+sep)&&basename(dir).startsWith('security-status-unit-'));await rm(dir,{recursive:true,force:true});});
  const path=join(dir,'snapshot.json');await writeFile(path,JSON.stringify(input({checkRuns:packet('check_runs',[gg({output:{text:marker}})])})));
  const report=parse(await promisify(execFile)(process.execPath,[cli,'--from-json',path,'--ref',sha],{shell:false}));
  assert.equal(report.source,'provided-snapshot');assert.ok(!JSON.stringify(report).includes(marker));
  await writeFile(path,'{'+marker);
  await assert.rejects(promisify(execFile)(process.execPath,[cli,'--from-json',path],{shell:false}),e=>{
    const denied=JSON.parse(e.stdout);return e.stderr===''&&denied.githubCoverage==='unavailable'&&!e.stdout.includes(marker);});
});

test('existing-browser fallback is an exact repo-scoped read plan, never an incident observation or API coverage claim',async()=>{
  const plan=gitguardianBrowserReadPlan(),url=new URL(plan.overviewURL);
  assert.equal(url.origin,'https://dashboard.gitguardian.com');assert.equal(url.pathname,'/workspace/795524/incidents/secrets');
  assert.equal(plan.workspaceId,795524);assert.equal(plan.repository,SECURITY_REPOSITORY);assert.equal(plan.sourceId,30689542);
  assert.equal(url.searchParams.get('source'),'30689542+operator__in');assert.equal(url.searchParams.get('status'),'ASSIGNED,TRIGGERED+operator__in');
  assert.equal(plan.incidentCoverage,'not-read');assert.equal(plan.apiIncidentCoverage,'not-read');assert.equal(plan.scope,'repository-open-incidents');
  assert.equal(plan.knownIncidentURL,'https://dashboard.gitguardian.com/workspace/795524/incidents/37830671');
  assert.equal(Object.hasOwn(plan,'incidents'),false);assert.equal(Object.hasOwn(plan,'authenticated'),false);
  assert.equal(url.username,'');assert.equal(url.password,'');assert.equal(url.searchParams.has('token'),false);
  plan.workspaceId=123;assert.equal(gitguardianBrowserReadPlan().workspaceId,795524);
  assert.deepEqual(parse(await promisify(execFile)(process.execPath,[cli,'--browser'],{shell:false})),gitguardianBrowserReadPlan());
  await assert.rejects(promisify(execFile)(process.execPath,[cli,'--browser','--mcp'],{shell:false}),e=>{
    const report=JSON.parse(e.stdout);return report.safeCode==='security_status_cli_arguments_required'&&report.incidentCoverage==='not-read';});
  const report=projectGitHubSecurityStatus(input({checkRuns:packet('check_runs',[gg({output:{text:marker}})])}));
  assert.equal(report.browserReadFallback.apiIncidentCoverage,'not-read');assert.ok(!JSON.stringify(report).includes(marker));
});
