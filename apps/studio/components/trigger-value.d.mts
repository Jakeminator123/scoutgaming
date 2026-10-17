import type { PathDescriptor, PredicateOperator, Scalar } from '../../../packages/presentation/contracts/studio-model.mjs';
export function parseTriggerValue(raw: string, descriptor: PathDescriptor, operator: PredicateOperator): Scalar | Scalar[];
