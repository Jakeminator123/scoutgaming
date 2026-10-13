/** Describe an already validated public room, without turning defaults into grants.
 * A shared image is only shown when every dealer has the same sole background.
 * Draft assets and private storage addresses never enter this projection. */
export function roomEnvironment(room, operatorSlug) {
  const dealers = room.dealers;
  const baked = dealers.filter(dealer => !dealer.independentLayers || dealer.background.mode === 'baked');
  if (baked.length === dealers.length) return {
    kind: 'baked', fixed: dealers.length === 1,
    label: dealers.length === 1 ? 'Miljö i dealerfilmen' : 'Miljön följer vald dealer',
  };
  if (dealers.some(dealer => dealer.independentLayers && dealer.background.mode !== 'baked' && !dealer.background.enabled)) {
    return { kind: 'variable', fixed: false, label: 'Bakgrund saknas för minst en dealer' };
  }
  const first = dealers[0].background;
  const asset = first.allowed[0];
  const fixed = !baked.length && asset && dealers.every(dealer =>
    dealer.background.allowed.length === 1 && dealer.background.allowed[0].id === asset.id
      && dealer.background.default === asset.id && dealer.background.mode === first.mode);
  if (!fixed) return { kind: 'variable', fixed: false, label: 'Flera publicerade miljöval' };
  return { kind: first.mode, fixed: true, label: asset.label,
    ...(first.mode === 'image' ? { image: `/api/presentation/layers/${encodeURIComponent(operatorSlug)}/${asset.id}` } : {}),
  };
}
