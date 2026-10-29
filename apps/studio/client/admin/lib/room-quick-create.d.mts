import type {StudioProject} from '../../../../../packages/presentation/contracts/studio-model.mjs';
import type {Catalog,Room,VideoInventory,Workspace} from './connected-studio.mjs';
export const PAOW_DEALER_ID:'paow';
export type QuickStepId='miljo'|'matning'|'spelbord'|'spel';
export type QuickStepStatus='running'|'done'|'skipped'|'stopped';
export const QUICK_CREATE_STEPS:readonly (readonly [QuickStepId,string])[];
export type QuickChoice={game:'blackjack'|'roulette';dealerId:string;laneId:string;language:'en'|'sv';limitPreset:'casual'|'prive'|'high';name:string};
export type QuickStop={text:string;href?:string;label?:string;action?:'retry'|'reload'};
export type QuickOperator={id:string;slug:string;name:string;appearanceDraft?:boolean};
export type QuickMemo={laneId?:string;payload?:Record<string,unknown>;room?:Record<string,unknown>};
export function roomDealer(catalog:Catalog,room:Room):string;
export function dealerChoices(project:StudioProject,inventory:VideoInventory):{id:string;label:string;complete:boolean}[];
export function laneChoices(input:{catalog:Catalog;project:StudioProject;operatorId:string;dealerId:string}):{id:string;label:string}[];
export function roomName(input:{catalog:Catalog;operatorId:string;dealerId:string;dealerLabel:string;game?:string}):string;
export function quickCreateDefaults(input:{catalog:Catalog;project:StudioProject;inventory:VideoInventory;operatorId:string;isComplete?:(dealerId:string)=>boolean}):QuickChoice;
export function defaultLanguage(input:{catalog:Catalog;operatorId:string},options?:{fetchImpl?:typeof fetch;gameClient?:unknown;signal?:AbortSignal}):Promise<'en'|'sv'>;
export function laneEnvironmentFixed(project:StudioProject,lane:NonNullable<StudioProject['lanes']>[number]):boolean;
export function planEnvironment(input:{catalog:Catalog;project:StudioProject;dealerId:string;laneId:string;dealerLabel?:string;roomLabel?:string;forceCopy?:boolean;newKey?:()=>string}):
  {action:'use'|'lock'|'copy'|'create';laneId:string;project:StudioProject|null}|{stop:string;laneId:string};
export function stopView(code:string,refs?:{operatorId?:string;dealerId?:string;laneId?:string;roomId?:string;detail?:string}):QuickStop;
export function runQuickCreate(choice:QuickChoice,options:{operator:QuickOperator;memo?:QuickMemo;onStep?:(id:QuickStepId,status:QuickStepStatus,text:string)=>void;signal?:AbortSignal;fetchImpl?:typeof fetch;newKey?:()=>string;
  studio?:{load(signal?:AbortSignal):Promise<Workspace>;save(project:StudioProject,signal?:AbortSignal):Promise<StudioProject>};rooms?:unknown;gameClient?:unknown}):
  Promise<({ok:true;room:{id:string;name:string};playUrl:string;roomHref:string})|({ok:false;step:QuickStepId}&QuickStop)>;
