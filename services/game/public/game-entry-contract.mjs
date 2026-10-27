import {gameEntryEnabled} from '../../../packages/navigation/game-entry.mjs';
import { isActiveDealerId as isDealerId, validatePublicRegisteredDealers } from '../../../packages/presentation/contracts/dealer-identity.mjs';
import {validateComposition} from '../../../packages/presentation/runtime/presentation-composition.mjs';
import {assertGameChoices} from '../../../packages/presentation/contracts/game-selection.mjs';
import {isGameLaneId} from '../../../packages/presentation/contracts/game-lane-id.mjs';
import { isOperatorSlug } from '../../../packages/navigation/operator-slug.mjs';

const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
export function validateStudioPreview(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).sort().join(',') !== 'expiresAt,presentationLaneId,projectRevision,sessionId'
    || !uuid.test(value.sessionId) || !isGameLaneId(value.presentationLaneId)
    || typeof value.projectRevision !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$/.test(value.projectRevision)
    || typeof value.expiresAt !== 'string' || !Number.isFinite(Date.parse(value.expiresAt))
    || new Date(value.expiresAt).toISOString() !== value.expiresAt) throw Error('Invalid studio preview');
  return Object.freeze({...value});
}
const attributeText = value => value.replace(/[&"'<>]/g,character => ({'&':'&amp;','"':'&quot;',"'":'&#39;','<':'&lt;','>':'&gt;'})[character]);
// Branding is operator-written JSON. It is escaped data for the client, never markup.
function brandingAttribute(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Invalid game presentation');
  const text = JSON.stringify(value);
  if (typeof text !== 'string' || text.length > 8000) throw Error('Invalid game presentation');
  return attributeText(text);
}
export function decorateGameEntryHtml(html,env,selection,{offline = false} = {}) {
  if (!gameEntryEnabled(env) && offline !== true) return html;
  let attributes = gameEntryEnabled(env) ? ' data-game-path="/blackjack"' : '';
  if (selection) {
    if (selection.studioPreview !== undefined) {
      const preview = validateStudioPreview(selection.studioPreview);
      if (selection.lane !== preview.presentationLaneId || ['operator','roomId','packageRevision','branding'].some(key => selection[key] !== undefined)) throw Error('Invalid game presentation');
      attributes += ' data-studio-preview="' + attributeText(JSON.stringify(preview)) + '"';
    }
    if (!isGameLaneId(selection.lane) || !isDealerId(selection.dealer) || !['local','layered'].includes(selection.presentation)) throw Error('Invalid game presentation');
    attributes += ` data-game-lane="${selection.lane}" data-game-dealer="${selection.dealer}" data-game-presentation="${selection.presentation}"`;
    attributes += ` data-presentation="${selection.presentation}" data-dealer="${selection.dealer}"`;
    const registry = validatePublicRegisteredDealers(selection.registeredDealers ?? []);
    const extra = selection.presentation !== 'layered';
    if (extra && (selection.presentation !== 'local' || selection.localDealer !== selection.dealer || !registry.some(row => row.id === selection.dealer))) throw Error('Invalid game presentation');
    if (selection.localDealer !== undefined) {
      if (selection.presentation !== 'local' || selection.localDealer !== selection.dealer) throw Error('Invalid game presentation');
      attributes += ` data-game-local-dealer="${selection.localDealer}"`;
    }
    if (registry.length) attributes += ` data-game-registered-dealers="${attributeText(JSON.stringify(registry))}"`;
    const packaged = selection.packageRevision !== undefined || selection.branding !== undefined;
    if (selection.operator !== undefined) {
      if (!isOperatorSlug(selection.operator)) throw Error('Invalid game presentation');
      attributes += ` data-game-operator="${selection.operator}"`;
      if (packaged) {
        if (!Number.isSafeInteger(selection.packageRevision) || selection.packageRevision < 1) throw Error('Invalid game presentation');
        attributes += ` data-game-package-revision="${selection.packageRevision}" data-game-branding="${brandingAttribute(selection.branding)}"`;
      }
    } else if (packaged) throw Error('Invalid game presentation');
    if (selection.roomId !== undefined) {
      if (!isGameLaneId(selection.roomId) || !selection.operator || !Number.isSafeInteger(selection.packageRevision)) throw Error('Invalid game presentation');
      attributes += ` data-game-room-id="${selection.roomId}"`;
    }
    if (selection.composition !== undefined) {
      const text=JSON.stringify(validateComposition(selection.composition));
      if(text.length>32000)throw Error('Invalid game presentation');
      attributes+=` data-game-composition="${attributeText(text)}"`;
    }
    if (selection.choices !== undefined) {
      assertGameChoices(selection.choices, { registeredDealerIds: registry.map(row => row.id) });
      const text = JSON.stringify(selection.choices);
      if (text.length > 8000) throw Error('Invalid game presentation');
      attributes += ` data-game-choices="${attributeText(text)}"`;
    }
  }
  // A replacer function: attribute text must never be read as a $-pattern.
  return html.replace(/<html(?=[\s>])/i,() => '<html'+attributes);
}
