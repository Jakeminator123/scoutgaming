import type {RegisteredFilmedProfile} from './registry.mjs';
type Pose = 'VILA'|'REDO';
export type StudioFilmedProfile =
  | {schemaVersion:1; id:string; kind:'copy'; base:string; takes:Record<string,{sha256:string}>}
  | {schemaVersion:1; id:string; kind:'measured'; plane:{width:number;height:number;fps:number}; card:{width:number;height:number};
    positions:Record<string,{cx:number;cy:number}>; measuredAt:string;
    takes:Record<string,{sha256:string;frames:number;startPose:Pose;endPose:Pose;landFrame:number;contactFrame?:number;clearFrame?:number}>};
export function validateStudioFilmedProfile(value:unknown,options:{dealerId:string}): StudioFilmedProfile;
export function expandStudioFilmedProfile(value:unknown,options:{dealerId:string}): RegisteredFilmedProfile;
export function filmedProfileFor(dealerId:string,options?:{registeredDealers?:{id:string;filmedProfile?:unknown}[];project?:{dealers:{id:string;filmedProfile?:unknown}[]}}): RegisteredFilmedProfile|null;
