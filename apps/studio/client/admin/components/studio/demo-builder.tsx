import {useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode} from 'react';
import {ArrowLeft, ArrowRight, Ban, Check, Copy, RotateCcw} from 'lucide-react';
import Link from '../../../runtime/navigation';
import {HubPage, Crumbs, Card, Chip, Empty, KV, Note} from '../ui/hub';
import {Button, buttonVariants, cn, focusRing, plural, TechnicalDetails} from '../ui/kit';
import {ConfirmDialog, DialogSteps} from '../ui/dialog';
import {toast} from '../ui/toast';
import {DealerAvatar} from './dealer-identity-portrait';
import {DEMO_STEPS, DEMO_CURRENCIES, DEMO_KEY_SCOPES, DEMO_LANGUAGES, DemoError, chooseCompany, chooseDealer, chooseRoom, creditDemo, demoCompanies, demoCredits, demoDealers, demoDisplayName,
  demoKeyName, demoNameBase, demoPermissions, demoRooms, editDemo, expiryText, formatMoney, goToStep, initialDemoState, launchDemo, nextLabel, nextStep, previousStep, reachableStep,
  readCreditAmount, readDemoCatalogFrom, readDemoSession, readRoomGameConfig, revokeDemoKey, stepRequirement,
  type DemoAdministration, type DemoCompany, type DemoCredits as Credits, type DemoDealer, type DemoKey, type DemoLaunch, type DemoPermissions, type DemoRoom, type DemoState} from '../../lib/demo-builder.mjs';

// Skapa demo (/admin/demo) on the Admin kit: the page layout from hub.tsx, a guided step row, the choice
// cards and fields of the guided dialogs, toasts for Kopiera and Återkalla and a ConfirmDialog before
// a key is revoked. Identities (company, table, dealer, key, demo player) stay in Tekniska detaljer.
type Load<T>={status:'loading'}|{status:'error';message:string;authentication:boolean}|{status:'ready';value:T};
type LaunchState={phase:'idle'}|{phase:'create'|'launch'}|{phase:'done';value:DemoLaunch}|{phase:'error';message:string;key:DemoKey|null};
type RevokeState={phase:'idle'}|{phase:'busy'}|{phase:'done'}|{phase:'error';message:string};
type Saldo={balance:number|null;currency:string|null};
type TopUpState={phase:'idle'}|{phase:'busy'}|{phase:'done';amount:number;before:Saldo;after:Saldo}|{phase:'error';message:string};
const SCOPE_TEXT=DEMO_KEY_SCOPES.join(' och ');
// Rutan visar visningsnamnet även medan det är ogiltigt; stegets krav säger vad som är fel.
const safeDisplayName=(form:DemoState['form'])=>{try{return demoDisplayName(form);}catch{return form.displayName.trim()||demoNameBase(form);}};
const languageLabel=(id:string)=>DEMO_LANGUAGES.find(row=>row.id===id)?.label??id;
const GAMES:Record<string,string>={blackjack:'Blackjack',roulette:'Roulette'};

const failure=(error:unknown)=>{const status=error instanceof DemoError?error.status:0;return {status:'error' as const,message:error instanceof Error?error.message:'Okänt fel.',authentication:[401,403].includes(status)};};
const companyHref=(company:DemoCompany,flik:string)=>`/admin/companies/${encodeURIComponent(company.id)}?flik=${flik}`;
// The choice cards and fields of the guided dialogs (Nytt spelbord, Ny dealer), on the same tokens.
const choiceClass=(on:boolean)=>cn('grid w-full min-w-0 content-start gap-1.5 rounded-xl border p-3.5 text-left text-[13px] text-sg-text transition-colors disabled:cursor-not-allowed disabled:opacity-60',focusRing,
  on?'border-sg-text bg-sg-surface shadow-[0_0_0_2px_var(--sg-lime)]':'cursor-pointer border-sg-border bg-sg-surface enabled:hover:bg-sg-surface-2');
const choiceGrid='grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-2.5';
const fieldClass='h-10 w-full min-w-0 rounded-lg border border-sg-border bg-sg-surface px-3 text-[14px] font-normal text-sg-text placeholder:text-sg-faint disabled:opacity-60 '+focusRing;
const linkClass='font-semibold text-sg-accent-text no-underline hover:underline';
const alertClass='m-0 rounded-lg bg-sg-danger-bg px-3.5 py-2.5 text-[13px] text-sg-danger';
const small='m-0 text-[12.5px] text-sg-muted';
const missingClass='m-0 text-[12.5px] text-sg-warn';

function Field({id,label,hint,children}:{id:string;label:ReactNode;hint?:ReactNode;children:ReactNode}) {
  return <div className="grid min-w-0 content-start gap-1.5 text-[13px]"><label htmlFor={id} className="font-semibold text-sg-text">{label}</label>{children}{hint&&<span className="text-[12.5px] text-sg-muted">{hint}</span>}</div>;
}

function CompanyStep({companies,selected,onSelect}:{companies:DemoCompany[];selected:string|null;onSelect:(id:string)=>void}) {
  if(!companies.length)return <Empty chip="Inga bolag" title="Det finns inget aktivt bolag att bygga en demo åt" text="Skapa bolaget först under Bolag och spelbord, lägg till ett spelbord och publicera paketet."
    action={<Link className={buttonVariants()} href="/admin/companies?view=create">Nytt bolag</Link>}/>;
  return <div className={choiceGrid} role="group" aria-label="Bolag">{companies.map(company=><button key={company.id} type="button" className={choiceClass(company.id===selected)} aria-pressed={company.id===selected} onClick={()=>onSelect(company.id)}>
    <span className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1"><span className="min-w-0 text-[13.5px] font-semibold [overflow-wrap:break-word]">{company.name}</span>{company.playable?<Chip tone="ok" dot>{company.playable} spelbara</Chip>:<Chip tone="warn">Inga spelbara spelbord</Chip>}</span>
    <span className="text-xs text-sg-muted">{plural(company.rooms,'spelbord','spelbord')} · {company.packageRevision===null?'inget publicerat paket':`publicerad version ${company.packageRevision}`}</span>
  </button>)}</div>;
}

function RoomStep({company,rooms,selected,onSelect}:{company:DemoCompany;rooms:DemoRoom[];selected:string|null;onSelect:(room:DemoRoom)=>void}) {
  if(!rooms.length)return <Empty chip="Inga spelbord" title={`${company.name} har inget spelbord`} text="Lägg till ett spelbord hos bolaget under Bolag och spelbord och publicera paketet, så går det att välja här."
    action={<Link className={buttonVariants()} href={companyHref(company,'spelbord')}>Spelbord hos {company.name}</Link>}/>;
  return <div className={choiceGrid} role="group" aria-label="Spelbord">{rooms.map(room=><button key={room.id} type="button" className={choiceClass(room.id===selected)} aria-pressed={room.id===selected} disabled={!room.selectable} onClick={()=>onSelect(room)}>
    <span className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1"><span className="min-w-0 text-[13.5px] font-semibold [overflow-wrap:break-word]">{room.name}</span>{room.selectable?<Chip tone="ok" dot>öppet</Chip>:<Chip tone="warn">{room.state==='live'?'inte spelbart':'pausat'}</Chip>}</span>
    <span className="text-xs text-sg-muted">{GAMES[room.game]??room.game} · {room.dealers.length?`${plural(room.dealers.length,'dealer','dealers')}: ${room.dealers.map(row=>row.name).join(', ')}`:'inga dealers i paketet'}</span>
    {!room.selectable&&<span className="text-xs text-sg-warn">{room.reason}</span>}
  </button>)}</div>;
}

function DealerStep({company,dealers,selected,onSelect}:{company:DemoCompany;dealers:{selectable:DemoDealer[];others:DemoDealer[]};selected:string|null;onSelect:(id:string)=>void}) {
  const assign=<Link className={linkClass} href={companyHref(company,'tilldelning')}>Tilldelning för {company.name}</Link>;
  return <div className="grid gap-3">
    {dealers.selectable.length?<div className={choiceGrid} role="group" aria-label="Dealer">{dealers.selectable.map(dealer=><button key={dealer.id} type="button" className={choiceClass(dealer.id===selected)} aria-pressed={dealer.id===selected} onClick={()=>onSelect(dealer.id)}>
      <span className="flex items-center justify-between gap-2"><DealerAvatar dealer={{id:dealer.id,label:dealer.name}} size={44}/><Chip tone="ok" dot>i paketet</Chip></span>
      <span className="text-[13.5px] font-semibold [overflow-wrap:anywhere]">{dealer.name}</span>
    </button>)}</div>
    :<Empty chip="Ingen dealer" title="Spelbordets publicerade paket har ingen dealer" text={<>Tilldela en dealer till bolaget och publicera paketet: {assign}.</>}/>}
    {dealers.others.length>0&&<p className={small}>Fler dealers finns i Admin: {dealers.others.map(row=>row.name).join(', ')}; de måste tilldelas bolaget och publiceras först ({assign}).</p>}
  </div>;
}

function CreditsReadout({credits,room}:{credits:Load<Credits>;room:DemoRoom}) {
  if(credits.status==='loading')return <p className={small} role="status">Läser spelbordets spelinställningar…</p>;
  if(credits.status==='error')return <p className={small}>{credits.message}</p>;
  if(!credits.value)return <p className={small}>Spelbordet {room.name} har inga publicerade spelinställningar, så påfyllningen av demosaldot är okänd. Publicera dem under spelbordets <Link className={linkClass} href={`/admin/rooms/${encodeURIComponent(room.id)}?flik=spel`}>Spelinställningar</Link>.</p>;
  const value=credits.value;
  return <KV items={[
    ['Startsaldo','Bestäms av spelmotorn när testsessionen skapas och visas i kvittot. Det går inte att välja här; efter lanseringen kan du fylla på demosaldot.'],
    ['Demokrediter',`${value.refill===null?'okänd påfyllning':`${formatMoney(value.refill,null)} per påfyllning i spelet`} · insatsprofil ${value.label} · bordsspråk ${languageLabel(value.language).toLowerCase()}`],
  ]}/>;
}

function LaunchStep({state,company,room,dealer,permissions,credits,onEdit}:{state:DemoState;company:DemoCompany;room:DemoRoom;dealer:DemoDealer;permissions:DemoPermissions;credits:Load<Credits>;onEdit:(field:'name'|'displayName'|'language'|'currency',value:string)=>void}) {
  const name=state.form.name.trim(),keyName=demoKeyName(state.form);
  return <div className="grid gap-5">
    <div className="grid gap-4 md:grid-cols-2">
      <Field id="demo-name" label="Demons namn" hint={<>Nyckeln för demon heter <b className="font-semibold text-sg-text">{keyName||'demo-…'}</b> under Integration och får bara rättigheterna {SCOPE_TEXT}.</>}>
        <input id="demo-name" className={fieldClass} value={state.form.name} maxLength={80} autoComplete="off" onChange={event=>onEdit('name',event.target.value)} placeholder={company.name}/></Field>
      <Field id="demo-display" label="Spelarens visningsnamn" hint="Visas i spelet. Högst 40 tecken; tomt ger demons namn.">
        <input id="demo-display" className={fieldClass} value={state.form.displayName} maxLength={40} autoComplete="off" onChange={event=>onEdit('displayName',event.target.value)} placeholder={demoNameBase(state.form)||'Som demons namn'}/></Field>
      <Field id="demo-language" label="Språk i spelet"><select id="demo-language" className={fieldClass} value={state.form.language} onChange={event=>onEdit('language',event.target.value)}>{DEMO_LANGUAGES.map(row=><option key={row.id} value={row.id}>{row.label}</option>)}</select></Field>
      <Field id="demo-currency" label="Valuta"><select id="demo-currency" className={fieldClass} value={state.form.currency} onChange={event=>onEdit('currency',event.target.value)}>{DEMO_CURRENCIES.map(row=><option key={row}>{row}</option>)}</select></Field>
    </div>
    <section aria-labelledby="demo-credits-title" className="grid gap-2.5"><h3 id="demo-credits-title" className="m-0 text-[13.5px] font-semibold text-sg-text">Saldo och giltighet</h3>
      <CreditsReadout credits={credits} room={room}/>
      <p className={small}>Giltighetstid går inte att välja: länken gäller 6 timmar; nyckeln tills den återkallas. Nycklar har ingen utgångstid i dag (fältet saknas i databasen; kommer senare). Återkalla finns i kvittot och stänger demospelarens sessioner direkt.</p>
    </section>
    <Note tone="accent">Skapar nyckeln <b>{name?keyName:'(namn saknas)'}</b> för <b>{company.name}</b> med rättigheterna {SCOPE_TEXT} och en testsession med demokrediter; länken anger spelbordet <b>{room.name}</b> med <b>{dealer.name}</b>. Nyckeln gäller bara {company.name}, och nyckel och hemlighet lämnar aldrig servern.</Note>
    {permissions.blocker&&<div role="note"><Note tone="warn">{permissions.blocker}</Note></div>}
  </div>;
}

function Result({value,company,room,dealer,language,permissions,revoke,confirming,onRevoke,onReset}:{value:DemoLaunch;company:DemoCompany;room:DemoRoom;dealer:DemoDealer;language:string;permissions:DemoPermissions;revoke:RevokeState;confirming:boolean;onRevoke:()=>void;onReset:()=>void}) {
  const [copied,setCopied]=useState<'idle'|'copied'|'manual'>('idle');
  const input=useRef<HTMLInputElement>(null);
  useEffect(()=>{if(copied==='idle')return;const timer=setTimeout(()=>setCopied('idle'),2500);return()=>clearTimeout(timer);},[copied]);
  const copy=async()=>{
    try{await navigator.clipboard.writeText(value.link);setCopied('copied');toast(`Demolänken är kopierad. Skicka den till ${company.name}.`);}
    catch{input.current?.select();setCopied('manual');}
  };
  return <div className="grid gap-5">
    <div role="status" className="rounded-xl bg-sg-ok-bg px-4 py-3 text-[13.5px] font-semibold text-sg-ok">Demon är klar · nyckel {value.key.name} · {dealer.name} vid {room.name} hos {company.name}</div>
    <div className="grid gap-2">
      <label className="text-[13px] font-semibold text-sg-text" htmlFor="demo-link">Demolänk</label>
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]"><input id="demo-link" ref={input} className={cn(fieldClass,'font-mono text-xs')} readOnly value={value.link} onFocus={event=>event.currentTarget.select()}/>
        <Button variant="primary" size="lg" onClick={copy}>{copied==='copied'?<><Check aria-hidden="true"/>Kopierad</>:<><Copy aria-hidden="true"/>Kopiera</>}</Button></div>
      {copied==='manual'&&<p className={small}>Urklipp är inte tillgängligt här. Länken är markerad: kopiera den med Ctrl+C.</p>}
    </div>
    <p className="m-0"><b>Skicka till bolaget.</b> Den som öppnar länken loggas in som demospelaren <b>{value.displayName}</b> ({language==='sv'?'svenska':'engelska'}). Länken anger spelbordet {room.name} hos {company.name} med {dealer.name}.</p>
    <KV items={[
      ['Startsaldo',formatMoney(value.receipt.balance,value.receipt.currency)],
      ['Länken gäller',`${expiryText(value.receipt.expiresIn)} från nu, enligt spelmotorn.`],
      ['Nyckeln',<>{value.key.name} · rättigheter {SCOPE_TEXT} · {revoke.phase==='done'?<Chip tone="danger">återkallad</Chip>:'gäller tills den återkallas'}</>],
    ]}/>
    <TopUp value={value} permissions={permissions} revoked={revoke.phase==='done'}/>
    <section className="grid items-center gap-3 rounded-xl border border-sg-danger-line bg-sg-surface p-4 sm:grid-cols-[minmax(0,1fr)_auto]" aria-labelledby="demo-revoke-title">
      <div><h3 id="demo-revoke-title" className="m-0 text-[13.5px] font-semibold text-sg-text">Återkalla demon</h3>
        <p className={cn(small,'mt-0.5')}>{revoke.phase==='done'?'Nyckeln är återkallad: länken fungerar inte längre och demospelarens sessioner har stängts.'
          :'Nyckeln har ingen utgångstid och gäller tills du återkallar den. Då slutar länken fungera och demospelarens sessioner stängs direkt.'}</p></div>
      {revoke.phase==='done'?<Chip tone="danger">återkallad</Chip>:permissions.canRevoke?<Button variant="danger" disabled={revoke.phase==='busy'} onClick={onRevoke}><Ban aria-hidden="true"/>{revoke.phase==='busy'?'Återkallar…':'Återkalla nyckeln'}</Button>
        :<span className={small}>Återkallas under Integration (kräver rollen admin).</span>}
    </section>
    {revoke.phase==='error'&&!confirming&&<div className={alertClass} role="alert">{revoke.message}</div>}
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-sg-line-2 pt-4"><span className={small}>Demonyckelns hemlighet lämnar aldrig servern. Ska bolaget integrera själv skapas en egen partnernyckel under Integration.</span>
      <Button variant="ghost" onClick={onReset}><RotateCcw aria-hidden="true"/>Skapa en ny demo</Button></div>
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
  return <section className="grid gap-3 rounded-xl border border-sg-border bg-sg-surface-2 p-4" aria-labelledby="demo-topup-title">
    <div><h3 id="demo-topup-title" className="m-0 text-[13.5px] font-semibold text-sg-text">Fyll på demosaldo <span className="font-normal text-sg-faint">(frivilligt)</span></h3>
      <p className={cn(small,'mt-0.5')}>Saldo nu: {formatMoney(known.balance,currency)}. Påfyllningen går till demospelaren i kvittot.</p></div>
    <form className="grid items-end gap-2 sm:grid-cols-[minmax(0,220px)_auto] sm:justify-start" onSubmit={submit}>
      <Field id="demo-topup" label={`Belopp${currency?` (${currency})`:''}`}>
        <input id="demo-topup" className={cn(fieldClass,'focus-visible:ring-offset-sg-surface-2')} inputMode="decimal" autoComplete="off" value={amount} disabled={Boolean(blocked)||busy} onChange={event=>setAmount(event.target.value)}/></Field>
      <Button type="submit" size="lg" disabled={Boolean(blocked)||busy||checked.amount===null}>{busy?'Fyller på…':'Fyll på'}</Button>
    </form>
    {blocked?<p className={missingClass}>{blocked}</p>:amount.trim()&&checked.missing&&<p className={missingClass}>{checked.missing}</p>}
    {state.phase==='done'&&<div className="rounded-lg bg-sg-info-bg px-3.5 py-2.5 text-[13px] text-sg-info" role="status">{state.after.balance!==null
      ?<>Påfyllt {formatMoney(state.amount,state.after.currency)}: saldo före <b>{formatMoney(state.before.balance,state.before.currency)}</b>, efter <b>{formatMoney(state.after.balance,state.after.currency)}</b>.</>
      :<>Påfyllningen på {formatMoney(state.amount,state.after.currency)} är skickad. Svaret innehöll inget saldo; saldot syns i spelet.</>}</div>}
    {state.phase==='error'&&<div className={alertClass} role="alert">{state.message}</div>}
  </section>;
}

function Summary({state,company,room,dealer,done,onStep}:{state:DemoState;company:DemoCompany|null;room:DemoRoom|null;dealer:DemoDealer|null;done:boolean;onStep:(step:number)=>void}) {
  const name=state.form.name.trim();
  const rows:{label:string;value:ReactNode;text?:ReactNode;step:number}[]=[
    {label:'Bolag',value:company?.name,text:company&&(company.packageRevision===null?'inget publicerat paket':`publicerad version ${company.packageRevision}`),step:1},
    {label:'Spelbord',value:room?.name,text:room&&(GAMES[room.game]??room.game),step:2},
    {label:'Dealer',value:dealer?.name,text:dealer&&'i spelbordets paket',step:3},
    {label:'Demo',value:name||undefined,text:name&&`${demoKeyName(state.form)} · ${safeDisplayName(state.form)} · ${languageLabel(state.form.language)} · ${state.form.currency}`,step:4},
  ];
  return <aside aria-label="Din demo"><Card title="Din demo" aside={done?'klar':`steg ${state.step} av ${DEMO_STEPS.length}`}>
    <div className="grid">{rows.map(row=><div key={row.label} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-t border-sg-line-2 py-3 first:border-t-0 first:pt-0 last:pb-0">
      <div className="min-w-0"><div className="text-xs text-sg-muted">{row.label}</div><div className={cn('font-semibold [overflow-wrap:anywhere]',row.value?'text-sg-text':'text-sg-faint')}>{row.value??'–'}</div>{row.text&&<div className="text-[12.5px] text-sg-muted [overflow-wrap:anywhere]">{row.text}</div>}</div>
      {!done&&row.value&&row.step!==state.step&&<Button size="sm" onClick={()=>onStep(row.step)}>Ändra</Button>}</div>)}</div>
  </Card></aside>;
}

export function DemoBuilder() {
  const [catalog,setCatalog]=useState<Load<DemoAdministration>>({status:'loading'});
  const [session,setSession]=useState<Load<DemoPermissions>>({status:'loading'});
  const [refresh,setRefresh]=useState(0);
  const [state,setState]=useState<DemoState>(initialDemoState);
  const [launch,setLaunch]=useState<LaunchState>({phase:'idle'});
  const [revoke,setRevoke]=useState<RevokeState>({phase:'idle'});
  const [credits,setCredits]=useState<Load<Credits>>({status:'loading'});
  const [confirmKey,setConfirmKey]=useState<DemoKey|null>(null);
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
      const value=await launchDemo({fetchImpl:fetch,form:state.form,permissions,operatorId:company.id,operatorSlug:company.slug,roomId:room.id,dealerId:dealer.id,onPhase:phase=>setLaunch({phase})});
      setLaunch({phase:'done',value});
    }catch(error){setLaunch({phase:'error',message:error instanceof Error?error.message:'Okänt fel.',key:(error as {key?:DemoKey}).key??null});}
  };
  // Återkalla asks first (ConfirmDialog); the dialog stays open with the error if the server refuses.
  const askRevoke=(key:DemoKey)=>{if(revoke.phase==='busy')return;setRevoke(current=>current.phase==='error'?{phase:'idle'}:current);setConfirmKey(key);};
  const revokeKey=async(key:DemoKey)=>{
    if(revoke.phase==='busy')return;
    setRevoke({phase:'busy'});
    try{await revokeDemoKey({fetchImpl:fetch,keyId:key.id});setRevoke({phase:'done'});setConfirmKey(null);toast(`Nyckeln ${key.name} är återkallad. Demolänken fungerar inte längre.`);}
    catch(error){setRevoke({phase:'error',message:error instanceof Error?error.message:'Okänt fel.'});}
  };
  const reset=()=>{setState(initialDemoState());setLaunch({phase:'idle'});setRevoke({phase:'idle'});setConfirmKey(null);setRefresh(value=>value+1);};
  const stepTitle=done?'Demon är klar':DEMO_STEPS[effective.step-1].label;
  let body:ReactNode;
  if(catalog.status==='loading')body=<p role="status" className="m-0 text-sg-muted">Läser bolag, spelbord och dealers…</p>;
  else if(catalog.status==='error')body=<div role="alert" className="grid gap-3"><p className="m-0">{catalog.authentication?'Din inloggning saknas eller har gått ut. Logga in igen.':catalog.message}</p><div><Button onClick={()=>setRefresh(value=>value+1)}>Försök igen</Button></div></div>;
  else if(done&&launch.phase==='done'&&company&&room&&dealer&&permissions)body=<Result value={launch.value} company={company} room={room} dealer={dealer} language={state.form.language} permissions={permissions} revoke={revoke} confirming={confirmKey!==null} onRevoke={()=>askRevoke(launch.value.key)} onReset={reset}/>;
  else if(effective.step===1)body=<CompanyStep companies={companies} selected={company?.id??null} onSelect={id=>setState(current=>chooseCompany(current,id))}/>;
  else if(effective.step===2&&company)body=<RoomStep company={company} rooms={rooms} selected={room?.id??null} onSelect={value=>setState(current=>chooseRoom(current,value))}/>;
  else if(effective.step===3&&company)body=<DealerStep company={company} dealers={dealers} selected={dealer?.id??null} onSelect={id=>setState(current=>chooseDealer(current,id))}/>;
  else if(company&&room&&dealer)body=<LaunchStep state={state} company={company} room={room} dealer={dealer} permissions={permissions??demoPermissions(null)} credits={session.status==='ready'?credits:session.status==='loading'?{status:'loading'}:session} onEdit={(field,value)=>setState(current=>editDemo(current,field,value))}/>;
  const launchReady=effective.step===4?requirement.ready&&Boolean(permissions?.canLaunch)&&!busy:requirement.ready;
  const launchMissing=effective.step===4&&session.status==='loading'?'Läser dina behörigheter…':effective.step===4&&permissions&&!permissions.canLaunch?permissions.blocker:requirement.missing;
  const key=launch.phase==='done'?launch.value.key:launch.phase==='error'?launch.key:null;
  const receipt=launch.phase==='done'?launch.value.receipt:null;
  const technical:[string,ReactNode][]=[
    ...(company?[['Bolags-id',company.id],['Bolag i länken','operator='+company.slug]] as [string,ReactNode][]:[]),
    ...(room?[['Spelbords-id',room.id]] as [string,ReactNode][]:[]),
    ...(dealer?[['Dealer-id',dealer.id]] as [string,ReactNode][]:[]),
    ['Nyckelns rättigheter',DEMO_KEY_SCOPES.join(', ')],
    ...(key?[['Nyckel-id',key.id]] as [string,ReactNode][]:[]),
    ...(receipt?.playerId?[['Demospelare',receipt.playerId]] as [string,ReactNode][]:[]),
    ...(receipt?.playerRef?[['Spelarreferens',receipt.playerRef]] as [string,ReactNode][]:[]),
    ['Skrivningar','apikeys/create (med bolags-id) och apikeys/launch; Fyll på: apikeys/credit; Återkalla: apikeys/revoke'],
  ];
  return <HubPage eyebrow={<Crumbs items={[{label:'Översikt',href:'/admin'},{label:'Skapa demo'}]}/>} title="Skapa demo"
    intro="Bygg en demo åt ett bolag i fyra steg och få en länk att skicka. Demon använder bolagets publicerade paket och spelbord; inget ändras i paketet.">
    <DialogSteps steps={DEMO_STEPS.map(step=>step.label)} current={done?DEMO_STEPS.length:effective.step-1} reachable={reachableStep(effective)-1} onSelect={done||busy?undefined:index=>go(index+1)} className="mb-5"/>
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px] min-[1600px]:grid-cols-[minmax(0,1fr)_400px]">
      <div className="min-w-0" aria-live="polite"><Card title={done?stepTitle:`${effective.step}. ${stepTitle}`} aside={!done&&catalog.status==='ready'?(effective.step===1?`${companies.length} aktiva bolag`:effective.step===2?`${rooms.filter(row=>row.selectable).length} av ${rooms.length} spelbara`:effective.step===3?`${dealers.selectable.length} i paketet`:undefined):undefined}>
        {body}
        {launch.phase==='error'&&<div className={cn(alertClass,'mt-4')} role="alert">{launch.message}{launch.key&&<> Nyckeln <b>{launch.key.name}</b> skapades innan felet. {permissions?.canRevoke&&revoke.phase!=='done'&&<Button size="sm" variant="danger" className="ml-1" disabled={revoke.phase==='busy'} onClick={()=>askRevoke(launch.key as DemoKey)}>{revoke.phase==='busy'?'Återkallar…':'Återkalla nyckeln'}</Button>}{revoke.phase==='done'&&' Nyckeln är återkallad.'}{revoke.phase==='error'&&confirmKey===null&&` ${revoke.message}`}</>}</div>}
        {busy&&<p className={cn(small,'mt-3')} role="status">{launch.phase==='create'?'Skapar nyckeln…':'Startar testsessionen i spelmotorn…'}</p>}
        {!done&&catalog.status==='ready'&&<div className="mt-5 flex flex-wrap items-start justify-between gap-3 border-t border-sg-line-2 pt-4">
          <Button variant="ghost" disabled={effective.step===1||busy} onClick={()=>setState(current=>previousStep(current))}><ArrowLeft aria-hidden="true"/>Tillbaka</Button>
          <div className="grid justify-items-end gap-1.5 max-sm:w-full max-sm:justify-items-stretch">
            {effective.step<4?<Button variant="primary" disabled={!launchReady} onClick={()=>setState(current=>nextStep({...current,...effective}))}>{nextLabel(effective.step)}<ArrowRight aria-hidden="true"/></Button>
              :<Button variant="primary" disabled={!launchReady} onClick={start}>{busy?'Skapar demon…':nextLabel(4)}</Button>}
            {!launchReady&&launchMissing&&<span className="max-w-[56ch] text-right text-[12.5px] text-sg-warn max-sm:text-left">{launchMissing}</span>}
          </div>
        </div>}
      </Card></div>
      <Summary state={effective} company={company} room={room} dealer={dealer} done={done} onStep={go}/>
    </div>
    {catalog.status==='ready'&&<TechnicalDetails items={technical}/>}
    <ConfirmDialog open={confirmKey!==null} title={`Återkalla nyckeln ${confirmKey?.name??''}?`}
      consequences={['Demolänken slutar fungera.','Demospelarens sessioner stängs direkt.','En ny demo ger en ny nyckel och en ny länk.']}
      confirmLabel="Återkalla nyckeln" busy={revoke.phase==='busy'} busyLabel="Återkallar…" error={revoke.phase==='error'?revoke.message:''}
      onConfirm={()=>{if(confirmKey)void revokeKey(confirmKey);}} onCancel={()=>{if(revoke.phase!=='busy')setConfirmKey(null);}}/>
  </HubPage>;
}
