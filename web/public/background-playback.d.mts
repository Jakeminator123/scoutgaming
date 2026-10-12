import type {BackgroundPlaybackPolicy,BackgroundPlaybackRule} from './background-playback-policy.mjs';
export interface BackgroundPlaybackController {
  start():void; pause():void; close():void;
  event(eventId:string,eventKey?:string):boolean;
  preview(ruleId:string):boolean;
  finish(token:number,reason?:string):boolean;
}
export function createBackgroundPlayback(policy:BackgroundPlaybackPolicy,options?:{
  now?:()=>number;
  onStart?:(rule:BackgroundPlaybackRule,token:number)=>void|Promise<void>;
  onStop?:(token:number,reason:string)=>void;
  setTimeout?:(callback:()=>void,delay:number)=>unknown;
  clearTimeout?:(handle:unknown)=>void;
}):BackgroundPlaybackController;
