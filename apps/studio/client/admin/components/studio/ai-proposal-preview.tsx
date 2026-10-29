import type {CSSProperties} from 'react';
import type {StudioProject} from '../../../../../../packages/presentation/contracts/studio-model.mjs';
import type {CompositionSettings} from '../../../../../../packages/presentation/contracts/composition-settings.mjs';
import type {VideoInventory} from '../../lib/connected-studio.mjs';
import type {AiProposal} from '../../lib/ai-background.mjs';
import {AI_PREVIEW_LAYOUTS, aiLandingWarning, aiPreviewLayout, type AiPreviewLayout, type AiPreviewMedia} from '../../lib/ai-proposal-preview.mjs';
import {useScenePreviewMedia} from '../../lib/scene-preview-media.mjs';
import {Badge} from '../ui/kit';

export type AiProposalPreviewProps = {
  role: 'background' | 'table';
  proposal: AiProposal;
  /** The other role's proposal from the same theme (a background under a table proposal), shown instead of the saved one. */
  companion?: AiProposal | null;
  /** The saved project and video register: the template's other layers and the dealer's idle. */
  project?: StudioProject | null;
  inventory?: VideoInventory | null;
  /** Scene template to draw on; '' = the composition defaults without a template. */
  laneId: string;
  dealerId?: string;
  /** The placement the table was drawn for, when it is not the saved template's. */
  composition?: CompositionSettings;
};

const box = (rect: readonly number[]): CSSProperties => ({left: rect[0] + '%', top: rect[1] + '%', width: rect[2] + '%', height: rect[3] + '%'});
const media = 'pointer-events-none absolute max-w-none select-none';
const isVideo = (contentType: string | undefined) => !/^image\//.test(contentType ?? 'image/');

/** The landing check's warning as a yellow badge: "Korten kan bli svårlästa: box 4". */
export function AiLandingBadge({role, proposal, className}: {role: 'background' | 'table'; proposal: AiProposal; className?: string}) {
  const warning = aiLandingWarning(proposal.check, role);
  return warning ? <Badge tone="warn" dot className={className} title={'Kontrollen varnar, men du väljer själv: ' + warning.detail}>{warning.text}</Badge> : null;
}

function Frame({layout, label}: {layout: AiPreviewLayout; label: string}) {
  return <figure className="m-0 grid min-w-0 content-start gap-1.5">
    <div role="img" aria-label={label} data-layout={layout.layout} className="relative w-full overflow-hidden rounded-lg border border-sg-border bg-sg-surface-2" style={{aspectRatio: String(layout.aspect)}}>
      {layout.layers.map(layer => layer.video
        ? <video key={layer.kind} data-layer={layer.kind} src={layer.url + '#t=1'} muted playsInline preload="metadata" aria-hidden="true" className={media} style={box(layer.rect)} />
        : <img key={layer.kind} data-layer={layer.kind} src={layer.url} alt="" draggable={false} className={media} style={box(layer.rect)} />)}
      {layout.marks.map(mark => <span key={mark.zone} data-mark={mark.zone} aria-hidden="true" className="pointer-events-none absolute rounded-md border-2 border-sg-warn" style={box(mark.rect)} />)}
    </div>
    <figcaption className="text-xs text-sg-muted">{label}</figcaption>
  </figure>;
}

/** A proposal drawn on the chosen scene template with the compositor's geometry, as a desktop (16:9) and a phone (9:16) frame.
 * Background or table is the proposal; the template's other layer and the dealer's idle come from the saved project. */
export function AiProposalPreview({role, proposal, companion = null, project = null, inventory = null, laneId, dealerId = '', composition}: AiProposalPreviewProps) {
  const lane = laneId ? project?.lanes?.find(row => row.id === laneId) : undefined;
  const scene = useScenePreviewMedia({project, inventory, lane, game: 'blackjack', dealerId});
  const settings = composition ?? scene.settings;
  const asset = (id: string | undefined) => project?.layerAssets?.find(row => row.id === id);
  const own: AiPreviewMedia = {url: proposal.dataUrl, width: proposal.width, height: proposal.height};
  const paired: AiPreviewMedia | null = companion ? {url: companion.dataUrl, width: companion.width, height: companion.height} : null;
  const savedBackground = asset(scene.backgroundId), savedTable = scene.tableAsset;
  const background = role === 'background' ? own : paired ?? (scene.background && savedBackground ? {url: scene.background.url, video: isVideo(scene.background.contentType), width: savedBackground.width, height: savedBackground.height} : null);
  const table = role === 'table' ? own : paired ?? (scene.table && savedTable ? {url: scene.table.url, video: isVideo(scene.table.contentType), width: savedTable.width, height: savedTable.height} : null);
  // Only a dealer with its own alpha is drawn; a green-screen idle needs the compositor's keying.
  const keyed = scene.dealer && scene.compositing?.mode === 'alpha';
  const dealer = keyed && scene.dealer ? {url: scene.dealer.url, video: isVideo(scene.dealer.contentType)} : null;
  const warned = aiLandingWarning(proposal.check, role)?.zones ?? [];
  let layouts: AiPreviewLayout[] = [];
  try {
    layouts = AI_PREVIEW_LAYOUTS.map(layout => aiPreviewLayout({layout, settings, background, table, dealer, dealerId: scene.dealerId || dealerId, warned, proposalRole: role}));
  } catch { layouts = []; }
  if (!layouts.length) return <p role="status" className="m-0 text-xs text-sg-muted">Förhandsvisningen kunde inte ritas för den här miljön.</p>;
  const missing = [
    !dealer ? (scene.dealer ? 'dealern (grön skärm visas bara i scenen)' : 'dealern (inget viloklipp)') : '',
    role === 'table' && !background ? 'bakgrund' : '',
    role === 'background' && !table ? 'bordsgrafik' : '',
  ].filter(Boolean);
  return <div className="grid gap-2" data-ai-proposal-preview={proposal.id}>
    <div className="grid items-start gap-3" style={{gridTemplateColumns: '16fr 5.0625fr'}}>
      <Frame layout={layouts[0]} label="Dator · 16:9" />
      <Frame layout={layouts[1]} label={role === 'table' ? 'Mobil · 9:16 · 3 av 7 platser' : 'Mobil · 9:16 · mittremsan'} />
    </div>
    <AiLandingBadge role={role} proposal={proposal} className="w-fit whitespace-normal" />
    {missing.length ? <p className="m-0 text-xs text-sg-muted">Visas inte här: {missing.join(', ')}.</p> : null}
  </div>;
}
