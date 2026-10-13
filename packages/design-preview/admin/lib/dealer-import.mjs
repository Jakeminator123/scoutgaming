import { validateVideoMetadata } from '../../../../lab/lib/video-intake.mjs';
import { DEFAULT_DEALER_COMPOSITING } from '../../../../web/public/dealer-compositing.mjs';
export { labUrl } from '../../../../lab/lib/lab-url.mjs';

// Only successful chat exchanges enter model history. Remove complete pairs so
// every request starts with a user and ends with the corresponding assistant.
export function appendAssistantHistory(history, message, answer) {
  const next=[...history,{role:'user',content:message.trim().slice(0,3000)},{role:'assistant',content:answer.trim().slice(0,3000)}];
  while(next.length>8 || next.reduce((size,row)=>size+row.content.length,0)>12000)next.splice(0,2);
  return next;
}

const MIME = Object.freeze({mp4:'video/mp4', webm:'video/webm', mp3:'audio/mpeg', wav:'audio/wav', png:'image/png', jpg:'image/jpeg', jpeg:'image/jpeg', webp:'image/webp'});
export function importContentType(name) { return MIME[String(name).split('.').pop().toLowerCase()] ?? ''; }
export function importFileError(file, maximum = 134217728) {
  if (!importContentType(file.name)) return 'Välj MP4, WebM, MP3, WAV, PNG, JPEG eller WebP.';
  return file.size < 16 || file.size > maximum ? 'Filen måste vara mellan 16 byte och 128 MB.' : '';
}
export function uniqueImportFiles(files, rows) {
  const key = file => JSON.stringify([file.name,file.size,file.lastModified]);
  const seen = new Set(rows.map(row => key(row.file))), accepted=[];
  let duplicates=0;
  for(const file of files) {const identity=key(file);if(seen.has(identity)){duplicates++;continue;}seen.add(identity);accepted.push(file);}
  return {files:accepted,duplicates};
}
export function compatibleImportSlot(file, slot) {
  const type = importContentType(file.name);
  if (!type || !slot) return false;
  if (type.startsWith('image/')) return Boolean(slot.pose);
  return !slot.pose && (!type.startsWith('audio/') || slot.category === 'speech');
}
// Rebuild only allowlisted classification fields from the registered catalogue.
// Model text and classifications never become upload capabilities.
export function importClassification(row, dealerId, catalog) {
  if (!catalog.dealers.some(dealer => dealer.id === dealerId)) throw Error('Välj en registrerad, aktiv dealer.');
  const slot = catalog.slots.find(item => item.id === row.slotId);
  if (!compatibleImportSlot(row.file, slot) || slot.pose) throw Error('Välj ett exakt fack för ljud eller video. Posebilder är endast lokala referenser.');
  if (importFileError(row.file, catalog.limits.maxFileBytes)) throw Error(importFileError(row.file, catalog.limits.maxFileBytes));
  const audio = importContentType(row.file.name).startsWith('audio/');
  if (!audio && row.background === 'alpha') throw Error('Transparent material behöver en separat verifierad uppspelningsväg. Filen finns kvar för lokal granskning; den sparas inte i denna import.');
  if (!audio && row.background !== 'green-screen') throw Error('Bekräfta grön bakgrund för varje video.');
  return validateVideoMetadata({ dealerId, eventId: slot.eventId, situation: slot.situation,
    kind: slot.kind, label: row.label.trim(), role: 'alternative', playback: 'once', notes: '',
    ...(audio ? {mediaType:'audio'} : {compositing:{...DEFAULT_DEALER_COMPOSITING}}),
  }, {forWrite:true});
}
export function applyImportProposals(rows, proposals, slots) {
  const byId = new Map(proposals.map(proposal => [proposal.fileId, proposal]));
  return rows.map(row => {
    const proposal = byId.get(row.id);
    if (!proposal || row.state !== 'ready') return row;
    const slot = slots.find(item => item.id === proposal.slotId);
    return {...row, slotId: compatibleImportSlot(row.file, slot) ? slot.id : '',
      reason: proposal.reason, confidence: proposal.confidence, warnings: proposal.warnings ?? []};
  });
}
