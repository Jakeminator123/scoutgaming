import type {LifecycleSnapshot} from '../../../components/control-resource-lifecycle';
export function lifecycleSnapshotKey(snapshot:LifecycleSnapshot):string;
export function isActiveOperator(row:{status:string;archivedAt?:string|null}):boolean;
export function operatorLifecycleGroups<T extends {status:string;archivedAt?:string|null}>(operators:T[]):{active:T[];trash:T[];suspended:T[]};
