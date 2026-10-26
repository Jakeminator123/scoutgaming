import assert from 'node:assert/strict';
import {EXTENDED_PRESENTATION_STORAGE_CHECKSUM} from '../../../../packages/presentation/server/presentation-storage.mjs';
const clone=value=>structuredClone(value);
export function combinedPool(scope,{extendedPresentationReady=false}={}) {
  let state = { documents: new Map(), media: new Map(), history: [], audits: [], operatorAudits: [], packages: [], roomConfigs: [], roomConfigHeads: [], operators: [
    { environment_id: scope.environment, workspace_id: scope.workspaceId, operator_id: 'north', slug: 'north', name: 'North', status: 'active', created_at_ms: 1 },
    { environment_id: scope.environment, workspace_id: scope.workspaceId, operator_id: 'other', slug: 'other', name: 'Other', status: 'active', created_at_ms: 1 },
  ] }, tail = Promise.resolve(), clientId = 0, tick = 0;
  const trace = [], faults = new Set();
  const sameScope = (row, values) => row.environment_id === values[0] && row.workspace_id === values[1];
  const documentKey = values => JSON.stringify(values.slice(0, 3));
  const result = (rows = [], command = 'SELECT') => ({ rows: clone(rows), command });
  const pool = { trace, active: 0, setExtendedPresentationReady(value) { assert.equal(typeof value,'boolean'); extendedPresentationReady=value; }, setMedia(record, revision = 'media-1') { state.media.set(record.id, { environment_id: scope.environment, workspace_id: scope.workspaceId, id: record.id, revision, record: clone(record), updated_at: '2026-10-09T00:00:00.000Z' }); }, snapshot: () => clone(state), fail: marker => faults.add(marker), async connect() {
    const id = ++clientId; let working, unlock, readOnly = false;
    return { async query(sql, values = []) {
      const marker = /\/\* (?:studio|operator-store|presentation-room):([a-z-]+) \*\//.exec(sql)?.[1] ?? sql.split(/\s/)[0];
      trace.push({ client: id, marker, values: clone(values) });
      if (faults.delete(marker)) throw Error('private forced failure');
      if (sql.startsWith('BEGIN')) { pool.active++; readOnly = sql.includes('READ ONLY'); working = readOnly ? clone(state) : undefined; return result([], 'BEGIN'); }
      if (sql.startsWith('SET LOCAL')) return result([], 'SET');
      if (sql.includes('pg_advisory_xact_lock')) {
        if (working) return result(); // The repository already owns this synthetic transaction lock.
        const previous = tail; tail = new Promise(resolve => { unlock = resolve; }); await previous; working = clone(state); return result();
      }
      if (sql === 'COMMIT' || sql === 'ROLLBACK') {
        pool.active--; if (sql === 'COMMIT' && !readOnly) state = working; working = undefined; unlock?.(); unlock = null; return result([], sql);
      }
      assert.ok(working, 'all domain queries use the repository transaction');
      if (marker === 'extended-presentation-ready') return result(extendedPresentationReady ? [{checksum:EXTENDED_PRESENTATION_STORAGE_CHECKSUM,structure_checksum:'a'.repeat(64),matching_checks:2}] : []);
      const packages = () => working.packages.filter(row => sameScope(row, values) && row.operator_id === values[2]);
      if (marker === 'lock-operator' || marker === 'operator-by-id') return result(working.operators.filter(row => sameScope(row, values) && row.operator_id === values[2]));
      if (marker === 'list-operators') return result(working.operators.filter(row=>sameScope(row,values)));
      if (marker === 'lifecycle-packages') return result(working.packages.filter(row=>sameScope(row,values)));
      if (marker === 'operator-status') {const row=working.operators.find(row=>sameScope(row,values)&&row.operator_id===values[2]&&row.status===values[4]);if(!row)return result();row.status=values[3];return result([row]);}
      if (marker === 'current-package') return result(packages().sort((a, b) => b.package_revision - a.package_revision).slice(0, 1));
      if (marker === 'package-by-revision') return result(packages().filter(row=>row.package_revision===values[3]));
      if (marker === 'room-config-administration') return result(working.documents.has(documentKey(values)) ? [working.documents.get(documentKey(values))] : []);
      if (marker === 'room-config-current') {
        const head=working.roomConfigHeads.find(row=>row.room_id===values[2]);
        return result(head?[{version:head.version,body:working.roomConfigs.find(row=>row.room_id===head.room_id&&row.version===head.version)?.body}]:[]);
      }
      if (marker === 'room-config-media') return result([...working.media.values()].filter(row=>sameScope(row,values)&&values[2].includes(row.id)));
      if (marker === 'room-config-insert') {
        assert.ok(!working.roomConfigs.some(row=>row.room_id===values[2]&&row.version===values[3]));
        working.roomConfigs.push({room_id:values[2],version:values[3],body:JSON.parse(values[4])});return result();
      }
      if (marker === 'room-config-head') {
        const head=working.roomConfigHeads.find(row=>row.room_id===values[2]);
        if(head?head.version!==values[4]:values[4]!==null)return result();
        if(head)head.version=values[3];else working.roomConfigHeads.push({room_id:values[2],version:values[3]});
        return result([{version:values[3]}]);
      }
      if (marker === 'used-key') return result(packages().filter(row => JSON.parse(row.tables).includes(values[3])).slice(0, 1));
      if (marker === 'publish-package') {
        const row = { environment_id: values[0], workspace_id: values[1], operator_id: values[2], package_revision: Math.max(0, ...packages().map(row => row.package_revision)) + 1,
          lanes: values[3], games: values[4], tables: values[5], branding: values[6], published_at_ms: values[7] };
        working.packages.push(row); return result([row]);
      }
      if (marker === 'list-media') return result([...working.media.values()].filter(row => sameScope(row, values)));
      if (marker === 'classify-media') {
        const previous=working.media.get(values[2]);if(!previous||!sameScope(previous,values)||previous.revision!==values[5])return result();
        const row={...previous,revision:values[3],record:JSON.parse(values[4]),updated_at:new Date(1700000000000 + ++tick).toISOString()};
        working.media.set(values[2],row);return result([row]);
      }
      if (marker === 'media-references') {
        const contains=value=>value===values[2]||Boolean(value&&typeof value==='object'&&Object.values(value).some(contains));
        return result([...working.documents.values()].filter(row=>sameScope(row,values)&&contains(row.value)).map(row=>({kind:row.kind,revision:row.revision,historical:false})));
      }
      if (marker === 'read-media') return result(working.media.has(values[2]) ? [working.media.get(values[2])] : []);
      if (marker === 'read-document') return result(working.documents.has(documentKey(values)) ? [working.documents.get(documentKey(values))] : []);
      if (marker === 'insert-document') {
        const row = { environment_id: values[0], workspace_id: values[1], kind: values[2], revision: values[3], value: JSON.parse(values[4]), updated_at: new Date(1700000000000 + ++tick).toISOString() };
        working.documents.set(documentKey(values), row); return result([row]);
      }
      if (marker === 'save-document') {
        const previous = working.documents.get(documentKey(values)); if (previous?.revision !== values[5]) return result();
        const row = { ...previous, revision: values[3], value: JSON.parse(values[4]), updated_at: new Date(1700000000000 + ++tick).toISOString() };
        working.documents.set(documentKey(values), row); return result([row]);
      }
      if (marker === 'history') { working.history.push(clone(values)); return result(); }
      if (marker === 'audit-write') { working.operatorAudits.push(clone(values)); return result([{event_id:values[3]}]); }
      if (marker === 'audit') { working.audits.push(clone(values)); return result(); }
      throw Error(`unknown fixture query ${marker}`);
    }, release() { unlock?.(); } };
  } };
  return pool;
}
