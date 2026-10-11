'use client';

import { DealerMediaLibrary } from './dealer-media-library';
import { useState } from 'react';
import { addVariant, isAssetCompatible, type StudioProject, type StudioVariant } from '../lib/studio-model.mjs';
import { applyClipLabel, clipLabel } from '../lib/clip-label.mjs';
import { OUTPUT_GROUPS, presentationProfile } from '../lib/presentation-profile.mjs';
import { videoFitsLine } from '../lib/video-intake.mjs';
import { FamilyVideoLibrary } from './family-video-library';
import { LegacyClipEditor } from './legacy-clip-editor';
import { PageTemplate } from './page-template.mjs';
import { ProjectConflict } from './project-conflict';
import styles from './control-videos-page.module.css';
import { StudioContextIntro, StudioMessages, useStudioSession } from './studio-session';
import { studioHref, type ConnectionStatus, type VideoEntry, type VideoInventory } from './studio-types';
import type { UploadBinding } from './video-upload';
import { ClipNameEditor, VideoLibrary } from './video-library';

export function ControlVideosPage({
  initialProject, initialVideos, initialStatus, initialDealerId, initialEventId, initialVariantId, initialSituation, connectedLane = false,
}: {
  initialProject: StudioProject;
  initialVideos: VideoInventory;
  initialStatus: ConnectionStatus;
  initialDealerId?: string;
  initialEventId?: string;
  initialVariantId?: string;
  initialSituation?: string;
  connectedLane?: boolean;
}) {
  const session = useStudioSession({
    initialProject, initialVideos, initialStatus, initialDealerId, initialEventId, initialVariantId, connectedLane,
  });
  const {
    project, setProject, updateProject, modelEdit, projectRef, dirty, saving, save,
    error, setError, notice, setNotice, conflict, setConflict, savedJson, setSavedJson,
    videos, setVideos, refreshVideos, refreshingVideos, originals,
    dealerId, selectDealer, selectEvent, selectVariant, assignSelection,
    event, line, variant, media, dealer,
  } = session;
  const invalidVideoBindings = project.lines.filter(l => !videos.families?.some(f => f.dealerId === l.dealerId)).flatMap(l => l.variants.filter(v => v.videoGenerationId && !videoFitsLine(videos.videos.find(f => f.id === v.videoGenerationId), l.dealerId, l.eventId)));
  const incompatibleBindings = project.lines.flatMap(item => item.variants.filter(candidate => !isAssetCompatible(project.events.find(entry => entry.id === item.eventId), project.assets.find(asset => asset.id === candidate.assetId))).map(candidate => ({ dealerId: item.dealerId, eventId: item.eventId, variantId: candidate.id })));
  const firstBinding = incompatibleBindings[0];
  const eventHref = studioHref('/control/events', { dealerId, eventId: event.id });
  const [intakePending, setIntakePending] = useState(false);
  const [namedId, setNamedId] = useState('');
  const dealerClips = videos.videos.filter(video => video.dealer === dealerId || video.familyId?.startsWith(`${dealerId}/`));
  const named = dealerClips.find(video => video.id === namedId) ?? dealerClips[0];

  function renameClip(clipId: string, text: string) {
    modelEdit(current => applyClipLabel(current, clipId, text));
  }

  function updateVariant(patch: Partial<StudioVariant>) {
    updateProject(draft => {
      const target = draft.lines.find(item => item.dealerId === dealerId && item.eventId === event.id)!.variants.find(item => item.id === variant.id)!;
      Object.assign(target, patch);
    });
  }

  function uploadedVideo(inventory: VideoInventory, video: VideoEntry, binding: UploadBinding | null) {
    setVideos(inventory);
    if (!binding || !video.classification) return;
    const { dealerId: targetDealer, eventId: targetEvent } = video.classification;
    try {
      let next = structuredClone(projectRef.current);
      if (binding.role === 'alternative') next = addVariant(next, targetDealer, targetEvent, video.label);
      const targetLine = next.lines.find(l => l.dealerId === targetDealer && l.eventId === targetEvent)!;
      const targetVariant = binding.role === 'standard' ? targetLine.variants.find(v => v.id === targetLine.baselineVariantId)! : targetLine.variants.at(-1)!;
      targetVariant.videoGenerationId = video.id;
      if (binding.role === 'alternative') { targetVariant.selection = binding.selection; targetVariant.triggerIds = binding.triggerIds; }
      setProject(next);
      assignSelection({ dealerId: targetDealer, eventId: targetEvent, variantId: targetVariant.id });
      setError('');
      setNotice('Videon finns i banken. Kopplingen ligger i utkastet tills du sparar projektet.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Filen sparades men kunde inte kopplas.');
    }
  }

  function openEvent(id: string, situation?: string) {
    const href = studioHref('/control/events', { dealerId, eventId: id });
    window.location.assign(situation ? `${href}&situation=${encodeURIComponent(situation)}` : href);
  }

  return (
    <PageTemplate
      eyebrow="// STUDIO"
      title="Dealerns media"

      primary={<button type="button" className="sg-btn sg-btn-primary" disabled={!dirty || saving || intakePending} onClick={() => void save()}>{saving ? 'Sparar…' : 'Spara projekt'}</button>}
    >
      <div className="sg-page-body">
      <nav className="sg-chip-row" aria-label="Innehållsverktyg">{[['/control/clips','Innehåll'],['/control/events','Händelser'],['/control/probe','Tal vid inaktivitet']].map(([path,label])=><a key={path} className="text-button" href={studioHref(path,{dealerId,eventId:event.id,situation:initialEventId === event.id ? initialSituation : undefined})}>{label} →</a>)}</nav>
      <StudioMessages error={error} notice={notice} setError={setError} setNotice={setNotice} />
      {conflict ? <ProjectConflict base={JSON.parse(savedJson)} draft={project} onResolve={(remote, merged) => { setSavedJson(JSON.stringify(remote)); setProject(merged); setConflict(false); setError(''); setNotice('Utkastet är sammanslaget. Granska dina val och spara.'); }} /> : null}
      {incompatibleBindings.length ? (
        <div className="feedback error" role="alert">
          <span><strong>{incompatibleBindings.length} animationskopplingar behöver rättas.</strong> Projektet innehåller äldre val som inte matchar spelhändelsen. Inget har ändrats automatiskt. Välj en kompatibel labbanimation för varje markerad variant innan du sparar eller testar.</span>
          {firstBinding ? <a className="primary-button" href={studioHref('/control/events', { dealerId: firstBinding.dealerId, eventId: firstBinding.eventId, variantId: firstBinding.variantId, tab: 'variants' })}>Rätta första kopplingen →</a> : null}
        </div>
      ) : null}
      {invalidVideoBindings.length ? (
        <div className="feedback error" role="alert">
          <span>{invalidVideoBindings.length} videokopplingar behöver kategoriseras eller kopplas loss. Inga original har ändrats.</span>
        </div>
      ) : null}
      <div className="sg-chip-row" role="group" aria-label="Välj dealer">
        {project.dealers.map(item => (
          <button type="button" className="sg-chip" disabled={intakePending} aria-pressed={dealerId === item.id} key={item.id} onClick={() => selectDealer(item.id)}>
            {item.label.slice(0, 1)} {item.label}
          </button>
        ))}
      </div>
      <DealerMediaLibrary key={dealerId} project={project} inventory={videos} dealerId={dealerId} onInventory={setVideos} onPendingChange={setIntakePending} disabled={saving || !connectedLane} />
      <details><summary>Avancerat · spelkopplingar och originalbank</summary>
      {media.managed ? null : (
        <div className={styles.binding}>
          <p className={styles.bindingText}>Koppling för: {dealer.label} · {event.label} · {variant.label}</p>
          <label className={styles.field}>
            Händelse
            <select value={event.id} onChange={change => selectEvent(change.target.value)}>
              {OUTPUT_GROUPS.map(group => {
                const items = project.events.filter(item => presentationProfile(item.sourceType)?.id === group.id);
                return items.length ? (
                  <optgroup key={group.id} label={group.label}>
                    {items.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
                  </optgroup>
                ) : null;
              })}
              {project.events.filter(item => !OUTPUT_GROUPS.some(group => group.id === presentationProfile(item.sourceType)?.id)).map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </label>
          <label className={styles.field}>
            Variant
            <select value={variant.id} onChange={change => selectVariant(change.target.value)}>
              {line.variants.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </label>
        </div>
      )}
      <details><summary>Avancerat · befintliga klippkopplingar</summary><fieldset disabled={saving || !connectedLane}>
        <LegacyClipEditor project={project} dealerId={dealerId} onChange={policy => updateProject(draft => { draft.legacyClipPolicy = policy; })} />
      </fieldset></details>
      {media.managed && named ? (
        <div className={styles.binding}>
          <label className={styles.field}>
            Klipp
            <select value={named.id} onChange={change => setNamedId(change.target.value)}>
              {dealerClips.map(video => {
                const fileName = video.fileName || video.relativePath?.split('/').at(-1) || video.id;
                return <option key={video.id} value={video.id}>{clipLabel({ id: video.id, label: video.label, familyId: video.familyId, role: video.role, relativePath: video.relativePath }, project.clipLabels)}</option>;
              })}
            </select>
          </label>
          <ClipNameEditor className={styles.field} video={named} clipLabels={project.clipLabels} onChange={renameClip} />
        </div>
      ) : null}
      {media.managed
        ? <FamilyVideoLibrary inventory={videos} dealerId={dealerId} clipLabels={project.clipLabels} onOpen={(id, situation) => openEvent(id, situation)} onRefresh={() => void refreshVideos()} refreshing={refreshingVideos} />
        : (
          <VideoLibrary
            key={`${dealerId}/${event.id}/${initialEventId === event.id ? initialSituation ?? '' : ''}`}
            initialSituation={initialEventId === event.id ? initialSituation : undefined}
            originals={originals}
            onInventory={next => { setVideos(next); }}
            project={project}
            onUploaded={uploadedVideo}
            onOpenEvent={openEvent}
            onClipLabel={renameClip}
            inventory={videos}
            dealer={dealer.label}
            eventLabel={event.label}
            line={line}
            variant={variant}
            onSelectVariant={selectVariant}
            onBind={id => updateVariant({ videoGenerationId: id })}
          />
        )}
      </details>
      </div>
    </PageTemplate>
  );
}
