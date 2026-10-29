import { clipLifecycleBlocker, lifecycleClipReferences, lifecycleMessage } from './studio-lifecycle.mjs';

// Pure planning of what a confirmation dialog shows. No requests here: the
// server still owns the final checks, these texts describe their outcome.
const clipLabel = video => video?.classification?.label ?? video?.label ?? video?.id ?? 'Klippet';
const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;
const retryHint = eligibility => {
  const ms = eligibility?.retryAfterMs;
  if (!Number.isFinite(ms) || ms <= 0) return '';
  const minutes = Math.max(1, Math.ceil(ms / 60000));
  return ` Försök igen om cirka ${plural(minutes, 'minut', 'minuter')}.`;
};
const listed = (names, limit = 8) => names.length <= limit ? names : [...names.slice(0, limit), `+ ${names.length - limit} till`];

export function clipArchivePlan({ project, inventory, dealerId, ids, archived = true }) {
  const videos = ids.map(id => inventory.videos.find(row => row.id === id));
  const names = videos.map(clipLabel);
  const blocker = videos.map(video => clipLifecycleBlocker(project, video, dealerId, archived ? 'archive' : 'restore')).find(Boolean) ?? '';
  const uses = archived ? [...new Set(ids.flatMap(id => lifecycleClipReferences(project, id).map(row => row.label)))] : [];
  const single = ids.length === 1, subject = single ? names[0] : plural(ids.length, 'klipp', 'klipp');
  const items = [];
  if (!single) items.push(...listed(names));
  if (archived) items.push(...uses.map(label => `Används: ${label}`));
  if (archived && single && !uses.length) items.push('Används inte i något sparat val.');
  if (!single) items.push('Klippen ändras ett i taget. Stoppar servern ett klipp avbryts resten, och redan ändrade klipp redovisas.');
  return {
    kind: archived ? 'archive' : 'restore', ids, names, uses, blocker,
    title: archived ? `Radera ${subject}?` : `Återställ ${subject}?`,
    summary: archived
      ? `${single ? 'Klippet' : 'Klippen'} flyttas till arkivet och försvinner från klippkartan och spelarens val. Filen bevaras och kan återställas från Arkiv.`
      : `${single ? 'Klippet' : 'Klippen'} återförs till biblioteket. Inga kopplingar eller publiceringar återskapas automatiskt.`,
    items,
    error: blocker ? lifecycleMessage(blocker) + (blocker === 'studio_media_in_use' ? ' Koppla loss klippet i klippkartan och spara utkastet först.' : '') : '',
    confirmLabel: blocker ? undefined : archived ? 'Radera' : 'Återställ',
    cancelLabel: blocker ? 'Behåll' : 'Avbryt',
    busyLabel: archived ? 'Raderar…' : 'Återställer…',
  };
}

export function clipDeletePlan({ video, eligibility }) {
  const name = clipLabel(video);
  const allowed = eligibility?.allowed === true;
  return {
    kind: 'delete', allowed, reason: allowed ? '' : eligibility?.reason ?? '',
    title: `Radera ${name} permanent?`,
    summary: allowed ? 'Filen och dess registrering raderas för alltid. Det går inte att ångra.' : 'Servern tillåter inte permanent radering just nu. Klippet ligger kvar i arkivet.',
    items: allowed ? ['Klippet försvinner ur arkivet och alla register.', 'Servern har kontrollerat att inga kopplingar, publiceringar eller andra arbetsytor använder filen.'] : [],
    error: allowed || !eligibility ? '' : lifecycleMessage(eligibility.reason) + retryHint(eligibility),
    confirmLabel: allowed ? 'Radera permanent' : undefined,
    cancelLabel: allowed ? 'Avbryt' : 'Behåll i arkivet',
    busyLabel: 'Raderar…',
  };
}

export function dealerArchivePlan({ label, impact }) {
  const items = impact ? [
    `${plural(impact.mediaCount, 'klipp', 'klipp')} följer med till papperskorgen`,
    ...impact.compositions.map(row => `Miljö: ${row.label} arkiveras`),
    ...impact.rooms.map(row => `Rum: ${row.name} kopplas loss och avpubliceras`),
    ...impact.operators.map(row => `Spelbolag: ${row.name} får ett ändrat paket`),
    impact.speechEnabled ? 'AI-tal stängs av' : 'AI-tal är redan avstängt',
  ] : [];
  return {
    kind: 'dealer-archive', title: `Ta bort ${label}?`,
    summary: 'Dealern flyttas till papperskorgen och försvinner från klippkartan och spelarens val. Källfiler och publiceringshistorik bevaras; du kan återställa dealern senare.',
    items, confirmLabel: 'Flytta till papperskorgen', cancelLabel: 'Avbryt', busyLabel: 'Flyttar…',
  };
}

export function dealerRestorePlan({ label, compositions = [] }) {
  return {
    kind: 'dealer-restore', title: `Återställ ${label}?`,
    summary: 'Dealern, klippen och sparade miljöer återförs som utkast. AI-tal förblir avstängt. Rum återställs eller öppnas inte automatiskt.',
    items: [`Sparade miljöer (${compositions.length})`, ...compositions.map(row => `Miljö: ${row.label}`)],
    confirmLabel: 'Återställ dealern', cancelLabel: 'Avbryt', busyLabel: 'Återställer…',
  };
}

export function dealerDeletePlan({ label, mediaCount = 0, eligibility, pending = false }) {
  const allowed = eligibility?.allowed === true;
  const files = Number.isSafeInteger(eligibility?.count) ? eligibility.count : mediaCount;
  return {
    kind: 'dealer-delete', allowed, reason: allowed ? '' : eligibility?.reason ?? '',
    title: pending ? `Slutför raderingen av ${label}?` : `Radera ${label} permanent?`,
    summary: allowed ? 'Dealeridentiteten och alla dess egna filer raderas för alltid. Det går inte att ångra.' : 'Servern tillåter inte permanent radering just nu. Dealern ligger kvar i papperskorgen.',
    items: allowed ? [
      files > 0 ? `${plural(files, 'fil', 'filer')} raderas från lagringen` : 'Inga egna filer finns kvar att radera',
      'Delad originalmedia och publicerade paket rörs inte; servern har kontrollerat beroendena.',
    ] : [],
    error: allowed || !eligibility ? '' : lifecycleMessage(eligibility.reason) + retryHint(eligibility),
    requiresAcknowledgement: allowed && files > 0,
    acknowledgement: 'Jag förstår att filerna raderas permanent',
    confirmLabel: allowed ? (pending ? 'Slutför radering' : 'Radera permanent') : undefined,
    cancelLabel: allowed ? 'Avbryt' : 'Behåll i papperskorgen',
    busyLabel: 'Raderar…',
  };
}
