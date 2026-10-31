'use client';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {labUrl} from '../lib/lab-url.mjs';
import type {OperatorDirectoryEntry,OperatorDirectoryMember} from '../lib/studio-native-runtime.mjs';
import {companyFailure,isCompanyTeam,isStandardRole,operatorMemberInput,useCompanyFormGuard,type CompanyIdentity,type StandardOperatorRole} from './company-form';
import {PartnerJournal} from './partner-journal-loader.mjs';
import styles from './company-team.module.css';

const MEMBER_STATUS:Record<string,string>={active:'aktiv',suspended:'avstängd',invited:'inbjuden'};
const ROLE_LABELS:Record<string,string>={'Partner administrator':'Administratör','Partner editor':'Redaktör','Partner viewer':'Läsare'};
const roleLabel=(role:{label:string})=>ROLE_LABELS[role.label]??role.label;
const PERMISSION_LABELS:Record<string,string>={
  'overview.read':'Se översikt','players.read':'Se spelare','team.read':'Se team','team.invite':'Bjuda in medlemmar',
  'team.roles.assign':'Tilldela roller','team.suspend':'Stänga av medlemmar','tables.read':'Se spelbord','tables.configure':'Konfigurera spelbord',
  'presentations.read':'Se miljöer','presentations.configure':'Anpassa miljöer','reports.read':'Se rapporter','integrations.read':'Se integrationer',
  'material.request':'Begära material','integration.request':'Begära nyckelrotation',
};
function defaultRole(operator:OperatorDirectoryEntry) {
  const wanted=operator.members.length?'partner-viewer':'partner-admin';
  return operator.roles.some(role=>role.id===wanted)?wanted:operator.roles[0]?.id??'';
}
type Context={operatorId:string;active:boolean};
type Snapshot={context:Context;operator:OperatorDirectoryEntry;standardRoles:StandardOperatorRole[]};
type Notice={context:Context;error:string;message:string;reload:boolean};

// The route is the only selection. Drafts survive company/tab changes; read and
// mutation receipts belong to one visit, including A -> B -> A while a read is late.
export function CompanyTeam({operatorId,active=true,disabled=false,onIdentity}:{operatorId:string;active?:boolean;disabled?:boolean;onIdentity?:(requestedId:string,operator:CompanyIdentity)=>void}) {
  const [data,setData]=useState<Snapshot|null>(null),[notice,setNotice]=useState<Notice|null>(null),[attempt,setAttempt]=useState(0);
  const [adds,setAdds]=useState<Record<string,{contact:string;roleId:string}>>({}),[drafts,setDrafts]=useState<Record<string,string>>({});
  const [busy,setBusy]=useState(false),pending=useRef(false),mounted=useRef(false);
  const context=useRef<Context>({operatorId,active}),identity=useRef(onIdentity);identity.current=onIdentity;
  if(context.current.operatorId!==operatorId||context.current.active!==active)context.current={operatorId,active};
  const current=context.current,snapshot=data?.context===current?data:null,feedback=notice?.context===current?notice:null;
  const access=useRef({disabled,active});access.current={disabled,active};
  useCompanyFormGuard(Object.values(adds).some(add=>Boolean(add.contact.trim()))||Object.keys(drafts).length>0,pending,true);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  useEffect(()=>{
    if(!active)return;
    const visit=context.current,controller=new AbortController();setData(null);setNotice(null);
    void (async()=>{
      let failure='Teamet kunde inte läsas. Dina osparade val är kvar.';
      try {
        const response=await fetch(labUrl('/api/admin/workspace/company-team?'+new URLSearchParams({operator:operatorId})),{credentials:'same-origin',cache:'no-store',redirect:'error',signal:controller.signal});
        if(!response.ok){failure=response.status===404?'Bolaget finns inte längre.':[401,403].includes(response.status)?companyFailure('member',response.status):failure;throw Error('team_read_failed');}
        failure='Teamet kunde inte bekräftas för bolaget i adressen.';
        const payload=await response.json();
        if(payload?.source!=='registered'||!isCompanyTeam(payload.operator)||(payload.operator.id!==operatorId&&payload.operator.slug!==operatorId)
          ||!Array.isArray(payload.standardRoles)||!payload.standardRoles.every(isStandardRole))throw Error('team_receipt_invalid');
        if(!controller.signal.aborted&&context.current===visit&&mounted.current){
          setData({context:visit,operator:payload.operator,standardRoles:payload.standardRoles});
          identity.current?.(operatorId,payload.operator);
        }
      } catch {if(!controller.signal.aborted&&context.current===visit&&mounted.current)setNotice({context:visit,error:failure,message:'',reload:true});}
    })();
    return()=>controller.abort();
  },[operatorId,active,attempt]);

  async function run(action:string,body:Record<string,unknown>,kind:'member'|'role',message:string) {
    if(pending.current||access.current.disabled||!access.current.active||context.current!==current||!snapshot||snapshot.operator.status!=='active'||feedback?.reload)return null;
    pending.current=true;setBusy(true);setNotice(null);
    const visit=current;
    const showError=(error:string,reload:boolean)=>setNotice({context:visit,error,message:'',reload});
    try {
      const response=await fetch(labUrl('/api/admin/'+action),{method:'POST',credentials:'same-origin',redirect:'error',headers:{'content-type':'application/json',accept:'application/json'},body:JSON.stringify(body)});
      const payload=await response.json().catch(()=>null);
      if(!mounted.current||context.current!==visit)return null;
      if(!response.ok){showError(companyFailure(kind,response.status),[401,403,404,409].includes(response.status)||response.status>=500);return null;}
      if(!isCompanyTeam(payload?.operator)||payload.operator.id!==snapshot.operator.id){showError('Ändringen kunde inte bekräftas för det valda bolaget. Läs in teamet igen.',true);return null;}
      setData({...snapshot,operator:payload.operator});setNotice({context:visit,error:'',message,reload:false});
      return payload.operator;
    } catch {if(mounted.current&&context.current===visit)showError('Ändringen kunde inte bekräftas. Läs in teamet igen innan du fortsätter.',true);return null;}
    finally {pending.current=false;if(mounted.current)setBusy(false);}
  }
  async function addMember(event:FormEvent,operator:OperatorDirectoryEntry) {
    event.preventDefault();
    const draft=adds[operator.id]??{contact:'',roleId:''},roleId=draft.roleId||defaultRole(operator);
    if(!roleId||!draft.contact.trim())return;
    const person=operatorMemberInput(draft.contact);
    const saved=await run('operator-membership',{operatorId:operator.id,...person,roleId},'member',person.email?`Inbjudan till ${operator.name} är registrerad.`:`${person.username} är medlem i ${operator.name}.`);
    if(saved)setAdds(previous=>({...previous,[operator.id]:{contact:'',roleId}}));
  }
  async function change(operator:OperatorDirectoryEntry,member:OperatorDirectoryMember,next:{roleId:string;status:string},done:string) {
    if(pending.current||disabled||operator.status!=='active')return;
    if(next.status!==member.status&&!window.confirm((next.status==='suspended'?'Stäng av ':'Återaktivera ')+(member.username??'konto '+member.userId)+' hos '+operator.name+'? '+(next.status==='suspended'?'Medlemmen förlorar åtkomsten till bolagets portal.':'Medlemmen får tillbaka åtkomsten med sin sparade roll.')))return;
    const saved=await run('operator-membership',{operatorId:operator.id,userId:member.userId,roleId:next.roleId,status:next.status,expectedRevision:member.revision},'member',done);
    if(saved)setDrafts(previous=>Object.fromEntries(Object.entries(previous).filter(([key])=>key!==operator.id+':'+member.userId)));
  }
  async function restoreRoles(operator:OperatorDirectoryEntry) {
    for(const roleId of operator.missingRoles){
      const role=snapshot?.standardRoles.find(item=>item.id===roleId);if(!role)continue;
      if(!await run('operator-role',{operatorId:operator.id,roleId,permissions:role.permissions},'role',`Standardrollen ${roleLabel(role)} finns nu hos ${operator.name}.`))return;
    }
  }
  if(!active)return null;
  const reload=<button type="button" className="sg-btn sg-btn-secondary" disabled={busy} onClick={()=>{setData(null);setAttempt(value=>value+1);}}>Läs in teamet igen</button>;
  if(!snapshot)return <section className={styles.card} aria-label="Bolagets team">{feedback?.error?<><p role="alert">{feedback.error}</p>{reload}</>:<p role="status">Läser bolagets team…</p>}</section>;
  const operator=snapshot.operator,teamUnavailable=disabled||busy||operator.status!=='active'||Boolean(feedback?.reload);
  const add=adds[operator.id]??{contact:'',roleId:''},selectedRole=operator.roles.find(role=>role.id===(add.roleId||defaultRole(operator)));
      return <article className={styles.card} aria-labelledby={`operator-${operator.id}`} aria-busy={busy}>
        <header className={styles.heading}><div><h2 id={`operator-${operator.id}`}>{operator.name}</h2><p className={styles.muted}>/partner/{operator.slug}</p></div></header>
        {feedback?.error&&<div className={styles.feedback}><p role="alert">{feedback.error}</p>{feedback.reload&&reload}</div>}{feedback?.message&&<p role="status">{feedback.message}</p>}
        {operator.status!=='active'?<p className={styles.feedback} role="status">Bolaget är avstängt eller arkiverat. Teamet visas i läsläge.</p>:null}
        {operator.missingRoles.length ? <div className={styles.feedback}><p role="status">Standardroller saknas: {operator.missingRoles.join(', ')}.</p><button className="sg-btn sg-btn-ghost" type="button" disabled={teamUnavailable} onClick={() => { void restoreRoles(operator); }}>Skapa saknade standardroller</button></div> : null}
        <section className={styles.invite} aria-label="Lägg till i teamet">
          <h3>Bjud in till {operator.name}</h3>
          <p className={styles.muted}>En ny e-postadress får ett aktiveringsmejl. Ett befintligt partnerkonto kopplas utan mejl.</p>
          <form className={styles.form} aria-label={`Lägg till medlem i ${operator.name}`} onSubmit={event => { void addMember(event, operator); }}>
            <label className={styles.field}>E-post eller användarnamn<input value={add.contact} autoComplete="off" spellCheck={false} maxLength={254} required disabled={teamUnavailable} placeholder="namn@bolag.se" onChange={event => { const contact = event.target.value; setAdds(current => ({ ...current, [operator.id]: { ...add, contact } })); }} /></label>
            <label className={styles.field}>Roll<select value={add.roleId || defaultRole(operator)} disabled={teamUnavailable || !operator.roles.length} onChange={event => { const roleId = event.target.value; setAdds(current => ({ ...current, [operator.id]: { ...add, roleId } })); }}>{operator.roles.map(role => <option key={role.id} value={role.id}>{roleLabel(role)}</option>)}</select></label>
            <button className="sg-btn sg-btn-secondary" type="submit" disabled={teamUnavailable || !operator.roles.length}>{add.contact.includes('@') ? 'Bjud in medlem' : 'Lägg till medlem'}</button>
          </form>
          {selectedRole ? <p className={styles.muted}>{roleLabel(selectedRole)}: {selectedRole.permissions.length} behörigheter. Se rollens åtkomst nedan.{!operator.members.length ? ' Första medlemmen föreslås bli administratör.' : ''}</p> : null}
        </section>
        <div className={styles.heading}><h3>Team</h3><span className={styles.count}>{operator.members.length} medlemmar</span></div>
        {operator.members.length ? <div className={styles.scroll}><table className={styles.members}>
          <thead><tr><th>Medlem</th><th>Roll</th><th>Status</th><th>Åtgärd</th></tr></thead>
          <tbody>{operator.members.map(member => {
            const key = `${operator.id}:${member.userId}`;
            const who = member.username ?? `konto ${member.userId}`;
            const roleId = drafts[key] ?? member.roleId;
            const options = operator.roles.some(role => role.id === member.roleId) ? operator.roles : [...operator.roles, { id: member.roleId, label: member.roleId, permissions: [], delegable: false }];
            return <tr key={member.userId}><td>{who}</td>
              <td><select aria-label={`Roll för ${who}`} value={roleId} disabled={teamUnavailable} onChange={event => { const value = event.target.value; setDrafts(current => {const next={...current};if(value===member.roleId)delete next[key];else next[key]=value;return next;}); }}>{options.map(role => <option key={role.id} value={role.id}>{roleLabel(role)}</option>)}</select></td>
              <td><span className={styles.status} data-status={member.status}>{MEMBER_STATUS[member.status] ?? member.status}</span></td>
              <td><div className={styles.actions}>
                {roleId !== member.roleId ? <button className="sg-btn sg-btn-secondary" type="button" disabled={teamUnavailable} onClick={() => { void change(operator, member, { roleId, status: member.status }, `Rollen för ${who} är sparad.`); }}>Spara roll</button> : null}
                {member.status === 'active' ? <button className="sg-btn sg-btn-ghost" type="button" disabled={teamUnavailable} onClick={() => { void change(operator, member, { roleId: member.roleId, status: 'suspended' }, `${who} är avstängd.`); }}>Stäng av</button> : null}
                {member.status === 'suspended' ? <button className="sg-btn sg-btn-ghost" type="button" disabled={teamUnavailable} onClick={() => { void change(operator, member, { roleId: member.roleId, status: 'active' }, `${who} är återaktiverad.`); }}>Återaktivera</button> : null}
              </div></td></tr>;
          })}</tbody></table></div> : <p className={styles.empty}>Teamet är tomt. Lägg till bolagets första administratör ovan.</p>}
        {operator.status==='active'&&<div className={styles.journal}><PartnerJournal key={operator.id} base={labUrl('/api/partner')} operatorSlug={operator.slug} operatorId={operator.id}/></div>}
        <details className={styles.roles}><summary>Vad får rollerna göra?</summary>{operator.roles.map(role => <div key={role.id}><strong>{roleLabel(role)}</strong><p className={styles.muted}>{role.permissions.map(permission => PERMISSION_LABELS[permission] ?? permission).join(' · ') || 'Inga behörigheter'}</p></div>)}</details>
      </article>;
}
