// Legacy metadata remains readable, but never grants permission to show an
// unkeyed green source. Chroma key cannot remove an arbitrary baked scene.
export const DEFAULT_DEALER_COMPOSITING = Object.freeze({mode:'green-screen',threshold:.23,softness:.15,despill:0});
const fail = () => { throw Object.assign(Error('Dealerklipp måste ha grön bakgrund som friläggs. Byt material med inbakad miljö.'),{code:'dealer_background_required'}); };
export function effectiveDealerCompositing(value) {
  if (value === undefined || value?.mode === 'opaque' && Object.keys(value).length === 1) return {...DEFAULT_DEALER_COMPOSITING};
  if (!value || Array.isArray(value) || Object.keys(value).sort().join(',') !== 'despill,mode,softness,threshold'
    || value.mode !== 'green-screen' || ['threshold','softness','despill'].some(key => !Number.isFinite(value[key]) || value[key] < 0 || value[key] > 1)
    || value.softness === 0) fail();
  return {...value};
}
export function assertDealerCompositingWrite(value) {
  if (value?.mode === 'opaque') fail();
  return effectiveDealerCompositing(value);
}
