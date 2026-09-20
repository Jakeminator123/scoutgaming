import type { PathDescriptor, PredicateOperator, Scalar } from '../lib/studio-model.mjs';
export function parseTriggerValue(raw: string, descriptor: PathDescriptor, operator: PredicateOperator): Scalar | Scalar[];
