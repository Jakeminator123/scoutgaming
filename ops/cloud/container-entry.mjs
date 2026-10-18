import { chown, chmod, lstat, realpath, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// The image's node account is UID/GID 1000. A fresh platform volume may be
// root-owned. Fix only its exact mount directory, then drop root BEFORE apps,
// databases, provider settings or any public listener are initialized.
export async function prepareContainerUser(env = process.env, { fs = { chown, chmod, lstat, realpath, mkdir }, proc = process } = {}) {
  const dataRoot=env.CROUPIER_CLOUD_DATA_ROOT;
  const qa=/^\/var\/data\/native-studio-qa\/([a-f0-9]{12})$/.exec(dataRoot??'');
  let gameDatabase;try{gameDatabase=new URL(env.CROUPIER_GAME_DATABASE_URL);}catch{}
  const retiredDiskKeys=['CROUPIER_DATA_DIR','LAB_STUDIO_DATA_DIR','CROUPIER_PRESENTATION_STUDIO_DIR',
    'CROUPIER_GENERATIONS_DIR','CROUPIER_GENERATED_SPEECH_DIR','LAB_VIDEO_ARCHIVE'];
  const mountless=dataRoot===undefined&&env.CROUPIER_DATABASE==='postgres'&&env.CROUPIER_STUDIO_NEON_POLICY==='1'
    &&env.CROUPIER_MEDIA_STORAGE==='blob'&&typeof env.BLOB_READ_WRITE_TOKEN==='string'&&env.BLOB_READ_WRITE_TOKEN.length>0
    &&gameDatabase&&['postgres:','postgresql:'].includes(gameDatabase.protocol)&&gameDatabase.hostname.endsWith('.neon.tech')
    &&Boolean(gameDatabase.username)&&Boolean(gameDatabase.password)
    &&['require','verify-ca','verify-full'].includes(gameDatabase.searchParams.get('sslmode'))
    &&retiredDiskKeys.every(name=>env[name]===undefined);
  if(dataRoot===undefined&&!mountless) {
    throw new Error('Mountless container requires Postgres, Neon policy and private Blob with no retired disk configuration.');
  }
  if(dataRoot!=='/var/data') {
    if(!mountless&&(!qa || env.CROUPIER_DATABASE!=='postgres' || env.CROUPIER_STUDIO_NEON_POLICY!=='1'
      || env.CROUPIER_STUDIO_ENVIRONMENT_ID!==`qa_native_${qa[1]}` || env.CROUPIER_STUDIO_WORKSPACE_ID!=='croupier'
      || !gameDatabase || !['postgres:','postgresql:'].includes(gameDatabase.protocol) || !gameDatabase.hostname.endsWith('.neon.tech')
      || gameDatabase.username!==`croupier_studio_qa_${qa[1]}` || gameDatabase.pathname!==`/croupier_studio_qa_${qa[1]}`)) {
      throw new Error('Container requires the persistent mount or an exactly scoped isolated QA directory.');
    }
  }
  if(!mountless) {
    const info = await fs.lstat('/var/data');
    if (!info.isDirectory() || info.isSymbolicLink() || await fs.realpath('/var/data') !== '/var/data') {
      throw new Error('Container data mount must be a real directory.');
    }
  }
  if (proc.getuid() === 0) {
    if(!mountless) {
      await fs.chown('/var/data', 1000, 1000);
      await fs.chmod('/var/data', 0o700);
    }
    proc.setgroups([]);
    proc.setgid(1000);
    proc.setuid(1000);
  }
  if (proc.getuid() !== 1000 || proc.getgid() !== 1000) throw new Error('Container must run as the node account.');
  if(qa) {
    // Create only this bounded QA namespace after dropping root. Existing QA
    // and production files keep their contents and permissions; no recursion.
    for(const path of ['/var/data/native-studio-qa',dataRoot]) {
      await fs.mkdir(path,{mode:0o700}).catch(error=>{if(error.code!=='EEXIST')throw error;});
      const entry=await fs.lstat(path);
      if(!entry.isDirectory() || entry.isSymbolicLink() || await fs.realpath(path)!==path) {
        throw new Error('Isolated QA directory must be a real directory inside the persistent mount.');
      }
    }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  prepareContainerUser().then(async () => {
    // Restore only the manifest-pinned private SDK closure before flag-on children.
    const { initializeAiQaPrivateBootstrap } = await import('../../services/game/native-ai-qa-private.mjs');
    await initializeAiQaPrivateBootstrap();
    const { main } = await import('./start.mjs');
    process.exitCode = await main(['--start']);
  }).catch(() => {
    console.error('Cloud container could not start. Check mount, build, required configuration and access checks.');
    process.exitCode = 1;
  });
}
