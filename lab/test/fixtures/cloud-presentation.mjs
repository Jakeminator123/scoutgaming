import {createHash} from 'node:crypto';
import {addDealer, createEmptyProject} from '../../lib/studio-model.mjs';
import {captureFrozenPresentation} from '../../../web/storage/frozen-presentation-capture.mjs';

/** Pure, explicit cloud data for domain tests. No provider, filesystem or database I/O. */
export function cloudPresentationFixture({project: input, lanes = input?.lanes, assets, compositingByDealer = {}} = {}) {
  if (!Array.isArray(lanes) || !lanes.length) throw new TypeError('Cloud fixture requires explicit presentation lanes.');
  let project = structuredClone(input ?? createEmptyProject());
  const selected = structuredClone(lanes);
  const dealerIds = [...new Set(selected.flatMap(lane => [...lane.dealers, ...lane.layers.dealer.allowed]))];
  project.lanes = [];
  for (const id of dealerIds) if (!project.dealers.some(dealer => dealer.id === id)) project = addDealer(project, id, id[0].toUpperCase() + id.slice(1));
  project.lanes = selected;
  if (assets !== undefined) project.layerAssets = structuredClone(assets);
  const mediaRows = [], videos = [];
  for (const dealerId of dealerIds) {
    const sha256 = createHash('sha256').update(`cloud-fixture:${dealerId}`).digest('hex');
    const id = `${sha256.slice(0,8)}-${sha256.slice(8,12)}-4000-8000-${sha256.slice(12,24)}`;
    const classification = {dealerId, eventId:'idle.ready', kind:'idle', role:'alternative', situation:'', label:`${dealerId} fixture idle`, notes:'',
      compositing: structuredClone(compositingByDealer[dealerId] ?? {mode:'green-screen',threshold:.2,softness:.1,despill:0})};
    const record = {id, sha256, size:4096, contentType:'video/mp4', pathname:`croupier/media/dealers/${dealerId}/review/uploads/${id}/${sha256}.mp4`, classification};
    const idle = project.lines.find(line => line.dealerId === dealerId && line.eventId === 'idle.ready');
    idle.variants.find(variant => variant.id === idle.baselineVariantId).videoGenerationId = id;
    mediaRows.push({...record, revision:'fixture-media-1'});
    videos.push({id,sha256,bytes:record.size,dealer:dealerId,available:true,integrity:'verified',classification:structuredClone(classification),kind:'idle',playback:'once'});
  }
  const inventory = {videos, families:[], summary:{readable:true,snapshotReadable:true}};
  const snapshot = {scope:{environment:'cloud-fixture',workspaceId:'isolated'},
    projectDocument:{kind:'project',revision:project.revision,value:project},
    administrationDocument:{kind:'administration',revision:'fixture-admin-1',value:{rooms:[]}},mediaRows};
  const captured = captureFrozenPresentation({snapshot,selectedLaneIds:selected.map(lane => lane.id),inventory,requiredIdleDealerIds:dealerIds});
  return {project,presentation:structuredClone(captured.presentation),mediaRows,inventory,snapshot,mediaPreconditions:captured.mediaPreconditions};
}