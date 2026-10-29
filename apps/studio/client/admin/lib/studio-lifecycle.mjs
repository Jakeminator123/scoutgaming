import { validateProject } from '../../../../../packages/presentation/contracts/studio-model.mjs';

const text = value => typeof value === 'string' && value.trim().length > 0;
const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value);
const fail = code => { throw Object.assign(new Error(code), { code }); };
const usesDealer = (lane, id) => lane.dealers?.includes(id) || lane.layers?.dealer?.default === id || lane.layers?.dealer?.allowed?.includes(id);

// Relationship fields establish ownership. A filename, label or version-like ID
// never creates a dealer or makes another dealer's media part of this bank.
export function lifecycleBank(project, inventory, catalog, dealerId) {
  const active = project.dealers.find(row => row.id === dealerId);
  const trash = project.dealerTrash?.find(row => row.dealer.id === dealerId);
  const registered = catalog?.source === 'registered' && catalog.administration.dealers.some(row => row.id === dealerId);
  if (!registered || !active && !trash) return null;
  return {
    dealer: active ?? trash.dealer, archived: !active, deletionPending: Boolean(trash?.deletion),
    videos: inventory.videos.filter(row => (row.classification?.dealerId ?? row.dealer) === dealerId && row.deletion?.state !== 'deleted'),
    compositions: [...(project.lanes ?? []).filter(row => usesDealer(row, dealerId)), ...(trash?.compositions ?? [])],
    rooms: catalog.administration.rooms.filter(row => row.dealerIds.includes(dealerId)),
  };
}

// These are exact references in the supplied draft, not a claim of complete
// published/other-workspace coverage. The existing server owns those checks.
export function lifecycleClipReferences(project, videoId, { includeArchive = false } = {}) {
  const result = [];
  const add = (kind, label) => { if (!result.some(row => row.kind === kind && row.label === label)) result.push({ kind, label }); };
  const lines = (rows, kind = 'line') => { for (const line of rows ?? []) for (const variant of line.variants ?? []) if (variant.videoGenerationId === videoId) add(kind, `${line.label} · ${variant.label} (${line.dealerId})`); };
  const idle = (policy, label, kind = 'idle') => { if ([...(policy?.base ?? []), ...(policy?.variants ?? [])].some(row => row.videoId === videoId)) add(kind, label); };
  const families = (rows, kind = 'family') => { for (const family of rows ?? []) if (family.variants.some(row => row.videoId === videoId)) add(kind, family.familyId); };
  lines(project.lines); idle(project.idlePolicy, 'Gemensam grundloop');
  for (const dealer of project.dealers) if (dealer.speechProfile?.reference?.videoId === videoId) add('speech', `Talreferens · ${dealer.label}`);
  for (const row of project.dealerIdlePolicies ?? []) idle(row.policy, `Grundloop · ${row.dealerId}`);
  families(project.mediaPolicy);
  for (const set of project.dealerSets ?? []) if (set.clipIds.includes(videoId)) add('set', `${set.name}${set.archived ? ' (arkiverad kategori)' : ''}`);
  for (const row of project.legacyClipPolicy ?? []) if (row.clipId === videoId) add('line', `${row.dealerId} · ${row.part}`);
  for (const lane of project.lanes ?? []) if (lane.idle?.variants?.includes(videoId)) add('composition', lane.label);
  if (includeArchive) for (const entry of project.dealerTrash ?? []) {
    if (entry.dealer.speechProfile?.reference?.videoId === videoId) add('archive', `Arkiverad talreferens · ${entry.dealer.label}`);
    lines(entry.lines, 'archive'); idle(entry.idlePolicy, `Arkiverad grundloop · ${entry.dealer.label}`, 'archive');
    idle(entry.globalIdlePolicy, `Arkiverad gemensam grundloop · ${entry.dealer.label}`, 'archive'); families(entry.mediaPolicy, 'archive');
    for (const row of entry.legacyClipPolicy ?? []) if (row.clipId === videoId) add('archive', `${row.dealerId} · ${row.part}`);
    for (const lane of entry.compositions ?? []) if (lane.idle?.variants?.includes(videoId)) add('archive', lane.label);
  }
  return result;
}

export function lifecycleFingerprint(project, inventory, dealerId, ids) {
  return JSON.stringify({ dealerId, revision: project.revision, videos: [...new Set(ids)].sort().map(id => {
    const row = inventory.videos.find(video => video.id === id);
    return row ? { id, sha256: row.sha256, revision: row.revision, classification: row.classification, retainedBank: row.retainedBank, bindingScope: row.bindingScope, deletion: row.deletion } : { id, missing: true };
  }) });
}

export function clipLifecycleBlocker(project, video, dealerId, operation) {
  if (!video?.classification || video.classification.dealerId !== dealerId) return 'studio_media_ownership_unknown';
  const archivedDealer = project.dealerTrash?.find(row => row.dealer.id === dealerId);
  if (!project.dealers.some(row => row.id === dealerId) && !archivedDealer) return 'studio_dealer_not_registered';
  if (archivedDealer?.deletion) return 'studio_dealer_delete_pending';
  if (video.retainedBank || video.bindingScope === 'shared-local' || !uuid(video.id)) return 'studio_retained_media_immutable';
  if (!hash(video.sha256) || !text(video.revision)) return 'studio_media_snapshot_incomplete';
  if (video.deletion?.state === 'deleted') return 'studio_media_already_deleted';
  if (operation !== 'delete' && video.deletion) return 'studio_media_deletion_pending';
  if (operation === 'restore' && !project.dealers.some(row => row.id === dealerId)) return 'studio_dealer_not_registered';
  if (operation === 'archive' && !project.dealers.some(row => row.id === dealerId)) return 'studio_dealer_archived';
  if (operation === 'archive' && video.classification.archived || operation !== 'archive' && !video.classification.archived) return 'studio_conflict';
  if (operation !== 'restore' && lifecycleClipReferences(project, video.id, { includeArchive: operation === 'delete' }).length) return 'studio_media_in_use';
  return '';
}

export function validArchiveImpact(value, dealerId) {
  return Boolean(value && value.dealerId === dealerId && hash(value.token) && Number.isSafeInteger(value.mediaCount) && value.mediaCount >= 0 && typeof value.speechEnabled === 'boolean'
    && Array.isArray(value.compositions) && value.compositions.every(row => row && text(row.id) && text(row.label))
    && Array.isArray(value.rooms) && value.rooms.every(row => row && text(row.id) && text(row.name) && (row.operatorId === null || text(row.operatorId)))
    && Array.isArray(value.operators) && value.operators.every(row => row && text(row.id) && text(row.name)));
}

export function lifecycleMessage(cause) {
  const code = typeof cause === 'string' ? cause : cause?.code ?? cause?.message;
  return ({
    studio_media_ownership_unknown: 'Filens exakta ägare saknas. Den kan inte ändras här.',
    studio_media_snapshot_incomplete: 'Filens hash eller revision saknas. Läs om registret.',
    studio_retained_media_immutable: 'Delad originalmedia är skyddad och bevaras.',
    studio_dealer_not_registered: 'Återställ dealern innan du återställer enskilda klipp.',
    studio_dealer_archived: 'Dealern är arkiverad. Använd dealerns återställning.',
    studio_dealer_inactive: 'Den historiska dealeridentiteten kan inte återställas som aktiv.',
    studio_media_in_use: 'En sparad koppling, annan arbetsyta eller publicering behöver mediafilen. Den bevaras.',
    studio_media_published: 'Ett publicerat bolagspaket behöver klippet. Det bevaras.',
    studio_dealer_published: 'Ett publicerat bolagspaket behöver dealern eller klippen. De bevaras.',
    studio_dealer_in_use: 'En kategori, miljö eller ett spelbord behöver dealern. Koppla loss berörda referenser och spara först.',
    studio_dealer_set_invalid: 'Välj ett unikt kategorinamn/id under en registrerad dealer och exakta klipp.',
    studio_dealer_set_missing: 'Kategorin finns inte längre. Läs om innan du fortsätter.',
    studio_media_owned_elsewhere: 'Samma media används av en annan arbetsyta och bevaras.',
    studio_media_upload_grant_active: 'En uppladdningstillåtelse är fortfarande giltig. Kontrollera igen när den har löpt ut.',
    studio_dealer_restore_conflict: 'Arkivets klipp eller miljöer har ändrats. Återställningen stoppades.',
    studio_media_deletion_pending: 'Permanent radering har påbörjats. Filen kan inte återställas.',
    studio_dealer_delete_pending: 'Radering av dealern har påbörjats. Den kan inte återställas; läs om innan du slutför.',
    studio_media_delete_failed: 'Raderingen kunde inte bekräftas. Filen kan redan vara raderad; läs om innan du fortsätter.',
    studio_media_delete_coverage_incomplete: 'Servern kan inte verifiera alla lagringsberoenden. Permanent radering är spärrad.',
    studio_delete_coverage_incomplete: 'Servern kan inte verifiera alla lagringsberoenden. Permanent radering är spärrad.',
    studio_dealer_archive_coverage_incomplete: 'Servern kunde inte kontrollera alla spelbord och publiceringar. Arkivering är spärrad.',
    studio_conflict: 'Registret eller urvalet har ändrats. Läs om och granska åtgärden igen.',
    studio_lifecycle_response_invalid: 'Resultatet kunde inte bekräftas. Läs om innan du fortsätter.',
    studio_request_rejected: 'N1-behörigheten saknas eller har gått ut. Logga in igen.',
    studio_presentation_runtime_update_required: 'Spelmotorn måste uppdateras innan livscykeländringen kan göras.',
  })[code] ?? 'Åtgärden kunde inte bekräftas. Läs om registret innan du fortsätter.';
}

export function createLifecycleClient({ fetchImpl = fetch } = {}) {
  async function json(path, body) {
    const response = await fetchImpl('/studio/api/' + path, { method: 'POST', credentials: 'same-origin', cache: 'no-store', redirect: 'error',
      headers: { 'Content-Type': 'application/json', accept: 'application/json' }, body: JSON.stringify(body) });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result) fail(result?.code ?? (typeof result?.error === 'string' && result.error.startsWith('studio_') ? result.error : [401, 403].includes(response.status) ? 'studio_request_rejected' : response.status === 409 ? 'studio_conflict' : 'studio_lifecycle_response_invalid'));
    return result;
  }
  function checkPlan(result) {
    if (typeof result?.allowed !== 'boolean' || result.reason !== undefined && !text(result.reason)) fail('studio_lifecycle_response_invalid');
    return result;
  }
  function targets(project, inventory, dealerId, ids, operation) {
    if (!ids.length || new Set(ids).size !== ids.length) fail('studio_invalid_request');
    return ids.map(id => {
      if (inventory.videos.filter(row => row.id === id).length !== 1) fail('studio_media_snapshot_incomplete');
      const video = inventory.videos.find(row => row.id === id);
      const blocker = clipLifecycleBlocker(project, video, dealerId, operation);
      if (blocker) fail(blocker);
      return structuredClone(video);
    });
  }
  return {
    async checkDealerArchive(project, dealerId) {
      if (!project.dealers.some(row => row.id === dealerId)) fail('studio_dealer_missing');
      const result = await json('dealers/archive-check', { dealerId, expectedRevision: project.revision });
      if (!validArchiveImpact(result.impact, dealerId)) fail('studio_lifecycle_response_invalid');
      return result.impact;
    },
    async dealerLifecycle(project, dealerId, archived, impact, stillCurrent = () => true) {
      if (!stillCurrent()) fail('studio_conflict');
      if (archived ? !project.dealers.some(row => row.id === dealerId) || !validArchiveImpact(impact, dealerId) : !project.dealerTrash?.some(row => row.dealer.id === dealerId && !row.deletion)) fail('studio_invalid_request');
      const result = await json('dealers/archive', { dealerId, expectedRevision: project.revision, archived, ...(archived ? { impactToken: impact.token } : {}) });
      validateProject(result.project, { allowIncompatibleAnimations: true });
      const active = result.project.dealers.some(row => row.id === dealerId), trash = result.project.dealerTrash?.some(row => row.dealer.id === dealerId);
      if (!Array.isArray(result.inventory?.videos) || result.project.revision === project.revision || (archived ? active || !trash : !active || trash)) fail('studio_lifecycle_response_invalid');
      return result;
    },
    async archiveClips({ project, inventory, dealerId, ids, archived, stillCurrent = () => true }) {
      const rows = targets(project, inventory, dealerId, ids, archived ? 'archive' : 'restore');
      const completed = [];
      try {
        for (const row of rows) {
          if (!stillCurrent()) fail('studio_conflict');
          const result = await json('videos/archive', { id: row.id, sha256: row.sha256, previous: row.classification, archived });
          const updated = result.videos?.find(video => video.id === row.id);
          if (!updated || updated.sha256 !== row.sha256 || updated.classification?.dealerId !== dealerId || updated.classification.archived !== archived || updated.deletion) fail('studio_lifecycle_response_invalid');
          completed.push(row.id);
        }
        return completed;
      } catch (error) { error.completed = completed; throw error; }
    },
    async checkClipDeletion(project, inventory, dealerId, id) {
      const [row] = targets(project, inventory, dealerId, [id], 'delete');
      return checkPlan(await json('videos/delete-check', { id, sha256: row.sha256, expectedRevision: row.revision }));
    },
    async deleteClip(project, inventory, dealerId, id, stillCurrent = () => true) {
      const [row] = targets(project, inventory, dealerId, [id], 'delete');
      if (!stillCurrent()) fail('studio_conflict');
      const result = await json('videos/delete', { id, sha256: row.sha256, expectedRevision: row.revision });
      validateProject(result.project, { allowIncompatibleAnimations: true });
      if (!Array.isArray(result.inventory?.videos) || result.inventory.videos.some(video => video.id === id && video.deletion?.state !== 'deleted')) fail('studio_lifecycle_response_invalid');
      return result;
    },
    async checkDealerDeletion(project, dealerId) {
      if (!project.dealerTrash?.some(row => row.dealer.id === dealerId)) fail('studio_dealer_missing');
      return checkPlan(await json('dealers/delete-check', { dealerId, expectedRevision: project.revision }));
    },
    async deleteDealer(project, dealerId, stillCurrent = () => true) {
      if (!stillCurrent()) fail('studio_conflict');
      if (!project.dealerTrash?.some(row => row.dealer.id === dealerId)) fail('studio_dealer_missing');
      const result = await json('dealers/delete', { dealerId, expectedRevision: project.revision });
      validateProject(result.project, { allowIncompatibleAnimations: true });
      if (!Array.isArray(result.inventory?.videos) || result.project.dealers.some(row => row.id === dealerId) || result.project.dealerTrash?.some(row => row.dealer.id === dealerId)) fail('studio_lifecycle_response_invalid');
      return result;
    },
  };
}
