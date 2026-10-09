const fail = () => { throw Object.assign(Error('Invalid composition settings'), { statusCode: 422 }); };
const object = value => value && typeof value === 'object' && !Array.isArray(value)
  && [Object.prototype, null].includes(Object.getPrototypeOf(value));
function exact(value, keys) {
  if (!object(value) || Object.keys(value).sort().join(',') !== [...keys].sort().join(',')) fail();
}
function placement(value, dimension) {
  exact(value, [dimension, 'x', 'y']);
  if (!Number.isFinite(value[dimension]) || value[dimension] < .1 || value[dimension] > 4
    || ['x', 'y'].some(key => !Number.isFinite(value[key]) || value[key] < -2 || value[key] > 2)) fail();
}
export function defaultCompositionSettings() {
  const plane = () => ({ scale: 1, x: 0, y: 0 });
  return { mobile: { dealer: plane(), background: plane(), table: { width: 1, x: 0, y: .04 } },
    desktop: { dealer: plane(), background: plane(), table: { width: .31640625, x: 0, y: .04 } }, tableFront: false };
}
export function validateCompositionSettings(value) {
  exact(value, ['mobile', 'desktop', 'tableFront']);
  if (typeof value.tableFront !== 'boolean') fail();
  for (const layout of ['mobile', 'desktop']) {
    exact(value[layout], ['dealer', 'background', 'table']);
    placement(value[layout].dealer, 'scale'); placement(value[layout].background, 'scale'); placement(value[layout].table, 'width');
  }
  return structuredClone(value);
}
export function sceneForComposition(settings, layout, show = {}, key = {}) {
  const checked = validateCompositionSettings(settings);
  if (!['mobile', 'desktop'].includes(layout)) fail();
  return { layout, stage: { mobile: checked.mobile.dealer, desktop: checked.desktop.dealer },
    background: 'background', table: 'table', backgroundFit: 'cover',
    backgroundTransform: { mobile: checked.mobile.background, desktop: checked.desktop.background },
    tablePlacement: checked[layout].table, tableFront: checked.tableFront,
    tableTransform: { width: 1, x: 0, y: 0 }, layerMode: 'full', splitY: .4, anchors: false,
    key: { mode: 'composite', enabled: false, threshold: .23, softness: .15, despill: 0, ...key },
    show: { background: true, dealer: true, table: true, cards: false, foreground: false, overlay: false, ...show } };
}
