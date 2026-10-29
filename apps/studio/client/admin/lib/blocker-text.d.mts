export type BlockerInput = string|{code?: string; materialReason?: string; reason?: string; area?: string; roomId?: string}|null|undefined;
export type BlockerContext = {roomId?: string; dealerId?: string|null; dealerName?: string; rooms?: {id: string; name: string}[]};
export type BlockerView = {text: string; href: string|null; linkLabel: string; title: string};
export const BLOCKER_FALLBACK: string;
export const MATERIAL_REASON_TEXT: Readonly<Record<string, readonly [string, string]>>;
export const BLOCKER_TEXT: Readonly<Record<string, readonly [string, string]>>;
export function blockerKey(blocker: BlockerInput): string|undefined;
export function hasBlockerText(blocker: BlockerInput): boolean;
export function blockerText(blocker: BlockerInput, ctx?: BlockerContext): BlockerView;
export function blockerView(blocker: BlockerInput, ctx?: BlockerContext,
  other?: ((blocker: any, ctx: any) => {text: string; href?: string|null; linkLabel?: string|null})|null): BlockerView;
