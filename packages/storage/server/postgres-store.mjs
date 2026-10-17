import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash } from 'node:crypto';
import { validateStudioScope } from '../../studio-access/studio-scope.mjs';

const transactionContext = new AsyncLocalStorage();
const SCHEMAS = new Set(['croupier_game', 'croupier_auth']);
const TABLES = new Set(['players','transactions','blackjack_tables','native_presentations','player_accounts','player_sessions','craig_player_links','bo_game_handoffs','preview_sessions','lissabon_profiles','lissabon_profile_sessions','player_chat_memory_meta','player_chat_memory_profiles','player_chat_memory_requests','player_probe_profiles','player_probe_sessions','player_probe_attempts','player_probe_sources','player_probe_facts','player_probe_rounds','partner_rounds','partner_players','partner_idem','player_admin_events','users','tokens','meta','bo_auth_epochs','bo_lab_handoffs','lab_sessions','api_keys']);
function qualified(sql, schema) {
  const statement=postgresStatement(sql),parts=statement.split(/('(?:[^']|'')*'|"(?:[^"]|"")*")/g);
  return parts.map((part,i)=>i%2?part:part.replace(/\b(FROM|JOIN|UPDATE|INTO)\s+([a-z_][a-z0-9_]*)(?![a-z0-9_.])/gi,
    (all,keyword,table)=>TABLES.has(table.toLowerCase())?`${keyword} ${schema}.${table}`:all)).join('');
}

export function validateGameConnection(value, zonesValue = '') {
  let url;
  try { url = new URL(value); } catch { throw new Error('A dedicated game PostgreSQL connection is required'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || !url.username || !url.password
    || !url.pathname.slice(1) || url.hash || value === zonesValue) throw new Error('A dedicated game PostgreSQL connection is required');
  if (zonesValue) {
    let zones;try{zones=new URL(zonesValue);}catch{throw new Error('The zones connection must be valid before selecting the game database');}
    const host=value=>value.hostname.replace(/-pooler(?=\.)/,'');
    if(host(url)===host(zones)&&url.pathname===zones.pathname)throw new Error('Game and zones require separate databases');
  }
  if (url.searchParams.get('sslmode') !== 'require' && !['verify-full', 'verify-ca'].includes(url.searchParams.get('sslmode'))) {
    throw new Error('Game PostgreSQL requires TLS');
  }
  return value;
}

// Small, explicit SQL dialect boundary. Values always remain bound parameters.
// This is asynchronous PostgreSQL, not a synchronous SQLite compatibility bridge.
export function postgresStatement(sql) {
  if (typeof sql !== 'string' || /\b(?:PRAGMA|AUTOINCREMENT)\b/i.test(sql)) throw new Error('SQLite schema SQL cannot run on PostgreSQL');
  let n = 0, quote = null, output = '';
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (quote) {
      output += ch;
      if (ch === quote) { if (sql[i + 1] === quote) output += sql[++i]; else quote = null; }
    } else if (ch === "'" || ch === '"') { quote = ch; output += ch; }
    else output += ch === '?' ? `$${++n}` : ch;
  }
  if (/^\s*INSERT\s+OR\s+IGNORE\s+/i.test(output)) output = output.replace(/^\s*INSERT\s+OR\s+IGNORE\s+/i, 'INSERT ') + ' ON CONFLICT DO NOTHING';
  output=output.split(/('(?:[^']|'')*'|"(?:[^"]|"")*")/g).map((part,i)=>i%2?part:part.replace(/\bAS\s+([a-z_][a-zA-Z0-9_]*)\b/g,
    (all,name)=>/[A-Z]/.test(name)?`AS "${name}"`:all)).join('');
  // SQLite uses boolean expressions as integer columns in BO payloads.
  output = output.replace(/hash IS NOT NULL AS active/gi, '(hash IS NOT NULL)::integer AS active');
  return output;
}

function normalizeRow(row, fields) {
  const output = { ...row };
  // Native SQLite exposes these numbers. Reject unsafe conversion, never truncate.
  for (const field of fields ?? []) {
    if (!['20', '1700'].includes(String(field.dataTypeID))) continue; // int8 / numeric
    const value = output[field.name];
    if (value === null || value === undefined) continue;
    if (['id', 'user_id'].includes(field.name)) continue; // historical IDs may exceed JS integers
    const number = Number(value);
    if (!Number.isFinite(number) || field.dataTypeID === 20 && !Number.isSafeInteger(number)) throw new Error('Database number exceeds the runtime contract');
    output[field.name] = number;
  }
  return output;
}

export function createPostgresStore({ pool, readProductSchema } = {}) {
  if (typeof pool?.connect !== 'function' || typeof pool?.query !== 'function') throw new TypeError('An asynchronous PostgreSQL pool is required');
  function database(schema) {
    if (!SCHEMAS.has(schema)) throw new Error('Unsupported PostgreSQL schema');
    async function query(sql, values = []) {
      const context = transactionContext.getStore();
      if (context?.pool === pool) {
        return context.client.query(qualified(sql, schema), values);
      }
      return transaction(() => query(sql, values), {serialize:false});
    }
    async function transaction(work, {serialize=true,studioScope}={}) {
      // validateStudioScope returns exactly these keys in canonical order.
      const studioScopeKey = studioScope === undefined ? null : JSON.stringify(validateStudioScope(studioScope));
      const existing = transactionContext.getStore();
      if (existing?.pool === pool) {
        try{
          // Nested work must inherit the outer locks, never silently expand them.
          if(studioScopeKey && existing.studioScopeKey!==studioScopeKey)throw new Error('Studio transaction scope mismatch');
          if(serialize && existing.studioScopeKey && !existing.serialize)throw new Error('Studio transaction lock escalation');
          return await work();
        }catch(error){existing.failed=error;throw error;}
      }
      const client = await pool.connect();
      try {
        // Serializes existing memory/quota CAS sequences until per-scope locks
        // are introduced. Transaction-scoped, works through PgBouncer pooling.
        // Send transaction setup in one round trip without session-level state.
        // Native admin already holds the game lock before its Studio repository
        // write. Scoped memory must follow the same game -> Studio order.
        await client.query("BEGIN; SET LOCAL statement_timeout = '15000ms'; SET LOCAL lock_timeout = '5000ms'"+(serialize?'; SELECT pg_advisory_xact_lock(1129467984)':''));
        if(studioScopeKey){
          const digest=createHash('sha256').update(`croupier-studio\0${studioScopeKey}`).digest();
          await client.query('SELECT pg_advisory_xact_lock($1::integer, $2::integer)',[digest.readInt32BE(0),digest.readInt32BE(4)]);
        }
        const context={pool,client,studioScopeKey,serialize};
        const result = await transactionContext.run(context, work);
        if(context.failed)throw context.failed;
        const committed=await client.query('COMMIT');
        if(committed?.command==='ROLLBACK')throw new Error('PostgreSQL transaction was rolled back');
        return result;
      } catch (error) {
        try { await client.query('ROLLBACK'); } catch { /* Preserve original error. */ }
        throw error;
      } finally { client.release(); }
    }
    return {
      backend: 'postgres', schema, transaction,
      async exec(sql) {
        if (/^\s*(BEGIN|COMMIT|ROLLBACK)\b/i.test(sql)) throw new Error('Use db.transaction(callback) for PostgreSQL');
        return query(sql);
      },
      prepare(sql) {
        return {
          async all(...args) { const result = await query(sql, args); return result.rows.map(row => normalizeRow(row, result.fields)); },
          async get(...args) { return (await this.all(...args))[0]; },
          async run(...args) { const result = await query(sql, args); return { changes: result.rowCount, lastInsertRowid: result.rows[0]?.id }; },
        };
      },
      async assertInstalled({ source } = {}) {
        if (source === undefined || source === null) {
          if (typeof readProductSchema !== 'function') throw new Error('Game PostgreSQL source is invalid');
          source = await readProductSchema();
        }
        if(typeof source !== 'string' || Buffer.byteLength(source)>1024*1024)throw new Error('Game PostgreSQL source is invalid');
        const checksum=createHash('sha256').update(source.replace(/\r\n/g,'\n')).digest('hex');
        const result = await pool.query("SELECT version,checksum FROM croupier_game.storage_migrations WHERE version='product-v1'");
        if (result.rows.length !== 1 || result.rows[0].checksum!==checksum) throw new Error('Game PostgreSQL migration is not installed or has changed');
      },
    };
  }
  const gamePool = {
    query: (sql, values) => pool.query(qualified(sql, 'croupier_game'), values),
    async connect() {
      const client = await pool.connect();
      return { query: (sql, values) => client.query(qualified(sql, 'croupier_game'), values), release: () => client.release() };
    },
  };
  return { pool, gamePool, db: database('croupier_game'), boDb: database('croupier_auth'), close: () => pool.end() };
}
