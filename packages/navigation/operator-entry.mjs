import {isOperatorSlug} from './operator-slug.mjs';

export const OPERATOR_NOT_FOUND_HTML = '<!doctype html><html lang="sv"><head><meta charset="utf-8">'
  + '<meta name="viewport" content="width=device-width,initial-scale=1"><title>Bolaget finns inte</title></head>'
  + '<body><main><h1>Bolaget finns inte</h1><p>Adressen pekar på ett spelbolag som inte finns.</p></main></body></html>';

// undefined: no operator context. null: present, but not exactly one valid slug.
export function requestedOperator(params) {
  if (!params.has('operator')) return undefined;
  const values = params.getAll('operator');
  return values.length === 1 && isOperatorSlug(values[0]) ? values[0] : null;
}
