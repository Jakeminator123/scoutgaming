import {validateCompositionSettings} from '../../packages/presentation/contracts/composition-settings.mjs';

// Editor operation over the existing saved placements, not a new runtime zoom.
// Dealer/background origins are centred; table Y is its top edge.
export function zoomComposition(settings, layout, factor) {
  if (!['mobile', 'desktop'].includes(layout) || !Number.isFinite(factor) || factor <= 0) {
    throw new Error('Ogiltig scenzoom.');
  }
  const next = validateCompositionSettings(settings), planes = next[layout];
  for (const role of ['dealer', 'background']) {
    planes[role].scale *= factor;
    planes[role].x *= factor;
    planes[role].y *= factor;
  }
  planes.table.width *= factor;
  planes.table.x *= factor;
  planes.table.y = .5 + (planes.table.y - .5) * factor;
  // Reject the entire step at a placement limit; clamping individual layers
  // would change their relationship and move the table away from the dealer.
  return validateCompositionSettings(next);
}
