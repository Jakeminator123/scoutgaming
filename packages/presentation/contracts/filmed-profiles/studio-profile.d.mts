import type {RegisteredFilmedProfile} from './registry.mjs';
type Pose = 'VILA'|'REDO';
export type StudioFilmedProfile =
  | {schemaVersion:1; id:string; kind:'copy'; base:string; takes:Record<string,{sha256:string;frames?:number}>}
  | {schemaVersion:1; id:string; kind:'measured'; plane:{width:number;height:number;fps:number}; card:{width:number;height:number};
    positions:Record<string,{cx:number;cy:number}>; measuredAt:string;
    takes:Record<string,{sha256:string;frames:number;startPose:Pose;endPose:Pose;landFrame:number;contactFrame?:number;clearFrame?:number}>};
export const STUDIO_MEASURED_PLANE:{readonly width:1080;readonly height:1920;readonly fps:24};
export const STUDIO_MEASURED_CARD_MAX:{readonly width:number;readonly height:number};
export function copyTakeFrames(take:{frames:number},frameCount:unknown): number|null;
export function validateStudioFilmedProfile(value:unknown,options:{dealerId:string}): StudioFilmedProfile;
export function expandStudioFilmedProfile(value:unknown,options:{dealerId:string}): RegisteredFilmedProfile;
export function filmedProfileFor(dealerId:string,options?:{registeredDealers?:{id:string;filmedProfile?:unknown}[];project?:{dealers:{id:string;filmedProfile?:unknown}[]}}): RegisteredFilmedProfile|null;
