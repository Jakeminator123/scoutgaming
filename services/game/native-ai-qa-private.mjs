import {readFile,lstat,realpath,mkdir,open} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {sha256,aiQaNeed as need} from './native-ai-qa-budget.mjs';
import {nativeP6QaRouterConfig} from '../../ops/cloud/config.mjs';
const repo=resolve(fileURLToPath(new URL('../..',import.meta.url)));
export const AI_QA_PRIVATE_NAMES=Object.freeze(['native-cloud-browser-qa.mjs','native-p6-sdk-worker.mjs',
  'native-p6-sdk-admission.mjs','native-p6-upstream-bounds-final.json']);
const equalPath=(a,b)=>process.platform==='win32'?resolve(a).toLowerCase()===resolve(b).toLowerCase():a===b;
async function source(path){const s=await lstat(path);need(s.isFile()&&!s.isSymbolicLink()&&s.nlink===1&&s.size<=1048576
  &&equalPath(await realpath(path),path),'ai_qa_private_snapshot_source');return readFile(path);}
export async function buildAiQaPrivateSnapshot({directory,pins}={}){
  const files={};for(const name of AI_QA_PRIVATE_NAMES){const bytes=await source(join(directory,name));
    need(sha256(bytes)===pins[name],'ai_qa_private_snapshot_source_changed');files[name]={sha256:pins[name],bytesBase64:bytes.toString('base64')};}
  return Buffer.from(JSON.stringify({purpose:'bounded-native-ai-qa-private-snapshot-v1',files}));
}
export function decodeAiQaPrivateSnapshot(raw,pins){
  need(raw.length<=2097152,'ai_qa_private_snapshot_size');let p;try{p=JSON.parse(raw);}catch{need(false,'ai_qa_private_snapshot_json');}
  need(p?.purpose==='bounded-native-ai-qa-private-snapshot-v1'&&Object.keys(p).sort().join(',')==='files,purpose'
    &&Object.keys(p.files??{}).sort().join(',')===[...AI_QA_PRIVATE_NAMES].sort().join(','),'ai_qa_private_snapshot_paths');
  let total=0;return AI_QA_PRIVATE_NAMES.map(name=>{const f=p.files[name];need(Object.keys(f).sort().join(',')==='bytesBase64,sha256'
    &&typeof f.bytesBase64==='string'&&f.sha256===pins[name],'ai_qa_private_snapshot_pin');
    const bytes=Buffer.from(f.bytesBase64,'base64');total+=bytes.length;
    need(bytes.length>0&&bytes.length<=1048576&&total<=1048576&&bytes.toString('base64')===f.bytesBase64
      &&sha256(bytes)===pins[name],'ai_qa_private_snapshot_bytes');return{name,bytes};});
}
export async function restoreAiQaPrivateSnapshot({repository,manifest,raw}={}){
  need(sha256(raw)===manifest.privateSnapshotSha256,'ai_qa_private_snapshot_changed');
  const files=decodeAiQaPrivateSnapshot(raw,manifest.privateSources);let directory=repository,written=0,retained=0;
  for(const part of ['lab','data','platform-private']){directory=join(directory,part);await mkdir(directory,{mode:0o700}).catch(e=>{if(e.code!=='EEXIST')throw e;});
    const s=await lstat(directory);need(s.isDirectory()&&!s.isSymbolicLink()&&equalPath(await realpath(directory),directory),'ai_qa_private_snapshot_target');}
  // Inspect every existing target before writing anything. Never replace a
  // different source, a symlink, state, credentials or any historical journal.
  const missing=[];for(const f of files){const target=join(directory,f.name);try{need(sha256(await source(target))===sha256(f.bytes),'ai_qa_private_snapshot_target_changed');retained++;}
    catch(e){if(e.code!=='ENOENT')throw e;missing.push({...f,target});}}
  for(const f of missing){const fd=await open(f.target,'wx',0o600);try{await fd.writeFile(f.bytes);await fd.sync();}finally{await fd.close();}written++;}
  if(process.platform==='linux'){const fd=await open(directory,'r');try{await fd.sync();}finally{await fd.close();}}
  return{purpose:'bounded-native-ai-qa-private-bootstrap-v1',files:files.length,written,retained,privateSnapshotSha256:manifest.privateSnapshotSha256,providerCalls:0,budgetWrites:0};
}
export async function initializeAiQaPrivateBootstrap(env=process.env){
  if(env.CROUPIER_P6_BOUNDED_TEST!=='1')return null;
  const qa=nativeP6QaRouterConfig(env);
  need(qa&&env===process.env&&process.platform==='linux'&&process.getuid?.()===1000&&process.getgid?.()===1000
    &&repo==='/app'&&resolve(process.argv[1]??'')==='/app/ops/cloud/container-entry.mjs','ai_qa_actual_private_bootstrap_required');
  const raw=await source(qa.stateRoot+'/bounded-manifest.json');need(sha256(raw)===env.CROUPIER_P6_BOUNDED_MANIFEST_SHA256,'ai_qa_private_manifest_pin');
  const {validateAiQaManifest}=await import('./native-ai-qa-runtime.mjs'),m=validateAiQaManifest(JSON.parse(raw),env);
  for(const path of ['services/game/native-ai-qa-private.mjs','services/game/native-ai-qa-runtime.mjs','ops/cloud/config.mjs','ops/cloud/container-entry.mjs','ops/cloud/Dockerfile'])
    need(sha256(await source(join(repo,path)))===m.sources[path],'ai_qa_private_bootstrap_current_sources');
  const snapshot=await source(qa.stateRoot+'/bounded-private-snapshot.json');return restoreAiQaPrivateSnapshot({repository:repo,manifest:m,raw:snapshot});
}
