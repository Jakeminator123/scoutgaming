import type {StudioProject, DealerId} from '../contracts/studio-model.mjs';
import type {IdlePolicy} from './idle-policy.mjs';
import type { VideoInventory } from '../contracts/media-inventory.mjs';
export function registeredIdleFamilyId(dealerId:string):string;
export function createRegisteredIdlePolicy(input:{dealerId:string;baselineVideoId:string;durationMs:number}):IdlePolicy;
export function registeredIdlePolicy(project:Pick<StudioProject,'idlePolicy'|'dealerIdlePolicies'>,dealerId:string):IdlePolicy|null;
export function validateRegisteredIdlePolicies(value:unknown,context:Pick<StudioProject,'dealers'|'lines'>&{requireBaseline?:boolean}):{dealerId:DealerId;policy:IdlePolicy}[];
export function registeredIdleInventory(inventory:VideoInventory,options:{dealerId:string;policy?:IdlePolicy|null}):VideoInventory;
