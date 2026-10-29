export type DemoStepId='company'|'room'|'dealer'|'launch';
export type DemoStep={id:DemoStepId;label:string;next:string};
export const DEMO_STEPS:readonly DemoStep[];
export const DEMO_CURRENCIES:readonly string[];
export const DEMO_LANGUAGES:readonly {id:'en'|'sv';label:string}[];
export const LIMIT_PRESET_LABELS:Readonly<Record<string,string>>;
export const DEMO_ACTIONS:Readonly<{create:string;launch:string;credit:string;revoke:string;config:string}>;
export const DEMO_KEY_SCOPES:readonly ('launch'|'play')[];
export const DEMO_KEY_PREFIX:'demo-';
export const DEMO_NAME_MAX:number;
export const DEMO_CREDIT_MAX:number;

export type DemoOperatorRow={id:string;slug:string;name:string;status:string;packageRevision:number|null;archivedAt?:string|null};
export type DemoRoomRow={id:string;name:string;operatorId:string;game?:string;state:string;published:boolean;playable:boolean;
  dealerIds:string[];dealers:{id:string;name:string}[];playUrl:string|null;materialWarning?:string};
export type DemoDealerRow={id:string;name:string;archived:boolean};
export type DemoAdministration={revisions:{project:string;administration:string};operators:DemoOperatorRow[];rooms:DemoRoomRow[];dealers:DemoDealerRow[];compositions:unknown[]};

export type DemoForm={name:string;displayName:string;language:'en'|'sv';currency:string};
export type DemoState={step:number;operatorId:string|null;roomId:string|null;dealerId:string|null;form:DemoForm};
export type DemoCompany={id:string;slug:string;name:string;packageRevision:number|null;rooms:number;playable:number};
export type DemoRoom={id:string;name:string;game:string;state:string;published:boolean;playable:boolean;dealers:{id:string;name:string}[];selectable:boolean;reason:string};
export type DemoDealer={id:string;name:string};
export type DemoRequirement={ready:boolean;missing:string};
export type DemoPermissions={gameOrigin:string|null;canCreate:boolean;canLaunch:boolean;canCredit:boolean;canRevoke:boolean;canReadConfig:boolean;blocker:string};
export type DemoReceipt={playerRef:string|null;playerId:string|null;balance:number|null;currency:string|null;expiresIn:number|null};
export type DemoCredits={preset:string;label:string;refill:number|null;language:string;configVersion:string}|null;
export type DemoKey={id:string;name:string};
export type DemoLaunch={key:DemoKey;displayName:string;link:string;receipt:DemoReceipt};
export type DemoCreditAmount={amount:number;missing:''}|{amount:null;missing:string};
export type DemoCreditReceipt={balance:number|null;currency:string|null};
export type RoomGameConfigReceipt={ok:true;operatorId:string;roomId:string;published:{configVersion:string;gameConfig:{language:string;limitPreset:string}}|null;draft:unknown};

export class DemoError extends Error {status:number;constructor(message:string,status?:number);}

export function initialDemoState():DemoState;
export function chooseCompany(state:DemoState,operatorId:string):DemoState;
export function chooseRoom(state:DemoState,room:DemoRoom):DemoState;
export function chooseDealer(state:DemoState,dealerId:string):DemoState;
export function editDemo(state:DemoState,field:keyof DemoForm,value:string):DemoState;
export function stepRequirement(state:DemoState,step?:number):DemoRequirement;
export function demoFormRequirement(state:DemoState):DemoRequirement;
export function reachableStep(state:DemoState):number;
export function goToStep(state:DemoState,step:number):DemoState;
export function nextStep(state:DemoState):DemoState;
export function previousStep(state:DemoState):DemoState;
export function nextLabel(step:number):string;
export function demoNameBase(form:DemoForm):string;
export function demoKeyName(form:DemoForm):string;
export function demoDisplayName(form:DemoForm):string;

export function readDemoCatalog(value:unknown):DemoAdministration;
export function demoCompanies(administration:DemoAdministration):DemoCompany[];
export function demoRooms(administration:DemoAdministration,operatorId:string):DemoRoom[];
export function demoDealers(administration:DemoAdministration,room:DemoRoom|null):{selectable:DemoDealer[];others:DemoDealer[]};

export function approvedGameOrigin(value:unknown):string|null;
export function demoPermissions(session:unknown):DemoPermissions;
export function refillForPreset(preset:string):number|null;
export function demoCredits(receipt:RoomGameConfigReceipt|null|undefined):DemoCredits;

export function demoLaunchLink(payload:unknown,context:{gameOrigin:string|null;operatorSlug:string;roomId:string;dealerId?:string|null}):string;
export function demoReceipt(payload:unknown):DemoReceipt;
export function expiryText(expiresIn:number|null):string;
export function readCreditAmount(value:string):DemoCreditAmount;
export function demoCreditReceipt(payload:unknown,playerId:string):DemoCreditReceipt;
export function formatMoney(amount:number|null,currency:string|null):string;
export function demoErrorMessage(step:string,status:number,payload:unknown):string;

export function readDemoSession(fetchImpl?:typeof fetch,signal?:AbortSignal):Promise<Record<string,unknown>>;
export function readDemoCatalogFrom(fetchImpl?:typeof fetch,signal?:AbortSignal):Promise<DemoAdministration>;
export function readRoomGameConfig(fetchImpl:typeof fetch|undefined,context:{operatorId:string;roomId:string},signal?:AbortSignal):Promise<RoomGameConfigReceipt>;
export function postAdminAction(fetchImpl:typeof fetch|undefined,action:string,body:Record<string,unknown>,signal?:AbortSignal):Promise<Record<string,unknown>>;
export function launchDemo(input:{fetchImpl?:typeof fetch;signal?:AbortSignal;form:DemoForm;permissions:DemoPermissions;operatorId:string;operatorSlug:string;roomId:string;dealerId:string|null;onPhase?:(phase:'create'|'launch')=>void}):Promise<DemoLaunch>;
export function creditDemo(input:{fetchImpl?:typeof fetch;signal?:AbortSignal;keyId:string;playerId:string;amount:number}):Promise<DemoCreditReceipt>;
export function revokeDemoKey(input:{fetchImpl?:typeof fetch;signal?:AbortSignal;keyId:string}):Promise<Record<string,unknown>>;
