import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createTransactions} from '../server/transactions.mjs';
function setup(){const db=new DatabaseSync(':memory:');db.exec(`CREATE TABLE shared_players(room TEXT,id TEXT,name TEXT,balance REAL);CREATE TABLE shared_rooms(id TEXT,state TEXT);CREATE TABLE shared_settlements(room TEXT,round_id TEXT,player_id TEXT,receipt TEXT,PRIMARY KEY(room,round_id,player_id));INSERT INTO shared_players VALUES ('a','p','Player',1000);`);const t=createTransactions(db,()=>10000);const receipt=(room,id,player,staked,returned,at=1000)=>db.prepare('INSERT INTO shared_settlements VALUES(?,?,?,?)').run(room,id,player,JSON.stringify({staked,returned,settledAt:at}));return{db,t,receipt};}
test('house totals include all pages, pushes, side-inclusive stakes and fractional payouts; scope and dates filter totals',()=>{
 const {db,t,receipt}=setup();try{
 for(let i=0;i<105;i++)receipt('a','r'+i,'p',12.5,31.25);receipt('a','push','p',100,100);receipt('b','other','q',200,0);receipt('a','later','p',50,0,9000);
 const all=t.read({room:'a',to:8000});assert.equal(all.rows.length,100);assert.ok(all.nextBefore);assert.equal(all.summary.houseNetCents,-196875);assert.equal(all.summary.rounds,106);
 const older=t.read({room:'a',to:8000,before:all.nextBefore});assert.equal(older.rows.length,6);assert.deepEqual(older.summary,all.summary);assert.equal(older.nextBefore,null);
 assert.equal(t.read({room:'all',from:8001}).summary.houseNetCents,5000);assert.equal(t.read({room:'all',playerId:'q'}).summary.houseNetCents,20000);
 assert.equal(t.read({room:'a',playerId:'missing'}).summary.holdPercent,null);
 assert.throws(()=>t.read({from:'NaN'}),/Invalid/);assert.throws(()=>t.read({from:2,to:1}),/Invalid/);
 }finally{db.close();}
});
test('opening snapshots and credits are excluded from house totals, no player secrets or cards; records rollback and cannot change',()=>{
 const {db,t}=setup();try{
 const p={id:'p',name:'Player'};t.record('a',p,null,'demo_refill',1000,2000);t.record('a',p,'r','stake',2000,1990);
 db.prepare('INSERT INTO shared_rooms VALUES (?,?)').run('a',JSON.stringify({phase:'round',owners:['p'],round:{hands:[{box:0,stake:10,pp:5,tp:5,insured:5,cards:[{secret:'hidden'}]}]}}));
 const report=t.read({room:'a',kind:'movements'});assert.equal(report.openStakesCents,2500);assert.equal(report.summary.houseNetCents,0);assert.equal(report.rows.at(-1).kind,'opening_snapshot');assert.equal(report.rows.at(-1).amountCents,0);assert.equal(report.rows.at(-1).afterCents,100000);assert.ok(!JSON.stringify(report).includes('hidden'));
 db.exec('BEGIN');t.record('a',p,null,'demo_refill',2000,3000);db.exec('ROLLBACK');assert.equal(t.read({room:'a',kind:'movements'}).rows.length,3);
 assert.throws(()=>db.exec('UPDATE shared_transactions SET amount_cents=1'),/append-only/);assert.throws(()=>db.exec('DELETE FROM shared_transactions'),/append-only/);
 createTransactions(db,()=>10001);assert.equal(t.read({room:'a',kind:'movements'}).rows.length,3);
 }finally{db.close();}
});
