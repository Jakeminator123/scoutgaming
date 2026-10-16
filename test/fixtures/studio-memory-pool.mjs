// Transaction/adapter fixture only. It is not evidence of PostgreSQL syntax,
// isolation or constraints: the separate real-Postgres integration test is.
import {runtimeCatalogRevision} from '../../web/storage/runtime-media-catalog.mjs';
export function createStudioMemoryPool() {
  let state = { documents: new Map(), history: [], media: new Map(), catalogs: new Map(), audits: [] }, tail = Promise.resolve(), clock = 0, clientId = 0;
  const faults = new Map(), calls = [];
  const clone = value => structuredClone(value);
  const key = (values, kind = values[2]) => JSON.stringify([values[0], values[1], kind]);
  const scoped = (row, values) => row.environment_id === values[0] && row.workspace_id === values[1];
  const at = () => new Date(1700000000000 + ++clock).toISOString();
  const result = (rows = [], command = 'SELECT') => ({ rows: clone(rows), rowCount: rows.length, command });
  const references = (value, id) => value === id || value && typeof value === 'object' && Object.values(value).some(item => references(item, id));
  const pool = {
    calls, connects: 0, releases: 0, commitRollback: false,
    snapshot: () => clone(state),
    seedRuntimeCatalog(scope,value) {
      state.catalogs.set(JSON.stringify([scope.environment,scope.workspaceId]),{revision:runtimeCatalogRevision(value),value:clone(value)});
    },
    failNext(marker, error = Object.assign(new Error('private driver diagnostic'), { code: 'XX000' }), after = 0) { faults.set(marker, { error, after }); },
    corruptDocument(scope, kind, change) {
      const id = JSON.stringify([scope.environment, scope.workspaceId, kind]);
      state.documents.set(id, change(clone(state.documents.get(id))));
    },
    async connect() {
      pool.connects++; const id = ++clientId;
      let working, readOnly = false, lockRelease, released = false;
      const releaseLock = () => { lockRelease?.(); lockRelease = undefined; };
      const client = {
        async query(sql, values = []) {
          if (released) throw new Error('fixture client already released');
          const marker = /\/\* studio:([a-z-]+) \*\//.exec(sql)?.[1] ?? sql.split(/\s/)[0];
          calls.push({ client: id, marker, sql, values: clone(values) });
          if (faults.has(marker)) {
            const fault = faults.get(marker);
            if (fault.after-- <= 0) { faults.delete(marker); throw fault.error; }
          }
          if (sql.startsWith('BEGIN')) { readOnly = sql.includes('READ ONLY'); working = readOnly ? clone(state) : undefined; return result([], 'BEGIN'); }
          if (sql.startsWith('SET LOCAL')) return result([], 'SET');
          if (sql.includes('pg_advisory_xact_lock')) {
            if(lockRelease)return result();
            const previous = tail; tail = new Promise(resolve => { lockRelease = resolve; });
            await previous; working = clone(state); return result();
          }
          if (sql === 'ROLLBACK') { working = undefined; releaseLock(); return result([], 'ROLLBACK'); }
          if (sql === 'COMMIT') {
            if (pool.commitRollback) { pool.commitRollback = false; working = undefined; releaseLock(); return result([], 'ROLLBACK'); }
            if (!readOnly) state = working;
            working = undefined; releaseLock(); return result([], 'COMMIT');
          }
          if (!working) throw new Error('fixture operation outside transaction');
          switch (marker) {
            case 'read-runtime-catalog': return result(working.catalogs.has(JSON.stringify(values.slice(0,2))) ? [working.catalogs.get(JSON.stringify(values.slice(0,2)))] : []);
            case 'media-registered-at': return result([{registered_at:working.audits.filter(row=>scoped(row,values)&&row.subject===values[2]&&row.action==='register_media').map(row=>row.at).sort()[0]??null}]);
            case 'media-aliases': return result([...working.media.values()].filter(row=>!(scoped(row,values)&&row.id===values[2])&&(row.id===values[2]||row.record.pathname===values[3])).slice(0,2));
            case 'media-current-owners': return result([...working.documents.values()].filter(row=>references(row.value,values[2])||JSON.stringify(row.value).includes(values[3])).slice(0,101));
            case 'media-all-packages': return result(pool.packages??[]);
            case 'lifecycle-packages': return result(pool.packages ?? []);
            case 'read-document': return result(working.documents.has(key(values)) ? [working.documents.get(key(values))] : []);
            case 'list-documents': return result([...working.documents.values()].filter(row => scoped(row, values)).sort((a, b) => a.kind.localeCompare(b.kind)));
            case 'insert-document': {
              if (working.documents.has(key(values))) return result([], 'INSERT');
              const row = { environment_id: values[0], workspace_id: values[1], kind: values[2], revision: values[3], value: JSON.parse(values[4]), updated_at: values[5] ?? at() };
              working.documents.set(key(values), row); return result([row], 'INSERT');
            }
            case 'save-document': {
              const previous = working.documents.get(key(values));
              if (!previous || previous.revision !== values[5]) return result([], 'UPDATE');
              const row = { ...previous, revision: values[3], value: JSON.parse(values[4]), updated_at: at() };
              working.documents.set(key(values), row); return result([row], 'UPDATE');
            }
            case 'history': {
              if (working.history.some(row => scoped(row, values) && row.kind === values[2] && row.revision === values[3])) throw Object.assign(new Error('duplicate'), { code: '23505' });
              working.history.push({ environment_id: values[0], workspace_id: values[1], kind: values[2], revision: values[3], value: JSON.parse(values[4]),
                updated_at: values[5], replaced_at: at(), replaced_by: values[6], actor: values[7] });
              return result([], 'INSERT');
            }
            case 'list-history': return result(working.history.filter(row => scoped(row, values) && row.kind === values[2])
              .sort((a, b) => b.replaced_at.localeCompare(a.replaced_at) || a.revision.localeCompare(b.revision)).slice(0, values[3]));
            case 'audit': working.audits.push({ environment_id: values[0], workspace_id: values[1], id: values[2], action: values[3], subject: values[4], revision: values[5], actor: values[6], at: at() }); return result([], 'INSERT');
            case 'read-media': return result(working.media.has(key(values)) ? [working.media.get(key(values))] : []);
            case 'list-media': return result([...working.media.values()].filter(row => scoped(row, values)).sort((a, b) => a.id.localeCompare(b.id)).slice(0, values[2]));
            case 'insert-media': {
              if (working.media.has(key(values))) throw Object.assign(new Error('duplicate'), { code: '23505' });
              const row = { environment_id: values[0], workspace_id: values[1], id: values[2], revision: values[3], record: JSON.parse(values[4]), updated_at: at() };
              working.media.set(key(values), row); return result([row], 'INSERT');
            }
            case 'classify-media': {
              const previous = working.media.get(key(values));
              if (!previous || previous.revision !== values[5]) return result([], 'UPDATE');
              const row = { ...previous, revision: values[3], record: JSON.parse(values[4]), updated_at: at() };
              working.media.set(key(values), row); return result([row], 'UPDATE');
            }
            case 'media-references': return result([
              ...[...working.documents.values()].filter(row => scoped(row, values) && references(row.value, values[2])).map(row => ({ kind: row.kind, revision: row.revision, historical: false })),
              ...working.history.filter(row => scoped(row, values) && references(row.value, values[2])).map(row => ({ kind: row.kind, revision: row.revision, historical: true })),
            ]);
            default: throw new Error(`unexpected fixture SQL marker: ${marker}`);
          }
        },
        release() { if (released) throw new Error('double fixture release'); released = true; pool.releases++; working = undefined; releaseLock(); },
      };
      return client;
    },
  };
  return pool;
}
