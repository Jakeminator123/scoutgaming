export const ZONE_BROWSER_STORAGE = 'croupier.astrid.background-zones.v1';
export const ZONE_CLOUD_DRAFT_STORAGE = 'croupier.astrid.background-zones.cloud-draft.v1';

// A cloud view must never replace the independently saved offline draft.
export function persistBrowserZones(storage, workspace, zones) {
  if (workspace === 'local') storage.setItem(ZONE_BROWSER_STORAGE, JSON.stringify(zones));
}

export function persistCloudZoneDraft(storage, zones, revision) {
  storage.setItem(ZONE_CLOUD_DRAFT_STORAGE, JSON.stringify({ zones, revision }));
}

export function readCloudZoneDraft(storage, validateZone) {
  const raw = storage.getItem(ZONE_CLOUD_DRAFT_STORAGE);
  if (!raw) return null;
  const draft = JSON.parse(raw);
  if (!Number.isSafeInteger(draft.revision) || draft.revision < 0 || !Array.isArray(draft.zones) || !draft.zones.every(validateZone)) throw new Error('Det sparade molnutkastet är ogiltigt.');
  return draft;
}

export function adoptUploadedZoneClip(zones, zoneId, clip) {
  return zones.map(zone => zone.id === zoneId ? { ...zone, cloudClipId: clip.id, clipWidth: clip.width, clipHeight: clip.height } : zone);
}

export function restoredCloudDraftState(draft, cloud) {
  return { configured: Boolean(cloud?.configured), revision: draft.revision, zones: draft.zones };
}

export function zoneClipKey(workspace, id) {
  return workspace === 'local' ? id : `cloud-draft:${id}`;
}

export function zoneClipSource(workspace, zone, localUrls, mediaUrl, preferOffline = false) {
  if (workspace === 'cloud' && zone.cloudClipId && !preferOffline) return mediaUrl(zone.cloudClipId);
  return localUrls[`${workspace}:${zone.id}`] || (zone.cloudClipId ? mediaUrl(zone.cloudClipId) : '');
}
