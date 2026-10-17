import {isActiveDealerId} from '../../packages/presentation/contracts/dealer-identity.mjs';
import { isGameLaneId } from './game-lanes.mjs';
import { isOperatorSlug } from '../../packages/navigation/operator-slug.mjs';

// The document's published selection is a request, never authorization. The
// server resolves this context against its current package on every chat call.
export function chatPresentationContext(entry,dealerId) {
  if(!isActiveDealerId(dealerId)||!entry||entry.dealer!==dealerId||!isOperatorSlug(entry.operator)||!isGameLaneId(entry.roomId)
    ||!Number.isSafeInteger(entry.packageRevision)||entry.packageRevision<1)return null;
  return {operatorSlug:entry.operator,roomId:entry.roomId,packageRevision:entry.packageRevision,dealerId};
}
