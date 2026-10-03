import { readFile, readdir, writeFile, realpath, lstat } from 'node:fs/promises';
import { resolve, dirname, relative, sep, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

export function privateBuildSource(path) {
  const normalized=path.replaceAll('\\','/');
  return /(?:^|\/)\.env[^/]*(?:\/|$)/.test(normalized)
    || /(?:^|\/)(?:lab\/data|web\/data|open-claw\/lab\/(?:data|runtime)|agent-talk|\.croupier-inbox|\.codex|\.git)(?:\/|$)/.test(normalized)
    || /\.(?:db|sqlite|sqlite3)(?:-(?:wal|shm|journal))?$/.test(normalized);
}
export async function checkBuildTraces({directory=resolve(process.cwd(),process.env.CROUPIER_LAB_DIST_DIR||'.next'),sanitize=false}={}) {
  const root=resolve(directory), actual=await realpath(root), info=await lstat(root);
  if ((process.platform==='win32'?actual.toLowerCase()!==root.toLowerCase():actual!==root) || !info.isDirectory() || info.isSymbolicLink()) throw Error('unsafe_build_trace_directory');
  let checked=0,removed=0;
  async function visit(folder) {
    for(const row of await readdir(folder,{withFileTypes:true})) {
      // Deployment inputs are the root server traces and server/** traces.
      // Standalone output duplicates those inputs and contains dependency
      // links created by Next/Vercel. Never traverse cache or copied packages.
      if(folder===root && row.name!=='server' && !row.name.endsWith('.nft.json')) continue;
      if(row.isSymbolicLink()) throw Error('unsafe_build_trace_entry');
      const file=resolve(folder,row.name),distance=relative(root,file);
      if(isAbsolute(distance)||distance.startsWith(`..${sep}`)) throw Error('unsafe_build_trace_entry');
      if(row.isDirectory()) await visit(file);
      else if(row.isFile()&&row.name.endsWith('.nft.json')) {
        const data=JSON.parse(await readFile(file,'utf8'));if(data.version!==1||!Array.isArray(data.files)||data.files.some(x=>typeof x!=='string')) throw Error('invalid_build_trace');
        const safe=data.files.filter(path=>!privateBuildSource(resolve(dirname(file),path)));
        checked++;removed+=data.files.length-safe.length;
        if(safe.length!==data.files.length) {
          if(!sanitize) throw Error('private_state_in_build_trace');
          await writeFile(file,JSON.stringify({...data,files:safe}));
        }
      }
    }
  }
  await visit(root);if(!checked) throw Error('build_traces_missing');return {checked,removed};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {console.log(JSON.stringify(await checkBuildTraces({sanitize:process.argv.slice(2).includes('--sanitize')})));}
  catch(error) {
    const code=/^[a-z_]{1,80}$/.test(error?.message??'')?error.message:'trace_io_failure';
    console.error(`Studio build tracing verification failed: ${code}.`);process.exitCode=1;
  }
}
