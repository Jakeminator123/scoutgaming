export interface PartnerTrace { records: Record<string, unknown>[]; bytes: number; limited: boolean }
export const TRACE_RECORD_LIMIT: number;
export const TRACE_BYTE_LIMIT: number;
export function sanitizeObservation<T>(value: T): T;
export function createPartnerTrace(): PartnerTrace;
export function appendPartnerTrace(trace: PartnerTrace, envelope: Record<string, unknown>): PartnerTrace;
export function exportPartnerTrace(trace: PartnerTrace, options?: { access?: unknown; videoMapping?: unknown; exportedAt?: string }): Record<string, unknown>;
