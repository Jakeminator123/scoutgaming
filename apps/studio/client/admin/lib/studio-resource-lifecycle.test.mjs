import test from 'node:test';
import assert from 'node:assert/strict';
import {companyListGroups,operatorLifecycleGroups} from './studio-resource-lifecycle.mjs';

const operators=[
  {id:'johns-bet',name:'Johns Bet',status:'active',archivedAt:null},
  {id:'nord',name:'Nord',status:'suspended',archivedAt:null},
  {id:'gammal',name:'Gammalt bolag',status:'suspended',archivedAt:'2026-10-20T10:00:00.000Z'},
];
const rooms=[{id:'a',operatorId:'johns-bet',state:'live'},{id:'b',operatorId:'nord',state:'pending'},{id:'c',operatorId:'johns-bet',state:'archived'}];

test('companies in the trash are listed only under Papperskorg, and its count includes them', () => {
  const groups=companyListGroups(operators,rooms);
  assert.deepEqual(groups.companies.map(row=>row.id),['johns-bet','nord'],'Bolag shows active and suspended companies, never an archived one');
  assert.deepEqual(groups.trashCompanies.map(row=>row.id),['gammal']);
  assert.deepEqual(groups.rooms.map(row=>row.id),['a','b']);assert.deepEqual(groups.trashRooms.map(row=>row.id),['c']);
  assert.deepEqual(groups.counts,{bolag:2,spelbord:2,papperskorg:2});
  // The list and the lifecycle groups agree on what the trash is.
  assert.deepEqual(groups.trashCompanies,operatorLifecycleGroups(operators).trash);
});

test('an archived company with no archived rooms still makes the trash count non-zero', () => {
  const groups=companyListGroups([operators[2]],[]);
  assert.deepEqual(groups.counts,{bolag:0,spelbord:0,papperskorg:1});
});
