import { createRenderStudioPolicy as createProductStudioPolicy } from '../../services/game/storage/studio-runtime.mjs';

// The engine's own Studio policy factory, unchanged: migration plan and readiness,
// scoped repository, saved project/administration and registered dealer idle all run
// against the engine's pool. Only its configuration check reads an inert *.neon.tech
// URL, because the owned CI cluster is 127.0.0.1 (the same substitution
// test/studio-cutover-integration.mjs makes in process). It refuses any database that
// is not an engine-qa database on loopback with verify-full TLS.
export function engineQaStudioEnvironment(env) {
  const actual = new URL(env.CROUPIER_GAME_DATABASE_URL);
  if (actual.hostname !== '127.0.0.1' || actual.searchParams.get('sslmode') !== 'verify-full'
    || !/^croupier_engine_[a-f0-9]{12}$/.test(actual.pathname.slice(1)) || env.CROUPIER_ZONES_DATABASE_URL) {
    throw Error('engine_qa_studio_policy_requires_owned_cluster');
  }
  const inert = new URL(`postgresql://engine-qa.neon.tech/${actual.pathname.slice(1)}?sslmode=require`);
  inert.username = 'engine-qa'; inert.password = 'inert-configuration-check-only';
  return { ...env, CROUPIER_GAME_DATABASE_URL: inert.href };
}

export function createRenderStudioPolicy({ env = process.env, ...ports } = {}) {
  return createProductStudioPolicy({ ...ports, env: engineQaStudioEnvironment(env) });
}
