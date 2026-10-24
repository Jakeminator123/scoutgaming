// Display depth belongs to the published table layout, never browser storage.
export const normalizeCardView = value => value === 'table' ? 'table' : 'raised';
export const cardViewDepth = value => normalizeCardView(value) === 'table' ? .62 : 1;
