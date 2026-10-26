// Transaction/adapter fixture only. It is not evidence of PostgreSQL syntax,
// isolation or constraints: the separate real-Postgres integration test is.
import {runtimeCatalogRevision} from '../../packages/studio-registry/server/runtime-catalog.mjs';
export function createStudioMemoryPool() {
  let state = { documents: new Map(), history: [], media: new Map(), catalogs: new Map(), forgeJobs: new Map(), audits: [] }, tail = Promise.resolve(), clock = 0, clientId = 0;
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
          const marker = /\/\* (?:studio|forge):([a-z-]+) \*\//.exec(sql)?.[1] ?? sql.split(/\s/)[0];
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
            case 'job': return result(working.forgeJobs.has(key(values)) ? [working.forgeJobs.get(key(values))] : []);
            case 'job-insert': {
              if (working.forgeJobs.has(key(values))) return result();
              const row = {environment_id:values[0],workspace_id:values[1],job_id:values[2],dealer_id:values[3],slot_id:values[4],kind:values[5],status:values[6],provider:'runway',task_id:values[7],request:JSON.parse(values[8]),result:values[9]===null?null:JSON.parse(values[9]),error:values[10],actor_id:values[11],created_at_ms:values[12],updated_at_ms:values[12]};
              working.forgeJobs.set(key(values),row);return result([row]);
            }
            case 'job-update': {
              const row=working.forgeJobs.get(key(values));if(!row||values[8]!==null&&row.status!==values[8])return result();
              Object.assign(row,{status:values[3],task_id:values[4]??row.task_id,result:values[5]===null?row.result:JSON.parse(values[5]),error:values[6],updated_at_ms:values[7]});return result([row]);
            }
            case 'media-journal-owners': return result([
              ...(pool.journalOwners??[]),
              ...[...working.forgeJobs.values()].filter(row=>!['succeeded','failed','cancelled'].includes(row.status)).map(row=>({source:'forge-job',environment_id:row.environment_id,workspace_id:row.workspace_id,owner_id:row.job_id,value:[row.request,row.result]})),
            ].filter(row=>references(row.value,values[2])||references(row.value,values[3])).slice(0,101));
            case 'media-moving-present': return result([{present:false}]);
            case 'media-speech-coverage': return result([{open_session:false,live_lease:false,unresolved_fullfile:false,...pool.speechActivity}]);
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
            case 'classify-media':
            case 'save-media-timing': {
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
