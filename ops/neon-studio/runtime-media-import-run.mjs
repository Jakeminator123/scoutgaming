#!/usr/bin/env node
// Explicit operator runner for the scoped runtime media catalogue (docs/plans/REN-START.md, steps 6–7).
//   prepare                  local only: hashes the four source files and prints the new revision.
//   plan --out <file>        read-only against CROUPIER_GAME_DATABASE_URL; saves the reviewable plan.
//   apply --plan <file> --actor <name>
//                            writes only when CROUPIER_RUNTIME_IMPORT_CONFIRM equals the reviewed planHash.
// The scope is always explicit (CROUPIER_STUDIO_ENVIRONMENT_ID, CROUPIER_STUDIO_WORKSPACE_ID).
// Output contains codes, hashes and counts only: never a connection string or driver message.
import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {prepareRuntimeMediaImport,planRuntimeMediaImport,applyRuntimeMediaImport} from './runtime-media-import.mjs';
import {migrationDatabaseGuard} from '../../tools/check-migration-readiness.mjs';

const repositoryRoot=fileURLToPath(new URL('../../',import.meta.url));
const SHA=/^[a-f0-9]{64}$/;
const COMMANDS={prepare:[],plan:['--out'],apply:['--plan','--actor']};
const usage=()=>Object.assign(Error('runtime_import_usage'),{code:'runtime_import_usage'});
const refuse=code=>Object.assign(Error(code),{code});

/** Exact command and flags; every value is a separate argument. */
export function parseImportArguments(argv) {
  const [command,...rest]=argv;
  if(!Object.hasOwn(COMMANDS,command)||rest.length!==COMMANDS[command].length*2)throw usage();
  const options={command};
  for(let index=0;index<rest.length;index+=2){
    const [flag,value]=[rest[index],rest[index+1]];
    if(!COMMANDS[command].includes(flag)||Object.hasOwn(options,flag)||typeof value!=='string'||!value||value.startsWith('--'))throw usage();
    options[flag]=value;
  }
  return {command,out:options['--out'],planFile:options['--plan'],actor:options['--actor']};
}

export function importScope(env=process.env) {
  const environment=env.CROUPIER_STUDIO_ENVIRONMENT_ID,workspaceId=env.CROUPIER_STUDIO_WORKSPACE_ID;
  if(typeof environment!=='string'||!environment||typeof workspaceId!=='string'||!workspaceId)throw refuse('runtime_import_scope_required');
  return {environment,workspaceId};
}

function counts(value) {
  return {layout:value.layout.files.length,blobIndex:value.blobIndex.files.length,presentation:value.presentation.items.length,
    families:value.presentation.families.length,legacy:Object.keys(value.legacy.entries).length};
}
/** What the reviewer reads. The saved plan file additionally binds the server address. */
export function reviewSummary(plan) {
  return {scope:plan.scope,database:plan.target.database,role:plan.target.role,operation:plan.operation,
    expectedRevision:plan.expectedRevision,revision:plan.revision,counts:plan.counts,planHash:plan.planHash};
}

export async function runRuntimeMediaImport({command,out,planFile,actor,sourceRoot=repositoryRoot,scope,pool,confirm,
  readText=path=>readFile(path,'utf8'),writeText=(path,text)=>writeFile(path,text,{flag:'wx'}),...overrides}={}) {
  const prepared=await prepareRuntimeMediaImport({scope,sourceRoot});
  if(command==='prepare')return {scope:prepared.scope,revision:prepared.revision,sourceHashes:prepared.sourceHashes,counts:counts(prepared.value)};
  if(command==='plan'){
    const plan=await planRuntimeMediaImport({pool,prepared,...overrides});
    // The plan file is the only apply input; refuse to overwrite an earlier review.
    await writeText(resolve(out),JSON.stringify(plan,null,2)+'\n');
    return reviewSummary(plan);
  }
  if(command!=='apply')throw usage();
  let expectedPlan;
  try{expectedPlan=JSON.parse(await readText(resolve(planFile)));}catch{throw refuse('runtime_import_plan_unreadable');}
  if(!SHA.test(expectedPlan?.planHash??'')||confirm!==expectedPlan.planHash)throw refuse('runtime_import_confirmation_required');
  // The source checkout must still produce exactly the reviewed catalogue.
  if(expectedPlan.revision!==prepared.revision)throw refuse('runtime_import_source_changed');
  const result=await applyRuntimeMediaImport({pool,prepared,expectedPlan,confirm:true,actor,...overrides});
  return {scope:result.scope,revision:result.revision,previousRevision:result.previousRevision??null,changed:result.changed,planHash:result.planHash};
}

const safeCode=error=>{
  const code=error?.code;
  return typeof code==='string'&&/^(studio|runtime_import)_[a-z0-9_]+$/.test(code)?code:'runtime_import_failed';
};

async function main() {
  let pool,code=2;
  try {
    const options=parseImportArguments(process.argv.slice(2)),scope=importScope();
    if(options.command!=='prepare'){
      const connectionString=process.env.CROUPIER_GAME_DATABASE_URL,guard=migrationDatabaseGuard(connectionString);
      // Neon hosts only, exactly as the migration readiness check.
      if(!guard.ok)throw refuse(guard.code==='migration_check_host_rejected'?'runtime_import_host_rejected':'runtime_import_database_required');
      const {Pool}=createRequire(new URL('../../apps/studio/package.json',import.meta.url))('@neondatabase/serverless');
      pool=new Pool({connectionString,max:1,connectionTimeoutMillis:10000});
    }
    const result=await runRuntimeMediaImport({...options,scope,pool,confirm:process.env.CROUPIER_RUNTIME_IMPORT_CONFIRM});
    console.log(JSON.stringify(result,null,2));
    code=0;
  } catch(error) {
    console.error(safeCode(error));
  } finally {
    if(pool)try{await pool.end();}catch{/* Never print driver shutdown details. */}
  }
  process.exit(code);
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main();
