import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable,Writable} from 'node:stream';
import {spawn} from 'node:child_process';
import {createGitGuardianReader,validateGitGuardianReadURL,nextGitGuardianPage,GITGUARDIAN_BINDING} from '../tools/gitguardian-read.mjs';
import {createGitGuardianRpc,runGitGuardianMcp} from '../tools/gitguardian-mcp.mjs';
const sourceURL='https://api.gitguardian.com/v1/sources/30689542';
const incidentsURL=sourceURL+'/incidents/secrets?per_page=100';
const repo=GITGUARDIAN_BINDING.repository,marker='DO_NOT_OUTPUT_PRIVATE_PROVIDER_FIELDS';
const token='fixture_only_not_a_real_token';
const source=(open=2,closed=0)=>({id:30689542,type:'github',full_name:repo,url:'https://github.com/'+repo,
  open_incidents_count:open,closed_incidents_count:closed,detector:marker,secret:marker});
const incident=(id,status='TRIGGERED')=>({id,status,date:'2026-10-03T16:30:00Z',gitguardian_url:'https://dashboard.gitguardian.com/workspace/795524/incidents/'+id,
  detector:{name:marker},matches:{value:marker},secret_hash:marker,secret_id:555,severity:marker,assignee_email:marker,
  incident_name:marker,occurrences:[{content:marker}],extraUnknown:marker});
const location=(iid,lid=10)=>({id:lid,incident_id:iid,source:{id:30689542,type:'github',full_name:repo,extra:marker},
  filepath:'web/server.mjs',last_updated_at:'2026-10-03T16:31:00Z',matches:[{name:marker,line_start:12,line_end:13,index_start:4,index_end:5,value:marker}],
  content:marker,remediation_prs:[{description:marker}],external_url:marker});
const json=(data,link)=>new Response(JSON.stringify(data),{headers:{'content-type':'application/json',...(link?{link}:{})}});
function fixture(routes){const calls=[];return{calls,reader:createGitGuardianReader({tokenProvider:async()=>token,now:()=>1791046000000,
  fetchImpl:async(url,options)=>{calls.push({url,options});assert.equal(options.method,'GET');assert.equal(options.redirect,'error');
    assert.equal(options.headers['X-Privacy-Mode'],'true');assert.equal(options.headers.Authorization,'Token '+token);
    assert.ok(Object.hasOwn(routes,url),'only allowlisted expected GETs');const route=routes[url];return typeof route==='function'?route():json(route.data,route.link);}})};}
const locationsURL=iid=>'https://api.gitguardian.com/v1/incidents/secrets/'+iid+'/locations?source=30689542&per_page=100';

test('fully paginates source incidents and location metadata; strips every non-allowlisted provider field',async()=>{
  const next=incidentsURL+'&cursor=cD0y',lnext=locationsURL(101)+'&cursor=cD0y';
  const{reader,calls}=fixture({[sourceURL]:{data:source(2,1)},
    [incidentsURL]:{data:[incident(101),incident(102,'ASSIGNED')],link:'<'+next+'>; rel="next"'},
    [next]:{data:[incident(103,'RESOLVED')]},
    [locationsURL(101)]:{data:[location(101)],link:'<'+lnext+'>; rel="next"'},
    [lnext]:{data:[{...location(101,11),filepath:'web/public/game.js',matches:[{line_start:21,value:marker}]}]},
    [locationsURL(102)]:{data:[location(102)]},[locationsURL(103)]:{data:[location(103)]}});
  const report=await reader.readRepoIncidents();assert.equal(report.incidentCoverage,'complete-for-source');
  assert.equal(report.locationCoverage,'complete-for-source');assert.deepEqual(report.pagesRead,{incidents:2,locations:4});
  assert.equal(report.incidents.length,4);assert.equal(report.incidents[0].line,12);assert.equal(report.incidents[1].file,'web/public/game.js');
  assert.deepEqual(Object.keys(report.incidents[0]).sort(),['file','id','incidentURL','line','repository','status','time']);
  const encoded=JSON.stringify(report);assert.equal(encoded.includes(marker),false);assert.equal(encoded.includes(token),false);
  assert.equal(encoded.includes('secret'),false);assert.equal(calls.filter(c=>c.url===sourceURL).length,2);
});
test('source binding must match exact repository, source ID, type and GitHub URL before listing',async()=>{
  for(const replacement of [{full_name:'Other/repo'},{id:30689543},{type:'gitlab'},{url:'https://github.com/Other/repo'}]){
    const{reader,calls}=fixture({[sourceURL]:{data:{...source(),...replacement}}});
    const report=await reader.readRepoIncidents();assert.equal(calls.length,1);assert.equal(report.incidentCoverage,'not-read');
    assert.equal(report.coverageGaps[0].safeCode,'gg_read_source_binding_mismatch');assert.deepEqual(report.incidents,[]);
  }
});
test('strict URL allowlist rejects other hosts/repos/endpoints/verbs-by-path, unbound incident IDs and changed filters',()=>{
  const allowed=new Set([101]);assert.equal(validateGitGuardianReadURL(locationsURL(101),{allowedIncidentIds:allowed}),'locations');
  for(const url of ['https://attacker.invalid/v1/sources/30689542',sourceURL.replace('30689542','1'),
    'https://api.gitguardian.com/v1/scan','https://api.gitguardian.com/v1/secrets/101',locationsURL(102),
    locationsURL(101).replace('source=30689542','source=1'),incidentsURL+'&status=TRIGGERED',
    incidentsURL+'&per_page=10',incidentsURL+'&api_key='+marker,sourceURL+'#'+marker,
    'https://name:password@api.gitguardian.com/v1/sources/30689542']){
    assert.throws(()=>validateGitGuardianReadURL(url,{allowedIncidentIds:allowed}),/gg_read_url_denied/);
  }
});
test('malicious next link is denied before its request; no foreign URL reaches fetch or report',async()=>{
  const{reader,calls}=fixture({[sourceURL]:{data:source(1)},[incidentsURL]:{data:[incident(101)],
    link:'<https://attacker.invalid/'+marker+'>; rel="next"'}});
  const report=await reader.readRepoIncidents();assert.equal(calls.length,2);assert.notEqual(report.incidentCoverage,'complete-for-source');
  assert.equal(JSON.stringify(report).includes(marker),false);assert.equal(report.coverageGaps[0].safeCode,'gg_read_url_denied');
  assert.throws(()=>nextGitGuardianPage('<'+incidentsURL+'&cursor=x>; rel="next", <'+incidentsURL+'&cursor=y>; rel="next"',incidentsURL),/gg_read_pagination_invalid/);
});
test('documented cursor Link without per_page is accepted; source filter cannot disappear from locations',()=>{
  assert.equal(nextGitGuardianPage('<'+sourceURL+'/incidents/secrets?cursor=cD0y>; rel="next"',incidentsURL),sourceURL+'/incidents/secrets?cursor=cD0y');
  assert.throws(()=>nextGitGuardianPage('<https://api.gitguardian.com/v1/incidents/secrets/101/locations?cursor=cD0y>; rel="next"',locationsURL(101),
    {allowedIncidentIds:new Set([101])}),/gg_read_url_denied/);
});
test('wrong workspace incident URL or unknown response schema produces only safe gap and never completeness',async()=>{
  for(const data of [[{...incident(101),gitguardian_url:'https://dashboard.gitguardian.com/workspace/1/incidents/101'}],
    [{...incident(101),status:marker}],{results:[incident(101)],secret:marker}]){
    const{reader}=fixture({[sourceURL]:{data:source(1)},[incidentsURL]:{data}});
    const report=await reader.readRepoIncidents();assert.notEqual(report.incidentCoverage,'complete-for-source');
    assert.equal(report.coverageGaps.length,1);assert.equal(JSON.stringify(report).includes(marker),false);
  }
});
test('HTTP failure never consumes raw API error body; exception text is redacted',async()=>{
  let bodyReads=0;
  const reader=createGitGuardianReader({tokenProvider:async()=>token,fetchImpl:async()=>({status:403,
    get body(){bodyReads++;throw Error(marker);}})});
  const report=await reader.readSourceBinding();assert.equal(bodyReads,0);
  assert.deepEqual(report.coverageGaps,[{safeCode:'gg_read_http_unavailable',statusCode:403}]);
  const failed=createGitGuardianReader({tokenProvider:async()=>{throw Error(marker);},fetchImpl:async()=>assert.fail('no request')});
  assert.equal(JSON.stringify(await failed.readSourceBinding()).includes(marker),false);
});
test('pagination failure retains honest partial list and actual page count; count mismatch cannot imply complete',async()=>{
  const next=incidentsURL+'&cursor=cD0y';
  const{reader}=fixture({[sourceURL]:{data:source(2)},[incidentsURL]:{data:[incident(101)],link:'<'+next+'>; rel="next"'},
    [next]:()=>new Response(marker,{status:401})});
  const report=await reader.readRepoIncidents();assert.equal(report.incidentCoverage,'partial');
  assert.equal(report.pagesRead.incidents,1);assert.equal(report.incidents.length,1);assert.equal(JSON.stringify(report).includes(marker),false);
  const wrong=fixture({[sourceURL]:{data:source(2)},[incidentsURL]:{data:[incident(101)]}});
  assert.equal((await wrong.reader.readRepoIncidents()).coverageGaps[0].safeCode,'gg_read_incident_count_mismatch');
});
test('location from another repo is discarded, unsafe filenames/lines cannot expose provider values',async()=>{
  const{reader}=fixture({[sourceURL]:{data:source(1)},[incidentsURL]:{data:[incident(101)]},
    [locationsURL(101)]:{data:[{...location(101),source:{id:1,type:'github',full_name:marker}}]}});
  const report=await reader.readRepoIncidents();assert.equal(report.incidentCoverage,'complete-for-source');
  assert.equal(report.locationCoverage,'partial');assert.equal(report.incidents[0].file,null);assert.equal(JSON.stringify(report).includes(marker),false);
  assert.deepEqual(report.coverageGaps,[{safeCode:'gg_read_location_binding_mismatch',incidentId:101}]);
  const unsafe=fixture({[sourceURL]:{data:source(1)},[incidentsURL]:{data:[incident(101)]},
    [locationsURL(101)]:{data:[{...location(101),filepath:'../outside',matches:[{line_start:marker,value:marker}]}]}});
  const redacted=await unsafe.reader.readRepoIncidents();assert.equal(redacted.incidents[0].file,null);
  assert.equal(redacted.incidents[0].line,null);assert.equal(redacted.locationCoverage,'partial');
  assert.deepEqual(redacted.coverageGaps,[{safeCode:'gg_read_location_metadata_incomplete',incidentId:101}]);
});
test('zero locations are attributed to each numeric incident ID without downgrading fully read incident list',async()=>{
  const ids=[37828691,37830671,37840514];
  const{reader}=fixture({[sourceURL]:{data:source(3)},[incidentsURL]:{data:ids.map(i=>incident(i))},
    [locationsURL(ids[0])]:{data:[]},[locationsURL(ids[1])]:{data:[]},[locationsURL(ids[2])]:{data:[location(ids[2])]}});
  const report=await reader.readRepoIncidents();
  assert.equal(report.incidentCoverage,'complete-for-source');assert.equal(report.locationCoverage,'partial');
  assert.deepEqual(report.coverageGaps,[{safeCode:'gg_read_location_metadata_unavailable',incidentId:37828691},
    {safeCode:'gg_read_location_metadata_unavailable',incidentId:37830671}]);
  assert.equal(report.incidents.length,3);assert.equal(report.incidents[0].file,null);assert.equal(report.incidents[1].line,null);
  assert.equal(report.incidents[2].file,'web/server.mjs');assert.equal(report.incidents[2].line,12);
  assert.deepEqual(report.pagesRead,{incidents:1,locations:3});assert.equal(JSON.stringify(report).includes(marker),false);
});
test('location HTTP error and duplicate metadata pages stay fail-closed, attributed and secret-free',async()=>{
  const{reader}=fixture({[sourceURL]:{data:source(1)},[incidentsURL]:{data:[incident(101)]},
    [locationsURL(101)]:()=>new Response(marker,{status:403})});
  const report=await reader.readRepoIncidents();assert.equal(report.incidentCoverage,'complete-for-source');assert.equal(report.locationCoverage,'partial');
  assert.deepEqual(report.coverageGaps,[{safeCode:'gg_read_http_unavailable',statusCode:403,incidentId:101}]);
  assert.equal(report.incidents[0].file,null);assert.equal(JSON.stringify(report).includes(marker),false);
  const next=locationsURL(101)+'&cursor=duplicate';
  const repeated=fixture({[sourceURL]:{data:source(1)},[incidentsURL]:{data:[incident(101)]},
    [locationsURL(101)]:{data:[location(101,99)],link:'<'+next+'>; rel="next"'},[next]:{data:[location(101,99)]}});
  const result=await repeated.reader.readRepoIncidents();assert.equal(result.incidentCoverage,'complete-for-source');
  assert.equal(result.locationCoverage,'partial');assert.equal(result.incidents[0].file,null);
  assert.deepEqual(result.coverageGaps,[{safeCode:'gg_read_location_observation_changed',incidentId:101}]);
});
test('source re-read count drift downgrades complete list; repeated cursor is bounded',async()=>{
  let count=0;const repeated=incidentsURL+'&cursor=x';
  const{reader}=fixture({[sourceURL]:()=>json(source(++count===1?1:2)),[incidentsURL]:{data:[incident(101)]},[locationsURL(101)]:{data:[]}});
  assert.equal((await reader.readRepoIncidents()).incidentCoverage,'partial');
  const loop=fixture({[sourceURL]:{data:source(2)},[incidentsURL]:{data:[incident(101)],link:'<'+repeated+'>; rel="next"'},
    [repeated]:{data:[incident(102)],link:'<'+repeated+'>; rel="next"'}});
  const r=await loop.reader.readRepoIncidents();assert.equal(r.incidentCoverage,'partial');assert.equal(loop.calls.length,3);
  assert.equal(r.coverageGaps[0].safeCode,'gg_read_pagination_incomplete');
});
test('MCP initialize/list do not touch token/API; three no-argument read tools, safe errors',async()=>{
  let reads=0;const rpc=createGitGuardianRpc({reader:{readSourceBinding:async()=>{reads++;return{sourceBinding:'verified'};},
    readRepoIncidents:async()=>{throw Error(marker);}}});
  assert.equal((await rpc({jsonrpc:'2.0',id:0,method:'tools/list'})).error.code,-32000);
  await rpc({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-03-26'}});
  const list=await rpc({jsonrpc:'2.0',id:2,method:'tools/list'});assert.equal(reads,0);
  assert.deepEqual(list.result.tools.map(t=>t.name),['read_source_binding','read_repo_incidents','read_security_status']);
  assert.ok(list.result.tools.every(t=>t.annotations.readOnlyHint&&t.inputSchema.additionalProperties===false));
  const deny=await rpc({jsonrpc:'2.0',id:3,method:'tools/call',params:{name:'read_repo_incidents',arguments:{url:marker}}});
  assert.equal(deny.error.code,-32602);assert.equal(reads,0);
  await rpc({jsonrpc:'2.0',id:4,method:'tools/call',params:{name:'read_source_binding',arguments:{}}});assert.equal(reads,1);
  const fail=await rpc({jsonrpc:'2.0',id:5,method:'tools/call',params:{name:'read_repo_incidents'}});
  assert.equal(fail.result.isError,true);assert.equal(JSON.stringify(fail).includes(marker),false);
  assert.equal(await rpc({jsonrpc:'2.0',method:'notifications/initialized'}),null);
});
test('MCP stdio JSON-lines parse errors/notifications do not corrupt response stream',async()=>{
  let output='';const input=Readable.from(['invalid\n',JSON.stringify({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-06-18'}})+'\n',
    JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})+'\n',JSON.stringify({jsonrpc:'2.0',id:2,method:'tools/list'})+'\n']);
  await runGitGuardianMcp({input,output:new Writable({write(chunk,enc,done){output+=chunk;done();}})});
  const responses=output.trim().split('\n').map(s=>JSON.parse(s));assert.equal(responses.length,3);
  assert.equal(responses[0].error.code,-32700);assert.equal(responses[1].result.protocolVersion,'2025-06-18');
  assert.equal(responses[2].result.tools.length,3);
});
test('real stdio entrypoint initializes and lists without reading the protected connection',async()=>{
  const child=spawn(process.execPath,['tools/gitguardian-mcp.mjs'],{stdio:['pipe','pipe','pipe'],windowsHide:true});
  let out='',err='';child.stdout.on('data',b=>{out+=b;});child.stderr.on('data',b=>{err+=b;});
  const done=new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',code=>resolve(code));});
  child.stdin.end(JSON.stringify({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-03-26'}})+'\n'+
    JSON.stringify({jsonrpc:'2.0',id:2,method:'tools/list'})+'\n');
  assert.equal(await done,0);assert.equal(err,'');assert.equal(out.trim().split('\n').length,2);
});

test('MCP combined status calls one read-only adapter and reports unread coverage as an error',async()=>{
  let calls=0;const rpc=createGitGuardianRpc({readSecurityStatus:async()=>{calls++;return{
    githubCoverage:'complete-for-this-commit',incidentCoverage:calls===1?'complete-for-source':'not-read',
    locationCoverage:'partial',incidentIssues:[]};}});
  await rpc({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-11-25'}});
  const denied=await rpc({jsonrpc:'2.0',id:2,method:'tools/call',params:{name:'read_security_status',arguments:{repository:marker}}});
  assert.equal(denied.error.code,-32602);assert.equal(calls,0);
  const ok=await rpc({jsonrpc:'2.0',id:3,method:'tools/call',params:{name:'read_security_status',arguments:{}}});
  assert.equal(ok.result.isError,false);assert.equal(calls,1);
  const unread=await rpc({jsonrpc:'2.0',id:4,method:'tools/call',params:{name:'read_security_status'}});
  assert.equal(unread.result.isError,true);assert.equal(calls,2);
});

test('source monitoring metadata exposes only known states and safe historical scan time',async()=>{
  const{reader}=fixture({[sourceURL]:{data:{...source(),monitored:true,monitoring_status:'active',
    last_scan:{status:'finished',date:'2026-10-08T10:00:00Z',failing_reason:marker},secret:marker}}});
  const report=await reader.readSourceBinding();
  assert.deepEqual(report.monitoring,{status:'active',monitored:true,lastHistoricalScan:{status:'finished',time:'2026-10-08T10:00:00Z'}});
  assert.ok(!JSON.stringify(report).includes(marker));
  const unknown=fixture({[sourceURL]:{data:{...source(),monitored:marker,monitoring_status:marker,
    last_scan:{status:marker,date:marker}}}});
  assert.deepEqual((await unknown.reader.readSourceBinding()).monitoring,
    {status:null,monitored:null,lastHistoricalScan:{status:null,time:null}});
});
