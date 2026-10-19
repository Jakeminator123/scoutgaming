import { validateVideoMetadata } from '../../../../../packages/presentation/contracts/video-intake.mjs';
import { DEFAULT_DEALER_COMPOSITING } from '../../../../../packages/presentation/contracts/dealer-compositing.mjs';
import { addDealer, validateProject } from '../../../../../packages/presentation/contracts/studio-model.mjs';
import { MAX_DEALERS, isActiveDealerId } from '../../../../../packages/presentation/contracts/dealer-identity.mjs';
import { CLIP_POSE_VARIANTS, clipPosesForVariant, clipVariantForPoses } from '../../../../../packages/presentation/contracts/clip-naming.mjs';
export { labUrl } from '../../../lib/lab-url.mjs';
export { CLIP_POSE_VARIANTS, clipPosesForVariant, clipVariantForPoses };

// Pose chains apply to deal, reveal and shoe transition videos only. The
// transition slots have a fixed chain; other slots never carry one.
export function slotAcceptsPoses(slot) {
  return Boolean(slot) && !slot.pose && slot.kind === 'action' && /^(?:deal|reveal|transition)\./.test(slot.eventId ?? '');
}
export function importRowPoses(row, slot) {
  if (!slotAcceptsPoses(slot) || importContentType(row.file.name).startsWith('audio/')) return null;
  if (slot.eventId === 'transition.shoe') return slot.situation === 'to-shoe' ? { start: 'VILA', end: 'REDO' } : { start: 'REDO', end: 'VILA' };
  const poses = row.poses;
  return poses && ['VILA', 'REDO'].includes(poses.start) && ['VILA', 'REDO'].includes(poses.end) ? { start: poses.start, end: poses.end } : null;
}

// Format for display only; keep the original failure on its file for review.
export function importErrorMessage(message) {
  if (message === 'studio_media_content_type_unsupported' || message.startsWith('studio_media_content_type_unsupported ')) {
    return 'Endast MP4 och WebM kan sparas just nu. Filen och dina val finns kvar; inget nytt försök görs automatiskt.';
  }
  return message.includes('studio_presentation_runtime_update_required')
    ? 'Spelmotorn behöver uppdateras innan filen kan registreras. Dina filer och val finns kvar; inget nytt försök görs automatiskt.'
    : message;
}

// Only successful chat exchanges enter model history. Remove complete pairs so
// every request starts with a user and ends with the corresponding assistant.
export function appendAssistantHistory(history, message, answer) {
  const next=[...history,{role:'user',content:message.trim().slice(0,3000)},{role:'assistant',content:answer.trim().slice(0,3000)}];
  while(next.length>8 || next.reduce((size,row)=>size+row.content.length,0)>12000)next.splice(0,2);
  return next;
}

const MIME = Object.freeze({mp4:'video/mp4', webm:'video/webm', mp3:'audio/mpeg', wav:'audio/wav', png:'image/png', jpg:'image/jpeg', jpeg:'image/jpeg', webp:'image/webp'});
export function importContentType(name) { return MIME[String(name).split('.').pop().toLowerCase()] ?? ''; }
// Check every unsaved row before classification or any upload work. An error
// row is still part of the user's batch and must not be silently skipped.
export function importBatchError(rows) {
  const unsupported = rows.some(row => row.state !== 'saved' && !['video/mp4','video/webm'].includes(importContentType(row.file.name)));
  return unsupported ? 'Endast MP4 och WebM kan sparas. Ta bort ljud, posebilder och andra filformat ur denna import innan videorna kan sparas. Originalfilerna på din dator påverkas inte.' : '';
}
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

// Finished rows are receipts, not occupied slots in the next upload batch.
// Retain failed/uncertain rows, and check duplicates before retiring receipts.
export function planImportFiles(files, rows, maximum) {
  const selected = uniqueImportFiles(files, rows);
  const pending = rows.filter(row => row.state !== 'saved');
  if (pending.length + selected.files.length > maximum) {
    throw Error(`Högst ${maximum} osparade filer per omgång. ${pending.length} finns redan i listan. Spara dem eller ta bort valda filer ur listan först.`);
  }
  return {...selected, rows: selected.files.length ? pending : rows};
}

export function importDealerId(name) {
  return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,40).replace(/-$/,'');
}

// The normal N1 project writer owns authorization and compare-and-swap. Load the
// current project, add only this person, and never retry an uncertain save.
export async function registerImportDealer({id, name}, request) {
  id=id.trim();name=name.trim();
  if(!name || name.length>120)throw Error('Ange dealerns namn, högst 120 tecken.');
  if(!isActiveDealerId(id))throw Error('Ange ett ledigt dealer-id som börjar med en bokstav och bara innehåller små bokstäver, siffror eller bindestreck.');
  const {project} = await request('/api/project');
  validateProject(project);
  if (project.dealers.length + (project.dealerTrash?.length ?? 0) >= MAX_DEALERS) {
    throw Error(`Dealerregistret har nått gränsen ${MAX_DEALERS}, inklusive arkiverade dealers. Kontakta administrationen för att granska registret.`);
  }
  if (project.dealers.some(row => row.id === id) || project.dealerTrash?.some(row => row.dealer.id === id)) {
    throw Error('Dealer-id finns redan. Välj den befintliga dealern eller ett annat id.');
  }
  const next = addDealer(project, id, name);
  let result;
  try {
    result = await request('/api/project', {method:'PUT', body:JSON.stringify({project:next,expectedRevision:project.revision})});
    validateProject(result.project);
    if (result.project.revision === project.revision || !result.project.dealers.some(row => row.id === id.trim() && row.label === name.trim())) throw Error();
  } catch {
    throw Error('Registreringen kunde inte bekräftas. Läs om dealerlistan innan du försöker igen; ditt namn och id finns kvar.');
  }
  return result.project;
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
  if (!audio && row.background === 'alpha') throw Error('Assistentens kontroll och granskning av transparent material är inte färdig. Filen finns kvar för lokal granskning; den sparas inte i denna import.');
  if (!audio && row.background !== 'green-screen') throw Error('Bekräfta grön bakgrund för varje video.');
  const poses = importRowPoses(row, slot);
  return validateVideoMetadata({ dealerId, eventId: slot.eventId, situation: slot.situation,
    kind: slot.kind, label: row.label.trim(), role: 'alternative', playback: 'once', notes: '',
    ...(poses ? {startPose:poses.start, endPose:poses.end} : {}),
    ...(audio ? {mediaType:'audio'} : {compositing:{...DEFAULT_DEALER_COMPOSITING}}),
  }, {forWrite:true});
}
export function importRowError(row, dealerId, catalog) {
  if (row.state === 'saved' || row.state === 'saving') return '';
  if (row.state === 'error') return importErrorMessage(row.message || 'Kontrollera biblioteket innan filen läggs till igen.');
  const unsupported = importBatchError([row]);
  if (unsupported) return unsupported;
  if (!row.slotId || !catalog.slots.some(slot => slot.id === row.slotId && compatibleImportSlot(row.file,slot) && !slot.pose)) return 'Välj ett fack för den här filen.';
  try {importClassification(row,dealerId,catalog);return '';}
  catch (cause) {return importErrorMessage(cause instanceof Error ? cause.message : 'Kontrollera filens fack och bakgrund.');}
}

export function applyImportProposals(rows, proposals, slots) {
  const byId = new Map(proposals.map(proposal => [proposal.fileId, proposal]));
  return rows.map(row => {
    const proposal = byId.get(row.id);
    if (!proposal || row.state !== 'ready') return row;
    const slot = slots.find(item => item.id === proposal.slotId);
    const accepted = compatibleImportSlot(row.file, slot);
    const poses = accepted && proposal.poses && ['VILA','REDO'].includes(proposal.poses.start) && ['VILA','REDO'].includes(proposal.poses.end)
      ? {start: proposal.poses.start, end: proposal.poses.end} : undefined;
    const {poses: _previous, ...rest} = row;
    return {...rest, slotId: accepted ? slot.id : '', ...(poses ? {poses} : {}),
      reason: proposal.reason, confidence: proposal.confidence, warnings: proposal.warnings ?? []};
  });
}
