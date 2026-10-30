import { tableRect } from '../../../packages/presentation/compositor/geometry.js';

const dimensions = { desktop: [1920, 1080], mobile: [1080, 1920] };
const finite = value => Number.isFinite(value);
const point = value => value && ['x', 'y'].every(key => finite(value[key]) && value[key] >= 0 && value[key] <= 1);

function assertPlacement(placement) {
  if (!placement || !finite(placement.width) || placement.width < .1 || placement.width > 4
    || ['x', 'y'].some(key => !finite(placement[key]) || Math.abs(placement[key]) > 2)) {
    throw new TypeError('Invalid dealer table placement');
  }
}

/** The descriptor is a portable design file, not a registered product asset. */
export function validateDealerTableDefinition(definition) {
  if (definition?.schemaVersion !== 1 || !definition.id || !definition.name
    || definition.calibration?.status !== 'uncalibrated'
    || definition.pivot?.x !== .5 || definition.pivot?.y !== 0) {
    throw new TypeError('Invalid dealer table definition');
  }
  const asset = definition.asset;
  if (!asset || !['width', 'height'].every(key => Number.isSafeInteger(asset[key]) && asset[key] > 0)) {
    throw new TypeError('Invalid dealer table dimensions');
  }
  for (const key of ['alphaBounds', 'visibleBounds']) {
    const bounds = asset[key];
    if (!bounds || !['x', 'y', 'width', 'height', 'threshold'].every(field => Number.isSafeInteger(bounds[field]))
      || bounds.x < 0 || bounds.y < 0 || bounds.width <= 0 || bounds.height <= 0
      || bounds.x + bounds.width > asset.width || bounds.y + bounds.height > asset.height
      || bounds.threshold < 1 || bounds.threshold > 255) throw new TypeError('Invalid dealer table alpha bounds');
  }
  for (const [layout, [width, height]] of Object.entries(dimensions)) {
    const profile = definition.layouts?.[layout];
    if (profile?.scene?.width !== width || profile.scene.height !== height) throw new TypeError('Invalid dealer table scene');
    assertPlacement(profile.placement);
    const anchors = profile.anchors;
    if (!anchors || !finite(anchors.cardWidth) || anchors.cardWidth < .02 || anchors.cardWidth > .15
      || !point(anchors.dealer) || !Array.isArray(anchors.seats) || anchors.seats.length !== (layout === 'desktop' ? 7 : 3)
      || anchors.seats.some(seat => !point(seat?.card) || !point(seat?.bet))) throw new TypeError('Invalid dealer table anchors');
  }
  return definition;
}

export function projectTablePoint(rect, point) {
  return { x: rect[0] + rect[2] * point.x, y: rect[1] + rect[3] * point.y };
}

export function getDealerTableGeometry(definition, layout = 'desktop', placement) {
  validateDealerTableDefinition(definition);
  if (!Object.hasOwn(dimensions, layout)) throw new TypeError('Invalid dealer table layout');
  const profile = definition.layouts[layout];
  const selectedPlacement = placement ?? profile.placement;
  assertPlacement(selectedPlacement);
  const dims = [...dimensions[layout]];
  // Use the product's tableRect implementation, including the full alpha padding.
  const rect = tableRect({ tablePlacement: selectedPlacement }, definition.asset, { dims, x: 0, y: 0, s: 1 });
  const boundsRect = bounds => [rect[0] + rect[2] * bounds.x / definition.asset.width,
    rect[1] + rect[3] * bounds.y / definition.asset.height,
    rect[2] * bounds.width / definition.asset.width, rect[3] * bounds.height / definition.asset.height];
  return { dims, rect, alphaRect: boundsRect(definition.asset.alphaBounds), visibleRect: boundsRect(definition.asset.visibleBounds),
    dealer: projectTablePoint(rect, profile.anchors.dealer),
    cardWidth: rect[2] * profile.anchors.cardWidth,
    seats: profile.anchors.seats.map(seat => ({ card: projectTablePoint(rect, seat.card), bet: projectTablePoint(rect, seat.bet) })) };
}
