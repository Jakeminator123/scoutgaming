const layerImage = (operatorSlug, id) => `/api/presentation/layers/${encodeURIComponent(operatorSlug)}/${id}`;

/** The published background the game starts with: the room's default dealer's
 * default image, only when it is one of that dealer's published choices. */
function defaultBackgroundImage(room, operatorSlug) {
  if (typeof room.dealerDefault !== 'string') return {};
  const background = room.dealers.find(dealer => dealer.id === room.dealerDefault && dealer.independentLayers)?.background;
  if (!background?.enabled || background.mode !== 'image' || !background.default) return {};
  return background.allowed.some(item => item.id === background.default) ? { image: layerImage(operatorSlug, background.default) } : {};
}

/** Describe an already validated public room, without turning defaults into grants.
 * A room is fixed only when every dealer has the same sole background; with several
 * choices the card shows the published default background the game starts with.
 * Draft assets and private storage addresses never enter this projection. */
export function roomEnvironment(room, operatorSlug) {
  const dealers = room.dealers;
  const baked = dealers.filter(dealer => !dealer.independentLayers || dealer.background.mode === 'baked');
  if (baked.length === dealers.length) return {
    kind: 'baked', fixed: dealers.length === 1,
    label: dealers.length === 1 ? 'Bakgrund i dealerfilmen' : 'Bakgrunden följer vald dealer',
  };
  if (dealers.some(dealer => dealer.independentLayers && dealer.background.mode !== 'baked' && !dealer.background.enabled)) {
    return { kind: 'variable', fixed: false, label: 'Bakgrund saknas för minst en dealer' };
  }
  const first = dealers[0].background;
  const asset = first.allowed[0];
  const fixed = !baked.length && asset && dealers.every(dealer =>
    dealer.background.allowed.length === 1 && dealer.background.allowed[0].id === asset.id
      && dealer.background.default === asset.id && dealer.background.mode === first.mode);
  if (!fixed) return { kind: 'variable', fixed: false, label: 'Flera bakgrunder', ...defaultBackgroundImage(room, operatorSlug) };
  return { kind: first.mode, fixed: true, label: asset.label, ...(first.mode === 'image' ? { image: layerImage(operatorSlug, asset.id) } : {}) };
}

/** The room's miljöbild: the published environment picture served from the room's package, or undefined.
 * It is shown in the lobby and Admin, never in the game. */
export function roomIllustrationImage(room, operatorSlug) {
  return typeof room?.illustration === 'string' ? layerImage(operatorSlug, room.illustration) : undefined;
}
