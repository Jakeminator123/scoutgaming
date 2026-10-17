import type {Catalog,Room} from './connected-studio.mjs';
import type {StudioProject,StudioLane} from '../../../../../packages/presentation/contracts/studio-model.mjs';
export function studioContext(catalog:Catalog,project:StudioProject,selection?:{operatorId?:string;game?:string;roomId?:string;dealerId?:string;library?:boolean}):{operator?:Catalog['administration']['operators'][number];rooms:Room[];room?:Room;lane?:StudioLane;dealers:StudioProject['dealers'];dealer?:StudioProject['dealers'][number];game:string|null};
