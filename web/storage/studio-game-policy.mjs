import { BASE_DEALER_IDS, isRegisteredDealer, isActiveDealerId } from '../../packages/presentation/contracts/dealer-identity.mjs';
import { createHash } from 'node:crypto';
import { validateGameConnection } from './postgres-store.mjs';
import { gameLaneConfiguration } from '../public/game-lanes.mjs';
import { isPresentationRoom } from '../presentation-room-contract.mjs';
import { normalizeProject } from '../../packages/presentation/contracts/studio-model.mjs';
import {
  StudioStorageError, studioStorageFailure, validateStudioScope, validateRevision,
  validateActor, validateDocumentValue, canonicalStudioJson,
} from './studio-contract.mjs';

export const STUDIO_GAME_CONFIGURATION_SOURCE = 'neon/croupier_studio';
const tierIds = Object.freeze(['classic', 'high', 'vip']);
const fail = (code, status = 503) => { throw new StudioStorageError(code, status); };
const object = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const text = (value, max = 100) => typeof value === 'string' && Boolean(value.trim())
  && value.length <= max && !/[\u0000-\u001f\u007f-\u009f]/u.test(value);
const exact = (value, keys) => object(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
function freeze(value) {
  if (value && typeof value === 'object') { for (const item of Object.values(value)) freeze(item); Object.freeze(value); }
  return value;
}

// The flag selects one configuration source on both deployments. No connection,
// schema installation, row initialization or legacy disk read occurs here.
export function studioGamePolicyConfiguration(env = process.env) {
  if (env.CROUPIER_STUDIO_NEON_POLICY !== '1') return null;
  try {
    const scope = validateStudioScope({ environment: env.CROUPIER_STUDIO_ENVIRONMENT_ID, workspaceId: env.CROUPIER_STUDIO_WORKSPACE_ID });
    const connectionString = validateGameConnection(env.CROUPIER_GAME_DATABASE_URL, env.CROUPIER_ZONES_DATABASE_URL);
    if (!new URL(connectionString).hostname.endsWith('.neon.tech')) fail('studio_invalid_configuration');
    return Object.freeze({ scope, connectionString });
  } catch { fail('studio_invalid_configuration'); }
}

// Historical room rows and their independent administration domains stay
// readable. Operator-owned rooms do not depend on these demo-era settings.
function isLegacyGameRoom(room) {
  return exact(room, ['id', 'name', 'scene', 'felt', 'dealer', 'state'])
    && ['id', 'name', 'scene', 'felt'].every(key => text(room[key], key === 'scene' ? 300 : 100))
    && BASE_DEALER_IDS.includes(room.dealer) && ['live', 'preview', 'pending'].includes(room.state);
}

function validateLegacyAdministration(value, { required }) {
  const invalid = () => fail('studio_invalid_game_policy', 422);
  if (required || Object.hasOwn(value, 'tiers')) {
    if (!exact(value.tiers, tierIds) || Object.values(value.tiers).some(id => !BASE_DEALER_IDS.includes(id))) invalid();
  }
  if (required || Object.hasOwn(value, 'pitboss')) {
    if (!exact(value.pitboss, ['payout10x', 'streak5', 'randomWalkMin'])
      || typeof value.pitboss.payout10x !== 'boolean' || typeof value.pitboss.streak5 !== 'boolean'
      || !Number.isInteger(value.pitboss.randomWalkMin) || value.pitboss.randomWalkMin < 1 || value.pitboss.randomWalkMin > 1440) invalid();
  }
  if (!required && !Object.hasOwn(value, 'tournaments')) return;
  if (!Array.isArray(value.tournaments) || value.tournaments.length > 1000) invalid();
  const tournamentIds = new Set();
  for (const tournament of value.tournaments) {
    if (!exact(tournament, ['id', 'name', 'format', 'buyin', 'pool', 'entries', 'cap', 'starts', 'state'])
      || !['id', 'name', 'format', 'starts'].every(key => text(tournament[key])) || tournamentIds.has(tournament.id)
      || !['buyin', 'pool'].every(key => Number.isFinite(tournament[key]) && tournament[key] >= 0 && tournament[key] <= 100_000_000)
      || !['entries', 'cap'].every(key => Number.isSafeInteger(tournament[key]) && tournament[key] >= 0 && tournament[key] <= 1_000_000)
      || !['draft', 'registering', 'live', 'completed', 'cancelled'].includes(tournament.state)) invalid();
    tournamentIds.add(tournament.id);
  }
}

// Validate saved room/game configuration without creating default rooms or
// legacy settings. Old clipAssignments/neverAgain require an explicit import
// decision and are rejected by validateDocumentValue, never silently dropped.
export function validateStudioGameAdministration(input) {
  const value = validateDocumentValue('administration', input, 'validation');
  const invalid = () => fail('studio_invalid_game_policy', 422);
  if (!Array.isArray(value.rooms) || value.rooms.length > 1000) invalid();
  const roomIds = new Set();
  if (Object.hasOwn(value, 'legacyClipReview')) {
    const review = value.legacyClipReview;
    if (!exact(review, ['neverAgain', 'sourceSha256']) || !object(review.neverAgain) || !/^[a-f0-9]{64}$/.test(review.sourceSha256)
      || Object.entries(review.neverAgain).some(([clipId, record]) => !/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/.test(clipId)
        || clipId.includes('..') || !object(record))) invalid();
  }
  let legacyRooms = false;
  for (const room of value.rooms) {
    const legacy = isLegacyGameRoom(room);
    if ((!legacy && !isPresentationRoom(room)) || roomIds.has(room.id)) invalid();
    legacyRooms ||= legacy;
    roomIds.add(room.id);
  }
  validateLegacyAdministration(value, { required: legacyRooms });
  return value;
}

// This is presence in a dealer's exact registered engine path, not media/lip
// sync acceptance. A nearby key, approximate duration or another dealer fails.
export function exactRegisteredDealerIdle(record, dealerId) {
  return isActiveDealerId(dealerId) && object(record) && record.dealerId === dealerId
    && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(record.mediaId)
    && /^[a-f0-9]{64}$/.test(record.sha256) && record.available === true;
}

// Construction remains inert. The caller verifies product-v1 and Studio 001/002
// before constructing the repository and supplies only server-owned identity.
export function createStudioGamePolicy({ repository, scope, dealerIdle } = {}) {
  if (!repository?.transaction || !repository?.readDocument || !repository?.saveDocument || typeof dealerIdle !== 'function') fail('studio_invalid_configuration');
  scope = validateStudioScope(scope);
  if (canonicalStudioJson(scope) !== canonicalStudioJson(validateStudioScope(repository.scope))) fail('studio_scope_mismatch');
  function validate(projectDocument, administrationDocument, { write = false } = {}) {
    if (!projectDocument || !administrationDocument) fail('studio_game_policy_missing');
    try {
      if (projectDocument.kind !== 'project' || administrationDocument.kind !== 'administration'
        || projectDocument.value?.revision !== projectDocument.revision) fail('studio_corrupt_game_policy');
      const project = validateDocumentValue('project', projectDocument.value, validateRevision(projectDocument.revision));
      const administration = validateStudioGameAdministration(administrationDocument.value);
      validateRevision(administrationDocument.revision);
      if (gameLaneConfiguration(administration).gameLanes.some(lane => lane.renderer === 'portrait-video' && !isRegisteredDealer(project, lane.dealer))) fail('studio_invalid_game_policy', 422);
      // Old indexed lane records remain readable; entry rejects their retired renderer.
      return { project, administration };
    } catch (error) {
      if (error instanceof StudioStorageError && error.code === 'studio_game_dealer_unavailable') throw error;
      fail(write ? 'studio_invalid_game_policy' : 'studio_corrupt_game_policy', write ? 422 : 503);
    }
  }
  async function documents(repo) {
    const project = await repo.readDocument('project');
    const administration = await repo.readDocument('administration');
    if (!project || !administration) fail('studio_game_policy_missing');
    return { project, administration };
  }
  function projection(saved) {
    const { project, administration } = validate(saved.project, saved.administration);
    const projectRevision = saved.project.revision, administrationRevision = saved.administration.revision;
    const revision = `studio-game-${createHash('sha256').update(canonicalStudioJson({ scope, projectRevision, administrationRevision, project, administration })).digest('hex')}`;
    return freeze({ revision, projectRevision, administrationRevision,
      configurationSource: STUDIO_GAME_CONFIGURATION_SOURCE, project, administration });
  }
  async function readSaved() {
    try {
      const saved = await repository.transaction(repo => documents(repo), { readOnly: true });
      return projection(saved);
    } catch (error) { throw studioStorageFailure(error); }
  }
  async function save(kind, value, expectedRevision, actor) {
    validateRevision(expectedRevision); validateActor(actor);
    // Clone caller-owned drafts before awaiting; mutations during a save never
    // become persisted policy. Pure domain validation also precedes DB I/O.
    const proposed = kind === 'project' ? validateDocumentValue('project', value, expectedRevision) : validateStudioGameAdministration(value);
    return repository.transaction(async repo => {
      const saved = await documents(repo);
      if (saved[kind].revision !== expectedRevision) fail('studio_conflict', 409);
      const next = { ...saved, [kind]: { kind, revision: expectedRevision, value: proposed } };
      validate(next.project, next.administration, { write: true });
      return repo.saveDocument(kind, { value: proposed, expectedRevision, actor });
    }, { presentationMutation: {kind,value:proposed} });
  }
  const api = {
    scope, readSaved,
    async readProject() { return normalizeProject((await readSaved()).project, { allowIncompatibleAnimations: true, preserveMissingLanes: true }); },
    async readAdministration() { const saved = await readSaved(); return freeze({ kind: 'administration', revision: saved.administrationRevision, value: saved.administration }); },
    async readGameConfiguration() {
      const saved = await readSaved();
      // Review verdicts and other administration-only metadata stay private.
      const legacy = Object.fromEntries(['tiers', 'pitboss', 'tournaments']
        .filter(key => Object.hasOwn(saved.administration, key)).map(key => [key, saved.administration[key]]));
      return freeze({ ...legacy, rooms: saved.administration.rooms,
        ...gameLaneConfiguration(saved.administration),
        revision: saved.revision, projectRevision: saved.projectRevision,
        administrationRevision: saved.administrationRevision, configurationSource: saved.configurationSource });
    },
    saveProject: (value, expectedRevision, { actor } = {}) => save('project', value, expectedRevision, actor).then(saved => freeze(saved.value)),
    saveAdministration: (value, expectedRevision, { actor } = {}) => save('administration', value, expectedRevision, actor).then(saved => freeze(saved)),
    async canAssignDealer(dealerId) {
      if (!isActiveDealerId(dealerId)) return false;
      const {project} = await readSaved();
      if (!isRegisteredDealer(project,dealerId)) return false;
      try { return exactRegisteredDealerIdle(await dealerIdle(dealerId, project), dealerId); }
      catch { fail('studio_game_media_unavailable'); }
    },
    projectStore({ actor } = {}) {
      if (actor !== undefined) validateActor(actor);
      return Object.freeze({ configurationSource: STUDIO_GAME_CONFIGURATION_SOURCE, load: api.readProject,
        save: (value, expectedRevision) => api.saveProject(value, expectedRevision, { actor }) });
    },
  };
  return Object.freeze(api);
}
