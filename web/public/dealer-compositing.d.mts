export type DealerCompositing = {mode:'alpha'} | {mode:'green-screen';threshold:number;softness:number;despill:number};
export const DEFAULT_DEALER_COMPOSITING: Readonly<DealerCompositing>;
export function effectiveDealerCompositing(value?: unknown): DealerCompositing;
export function assertDealerCompositingWrite(value?: unknown): DealerCompositing;
