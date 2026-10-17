import type {StudioProject} from '../contracts/studio-model.mjs';
import type {VideoRegistry} from '../../studio-registry/server/registry-core.mjs';
import type {PresentationPackage} from '../contracts/presentation-layers.mjs';
import type {FrozenMediaRow, FrozenMediaPrecondition} from './frozen-dealer-idle.mjs';
export interface PresentationSnapshot {scope:Readonly<{environment:string; workspaceId:string}>; projectDocument:{kind:'project';revision:string;value:StudioProject;updatedAt?:string}; administrationDocument:{kind:'administration';revision:string;value:Record<string,unknown>;updatedAt?:string}; mediaRows:readonly FrozenMediaRow[];runtimeCatalog:{revision:string;value:any}}
export function captureFrozenPresentation(input:{snapshot:PresentationSnapshot;selectedLaneIds:readonly string[];inventory:VideoRegistry|null;requiredIdleDealerIds?:readonly string[];requiredRouletteIdleDealerIds?:readonly string[]}):{presentation:PresentationPackage;mediaPreconditions:readonly FrozenMediaPrecondition[];projectRevision:string;administrationRevision:string};
export function selectedRegisteredIdleDefaults(project:StudioProject, selectedLaneIds:readonly string[]):string[];
export function assertCapturedPresentationMedia(repository:{getMedia(id:string):Promise<FrozenMediaRow|null>}, preconditions:readonly FrozenMediaPrecondition[]):Promise<void>;

export function isPresentationRoomLaneCompatible(gameLane:unknown,presentationLane:unknown,frozenPresentation?:PresentationPackage|null,game?:'blackjack'|'roulette'):boolean;
export function assertPublishedRoomBindings(input:{administration:any;operatorId:string;currentPackage:any;presentation:PresentationPackage}):void;
