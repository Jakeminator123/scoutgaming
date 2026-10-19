import type {MovingDriftAdminStatus,MovingDriftCommand,MovingDriftMode} from '../../../../../packages/presentation/contracts/moving-drift-admin.mjs';
export interface DriftDraft {mode:MovingDriftMode;profileId:string;durationSeconds:1800|7200|86400;revision:number;dirty:boolean}
export function readMovingDriftStatus(value:unknown):MovingDriftAdminStatus;
export function driftModeLabel(mode:unknown):string;
export function driftDraft(status:MovingDriftAdminStatus):DriftDraft;
export function driftView(status:MovingDriftAdminStatus,elapsedMs?:number):{recent:boolean;fresh:boolean;ready:boolean;expired:boolean;label:string;costLabel:string;remainingSeconds:number|null};
export function driftCommand(status:MovingDriftAdminStatus,draft:DriftDraft,commandId:string):MovingDriftCommand;