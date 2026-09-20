'use client';

import { useDeferredValue, useState } from 'react';
import type { StudioLine, StudioVariant } from '../lib/studio-model.mjs';
import type { VideoInventory } from './studio-types';

const verdictLabels = { want: 'Want · utvald', no: 'No · bortvald', unrated: 'Ej bedömd' };

export function VideoLibrary({ inventory, dealer, eventLabel, line, variant, onSelectVariant, onBind }: {
  inventory: VideoInventory;
  dealer: string;
  eventLabel: string;
  line: StudioLine;
  variant: StudioVariant;
  onSelectVariant: (id: string) => void;
  onBind: (generationId: string | null) => void;
}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [selectedId, setSelectedId] = useState(variant.videoGenerationId ?? '');
  const deferredQuery = useDeferredValue(query);
  const videos = inventory.videos.filter(video => (filter === 'all' || video.verdict === filter) && `${video.label} ${video.id} ${video.fileName} ${video.dealer ?? ''}`.toLocaleLowerCase('sv').includes(deferredQuery.toLocaleLowerCase('sv')));
  const selected = inventory.videos.find(video => video.id === selectedId);
  const bound = inventory.videos.find(video => video.id === variant.videoGenerationId);

  return <div className="video-workspace">
    <div className="section-intro"><span className="eyebrow">02 / MATERIAL & KOPPLINGAR</span><h1>Från variant till videofil.</h1><p>Välj ett exakt original. Kopplingen sparas i labbets JSON, utan att ändra produktens videobank eller godkänna en tagning.</p></div>
    <section className="binding-bar" aria-label="Vald videokoppling"><div><span className="eyebrow">DU KOPPLAR FÖR</span><strong>{dealer} <span>/</span> {eventLabel}</strong></div><label className="field">Variant<select value={variant.id} onChange={event => onSelectVariant(event.target.value)}>{line.variants.map(item => <option key={item.id} value={item.id}>{item.label}{item.id === line.baselineVariantId ? ' · standard' : ''}</option>)}</select></label><div className="binding-current"><span className="eyebrow">NUVARANDE MÅL</span><span>{bound?.label ?? (variant.videoGenerationId ? variant.videoGenerationId : 'Labbanimation · ingen video')}</span>{variant.videoGenerationId ? <button className="text-button" onClick={() => onBind(null)}>Koppla loss</button> : null}</div></section>
    <div className="video-layout"><section className="video-index"><div className="video-toolbar"><label className="search-field"><span aria-hidden="true">⌕</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Sök namn, dealer eller generation-ID…" aria-label="Sök videor" /></label><select value={filter} onChange={event => setFilter(event.target.value)} aria-label="Filtrera videobedömning"><option value="all">Alla bedömningar</option><option value="want">Want · utvalda</option><option value="no">No · bortvalda</option><option value="unrated">Ej bedömda</option></select></div>
      <div className="inventory-summary"><strong>{videos.length}</strong> original <span>{inventory.summary?.available ?? inventory.videos.filter(video => video.available).length} lokalt tillgängliga</span></div>
      {videos.length ? <div className="video-list">{videos.map((video, index) => <button className={`video-list-item ${selected?.id === video.id ? 'active' : ''}`} key={video.id} onClick={() => setSelectedId(video.id)}><span className="film-thumb" aria-hidden="true"><span>▶</span><small>{String(index + 1).padStart(3, '0')}</small></span><span className="video-name"><strong>{video.label}</strong><span>{video.dealer ?? 'Dealer ej verifierad'} <i>·</i> {video.fileName}</span><code>{video.id}</code></span><span className={`verdict verdict-${video.verdict}`}>{verdictLabels[video.verdict]}</span><span className={`availability ${video.available ? 'available' : ''}`} title={video.available ? 'Tillgänglig lokalt' : 'Saknas lokalt'}>{video.available ? '●' : '○'}</span></button>)}</div> : <div className="empty-state"><span aria-hidden="true">▤</span><h2>{inventory.videos.length ? 'Inga matchande original' : 'Videobanken är inte ansluten'}</h2><p>{inventory.videos.length ? 'Prova ett annat sökord eller en annan bedömning.' : 'Originalen ligger utanför Git. Ange den lokala videobankens sökväg på servern; inga videofiler laddas upp här.'}</p></div>}
    </section><aside className="video-detail">{selected ? <><div className="video-preview">{selected.available ? <video controls preload="metadata" key={selected.id} src={selected.previewUrl} aria-label={`Förhandsvisning av ${selected.label}`} /> : <div className="video-unavailable">Originalfilen är inte tillgänglig lokalt.</div>}</div><span className="eyebrow">EXAKT ORIGINAL</span><h2>{selected.label}</h2><dl className="metadata-list"><div><dt>Intake</dt><dd>{verdictLabels[selected.verdict]}</dd></div><div><dt>Granskning</dt><dd>Ej runtime-godkänd</dd></div><div><dt>Filstorlek</dt><dd>{(selected.bytes / 1024 / 1024).toFixed(1)} MB</dd></div><div><dt>Dealer-förslag</dt><dd>{selected.dealer ?? 'Saknas'}</dd></div></dl><label className="field">Generation-ID<code className="hash-value">{selected.id}</code></label><label className="field">SHA-256 · original<code className="hash-value">{selected.sha256}</code></label><div className="notice subtle"><strong>Want är inte ett godkännande.</strong><p>Text, ljud, rörelse, kortdestination och kalibrering måste granskas tillsammans innan materialet får användas i spelet.</p></div><button className="primary-button full-width" disabled={!selected.available || variant.videoGenerationId === selected.id} onClick={() => onBind(selected.id)}>{variant.videoGenerationId === selected.id ? 'Kopplad till vald variant' : 'Koppla original till variant'}</button><p className="helper">En labbkoppling. Ändringen blir beständig först när du sparar projektet.</p></> : <div className="empty-state"><span aria-hidden="true">▷</span><h2>Inspektera ett original</h2><p>Välj en rad till vänster för förhandsvisning, filidentitet och koppling.</p></div>}</aside></div>
  </div>;
}
