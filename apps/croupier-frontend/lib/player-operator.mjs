import { operatorPublicView } from './player-catalog.mjs';
import { isOperatorSlug } from '../../../packages/navigation/operator-slug.mjs';

export const OPERATOR_STORAGE_KEY = 'croupier.operator';

export function operatorSlugFromSearch(search) {
  const params = new URLSearchParams(String(search || '').replace(/^\?/, ''));
  const values = params.getAll('operator');
  if (values.length !== 1 || !isOperatorSlug(values[0])) return '';
  return values[0];
}

// A query operator wins. An invalid or repeated query does not fall back to storage.
/** @param {{ search?: string, stored?: string | null }} [input] */
export function operatorChoice({search = '', stored = null} = {}) {
  const params = new URLSearchParams(String(search || '').replace(/^\?/, ''));
  const fromSearch = operatorSlugFromSearch(search);
  if (fromSearch) return fromSearch;
  if (params.getAll('operator').length > 0) return '';
  return isOperatorSlug(stored) ? stored : '';
}

export function operatorPlayPath(slug) {
  return isOperatorSlug(slug) ? `/play/blackjack?operator=${encodeURIComponent(slug)}` : '/play/blackjack';
}

export function operatorLoginPath(slug) {
  return `/player-login?returnTo=${encodeURIComponent(operatorPlayPath(slug))}`;
}

export function clearedOperatorLocation(href) {
  const url = new URL(href, 'https://www.scoutgaming.tech');
  url.searchParams.delete('operator');
  const search = url.searchParams.toString();
  return `${url.pathname}${search ? `?${search}` : ''}`;
}

export function lobbyOperatorName({search = '', stored = null, payload = null} = {}) {
  const slug = operatorChoice({search, stored});
  return operatorPublicView(payload, slug)?.name ?? '';
}
