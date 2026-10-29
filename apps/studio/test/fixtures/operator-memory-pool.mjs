// croupier_auth.users for the account lookups in lab/lib/operator-accounts.mjs.
// Also the invite writes: users insert (RETURNING id) and the tokens table.
export function usersDb(users) {
  const tokens = [];
  let nextId = users.reduce((max, user) => Math.max(max, Number(user.id) || 0), 0);
  const found = (sql, args) => {
    if (sql === 'SELECT id,username,role FROM users WHERE id=?') return users.filter(user => user.id === args[0]);
    if (sql === 'SELECT id,username,role FROM users WHERE lower(username)=?') return users.filter(user => user.username.toLowerCase() === args[0]);
    if (sql === 'SELECT id,username,role FROM users WHERE lower(email)=?') return users.filter(user => user.email?.toLowerCase() === args[0]);
    if (/^SELECT id,username FROM users WHERE id IN \(\?(?:,\?)*\)$/.test(sql)) return users.filter(user => args.includes(user.id));
    return null;
  };
  return {
    queries: [],
    tokens,
    async transaction(work) { return work(); },
    prepare(sql) {
      const db = this;
      return {
        async all(...args) {
          const rows = found(sql, args);
          if (!rows) throw new Error(`unexpected users query: ${sql}`);
          db.queries.push(sql);
          return rows.map(user => ({ id: user.id, username: user.username, role: user.role }));
        },
        async get(...args) { return (await this.all(...args))[0]; },
        async run(...args) {
          db.queries.push(sql);
          if (sql === 'INSERT INTO users (username,email,role,created_at) VALUES (?,?,?,?) RETURNING id') {
            const [username, email, role, created_at] = args;
            if (users.some(user => user.username.toLowerCase() === String(username).toLowerCase() || user.email?.toLowerCase() === String(email).toLowerCase())) {
              throw Object.assign(new Error('duplicate'), { code: '23505' });
            }
            const id = String(++nextId);
            users.push({ id, username, email, role, created_at, salt: null, hash: null });
            return { changes: 1, lastInsertRowid: id };
          }
          if (sql === 'DELETE FROM tokens WHERE username=?') {
            const username = args[0];
            for (let index = tokens.length - 1; index >= 0; index -= 1) if (tokens[index].username === username) tokens.splice(index, 1);
            return { changes: 1 };
          }
          if (sql === 'INSERT INTO tokens (token,username,kind,exp) VALUES (?,?,?,?)') {
            tokens.push({ token: args[0], username: args[1], kind: args[2], exp: args[3] });
            return { changes: 1 };
          }
          throw new Error(`unexpected users write: ${sql}`);
        },
      };
    },
  };
}

// In-memory croupier_studio operator tables behind tagged queries, shaped like
// the Neon pool: query() for reads and connect() for the store's locked writes.
// BEGIN/ROLLBACK restore a snapshot so a refused guard leaves no partial row.
export function operatorMemoryPool({ apiKeyColumn = true } = {}) {
  const tables = { operators: [], operator_roles: [], operator_memberships: [], operator_packages: [], operator_audit_events: [], operator_branding_drafts: [], api_keys: [] };
  const trace = [];
  const hooks = new Map();
  let lockTail = Promise.resolve();
  let clientSeq = 0;
  const pgError = code => Object.assign(new Error('fixture'), { code });
  const copy = row => structuredClone(row);
  function restore(snapshot) {
    for (const name of Object.keys(tables)) {
      tables[name].length = 0;
      tables[name].push(...snapshot[name]);
    }
  }
  async function dispatch(text, values, client) {
    // This schema has no migration 021: company material is not installed.
    if (text.includes('/* operator-materials:materials-ready */')) return [{ ledgered: 0, present: false }];
    // croupier_auth.api_keys as Partnerportalen reads it (lib/partner-api-keys.mjs). With game
    // migration 012 (apiKeyColumn) every row names its company; the real SQL runs in test/partner-key-operator.mjs.
    if (text.includes('/* partner-api-keys:column */')) return [{ present: apiKeyColumn }];
    if (text.includes('/* partner-api-keys:list */')) {
      return tables.api_keys.filter(row => row.operator_id === values[0]).map(row => ({ ...copy(row), wallet_configured: Boolean(row.wallet_url) }));
    }
    const tag = /\/\* operator-store:([a-z-]+) \*\//.exec(text)?.[1];
    if (!tag) throw new Error(`untagged query: ${text}`);
    trace.push({ client: client?.id ?? 0, step: tag });
    const hook = hooks.get(tag);
    if (hook) { hooks.delete(tag); await hook(tables); }
    const [environment, workspace] = values;
    const scoped = name => tables[name].filter(row => row.environment_id === environment && row.workspace_id === workspace);
    const snapshot = () => { if (client?.inTx && !client.snapshot) client.snapshot = structuredClone(tables); };
    if (tag === 'list-operators') return scoped('operators').sort((a, b) => a.slug.localeCompare(b.slug)).map(copy);
    if (tag === 'operator-by-slug') return scoped('operators').filter(row => row.slug === values[2]).map(copy);
    if (tag === 'operator-by-id' || tag === 'lock-operator') return scoped('operators').filter(row => row.operator_id === values[2]).map(copy);
    if (tag === 'list-roles' || tag === 'guard-roles') {
      return scoped('operator_roles').filter(row => row.operator_id === values[2]).sort((a, b) => a.role_id.localeCompare(b.role_id)).map(copy);
    }
    if (tag === 'get-role') return scoped('operator_roles').filter(row => row.operator_id === values[2] && row.role_id === values[3]).map(copy);
    if (tag === 'get-membership') return scoped('operator_memberships').filter(row => row.operator_id === values[2] && row.user_id === values[3]).map(copy);
    if (tag === 'list-memberships' || tag === 'guard-memberships') {
      return scoped('operator_memberships').filter(row => row.operator_id === values[2]).sort((a, b) => a.user_id.localeCompare(b.user_id)).map(copy);
    }
    if (tag === 'current-package') {
      return scoped('operator_packages').filter(row => row.operator_id === values[2]).sort((a, b) => b.package_revision - a.package_revision).slice(0, 1).map(copy);
    }

    if(tag==='package-by-revision')return scoped('operator_packages').filter(row=>row.operator_id===values[2]&&row.package_revision===values[3]).map(copy);
    if(tag==='list-packages')return scoped('operator_packages').filter(row=>row.operator_id===values[2]&&(values[3]===null||row.package_revision<values[3])).sort((a,b)=>b.package_revision-a.package_revision).slice(0,values[4]).map(copy);
    if(tag==='current-branding-draft')return scoped('operator_branding_drafts').filter(row=>row.operator_id===values[2]).sort((a,b)=>b.draft_revision-a.draft_revision).slice(0,1).map(copy);
    if(tag==='write-branding-draft'){
      snapshot();
      const row={environment_id:environment,workspace_id:workspace,operator_id:values[2],draft_revision:values[3],base_package_revision:values[4],branding:values[5],
        source_package_revision:values[6],published_package_revision:values[7],action:values[8],event_id:values[9],actor_id:values[10],access_class:values[11],
        occurred_at_ms:values[12],request_id:values[13],changes:values[14]};
      tables.operator_branding_drafts.push(row);return [copy(row)];
    }
    if (tag === 'audit-write') {
      snapshot();
      const row={environment_id:environment,workspace_id:workspace,operator_id:values[2],event_id:values[3],actor_id:values[4],access_class:values[5],action:values[6],resource_type:values[7],resource_id:values[8],before_revision:values[9],after_revision:values[10],occurred_at_ms:values[11],request_id:values[12],changes:values[13]};
      tables.operator_audit_events.push(row); return [copy(row)];
    }
    if (tag === 'list-audit') return [...scoped('operator_audit_events'),...scoped('operator_branding_drafts').map(row=>({...row,resource_type:'draft',resource_id:row.operator_id,before_revision:row.draft_revision>1?row.draft_revision-1:null,after_revision:row.draft_revision}))].filter(row=>row.operator_id===values[2] && (values[3]===null || row.occurred_at_ms<values[3] || row.occurred_at_ms===values[3] && row.event_id<values[4])
      && (values[6]==null || values[6].includes(row.action)))
      .sort((a,b)=>b.occurred_at_ms-a.occurred_at_ms || b.event_id.localeCompare(a.event_id)).slice(0,values[5]).map(copy);
    if (tag === 'create-operator') {
      if (scoped('operators').some(row => row.operator_id === values[2] || row.slug === values[3])) throw pgError('23505');
      snapshot();
      const row = { environment_id: environment, workspace_id: workspace, operator_id: values[2], slug: values[3], name: values[4], status: values[5], created_at_ms: values[6] };
      tables.operators.push(row);
      return [copy(row)];
    }
    if (tag === 'upsert-role') {
      if (!scoped('operators').some(row => row.operator_id === values[2])) throw pgError('23503');
      snapshot();
      let row = tables.operator_roles.find(item => item.environment_id === environment && item.workspace_id === workspace
        && item.operator_id === values[2] && item.role_id === values[3]);
      if (!row) {
        row = { environment_id: environment, workspace_id: workspace, operator_id: values[2], role_id: values[3], label: values[4], permissions: values[5], delegable: values[6] };
        tables.operator_roles.push(row);
      } else Object.assign(row, { label: values[4], permissions: values[5], delegable: values[6] });
      return [copy(row)];
    }
    if (tag === 'create-membership') {
      if (!scoped('operators').some(row => row.operator_id === values[2])) throw pgError('23503');
      if (!scoped('operator_roles').some(row => row.operator_id === values[2] && row.role_id === values[4])) throw pgError('23503');
      if (scoped('operator_memberships').some(row => row.operator_id === values[2] && row.user_id === values[3])) throw pgError('23505');
      snapshot();
      const row = { environment_id: environment, workspace_id: workspace, operator_id: values[2], user_id: values[3], role_id: values[4], status: values[5], revision: 1, created_at_ms: values[6] };
      tables.operator_memberships.push(row);
      return [copy(row)];
    }
    if (tag === 'cas-membership') {
      if (!scoped('operator_roles').some(row => row.operator_id === values[2] && row.role_id === values[5])) throw pgError('23503');
      const row = tables.operator_memberships.find(item => item.environment_id === environment && item.workspace_id === workspace
        && item.operator_id === values[2] && item.user_id === values[3] && Number(item.revision) === Number(values[4]));
      if (!row) return [];
      snapshot();
      Object.assign(row, { role_id: values[5], status: values[6], revision: Number(row.revision) + 1 });
      return [copy(row)];
    }
    if (tag === 'publish-package') {
      if (!scoped('operators').some(row => row.operator_id === values[2])) throw pgError('23503');
      snapshot();
      const revision = scoped('operator_packages').filter(row => row.operator_id === values[2]).reduce((max, row) => Math.max(max, Number(row.package_revision)), 0) + 1;
      const row = { environment_id: environment, workspace_id: workspace, operator_id: values[2], package_revision: revision, lanes: values[3], games: values[4], tables: values[5], branding: values[6], published_at_ms: values[7] };
      tables.operator_packages.push(row);
      return [copy(row)];
    }
    throw new Error(`unknown tag ${tag}`);
  }
  async function query(text, values = []) {
    return { rows: await dispatch(text, values, null) };
  }
  async function connect() {
    const client = { id: ++clientSeq, inTx: false, snapshot: null, unlock: null };
    const unlock = () => { const release = client.unlock; client.unlock = null; release?.(); };
    client.query = async (text, values = []) => {
      const command = text.trim();
      if (command === 'BEGIN') {
        client.inTx = true;
        client.snapshot = null;
        trace.push({ client: client.id, step: 'BEGIN' });
        return { rows: [], command: 'BEGIN' };
      }
      if (command.startsWith('SET LOCAL')) return { rows: [], command: 'SET' };
      if (command === 'SELECT pg_advisory_xact_lock($1::integer, $2::integer)') {
        trace.push({ client: client.id, step: 'scope-lock' });
        return { rows: [] };
      }
      if (command === 'COMMIT' || command === 'ROLLBACK') {
        if (command === 'ROLLBACK' && client.snapshot) restore(client.snapshot);
        client.snapshot = null;
        client.inTx = false;
        unlock();
        trace.push({ client: client.id, step: command });
        return { rows: [], command };
      }
      // PostgreSQL permits reacquiring a row lock already held by this transaction.
      if (/\/\* operator-store:lock-operator \*\//.test(text) && !client.unlock) {
        const previous = lockTail;
        let release;
        lockTail = new Promise(resolve => { release = resolve; });
        await previous;
        client.unlock = release;
      }
      return { rows: await dispatch(text, values, client) };
    };
    client.release = unlock;
    return client;
  }
  return {
    query,
    connect,
    tables,
    trace,
    // Runs once, inside the transaction, right before the next query with this tag.
    before(tag, work) { hooks.set(tag, work); },
  };
}
