import {useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode} from 'react';
import Link from '../../../runtime/navigation';
import styles from './demo-builder.module.css';
import {DEMO_STEPS, DEMO_CURRENCIES, DEMO_KEY_SCOPES, DEMO_LANGUAGES, DEMO_LAUNCH_ENABLED, DEMO_LAUNCH_OFF_TEXT, DemoError, chooseCompany, chooseDealer, chooseRoom, creditDemo, demoCompanies, demoCredits, demoDealers, demoDisplayName,
  demoKeyName, demoNameBase, demoPermissions, demoRooms, editDemo, expiryText, formatMoney, goToStep, initialDemoState, launchDemo, nextLabel, nextStep, previousStep, reachableStep,
  readCreditAmount, readDemoCatalogFrom, readDemoSession, readRoomGameConfig, revokeDemoKey, stepRequirement,
  type DemoAdministration, type DemoCompany, type DemoCredits as Credits, type DemoDealer, type DemoKey, type DemoLaunch, type DemoPermissions, type DemoRoom, type DemoState} from '../../lib/demo-builder.mjs';

type Load<T>={status:'loading'}|{status:'error';message:string;authentication:boolean}|{status:'ready';value:T};
type LaunchState={phase:'idle'}|{phase:'create'|'launch'}|{phase:'done';value:DemoLaunch}|{phase:'error';message:string;key:DemoKey|null};
type RevokeState={phase:'idle'}|{phase:'busy'}|{phase:'done'}|{phase:'error';message:string};
type Saldo={balance:number|null;currency:string|null};
type TopUpState={phase:'idle'}|{phase:'busy'}|{phase:'done';amount:number;before:Saldo;after:Saldo}|{phase:'error';message:string};
const SCOPE_TEXT=DEMO_KEY_SCOPES.join(' och ');
// Rutan visar visningsnamnet även medan det är ogiltigt; stegets krav säger vad som är fel.
const safeDisplayName=(form:DemoState['form'])=>{try{return demoDisplayName(form);}catch{return form.displayName.trim()||demoNameBase(form);}};

const failure=(error:unknown)=>{const status=error instanceof DemoError?error.status:0;return {status:'error' as const,message:error instanceof Error?error.message:'Okänt fel.',authentication:[401,403].includes(status)};};
const cx=(...names:(string|false|null|undefined)[])=>names.filter(Boolean).join(' ');
const initials=(name:string)=>name.trim().slice(0,2).toUpperCase()||'?';
const COMPANIES_HREF='/admin/companies';

function Chip({tone,dot,children}:{tone?:'ok'|'warn'|'danger'|'info';dot?:boolean;children:ReactNode}) {
  return <span className={cx(styles.chip,tone==='ok'&&styles.chipOk,tone==='warn'&&styles.chipWarn,tone==='danger'&&styles.chipDanger,tone==='info'&&styles.chipInfo)}>{dot&&<span className={styles.dot} aria-hidden="true"/>}{children}</span>;
}

function Steps({state,done,onStep}:{state:DemoState;done:boolean;onStep:(step:number)=>void}) {
  const reachable=reachableStep(state);
  return <ol className={styles.steps} aria-label="Steg">
    {DEMO_STEPS.map((step,index)=>{
      const n=index+1,finished=done||n<state.step,now=!done&&n===state.step;
      return <li key={step.id}><button type="button" className={cx(styles.step,finished&&styles.stepDone,now&&styles.stepNow)} aria-current={now?'step':undefined}
        disabled={done||n>reachable} onClick={()=>onStep(n)}><span className={styles.stepN} aria-hidden="true">{finished?'✓':n}</span><span className={styles.stepT}>{step.label}{finished&&<span className="sr-only"> (klart)</span>}</span></button></li>;
    })}
  </ol>;
}

function CompanyStep({companies,selected,onSelect}:{companies:DemoCompany[];selected:string|null;onSelect:(id:string)=>void}) {
  if(!companies.length)return <div className={styles.empty}><Chip tone="warn">Inga bolag</Chip><h3 className={styles.mt}>Det finns inget aktivt bolag att bygga en demo åt</h3>
    <p className={styles.small}>Skapa bolaget först under Bolag och spelbord › Nytt bolag, lägg till ett spelbord och publicera paketet.</p>
    <p className={styles.mt}><Link className={styles.btn} href={COMPANIES_HREF}>Bolag och spelbord › Nytt bolag</Link></p></div>;
  return <div className={styles.choiceGrid}>{companies.map(company=><button key={company.id} type="button" className={styles.choice} aria-pressed={company.id===selected} onClick={()=>onSelect(company.id)}>
    <div className={styles.choiceTop}><span className={styles.choiceName}>{company.name}</span>{company.playable?<Chip tone="ok" dot>{company.playable} spelbara</Chip>:<Chip tone="warn">Inga spelbara spelbord</Chip>}</div>
    <div className={styles.choiceMeta}><code>{company.slug}</code> · {company.rooms} spelbord · {company.packageRevision===null?'inget publicerat paket':`publicerad version ${company.packageRevision}`}</div>
  </button>)}</div>;
}

function RoomStep({company,rooms,selected,onSelect}:{company:DemoCompany;rooms:DemoRoom[];selected:string|null;onSelect:(room:DemoRoom)=>void}) {
  if(!rooms.length)return <div className={styles.empty}><Chip tone="warn">Inga spelbord</Chip><h3 className={styles.mt}>{company.name} har inget spelbord</h3>
    <p className={styles.small}>Lägg till ett spelbord hos bolaget under Bolag och spelbord och publicera paketet, så går det att välja här.</p>
    <p className={styles.mt}><Link className={styles.btn} href={`/admin/companies/${encodeURIComponent(company.id)}?flik=spelbord`}>Bolag › {company.name} › Spelbord</Link></p></div>;
  return <div className={styles.choiceGrid}>{rooms.map(room=><button key={room.id} type="button" className={styles.choice} aria-pressed={room.id===selected} disabled={!room.selectable} onClick={()=>onSelect(room)}>
    <div className={styles.choiceTop}><span className={styles.choiceName}>{room.name}</span>{room.selectable?<Chip tone="ok" dot>öppet</Chip>:<Chip tone="warn">{room.state==='live'?'inte spelbart':'pausat'}</Chip>}</div>
    <div className={styles.choiceMeta}><code>{room.id}</code> · {room.game} · {room.dealers.length?`${room.dealers.length} ${room.dealers.length===1?'dealer':'dealers'}: ${room.dealers.map(row=>row.name).join(', ')}`:'inga dealers i paketet'}</div>
    {!room.selectable&&<div className={cx(styles.choiceMeta,styles.missing)}>{room.reason}</div>}
  </button>)}</div>;
}

function DealerStep({company,dealers,selected,onSelect}:{company:DemoCompany;dealers:{selectable:DemoDealer[];others:DemoDealer[]};selected:string|null;onSelect:(id:string)=>void}) {
  const assign=<Link href={`/admin/companies/${encodeURIComponent(company.slug)}?flik=tilldelning`}>Bolag › {company.name} › Tilldelning</Link>;
  return <div className={styles.stack}>
    {dealers.selectable.length?<div className={styles.choiceGrid}>{dealers.selectable.map(dealer=><button key={dealer.id} type="button" className={styles.choice} aria-pressed={dealer.id===selected} onClick={()=>onSelect(dealer.id)}>
      <div className={styles.choiceTop}><span className={styles.portrait} aria-hidden="true">{initials(dealer.name)}</span><Chip tone="ok" dot>i paketet</Chip></div>
      <span className={styles.choiceName}>{dealer.name}</span><div className={styles.choiceMeta}><code>{dealer.id}</code></div>
    </button>)}</div>
    :<div className={styles.empty}><Chip tone="warn">Ingen dealer</Chip><h3 className={styles.mt}>Spelbordets publicerade paket har ingen dealer</h3><p className={styles.small}>Tilldela en dealer till bolaget och publicera paketet: {assign}.</p></div>}
    {dealers.others.length>0&&<p className={cx(styles.small,styles.muted)}>Fler dealers finns i Admin: {dealers.others.map(row=>row.name).join(', ')}; de måste tilldelas bolaget och publiceras först ({assign}).</p>}
  </div>;
}

function CreditsReadout({credits,company,room}:{credits:Load<Credits>;company:DemoCompany;room:DemoRoom}) {
  if(credits.status==='loading')return <p className={cx(styles.small,styles.muted)} role="status">Läser spelbordets spelinställningar…</p>;
  if(credits.status==='error')return <p className={cx(styles.small,styles.muted)}>{credits.message}</p>;
  if(!credits.value)return <p className={cx(styles.small,styles.muted)}>Spelbordet {room.name} har inga publicerade spelinställningar, så påfyllningen av demosaldot är okänd. Publicera dem under Bolag och spelbord › {company.name}.</p>;
  const value=credits.value;
  return <dl className={styles.kv}>
    <dt>Startsaldo</dt><dd>Bestäms av spelmotorn när testsessionen skapas och visas i kvittot. Det går inte att välja här; efter lanseringen kan du fylla på demosaldot.</dd>
    <dt>Demokrediter</dt><dd>{value.refill===null?'okänd påfyllning':`${formatMoney(value.refill,null)} per påfyllning i spelet`} · insatsprofil {value.label} · bordsspråk {value.language}</dd>
  </dl>;
}

function LaunchStep({state,company,room,dealer,permissions,credits,onEdit}:{state:DemoState;company:DemoCompany;room:DemoRoom;dealer:DemoDealer;permissions:DemoPermissions;credits:Load<Credits>;onEdit:(field:'name'|'displayName'|'language'|'currency',value:string)=>void}) {
  const name=state.form.name.trim(),keyName=demoKeyName(state.form);
  return <div className={styles.stack}>
    <div className={styles.form}>
      <div className={styles.field}><label htmlFor="demo-name">Demons namn</label><input id="demo-name" className={styles.input} value={state.form.name} maxLength={80} autoComplete="off" onChange={event=>onEdit('name',event.target.value)} placeholder={company.name}/>
        <span className={styles.hint}>Nyckeln för demon heter <code>{keyName||'demo-…'}</code> under Integration och får bara rättigheterna {SCOPE_TEXT}.</span></div>
      <div className={styles.field}><label htmlFor="demo-display">Spelarens visningsnamn</label><input id="demo-display" className={styles.input} value={state.form.displayName} maxLength={40} autoComplete="off" onChange={event=>onEdit('displayName',event.target.value)} placeholder={demoNameBase(state.form)||'Som demons namn'}/>
        <span className={styles.hint}>Visas i spelet. Högst 40 tecken; tomt ger demons namn.</span></div>
      <div className={styles.field}><label htmlFor="demo-language">Språk i spelet</label><select id="demo-language" className={styles.input} value={state.form.language} onChange={event=>onEdit('language',event.target.value)}>{DEMO_LANGUAGES.map(row=><option key={row.id} value={row.id}>{row.label}</option>)}</select></div>
      <div className={styles.field}><label htmlFor="demo-currency">Valuta</label><select id="demo-currency" className={styles.input} value={state.form.currency} onChange={event=>onEdit('currency',event.target.value)}>{DEMO_CURRENCIES.map(row=><option key={row}>{row}</option>)}</select></div>
    </div>
    <section aria-labelledby="demo-credits-title"><h3 id="demo-credits-title" className={cx(styles.small,styles.muted)} style={{fontWeight:600,marginBottom:6}}>Saldo och giltighet</h3>
      <CreditsReadout credits={credits} company={company} room={room}/>
      <p className={cx(styles.small,styles.muted,styles.mt)}>Giltighetstid går inte att välja: länken gäller 6 timmar; nyckeln tills den återkallas. Nycklar har ingen utgångstid i dag (fältet saknas i databasen; tidigast efter O03). Återkalla finns i kvittot och stänger demospelarens sessioner direkt.</p>
    </section>
    <div className={cx(styles.note,styles.noteAccent)}>Skapar nyckeln <b>{name?keyName:'(namn saknas)'}</b> med rättigheterna {SCOPE_TEXT} och en testsession med demokrediter; länken anger spelbordet <b>{room.name}</b> hos <b>{company.name}</b> med <b>{dealer.name}</b>. Nyckel och hemlighet lämnar aldrig servern. Två skrivningar: <code>apikeys/create</code> och <code>apikeys/launch</code>.</div>
    {permissions.blocker&&<div className={cx(styles.note,styles.noteWarn)} role="note">{permissions.blocker}</div>}
  </div>;
}

function Result({value,company,room,dealer,language,permissions,revoke,onRevoke,onReset}:{value:DemoLaunch;company:DemoCompany;room:DemoRoom;dealer:DemoDealer;language:string;permissions:DemoPermissions;revoke:RevokeState;onRevoke:()=>void;onReset:()=>void}) {
  const [copied,setCopied]=useState<'idle'|'copied'|'manual'>('idle');
  const input=useRef<HTMLInputElement>(null);
  useEffect(()=>{if(copied==='idle')return;const timer=setTimeout(()=>setCopied('idle'),2500);return()=>clearTimeout(timer);},[copied]);
  const copy=async()=>{
    try{await navigator.clipboard.writeText(value.link);setCopied('copied');}
    catch{input.current?.select();setCopied('manual');}
  };
  return <div className={styles.stack}>
    <div className={styles.receipt} role="status">Demon är klar · nyckel {value.key.name} · {dealer.name} vid {room.name} hos {company.name}</div>
    <div>
      <label className={cx(styles.small,styles.muted)} htmlFor="demo-link" style={{fontWeight:600}}>Demolänk</label>
      <div className={cx(styles.linkBox,styles.mt)}><input id="demo-link" ref={input} className={styles.input} readOnly value={value.link} onFocus={event=>event.currentTarget.select()}/>
        <button type="button" className={cx(styles.btn,styles.btnPrimary)} onClick={copy}>{copied==='copied'?'Kopierad':'Kopiera'}</button></div>
      {copied==='manual'&&<p className={cx(styles.small,styles.muted,styles.mt)}>Urklipp är inte tillgängligt här. Länken är markerad: kopiera den med Ctrl+C.</p>}
    </div>
    <p><b>Skicka till bolaget.</b> Den som öppnar länken loggas in som demospelaren <b>{value.displayName}</b> ({language==='sv'?'svenska':'engelska'}). Länken anger spelbordet {room.name} hos {company.name} med {dealer.name}.</p>
    <dl className={styles.kv}>
      <dt>Startsaldo</dt><dd>{formatMoney(value.receipt.balance,value.receipt.currency)}</dd>
      <dt>Demospelare</dt><dd>{value.receipt.playerId?<code>{value.receipt.playerId}</code>:'–'}{value.receipt.playerRef&&<> · ref <code>{value.receipt.playerRef}</code></>}</dd>
      <dt>Länken gäller</dt><dd>{expiryText(value.receipt.expiresIn)} från nu, enligt spelmotorn.</dd>
      <dt>Nyckeln</dt><dd><code>{value.key.name}</code> · rättigheter {SCOPE_TEXT} · {revoke.phase==='done'?<Chip tone="danger">återkallad</Chip>:'gäller tills den återkallas'}</dd>
    </dl>
    <TopUp value={value} permissions={permissions} revoked={revoke.phase==='done'}/>
    <section className={cx(styles.panel,styles.panelDanger)} aria-labelledby="demo-revoke-title">
      <div><h3 id="demo-revoke-title" className={styles.panelTitle}>Återkalla demon</h3>
        <p className={cx(styles.small,styles.muted)}>{revoke.phase==='done'?'Nyckeln är återkallad: länken fungerar inte längre och demospelarens sessioner har stängts.'
          :'Nyckeln har ingen utgångstid och gäller tills du återkallar den. Då slutar länken fungera och demospelarens sessioner stängs direkt.'}</p></div>
      {revoke.phase==='done'?<Chip tone="danger">återkallad</Chip>:permissions.canRevoke?<button type="button" className={cx(styles.btn,styles.btnDanger)} disabled={revoke.phase==='busy'} onClick={onRevoke}>{revoke.phase==='busy'?'Återkallar…':'Återkalla nyckeln'}</button>
        :<span className={cx(styles.small,styles.muted)}>Återkallas under Integration (kräver rollen admin).</span>}
    </section>
    {revoke.phase==='error'&&<div className={cx(styles.note,styles.noteDanger)} role="alert">{revoke.message}</div>}
    <div className={styles.footer}><span className={cx(styles.small,styles.muted)}>Demonyckelns hemlighet lämnar aldrig servern. Ska bolaget integrera själv skapas en egen partnernyckel under Integration.</span><button type="button" className={cx(styles.btn,styles.btnGhost)} onClick={onReset}>Skapa en ny demo</button></div>
  </div>;
}

// Frivillig påfyllning efter lanseringen: apikeys/credit för demospelaren i kvittot.
function TopUp({value,permissions,revoked}:{value:DemoLaunch;permissions:DemoPermissions;revoked:boolean}) {
  const [amount,setAmount]=useState('');
  const [state,setState]=useState<TopUpState>({phase:'idle'});
  const [known,setKnown]=useState<Saldo>({balance:value.receipt.balance,currency:value.receipt.currency});
  const currency=known.currency??value.receipt.currency,playerId=value.receipt.playerId,busy=state.phase==='busy';
  const checked=readCreditAmount(amount);
  const blocked=revoked?'Nyckeln är återkallad.':!permissions.canCredit?'Din inloggning får inte fylla på demosaldo. Det kräver rollen admin.':!playerId?'Demospelaren saknas i kvittot, så saldot kan inte fyllas på här.':'';
  const submit=async(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();
    if(blocked||checked.amount===null||busy||!playerId)return;
    const before=known,sent=checked.amount;
    setState({phase:'busy'});
    try{
      const receipt=await creditDemo({fetchImpl:fetch,keyId:value.key.id,playerId,amount:sent});
      // Utan saldo i svaret är saldot okänt, inte det gamla.
      const after={balance:receipt.balance,currency:receipt.balance===null?currency:receipt.currency};
      setKnown(after);setState({phase:'done',amount:sent,before,after});setAmount('');
    }catch(error){setState({phase:'error',message:error instanceof Error?error.message:'Okänt fel.'});}
  };
  return <section className={styles.panel} aria-labelledby="demo-topup-title">
    <div><h3 id="demo-topup-title" className={styles.panelTitle}>Fyll på demosaldo <span className={styles.faint}>(frivilligt)</span></h3>
      <p className={cx(styles.small,styles.muted)}>Saldo nu: {formatMoney(known.balance,currency)}. Påfyllningen går till demospelaren via <code>apikeys/credit</code>.</p></div>
    <form className={styles.topUp} onSubmit={submit}>
      <div className={styles.field}><label htmlFor="demo-topup">Belopp{currency?` (${currency})`:''}</label>
        <input id="demo-topup" className={styles.input} inputMode="decimal" autoComplete="off" value={amount} disabled={Boolean(blocked)||busy} onChange={event=>setAmount(event.target.value)}/></div>
      <button type="submit" className={styles.btn} disabled={Boolean(blocked)||busy||checked.amount===null}>{busy?'Fyller på…':'Fyll på'}</button>
    </form>
    {blocked?<p className={styles.missing}>{blocked}</p>:amount.trim()&&checked.missing&&<p className={styles.missing}>{checked.missing}</p>}
    {state.phase==='done'&&<div className={styles.note} role="status">{state.after.balance!==null
      ?<>Påfyllt {formatMoney(state.amount,state.after.currency)}: saldo före <b>{formatMoney(state.before.balance,state.before.currency)}</b>, efter <b>{formatMoney(state.after.balance,state.after.currency)}</b>.</>
      :<>Påfyllningen på {formatMoney(state.amount,state.after.currency)} är skickad. Svaret innehöll inget saldo; saldot syns i spelet.</>}</div>}
    {state.phase==='error'&&<div className={cx(styles.note,styles.noteDanger)} role="alert">{state.message}</div>}
  </section>;
}

function Summary({state,company,room,dealer,done,onStep}:{state:DemoState;company:DemoCompany|null;room:DemoRoom|null;dealer:DemoDealer|null;done:boolean;onStep:(step:number)=>void}) {
  const rows:{label:string;value:ReactNode;text?:ReactNode;step:number}[]=[
    {label:'Bolag',value:company?.name,text:company&&<code>{company.slug}</code>,step:1},
    {label:'Spelbord',value:room?.name,text:room&&<code>{room.id}</code>,step:2},
    {label:'Dealer',value:dealer?.name,text:dealer&&<code>{dealer.id}</code>,step:3},
    {label:'Demo',value:state.form.name.trim()||undefined,text:state.form.name.trim()&&<><code>{demoKeyName(state.form)}</code> · {safeDisplayName(state.form)} · {state.form.language} · {state.form.currency}</>,step:4},
  ];
  return <aside className={styles.card} aria-labelledby="demo-summary-title"><div className={styles.cardHead}><h2 id="demo-summary-title">Din demo</h2><span className={styles.aside}>{done?'klar':`steg ${state.step} av ${DEMO_STEPS.length}`}</span></div>
    <div className={styles.rows}>{rows.map(row=><div key={row.label} className={styles.row}><div><div className={styles.rowLabel}>{row.label}</div><div className={cx(styles.rowValue,!row.value&&styles.faint)}>{row.value??'–'}</div>{row.text&&<div className={styles.rowText}>{row.text}</div>}</div>
      {!done&&row.value&&row.step!==state.step&&<button type="button" className={cx(styles.btn,styles.btnSmall)} onClick={()=>onStep(row.step)}>Ändra</button>}</div>)}</div>
  </aside>;
}

export function DemoBuilder() {
  const [catalog,setCatalog]=useState<Load<DemoAdministration>>({status:'loading'});
  const [session,setSession]=useState<Load<DemoPermissions>>({status:'loading'});
  const [refresh,setRefresh]=useState(0);
  const [state,setState]=useState<DemoState>(initialDemoState);
  const [launch,setLaunch]=useState<LaunchState>({phase:'idle'});
  const [revoke,setRevoke]=useState<RevokeState>({phase:'idle'});
  const [credits,setCredits]=useState<Load<Credits>>({status:'loading'});
  useEffect(()=>{
    const controller=new AbortController();
    setCatalog(current=>current.status==='ready'?current:{status:'loading'});setSession({status:'loading'});
    void readDemoCatalogFrom(fetch,controller.signal).then(value=>{if(!controller.signal.aborted)setCatalog({status:'ready',value});},error=>{if(!controller.signal.aborted)setCatalog(failure(error));});
    void readDemoSession(fetch,controller.signal).then(value=>{if(!controller.signal.aborted)setSession({status:'ready',value:demoPermissions(value)});},error=>{if(!controller.signal.aborted)setSession(failure(error));});
    return()=>controller.abort();
  },[refresh]);
  const administration=catalog.status==='ready'?catalog.value:null;
  const permissions=session.status==='ready'?session.value:null;
  const companies=useMemo(()=>administration?demoCompanies(administration):[],[administration]);
  const company=companies.find(row=>row.id===state.operatorId)??null;
  const rooms=useMemo(()=>administration&&company?demoRooms(administration,company.id):[],[administration,company]);
  const room=rooms.find(row=>row.id===state.roomId)??null;
  const dealers=useMemo(()=>administration?demoDealers(administration,room):{selectable:[],others:[]},[administration,room]);
  const dealer=dealers.selectable.find(row=>row.id===state.dealerId)??null;
  // Valen bedöms mot katalogen: ett bolag eller spelbord som försvunnit räknas som ovalt.
  const effective:DemoState={...state,operatorId:company?.id??null,roomId:room?.id??null,dealerId:dealer?.id??null};
  const requirement=stepRequirement(effective);
  const done=launch.phase==='done';
  const busy=launch.phase==='create'||launch.phase==='launch';
  useEffect(()=>{
    if(effective.step!==4||!company||!room||!permissions)return;
    if(!permissions.canReadConfig){setCredits({status:'error',message:'Spelinställningarna kan inte läsas med din inloggning.',authentication:false});return;}
    const controller=new AbortController();setCredits({status:'loading'});
    void readRoomGameConfig(fetch,{operatorId:company.id,roomId:room.id},controller.signal).then(value=>{if(!controller.signal.aborted)setCredits({status:'ready',value:demoCredits(value)});},
      error=>{if(!controller.signal.aborted)setCredits(failure(error));});
    return()=>controller.abort();
  },[effective.step,company?.id,room?.id,permissions]);
  const go=(step:number)=>{if(busy)return;setState(current=>goToStep(current,step));};
  const start=async()=>{
    if(!company||!room||!dealer||!permissions?.canLaunch||!requirement.ready||busy)return;
    setLaunch({phase:'create'});setRevoke({phase:'idle'});
    try{
      const value=await launchDemo({fetchImpl:fetch,form:state.form,permissions,operatorSlug:company.slug,roomId:room.id,dealerId:dealer.id,onPhase:phase=>setLaunch({phase})});
      setLaunch({phase:'done',value});
    }catch(error){setLaunch({phase:'error',message:error instanceof Error?error.message:'Okänt fel.',key:(error as {key?:DemoKey}).key??null});}
  };
  const revokeKey=async(key:DemoKey)=>{
    if(revoke.phase==='busy'||!window.confirm(`Återkalla nyckeln ${key.name}? Demolänken slutar fungera och demospelarens sessioner stängs.`))return;
    setRevoke({phase:'busy'});
    try{await revokeDemoKey({fetchImpl:fetch,keyId:key.id});setRevoke({phase:'done'});}
    catch(error){setRevoke({phase:'error',message:error instanceof Error?error.message:'Okänt fel.'});}
  };
  const reset=()=>{setState(initialDemoState());setLaunch({phase:'idle'});setRevoke({phase:'idle'});setRefresh(value=>value+1);};
  const stepTitle=done?'Demon är klar':DEMO_STEPS[effective.step-1].label;
  let body:ReactNode;
  if(catalog.status==='loading')body=<p role="status">Läser bolag, spelbord och dealers…</p>;
  else if(catalog.status==='error')body=<div role="alert" className={styles.stack}><p>{catalog.authentication?'Din inloggning saknas eller har gått ut. Logga in igen.':catalog.message}</p><div><button type="button" className={styles.btn} onClick={()=>setRefresh(value=>value+1)}>Försök igen</button></div></div>;
  else if(done&&launch.phase==='done'&&company&&room&&dealer&&permissions)body=<Result value={launch.value} company={company} room={room} dealer={dealer} language={state.form.language} permissions={permissions} revoke={revoke} onRevoke={()=>revokeKey(launch.value.key)} onReset={reset}/>;
  else if(effective.step===1)body=<CompanyStep companies={companies} selected={company?.id??null} onSelect={id=>setState(current=>chooseCompany(current,id))}/>;
  else if(effective.step===2&&company)body=<RoomStep company={company} rooms={rooms} selected={room?.id??null} onSelect={value=>setState(current=>chooseRoom(current,value))}/>;
  else if(effective.step===3&&company)body=<DealerStep company={company} dealers={dealers} selected={dealer?.id??null} onSelect={id=>setState(current=>chooseDealer(current,id))}/>;
  else if(company&&room&&dealer)body=<LaunchStep state={state} company={company} room={room} dealer={dealer} permissions={permissions??demoPermissions(null)} credits={session.status==='ready'?credits:session.status==='loading'?{status:'loading'}:session} onEdit={(field,value)=>setState(current=>editDemo(current,field,value))}/>;
  const launchReady=effective.step===4?requirement.ready&&Boolean(permissions?.canLaunch)&&!busy:requirement.ready;
  const launchMissing=effective.step===4&&!DEMO_LAUNCH_ENABLED?DEMO_LAUNCH_OFF_TEXT:effective.step===4&&session.status==='loading'?'Läser dina behörigheter…':effective.step===4&&permissions&&!permissions.canLaunch?permissions.blocker:requirement.missing;
  return <section className={styles.page} aria-labelledby="demo-title"><div className={styles.inner}>
    <header className={styles.head}><div><p className={styles.eyebrow}><Link href="/admin">Översikt</Link><span className={styles.faint}>/</span><span>Skapa demo</span></p><h1 id="demo-title">Skapa demo</h1>
      <p className={styles.intro}>Bygg en demo åt ett bolag i fyra steg{DEMO_LAUNCH_ENABLED?' och få en länk att skicka':''}. Demon använder bolagets publicerade paket och spelbord; inget ändras i paketet.</p></div></header>
    <Steps state={effective} done={done} onStep={go}/>
    <div className={styles.grid}>
      <article className={styles.card} aria-live="polite">
        <div className={styles.cardHead}><h2>{done?stepTitle:`${effective.step}. ${stepTitle}`}</h2>{!done&&catalog.status==='ready'&&<span className={styles.aside}>{effective.step===1?`${companies.length} aktiva bolag`:effective.step===2?`${rooms.filter(row=>row.selectable).length} av ${rooms.length} spelbara`:effective.step===3?`${dealers.selectable.length} i paketet`:''}</span>}</div>
        {body}
        {launch.phase==='error'&&<div className={cx(styles.note,styles.noteDanger,styles.mt)} role="alert">{launch.message}{launch.key&&<> Nyckeln <b>{launch.key.name}</b> skapades innan felet. {permissions?.canRevoke&&revoke.phase!=='done'&&<button type="button" className={cx(styles.btn,styles.btnSmall,styles.btnDanger)} disabled={revoke.phase==='busy'} onClick={()=>revokeKey(launch.key as DemoKey)}>{revoke.phase==='busy'?'Återkallar…':'Återkalla nyckeln'}</button>}{revoke.phase==='done'&&' Nyckeln är återkallad.'}{revoke.phase==='error'&&` ${revoke.message}`}</>}</div>}
        {busy&&<p className={cx(styles.small,styles.muted,styles.mt)} role="status">{launch.phase==='create'?'Skapar nyckeln…':'Startar testsessionen i spelmotorn…'}</p>}
        {!done&&catalog.status==='ready'&&<div className={styles.footer}>
          <button type="button" className={cx(styles.btn,styles.btnGhost)} disabled={effective.step===1||busy} onClick={()=>setState(current=>previousStep(current))}>Tillbaka</button>
          <div className={styles.footerNext}>
            {effective.step<4?<button type="button" className={cx(styles.btn,styles.btnPrimary)} disabled={!launchReady} onClick={()=>setState(current=>nextStep({...current,...effective}))}>{nextLabel(effective.step)}</button>
              :<button type="button" className={cx(styles.btn,styles.btnPrimary)} disabled={!launchReady} onClick={start}>{busy?'Skapar demon…':nextLabel(4)}</button>}
            {!launchReady&&launchMissing&&<span className={styles.missing}>{launchMissing}</span>}
          </div>
        </div>}
      </article>
      <Summary state={effective} company={company} room={room} dealer={dealer} done={done} onStep={go}/>
    </div>
  </div></section>;
}
