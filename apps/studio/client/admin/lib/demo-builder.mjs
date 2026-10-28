// Demo-byggaren (Admin, nivå 1): stegens tillstånd, urvalet ur katalogen och
// demolänken. Läser GET /admin/_data/catalog och GET room-game-config; skriver
// bara via dagens actions apikeys/create, apikeys/launch, apikeys/credit och apikeys/revoke.
// En demo är en API-nyckel demo-<namn> plus en testsession på den nyckeln.
import {ROOM_LIMIT_PRESETS} from '../../../../../packages/presentation/contracts/room-game-config.mjs';
import {isActiveDealerId} from '../../../../../packages/presentation/contracts/dealer-identity.mjs';
import {isOperatorSlug} from '../../../../../packages/navigation/operator-slug.mjs';
import {normalizeDisplayName} from '../../../../../packages/studio-access/display-name.mjs';
import {approvedPartnerLaunchUrl} from '../../../lib/partner-launch-url.mjs';

export const DEMO_STEPS=Object.freeze([
  Object.freeze({id:'company',label:'Bolag',next:'Nästa: Välj spelbord'}),
  Object.freeze({id:'room',label:'Spelbord',next:'Nästa: Välj dealer'}),
  Object.freeze({id:'dealer',label:'Dealer',next:'Nästa: Lansera'}),
  Object.freeze({id:'launch',label:'Lansera',next:'Skapa demolänk'}),
]);
export const DEMO_CURRENCIES=Object.freeze(['EUR','USD','SEK']);
export const DEMO_LANGUAGES=Object.freeze([Object.freeze({id:'en',label:'Engelska'}),Object.freeze({id:'sv',label:'Svenska'})]);
export const LIMIT_PRESET_LABELS=Object.freeze({casual:'Casual',prive:'Privé',high:'High'});
// Serverns namn på de actions sidan använder, så som /studio/api/auth/session listar dem.
export const DEMO_ACTIONS=Object.freeze({create:'POST apikeys/create',launch:'POST apikeys/launch',credit:'POST apikeys/credit',revoke:'POST apikeys/revoke',config:'GET room-game-config'});
// Minsta rättigheter för en demospelare (services/game/storage/async-partner-api.mjs):
// launch är nyckelns syfte (Integrationer erbjuder "Skapa spellänk" bara med launch) och
// play är spelrätten (motorns enda scope-kontroll på en launchad spelares rundor kräver
// play eller events). lobby, wallet, history och events läses bara av de signerade
// /api/v1-anropen, som demon aldrig kan göra: nyckel och hemlighet lämnar inte servern.
export const DEMO_KEY_SCOPES=Object.freeze(['launch','play']);
export const DEMO_KEY_PREFIX='demo-';
export const DEMO_NAME_MAX=80-DEMO_KEY_PREFIX.length;
export const DEMO_CREDIT_MAX=100000;
// Avstängt tills partnernyckeln knyts till bolaget (efter O03): en partnerlanserad session
// nekas i dag vid det delade bordet (403) och har ingen reserv till det vanliga bordet.
// Knappen "Skapa demolänk" och steg 4:s krav läser bara den här konstanten; launch, Fyll på
// och Återkalla ligger kvar oförändrade bakom den och slås på genom att sätta true.
export const DEMO_LAUNCH_ENABLED=false;
export const DEMO_LAUNCH_OFF_TEXT='Demolänken öppnar spelet med en partnernyckel. Delat bord för sådana sessioner kommer när nyckeln knyts till bolaget, efter O03; tills dess går demon inte att spela vid ett publicerat delat bord. Skapa demolänk slås på då.';
const CONTROL=/[\u0000-\u001f\u007f-\u009f]/u;
const ROOM_ID=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const text=(value,max)=>typeof value==='string'&&value.length>0&&value.length<=max&&!CONTROL.test(value);
const byName=(left,right)=>left.name.localeCompare(right.name,'sv');

export class DemoError extends Error {
  constructor(message,status=0){super(message);this.name='DemoError';this.status=status;}
}

// Tillstånd -------------------------------------------------------------------
export function initialDemoState(){
  return {step:1,operatorId:null,roomId:null,dealerId:null,form:{name:'',displayName:'',language:'en',currency:'EUR'}};
}
export function chooseCompany(state,operatorId){return {...state,operatorId,roomId:null,dealerId:null};}
// Ett spelbord med exakt en dealer ger dealern direkt; fler dealers kräver ett val.
export function chooseRoom(state,room){return {...state,roomId:room.id,dealerId:room.dealers.length===1?room.dealers[0].id:null};}
export function chooseDealer(state,dealerId){return {...state,dealerId};}
export function editDemo(state,field,value){
  if(!['name','displayName','language','currency'].includes(field)||typeof value!=='string')return state;
  if(field==='language'&&!DEMO_LANGUAGES.some(row=>row.id===value))return state;
  if(field==='currency'&&!DEMO_CURRENCIES.includes(value))return state;
  return {...state,form:{...state.form,[field]:value}};
}
const ready=()=>({ready:true,missing:''}),missing=value=>({ready:false,missing:value});
export function stepRequirement(state,step=state.step){
  if(step===1)return state.operatorId?ready():missing('Välj ett bolag.');
  if(step===2)return state.roomId?ready():missing('Välj ett spelbart spelbord.');
  if(step===3)return state.dealerId?ready():missing('Välj en dealer.');
  return DEMO_LAUNCH_ENABLED?demoFormRequirement(state):missing(DEMO_LAUNCH_OFF_TEXT);
}
// Steg 4:s formulär (namn och visningsnamn), oberoende av om demolänken är påslagen.
export function demoFormRequirement(state){
  const name=demoNameBase(state.form);
  if(!name)return missing('Ge demon ett namn.');
  if(name.length>DEMO_NAME_MAX)return missing(`Demons namn får vara högst ${DEMO_NAME_MAX} tecken.`);
  if(CONTROL.test(name))return missing('Demons namn får inte innehålla styrtecken.');
  try{normalizeDisplayName(state.form.displayName.trim()||name);}catch{return missing('Visningsnamnet får vara högst 40 tecken utan styrtecken.');}
  return ready();
}
// Högsta steg som går att öppna: varje tidigare steg måste vara klart.
export function reachableStep(state){let step=1;while(step<DEMO_STEPS.length&&stepRequirement(state,step).ready)step++;return step;}
export function goToStep(state,step){return {...state,step:Math.min(Math.max(1,step),reachableStep(state))};}
export function nextStep(state){return stepRequirement(state).ready&&state.step<DEMO_STEPS.length?{...state,step:state.step+1}:state;}
export function previousStep(state){return {...state,step:Math.max(1,state.step-1)};}
export const nextLabel=step=>DEMO_STEPS[step-1]?.next??'';
// Demons namn utan ett inskrivet demo-prefix; nyckeln heter alltid demo-<namn>.
export function demoNameBase(form){return form.name.trim().replace(/^demo-\s*/i,'').trim();}
export function demoKeyName(form){const base=demoNameBase(form);return base?DEMO_KEY_PREFIX+base:'';}
// Visningsnamnet faller tillbaka på demons namn så att launch alltid får ett namn.
export function demoDisplayName(form){return normalizeDisplayName(form.displayName.trim()||demoNameBase(form));}

// Katalogen -------------------------------------------------------------------
export function readDemoCatalog(value){
  if(!value||value.schemaVersion!==1||value.source!=='registered'||!value.administration
    ||!['operators','rooms','dealers','compositions'].every(key=>Array.isArray(value.administration[key])))throw new DemoError('Katalogen har inte den väntade formen.');
  return value.administration;
}
export function demoCompanies(administration){
  const rooms=administration.rooms.filter(room=>room.state!=='archived');
  return administration.operators.filter(row=>row.status==='active'&&!row.archivedAt).map(row=>{
    const own=rooms.filter(room=>room.operatorId===row.id);
    return {id:row.id,slug:row.slug,name:row.name,packageRevision:row.packageRevision??null,rooms:own.length,playable:own.filter(room=>room.playable===true).length};
  }).sort(byName);
}
function roomReason(room){
  if((room.game??'blackjack')!=='blackjack')return 'Demolänken startar bara blackjack.';
  if(room.state!=='live')return 'Spelbordet är pausat. Öppna det under Bolag och spelbord först.';
  if(!room.published)return 'Spelbordet ingår inte i bolagets publicerade paket.';
  if(room.materialWarning)return 'Spelbordets material stämmer inte med spelinställningarna.';
  if(room.playable!==true)return 'Spelbordet går inte att spela just nu: publicerat material saknas.';
  return '';
}
export function demoRooms(administration,operatorId){
  return administration.rooms.filter(room=>room.operatorId===operatorId&&room.state!=='archived').map(room=>{
    const reason=roomReason(room);
    return {id:room.id,name:room.name,game:room.game??'blackjack',state:room.state,published:room.published===true,playable:room.playable===true,
      dealers:(room.dealers??[]).map(row=>({id:row.id,name:row.name})),selectable:reason==='',reason};
  });
}
// Valbara dealers = dealers i spelbordets publicerade paket. Övriga finns i Admin men
// måste tilldelas bolaget och publiceras först.
export function demoDealers(administration,room){
  const selectable=(room?.dealers??[]).map(row=>({id:row.id,name:row.name}));
  const taken=new Set(selectable.map(row=>row.id));
  const others=administration.dealers.filter(row=>!row.archived&&!taken.has(row.id)).map(row=>({id:row.id,name:row.name})).sort(byName);
  return {selectable,others};
}

// Behörighet ------------------------------------------------------------------
export function approvedGameOrigin(value){
  try{const url=new URL(value);return url.protocol==='https:'&&url.origin===value?url.origin:null;}catch{return null;}
}
export function demoPermissions(session){
  const actions=new Set(Array.isArray(session?.availableActions)?session.availableActions.filter(row=>typeof row==='string'):[]);
  const gameOrigin=approvedGameOrigin(session?.gameOrigin);
  const canCreate=actions.has(DEMO_ACTIONS.create),mayLaunch=actions.has(DEMO_ACTIONS.launch);
  const blocker=!canCreate||!mayLaunch?'Din inloggning får inte skapa nycklar eller starta testsessioner. Det kräver rollen admin.'
    :!gameOrigin?'Spelmotorns adress saknas i serverns inställningar, så demolänkar kan inte skapas.':'';
  return {gameOrigin,canCreate,canLaunch:mayLaunch&&Boolean(gameOrigin),canCredit:actions.has(DEMO_ACTIONS.credit),canRevoke:actions.has(DEMO_ACTIONS.revoke),canReadConfig:actions.has(DEMO_ACTIONS.config),blocker};
}

// Demokrediter ur spelbordets publicerade spelinställningar (läsvärde) ----------
export function refillForPreset(preset){return ROOM_LIMIT_PRESETS[preset]?.refill??null;}
export function demoCredits(receipt){
  const published=receipt?.published;
  if(!published||!published.gameConfig)return null;
  const preset=published.gameConfig.limitPreset;
  return {preset,label:LIMIT_PRESET_LABELS[preset]??preset,refill:refillForPreset(preset),language:published.gameConfig.language,configVersion:String(published.configVersion??'')};
}

// Länken ----------------------------------------------------------------------
// Spelmotorns adress prövas med samma regel som Integrationer (lib/partner-launch-url.mjs);
// därefter läggs bolag, spelbord och dealer till så att landningen pekar på spelbordet.
export function demoLaunchLink(payload,{gameOrigin,operatorSlug,roomId,dealerId}){
  if(!payload||payload.ok!==true||typeof payload.url!=='string')throw new DemoError('Spelmotorn bekräftade inte testsessionen.');
  const url=approvedPartnerLaunchUrl(payload.url,gameOrigin),token=url?.searchParams.get('launch');
  if(!url||!token)throw new DemoError('Spelmotorns länk stämmer inte med den godkända speladressen.');
  if(!isOperatorSlug(operatorSlug)||!ROOM_ID.test(roomId??'')||(dealerId!==undefined&&dealerId!==null&&!isActiveDealerId(dealerId)))throw new DemoError('Bolaget, spelbordet eller dealern har ett ogiltigt id.');
  const link=new URL(url.origin+url.pathname);
  link.searchParams.set('launch',token);link.searchParams.set('operator',operatorSlug);link.searchParams.set('table',roomId);
  if(dealerId)link.searchParams.set('dealer',dealerId);
  return link.href;
}
export function demoReceipt(payload){
  return {playerRef:text(payload?.playerRef,256)?payload.playerRef:null,playerId:text(payload?.playerId,256)?payload.playerId:null,
    balance:typeof payload?.balance==='number'&&Number.isFinite(payload.balance)&&payload.balance>=0?payload.balance:null,
    currency:DEMO_CURRENCIES.includes(payload?.currency)?payload.currency:null,
    expiresIn:Number.isSafeInteger(payload?.expiresIn)&&payload.expiresIn>0?payload.expiresIn:null};
}
export function expiryText(expiresIn){
  if(!expiresIn)return 'okänd tid';
  const hours=Math.round(expiresIn/3600);
  return hours>=1?`${hours} ${hours===1?'timme':'timmar'}`:`${Math.max(1,Math.round(expiresIn/60))} minuter`;
}
// Fyll på (frivilligt, efter lansering) via apikeys/credit -----------------------
export function readCreditAmount(value){
  const raw=typeof value==='string'?value.replace(/\s/gu,'').replace(',','.'):'';
  if(!raw)return {amount:null,missing:'Ange ett belopp.'};
  if(!/^\d+(?:\.\d{1,2})?$/.test(raw))return {amount:null,missing:'Beloppet ska vara ett tal med högst två decimaler.'};
  const amount=Number(raw);
  if(!(amount>0))return {amount:null,missing:'Beloppet måste vara större än 0.'};
  if(amount>DEMO_CREDIT_MAX)return {amount:null,missing:'Högst 100 000 per påfyllning.'};
  return {amount,missing:''};
}
// Saldot efter påfyllningen läses bara ur ett svar som gäller samma demospelare.
export function demoCreditReceipt(payload,playerId){
  const balance=payload?.playerId===playerId&&typeof payload?.balance==='number'&&Number.isFinite(payload.balance)&&payload.balance>=0?payload.balance:null;
  return {balance,currency:balance!==null&&DEMO_CURRENCIES.includes(payload?.currency)?payload.currency:null};
}
export function formatMoney(amount,currency){
  if(typeof amount!=='number')return '–';
  return new Intl.NumberFormat('sv-SE',{maximumFractionDigits:2}).format(amount)+(currency?' '+currency:'');
}

// Fel från servern, läsbara --------------------------------------------------
const WHAT={create:'Nyckeln kunde inte skapas',launch:'Testsessionen kunde inte startas',credit:'Demosaldot kunde inte fyllas på',revoke:'Nyckeln kunde inte återkallas',config:'Spelinställningarna kunde inte läsas',catalog:'Katalogen kunde inte läsas',session:'Sessionen kunde inte läsas'};
const WHY={400:'servern avvisade uppgifterna. Kontrollera namn och visningsnamn.',401:'din inloggning har gått ut. Logga in igen.',
  403:'din inloggning saknar behörighet (kräver rollen admin) eller sessionen har ändrats.',404:'funktionen finns inte på den här servern.',
  409:'uppgifterna har ändrats eller krockar med ett pågående spel. Läs in sidan igen.',413:'begäran var för stor.',415:'servern kräver JSON.',
  422:'servern avvisade uppgifterna.',503:'spelmotorn eller nyckeltjänsten är tillfälligt otillgänglig. Inget skapades lokalt.'};
const WHY_FOR={credit:{400:'servern avvisade beloppet eller demospelaren.',
  503:'spelmotorn svarade inte, eller nyckeln är återkallad. Kontrollera saldot i spelet innan du försöker igen.'}};
export function demoErrorMessage(step,status,payload){
  const code=typeof payload?.code==='string'&&/^[a-z][a-z0-9_]{0,100}$/.test(payload.code)?payload.code:'';
  return `${WHAT[step]??'Åtgärden misslyckades'}: ${WHY_FOR[step]?.[status]??WHY[status]??'servern svarade oväntat.'}${code?` (${code})`:''}`;
}

// Anrop -----------------------------------------------------------------------
const GET={credentials:'same-origin',cache:'no-store',redirect:'error',headers:{accept:'application/json'}};
async function readJson(fetchImpl,url,step,signal,{maxBytes=2*1024*1024}={}){
  let response;
  try{response=await fetchImpl(url,{...GET,signal});}
  catch(error){if(signal?.aborted)throw error;throw new DemoError(`${WHAT[step]}: servern kunde inte nås.`);}
  if(!response.ok)throw new DemoError(demoErrorMessage(step,response.status,null),response.status);
  const body=await response.text();
  if(body.length>maxBytes)throw new DemoError(`${WHAT[step]}: svaret var för stort.`);
  try{return JSON.parse(body);}catch{throw new DemoError(`${WHAT[step]}: svaret kunde inte läsas.`);}
}
export async function readDemoSession(fetchImpl=fetch,signal){
  const value=await readJson(fetchImpl,'/studio/api/auth/session','session',signal);
  if(!Array.isArray(value?.availableActions))throw new DemoError('Serverns administrationsbehörigheter kunde inte verifieras.');
  return value;
}
export async function readDemoCatalogFrom(fetchImpl=fetch,signal){
  return readDemoCatalog(await readJson(fetchImpl,'/admin/_data/catalog','catalog',signal));
}
export async function readRoomGameConfig(fetchImpl=fetch,{operatorId,roomId},signal){
  if(!ROOM_ID.test(operatorId??'')||!ROOM_ID.test(roomId??''))throw new DemoError('Välj ett registrerat spelbord.');
  const value=await readJson(fetchImpl,'/studio/api/admin/room-game-config?'+new URLSearchParams({operatorId,roomId}),'config',signal);
  if(value?.ok!==true||value.operatorId!==operatorId||value.roomId!==roomId)throw new DemoError('Spelinställningarnas kvitto stämmer inte med spelbordet.');
  return value;
}
export async function postAdminAction(fetchImpl=fetch,action,body,signal){
  const step=action.split('/')[1];
  let response;
  try{response=await fetchImpl('/studio/api/admin/'+action,{method:'POST',credentials:'same-origin',cache:'no-store',redirect:'error',signal,
    headers:{accept:'application/json','content-type':'application/json'},body:JSON.stringify(body)});}
  catch(error){if(signal?.aborted)throw error;throw new DemoError(`${WHAT[step]??'Åtgärden misslyckades'}: svaret kunde inte bekräftas. Läs in sidan innan du försöker igen.`);}
  const payload=await response.json().catch(()=>null);
  if(!response.ok)throw new DemoError(demoErrorMessage(step,response.status,payload),response.status);
  return payload;
}
// Två skrivningar i följd: nyckeln demo-<namn> med minsta rättigheter och purpose demo
// (servern svarar då utan nyckel och hemlighet), sedan testsession på nyckeln.
// Misslyckas lanseringen följer nyckeln med felet så att den kan återkallas.
export async function launchDemo({fetchImpl=fetch,signal,form,permissions,operatorSlug,roomId,dealerId,onPhase}){
  const name=demoKeyName(form),displayName=demoDisplayName(form);
  onPhase?.('create');
  const created=await postAdminAction(fetchImpl,'apikeys/create',{name,scopes:[...DEMO_KEY_SCOPES],purpose:'demo'},signal);
  if(created?.ok!==true||!text(created.key?.id,256))throw new DemoError('Nyckelns kvitto saknade id. Kontrollera nycklarna under Integration.');
  const key={id:created.key.id,name:text(created.key.name,80)?created.key.name:name}; // Aldrig key/secret vidare.
  onPhase?.('launch');
  try{
    const launched=await postAdminAction(fetchImpl,'apikeys/launch',{id:key.id,displayName,currency:form.currency,language:form.language},signal);
    return {key,displayName,link:demoLaunchLink(launched,{gameOrigin:permissions.gameOrigin,operatorSlug,roomId,dealerId}),receipt:demoReceipt(launched)};
  }catch(error){throw Object.assign(error,{key});}
}
export async function creditDemo({fetchImpl=fetch,signal,keyId,playerId,amount}){
  if(!text(keyId,256)||!text(playerId,256))throw new DemoError('Demospelaren saknas i kvittot. Fyll på under Integration i stället.');
  if(!Number.isFinite(amount)||amount<=0||amount>DEMO_CREDIT_MAX)throw new DemoError('Beloppet måste vara större än 0 och högst 100 000.');
  const value=await postAdminAction(fetchImpl,'apikeys/credit',{id:keyId,playerId,amount},signal);
  if(value?.ok!==true)throw new DemoError(demoErrorMessage('credit',503,null),503);
  return demoCreditReceipt(value,playerId);
}
export async function revokeDemoKey({fetchImpl=fetch,signal,keyId}){
  const value=await postAdminAction(fetchImpl,'apikeys/revoke',{id:keyId},signal);
  if(value?.ok!==true)throw new DemoError(demoErrorMessage('revoke',503,null),503);
  return value;
}
