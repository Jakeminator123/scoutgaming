import test from 'node:test';
import assert from 'node:assert/strict';
import {readEconomyJournal,summarizeEconomyJournal,journalType,JOURNAL_LIMIT} from './economy-journal.mjs';
const row=(amount,options={})=>({at:'2026-10-13T10:00:00Z',player_id:'test-player',type:'start',currency:'USD',amount,...options});
test('journal totals separate currencies, include opening balances and preserve source rows',()=>{
  const source={tx:[row('-0.10'),row('-0.20'),row(20,{type:'collect'}),row(1000,{type:'open'}),row(900,{currency:'SEK'})]};
  const before=JSON.stringify(source),parsed=readEconomyJournal(source),result=summarizeEconomyJournal(parsed,{currency:'USD'});
  assert.equal(result.debit,0.3);assert.equal(result.credit,1020);assert.equal(result.net,1019.7);
  assert.equal(result.count,4);assert.equal(result.sourceCount,5);assert.deepEqual(result.currencies,['SEK','USD']);
  assert.equal(result.types.find(row=>row.label==='Öppningssaldo').count,1);assert.equal(JSON.stringify(source),before);
  assert.equal(summarizeEconomyJournal(parsed).currency,'USD');
});
test('period filters use UTC day boundaries without inventing missing daily observations',()=>{
  const journal=readEconomyJournal({tx:[row(-5,{at:'2026-10-06T23:59:59Z'}),row(-6,{at:'2026-10-07T00:00:00Z'}),row(10,{at:'2026-10-13T10:00:00Z'})]});
  const result=summarizeEconomyJournal(journal,{currency:'USD',days:7,now:Date.parse('2026-10-13T12:00:00Z')});
  assert.equal(result.count,2);assert.equal(result.debit,6);assert.equal(result.sourceCount,3);
  assert.deepEqual(result.daily.map(row=>row.day),['2026-10-07','2026-10-13']);
  assert.equal(result.sourceFrom,'2026-10-06T23:59:59.000Z');
});
test('empty and filtered-empty journals remain empty, and unknown types stay in the totals',()=>{
  const empty=summarizeEconomyJournal(readEconomyJournal({tx:[]}));
  assert.equal(empty.currency,null);assert.deepEqual(empty.daily,[]);assert.equal(empty.sourceFrom,null);
  const parsed=readEconomyJournal({tx:[row(4,{type:'future-type',at:'2020-01-01T00:00:00Z'})]});
  assert.deepEqual(summarizeEconomyJournal(parsed).types,[{label:'Övriga händelser',count:1}]);
  assert.equal(journalType('constructor'),'Övriga händelser');
  assert.equal(summarizeEconomyJournal(parsed,{days:7,now:Date.parse('2026-10-13T12:00:00Z')}).count,0);
});
test('malformed amounts, currency, dates and oversized responses fail instead of fabricating totals',()=>{
  for(const value of [null,{}, {tx:[row('')]},{tx:[row('4 USD')]},{tx:[row(Infinity)]},{tx:[row(1,{currency:'usd'})]},
    {tx:[row(1,{at:'invalid'})]},{tx:Array.from({length:JOURNAL_LIMIT+1},()=>row(1))}])assert.throws(()=>readEconomyJournal(value));
  assert.throws(()=>summarizeEconomyJournal([],{days:14}));
});
