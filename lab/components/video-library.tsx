'use client';

import { useDeferredValue, useState } from 'react';
import type { StudioLine, StudioVariant, StudioProject } from '../lib/studio-model.mjs';
import { VideoUpload, type UploadBinding } from './video-upload';
import { VideoClassification } from './video-classification';
import { VideoCoverage } from './video-coverage';
import { videoFitsLine, VIDEO_KINDS } from '../lib/video-intake.mjs';
import styles from './video-intake.module.css';
import type { VideoEntry, VideoInventory } from './studio-types';

const verdictLabels = { want: 'Want · utvald', no: 'No · bortvald', unrated: 'Ej bedömd' };

/** Same binding as Videobanken, in the existing variant editor. No model call. */
export function VariantVideoBinding({ inventory, dealerId, eventId, variant, isBaseline, onBind, onInspect }: {
  inventory: VideoInventory; dealerId: string; eventId: string; variant: StudioVariant; isBaseline: boolean;
  onBind: (id: string | null) => void; onInspect: () => void;
}) {
  const [query, setQuery] = useState('');
  const needle = useDeferredValue(query).trim().toLocaleLowerCase('sv');
  const selected = inventory.videos.find(video => video.id === variant.videoGenerationId);
  const candidates = inventory.videos.filter(video => video.available && videoFitsLine(video, dealerId, eventId) && (!video.dealer || video.dealer === dealerId)
    && `${video.label} ${video.id}`.toLocaleLowerCase('sv').includes(needle));
  return <div className="variant-binding">
    <span className="eyebrow">{isBaseline ? 'STANDARDVARIANTENS VIDEO' : 'ALTERNATIVETS VIDEO'}</span>
    <label className="field">Hitta video<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Namn eller video-ID…" /></label>
    <label className="field">Kopplad video<select value={variant.videoGenerationId ?? ''} onChange={event => onBind(event.target.value || null)}>
      <option value="">Ingen video — använd 2D-reserv</option>
      {variant.videoGenerationId && !candidates.some(video => video.id === variant.videoGenerationId) ? <option value={variant.videoGenerationId}>{selected?.label ?? variant.videoGenerationId}{selected?.available ? '' : ' · fil saknas'}</option> : null}
      {candidates.map(video => <option key={video.id} value={video.id}>{video.label} · {video.id.slice(0, 8)} · {verdictLabels[video.verdict]}</option>)}
    </select></label>
    <p className="helper">Video om denna variant har en koppling, annars dess 2D-rörelse. Ingen annan variants video lånas.</p>
    {variant.videoGenerationId ? <button type="button" className="text-button" onClick={() => onBind(null)}>Koppla loss video</button> : null}
    <button type="button" className="text-button" onClick={onInspect}>Granska original i Videobanken ↗</button>
    <small className="helper">Manuell labbkoppling · innehåll, riktning och tal måste matcha. Sparas med Spara projekt.</small>
  </div>;
}

export function VideoLibrary({ project, inventory, dealer, eventLabel, line, variant, onSelectVariant, onBind, onUploaded, onOpenEvent, onInventory }: {
  project: StudioProject;
  onInventory: (next: VideoInventory) => void;
  onUploaded: (inventory: VideoInventory, video: VideoEntry, binding: UploadBinding | null) => void;
  onOpenEvent: (eventId: string) => void;
  inventory: VideoInventory;
  dealer: string;
  eventLabel: string;
  line: StudioLine;
  variant: StudioVariant;
  onSelectVariant: (id: string) => void;
  onBind: (generationId: string | null) => void;
}) {
  const [scope, setScope] = useState('matching');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [source, setSource] = useState('all');
  const [role, setRole] = useState('all');
  const [kind, setKind] = useState('all');
  const [eventFilter, setEventFilter] = useState('all');
  const [dealerFilter, setDealerFilter] = useState('all');
  const [selectedId, setSelectedId] = useState(variant.videoGenerationId ?? '');
  const deferredQuery = useDeferredValue(query);
  const videos = inventory.videos.filter(video => (scope === 'all' || (scope === 'inbox' ? !video.classification || !videoFitsLine(video, video.classification.dealerId, video.classification.eventId) : videoFitsLine(video, line.dealerId, line.eventId))) && (filter === 'all' || video.verdict === filter) && (source === 'all' || video.source === source) && (kind === 'all' || video.classification?.kind === kind) && (role === 'all' || video.classification?.role === role) && (eventFilter === 'all' || (video.classification?.eventId ?? video.suggestedEventId) === eventFilter) && (dealerFilter === 'all' || video.dealer === dealerFilter) && `${video.label} ${video.id} ${video.fileName} ${video.dealer ?? ''}`.toLocaleLowerCase('sv').includes(deferredQuery.toLocaleLowerCase('sv')));
  const selected = inventory.videos.find(video => video.id === selectedId);
  const bound = inventory.videos.find(video => video.id === variant.videoGenerationId);

  return <div className="video-workspace">
    <div className="section-intro"><span className="eyebrow">02 / MATERIAL & KOPPLINGAR</span><h1>Dina videor. Ordning från början.</h1><p>Lägg in standardtagningar och alternativ för rätt dealer och event. Koppla till en linje när materialet är redo.</p></div>
    <VideoUpload key={`${line.dealerId}/${line.eventId}`} project={project} dealerId={line.dealerId} eventId={line.eventId} onUploaded={(next, video, binding) => { setSelectedId(video.id); onUploaded(next, video, binding); }} />
    <VideoCoverage project={project} inventory={inventory} dealerId={line.dealerId} onOpen={onOpenEvent} />
    <div className={styles.scopes} role="group" aria-label="Visa videor">{[['matching','För vald eventgrupp'],['inbox','Inkorg · kategorisera'],['all','Alla filmer']].map(([id,label])=><button type="button" key={id} className="text-button" aria-pressed={scope===id} onClick={()=>{setScope(id);setSelectedId('');}}>{label}</button>)}</div>
    <details><summary>Fler filter</summary><div className={styles.filters}><select aria-label="Filtrera avsedd roll" value={role} onChange={e => setRole(e.target.value)}><option value="all">Standard och alternativ</option><option value="standard">Standardtagningar</option><option value="alternative">Alternativa tagningar</option></select><select aria-label="Filtrera källa" value={source} onChange={e => setSource(e.target.value)}><option value="all">Alla källor</option><option value="upload">Egna uppladdningar</option><option value="archive">Generationsarkiv</option></select><select aria-label="Filtrera videotyp" value={kind} onChange={e => setKind(e.target.value)}><option value="all">Alla videotyper</option>{Object.entries(VIDEO_KINDS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select><select aria-label="Filtrera dealer" value={dealerFilter} onChange={e => setDealerFilter(e.target.value)}><option value="all">Alla dealers</option>{project.dealers.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}</select><select aria-label="Filtrera event" value={eventFilter} onChange={e => setEventFilter(e.target.value)}><option value="all">Alla event</option>{project.events.map(e => <option key={e.id} value={e.id}>{e.label}</option>)}</select></div></details>
    <section className="binding-bar" aria-label="Vald videokoppling"><div><span className="eyebrow">DU KOPPLAR FÖR</span><strong>{dealer} <span>/</span> {eventLabel}</strong></div><label className="field">Variant<select value={variant.id} onChange={event => onSelectVariant(event.target.value)}>{line.variants.map(item => <option key={item.id} value={item.id}>{item.label}{item.id === line.baselineVariantId ? ' · standard' : ''}</option>)}</select></label><div className="binding-current"><span className="eyebrow">NUVARANDE MÅL</span><span>{bound?.label ?? (variant.videoGenerationId ? variant.videoGenerationId : 'Labbanimation · ingen video')}</span>{variant.videoGenerationId ? <button className="text-button" onClick={() => onBind(null)}>Koppla loss</button> : null}</div></section>
    <div className="video-layout"><section className="video-index"><div className="video-toolbar"><label className="search-field"><span aria-hidden="true">⌕</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Sök namn, dealer eller video-ID…" aria-label="Sök videor" /></label><select value={filter} onChange={event => setFilter(event.target.value)} aria-label="Filtrera videobedömning"><option value="all">Alla bedömningar</option><option value="want">Want · utvalda</option><option value="no">No · bortvalda</option><option value="unrated">Ej bedömda</option></select></div>
      <div className="inventory-summary"><strong>{videos.length}</strong> original <span>{inventory.summary?.available ?? inventory.videos.filter(video => video.available).length} totalt tillgängliga</span></div>
      {videos.length ? <div className="video-list">{videos.map((video, index) => <button className={`video-list-item ${selected?.id === video.id ? 'active' : ''}`} key={video.id} onClick={() => setSelectedId(video.id)}><span className="film-thumb" aria-hidden="true"><span>▶</span><small>{String(index + 1).padStart(3, '0')}</small></span><span className="video-name"><strong>{video.label}</strong><span>{video.dealer ?? 'Dealer ej verifierad'} <i>·</i> {video.fileName}</span><code>{video.id}</code></span><span className={`verdict verdict-${video.verdict}`}>{verdictLabels[video.verdict]}</span><span className={`availability ${video.available ? 'available' : ''}`} title={video.available ? 'Tillgänglig lokalt' : 'Saknas lokalt'}>{video.available ? '●' : '○'}</span></button>)}</div> : <div className="empty-state"><span aria-hidden="true">▤</span><h2>{inventory.videos.length ? 'Inga matchande original' : 'Videobanken är inte ansluten'}</h2><p>{inventory.videos.length ? 'Ingen film matchar detta urval. Öppna Inkorg för att kategorisera ett original, eller lägg in en ny video.' : 'Originalen ligger utanför Git. Ange den lokala videobankens sökväg på servern; du kan också lägga in egna filer med formuläret ovan.'}</p></div>}
    </section><aside className="video-detail">{selected ? <><div className="video-preview">{selected.available ? <video controls preload="metadata" key={selected.id} src={selected.previewUrl} aria-label={`Förhandsvisning av ${selected.label}`} /> : <div className="video-unavailable">Originalfilen är inte tillgänglig lokalt.</div>}</div><VideoClassification key={selected.id} project={project} video={selected} dealerId={line.dealerId} eventId={line.eventId} onSaved={onInventory} /><span className="eyebrow">EXAKT ORIGINAL</span><h2>{selected.label}</h2><dl className="metadata-list"><div><dt>Intake</dt><dd>{verdictLabels[selected.verdict]}</dd></div><div><dt>Granskning</dt><dd>Ej runtime-godkänd</dd></div><div><dt>Filstorlek</dt><dd>{(selected.bytes / 1024 / 1024).toFixed(1)} MB</dd></div><div><dt>{selected.classification ? 'Registrerad dealer' : 'Dealer-förslag'}</dt><dd>{selected.dealer ?? 'Saknas'}</dd></div>{selected.classification ? <><div><dt>Event</dt><dd>{selected.classification.eventId}</dd></div><div><dt>Typ / avsedd roll</dt><dd>{VIDEO_KINDS[selected.classification.kind]} · {selected.classification.role === 'standard' ? 'Standard' : 'Alternativ'}</dd></div><div><dt>Situation</dt><dd>{selected.classification.situation || 'Hela eventgruppen · täckning att granska'}</dd></div><div><dt>Anteckning</dt><dd>{selected.classification.notes || '—'}</dd></div></> : null}</dl><label className="field">Video-ID<code className="hash-value">{selected.id}</code></label><label className="field">SHA-256 · original<code className="hash-value">{selected.sha256}</code></label><div className="notice subtle"><strong>Want är inte ett godkännande.</strong><p>Text, ljud, rörelse, kortdestination och kalibrering måste granskas tillsammans innan materialet får användas i spelet.</p></div><button className="primary-button full-width" disabled={!selected.available || variant.videoGenerationId === selected.id || !videoFitsLine(selected, line.dealerId, line.eventId)} onClick={() => onBind(selected.id)}>{variant.videoGenerationId === selected.id ? 'Kopplad till vald variant' : 'Koppla original till variant'}</button><p className="helper">{videoFitsLine(selected, line.dealerId, line.eventId) ? 'Kopplingen sparas med Spara projekt.' : 'Kategorisera filmen och välj dess dealer och eventgrupp före koppling.'}</p></> : <div className="empty-state"><span aria-hidden="true">▷</span><h2>Inspektera ett original</h2><p>Välj en rad till vänster för förhandsvisning, filidentitet och koppling.</p></div>}</aside></div>
  </div>;
}
