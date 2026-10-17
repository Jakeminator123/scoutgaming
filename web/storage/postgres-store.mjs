import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { createPostgresStore as createPostgresCore, validateGameConnection } from '../../packages/storage/server/postgres-store.mjs';

// The game app owns pg and product-schema.sql. Studio supplies its own Neon pool
// directly to the same neutral SQL/transaction implementation.
export function createPostgresStore({ pool, connectionString, zonesConnectionString = '' } = {}) {
  if (!pool) {
    validateGameConnection(connectionString, zonesConnectionString);
    const requireWeb = createRequire(new URL('../package.json', import.meta.url));
    const { Pool } = requireWeb('pg');
    // Preserve certificate verification explicitly instead of depending on
    // pg-connection-string's version-specific sslmode=require interpretation.
    const secureUrl=new URL(connectionString);secureUrl.searchParams.set('sslmode','verify-full');
    pool = new Pool({ connectionString:secureUrl.href,max:8,connectionTimeoutMillis:10000,idleTimeoutMillis:30000 });
  }
  return createPostgresCore({ pool,
    readProductSchema: () => readFile(new URL('../../ops/neon-game/product-schema.sql',import.meta.url),'utf8'),
  });
}
