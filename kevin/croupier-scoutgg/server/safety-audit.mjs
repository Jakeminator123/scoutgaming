import {DatabaseSync} from 'node:sqlite';
import {POLICY_VERSION} from './dealer-policy.mjs';
export function createSafetyAudit(filename,{now=Date.now,retentionDays=30}={}){
 const db=new DatabaseSync(filename);db.exec('PRAGMA journal_mode=WAL;PRAGMA synchronous=NORMAL');db.exec('CREATE TABLE IF NOT EXISTS safety_audit (id INTEGER PRIMARY KEY, at INTEGER NOT NULL, policy TEXT NOT NULL, event TEXT NOT NULL, detail TEXT NOT NULL)');
 const prune=()=>db.prepare('DELETE FROM safety_audit WHERE at < ?').run(now()-retentionDays*86400000);
 prune();
 return {write(record){
  // Never persist raw prompts, display names, IP addresses, credentials or provider errors.
  const detail={};for(const k of ['decision','responseId','model','inputHash','outputHash','requestId','sessionRevision','roundRevision'])if(record[k]!=null)detail[k]=String(record[k]).slice(0,128);
  db.prepare('INSERT INTO safety_audit(at,policy,event,detail) VALUES (?,?,?,?)').run(now(),POLICY_VERSION,String(record.event).slice(0,80),JSON.stringify(detail));prune();
 },close:()=>db.close()};
}
