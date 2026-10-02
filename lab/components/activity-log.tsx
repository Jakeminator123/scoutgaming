'use client';
import { labUrl } from "../lib/lab-url.mjs";

import { useEffect, useRef, useState } from 'react';
import { eventSummary, createIdleLogFilter, type ActivityEntry } from '../lib/activity-log.mjs';
import styles from './activity-log.module.css';
import { ReferenceCapture } from './reference-capture';
import { PartnerReference } from './partner-reference';
import { createPartnerTrace, appendPartnerTrace, restartPartnerTrace } from '../lib/partner-trace.mjs';
import { GameStream, type GameStreamProps } from './game-stream';
import { PROBE_REASONS } from '../lib/probe-policy.mjs';
import { buildPlaybackTrace, playbackOutcome } from '../lib/playback-trace.mjs';
import type { LegacyClipControls } from '../lib/legacy-clip-inventory.mjs';

export type ActivityDraft = Omit<ActivityEntry, 'id' | 'time'>;
interface PartnerStatus { configured: boolean; missing: string[]; invalid: string[]; endpoint: string | null }
const sourceNames = { lab: 'Labb', manual: 'Manuellt val', social: 'Socialt prov', partner: 'Partner-indata', native: 'Originalspelaren', player: 'Labbspelare', config: 'Konfiguration' };
const stageNames = { input: 'Indata', decision: 'Beslut', playback: 'Uppspelning', connection: 'Anslutning', configuration: 'Konfiguration' };
const statusNames = { received: 'Mottaget', waiting: 'Väntar', selected: 'Valt', started: 'Startat', completed: 'Avslutat', failed: 'Fel / reserv', cancelled: 'Avbrutet', observed: 'Observerat' };

export function ActivityLog({ entries, onActivity, onClear, full = false, onOpen, streamView, focused = false, savedRevision }: { savedRevision?: string; focused?: boolean; entries: ActivityEntry[]; onActivity: (entry: ActivityDraft) => void; onClear: () => void; full?: boolean; onOpen: () => void; streamView?: Omit<GameStreamProps, 'trace' | 'active' | 'onActivity'> }) {
  const [expanded, setExpanded] = useState(false);
  const [filter, setFilter] = useState('all');
  const [configuration, setConfiguration] = useState<PartnerStatus | null>(null);
  const [connection, setConnection] = useState('Frånkopplad');
  const [statusError, setStatusError] = useState('');
  const [clipInventory, setClipInventory] = useState<LegacyClipControls | null>(null);
  const [clipInventoryError, setClipInventoryError] = useState('');
  const stream = useRef<EventSource | null>(null);
  const [connected, setConnected] = useState(false);
  const [nativeConnected, setNativeConnected] = useState(false);
  const [nativePresentationOwner, setNativePresentationOwner] = useState<string | null>(null);

  const [previewRequested, setPreviewRequested] = useState(false);
  const [followFromRecord, setFollowFromRecord] = useState(0);
  const [observationRevision, setObservationRevision] = useState(0);
  const connectionWait = useRef<{ promise: Promise<void>; resolve: () => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> } | null>(null);
  const [trace, setTrace] = useState(() => createPartnerTrace({ rolling: focused }));
  const [keepNativeLog] = useState(createIdleLogFilter);
  const observedVersions = useRef<Record<string, number>>({});
  function recordObservation(envelope: Record<string, unknown>) {
    const data = envelope.data as Record<string, unknown> | undefined;
    const version = data?.version;
    if (typeof version === 'number' && Number.isSafeInteger(version) && version >= 0) {
      const channel = typeof envelope.channel === 'string' ? envelope.channel : 'configured-partner';
      observedVersions.current = { ...observedVersions.current, [channel]: Math.max(observedVersions.current[channel] ?? -1, version) };
    }
    setTrace(current => appendPartnerTrace(current, envelope));
  }

  async function readConfiguration() {
    setStatusError('');
    try {
      const response = await fetch(labUrl('/api/inputs'), { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error('Anslutningsstatus kunde inte läsas.');
      setConfiguration(data);
    } catch { setStatusError('Anslutningsstatus kunde inte läsas. Labbets egen logg fungerar ändå.'); }
  }
  useEffect(() => { void readConfiguration(); return () => { stream.current?.close(); if (connectionWait.current) { clearTimeout(connectionWait.current.timer); connectionWait.current.reject(new Error('Ytan stängdes.')); connectionWait.current = null; } }; }, []);
  useEffect(() => {
    if (!full) return;
    let current = true;
    fetch(labUrl('/api/clip-controls'), { cache: 'no-store' }).then(async response => {
      if (!response.ok) throw new Error();
      const inventory = await response.json();
      if (current) { setClipInventory(inventory); setClipInventoryError(''); }
    }).catch(() => { if (current) setClipInventoryError('Originalens klippregister kunde inte läsas. Native-kvittona visas ändå.'); });
    return () => { current = false; };
  }, [full, savedRevision, streamView?.project?.revision]);

  function finishConnection(error?: Error) {
    const pending = connectionWait.current; connectionWait.current = null;
    if (!pending) return;
    clearTimeout(pending.timer);
    if (error) pending.reject(error); else pending.resolve();
  }

  function disconnect(user = true) {
    setPreviewRequested(false);
    stream.current?.close(); stream.current = null; setConnected(false); setConnection('Frånkopplad');

    finishConnection(new Error('Partner-anslutningen avbröts.'));
    if (user) setNativeConnected(false);
    setTrace(current => appendPartnerTrace(current, { time: new Date().toISOString(), source: 'lab-observer', kind: 'status', data: { state: 'disconnected', reason: user ? 'user' : 'transport-error', gap: true } }));
    if (user) onActivity({ source: 'partner', stage: 'connection', status: 'cancelled', title: 'Observation stoppad', owner: 'Du', reason: 'Ingen historik hämtas i efterhand. Nästa anslutning kan ha en lucka.', data: { replay: false } });
  }
  function connect(): Promise<void> {
    // The local profile may differ from the synthetic Partner launch player.
    // Lissabon follows the actual Web tab; do not open a misleading second feed.
    if (focused) { setConnection('Studion följer spelfliken direkt'); return Promise.resolve(); }
    if (connectionWait.current) return connectionWait.current.promise;
    if (stream.current) return Promise.resolve();
    if (!configuration?.configured) return Promise.reject(new Error('Partner-observation saknar giltig serverkonfiguration.'));
    setFollowFromRecord(trace.records.length);
    let resolve!: () => void, reject!: (error: Error) => void;
    const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
    const timer = setTimeout(() => { stream.current?.close(); stream.current = null; setConnected(false); setConnection('Transporten svarade inte'); finishConnection(new Error('Partner-anslutningen svarade inte inom 12 sekunder.')); }, 12000);
    connectionWait.current = { promise, resolve, reject, timer };
    const next = new EventSource(labUrl('/api/inputs/events')); stream.current = next;
    setConnected(true); setConnection('Ansluter…');
    next.addEventListener('status', message => {
      if (stream.current !== next) return;
      try {
        const envelope = JSON.parse((message as MessageEvent).data);
        recordObservation(envelope);
        const data = envelope.data ?? {};
        const state = data.state;
        setConnection(state === 'connected' ? 'Transport ansluten · väntar på speldata' : state === 'connecting' ? 'Ansluter…' : 'Frånkopplad / lucka');
        onActivity({ source: 'partner', stage: 'connection', status: state === 'error' ? 'failed' : 'observed', title: state === 'connected' ? 'Partner-transport ansluten' : 'Partner-anslutning', owner: 'Läsande anslutning', reason: String(data.reason ?? 'Transport är inte bevis på rundtrafik. Inväntar verkliga speldata.'), data });
        if (state === 'connected') { finishConnection(); }
        if (state === 'error' || state === 'disconnected') { next.close(); stream.current = null; setConnected(false); finishConnection(new Error('Partner-strömmen avvisades eller stängdes.')); }
      } catch { setStatusError('Ett anslutningsmeddelande kunde inte läsas.'); }
    });
    next.addEventListener('input', message => {
      if (stream.current !== next) return;
      try {
        const envelope = JSON.parse((message as MessageEvent).data);
        recordObservation(envelope);
        const data = envelope.data ?? {};
        onActivity({ source: 'partner', stage: 'input', status: 'observed', runId: typeof data.requestId === 'string' ? data.requestId : envelope.id, title: `Publicerad runda · ${data.op ?? envelope.kind}`, owner: 'Partner API / spelserver', reason: 'Verkligt mottagen data. Presentationslistan är instruktioner; labbuppspelning har egna kvitton.', data: { receivedAt: envelope.time, upstreamId: envelope.upstreamId, ...data } });
        if (Array.isArray(data.events)) {
          const runId = typeof data.requestId === 'string' ? data.requestId : envelope.id;
          for (const event of data.events.slice(0, 40)) onActivity({ source: 'partner', stage: 'decision', status: 'observed', runId, title: eventSummary(event), owner: 'Produktens presentationsbyggare', reason: 'Publicerad presentationsinstruktion. Inget lokalt variantval, ingen OpenClaw-bedömning och inget uppspelningskvitto följer automatiskt.', data: { event } });
          if (data.events.length > 40) onActivity({ source: 'partner', stage: 'input', status: 'observed', runId, title: `${data.events.length - 40} presentationsinstruktioner visas inte som egna rader`, owner: 'Labbets loggvisning', reason: `Rundan innehåller ${data.events.length} instruktioner. Loggen visar de första 40; denna begränsning gäller visningen, inte källans data.`, data: { $logTruncation: { kind: 'presentation-rows', shown: 40, total: data.events.length, omitted: data.events.length - 40 } } });
        }
      } catch { onActivity({ source: 'partner', stage: 'connection', status: 'failed', title: 'Oläsbart event', owner: 'Läsande anslutning', reason: 'Payload kunde inte tolkas. Det spelades inte upp.' }); }
    });
    next.onerror = () => {
      if (stream.current !== next) return;
      disconnect(false); setConnection('Avbrott · historik kan saknas');
      onActivity({ source: 'partner', stage: 'connection', status: 'failed', title: 'Strömmen avbröts', owner: 'Läsande anslutning', reason: 'Ingen automatisk återspelning. Anslut uttryckligen igen; mellanliggande events kan saknas.', data: { replay: false, gap: true } });
    };
    return promise;
  }

  function receiveNative(record: Record<string, unknown>) {
    setNativeConnected(true);
    recordObservation(record);
    if (focused && !keepNativeLog(record)) return;
    const data = record.data as Record<string, unknown> ?? {};
    if(record.kind==='status' && data.state==='probe'){
      onActivity({source:'native',stage:data.stage==='played'?'playback':'decision',status:data.stage==='played'?'completed':data.stage==='failed'?'failed':'observed',runId:String(data.requestId),title:`Probe · ${data.stage==='played'?'spelad':data.stage==='failed'?'avbruten':'beslut'}${data.synthetic?' · syntetiskt prov':''}`,owner:'Astrids talinitiativ',reason:PROBE_REASONS[String(data.reason)]??'Modellbeslut och faktisk uppspelning har separata kvitton.',data});
      return;
    }
    if (record.kind === 'status' && ['chat-progress', 'chat-failed'].includes(String(data.state))) {
      onActivity({ source: 'native', stage: 'decision', status: data.state === 'chat-failed' ? 'failed' : 'observed',
        runId: String(data.requestId), title: data.state === 'chat-failed' ? 'Chattsvaret avbröts' : `Chattsvar · ${data.stage} · ${(Number(data.elapsedMs) / 1000).toFixed(1)} s`,
        owner: 'Astrids chatt och tal', reason: data.state === 'chat-failed' ? String(data.reason) : 'Tid sedan frågan skickades. Uppspelningen har ett separat kvitto.', data });
      return;
    }
    if (record.kind === 'status' && data.state === 'attached') setNativePresentationOwner(String(data.presentationOwner ?? 'legacy'));
    const playback = record.kind === 'playback';
    const phase = String(data.state ?? 'observed');
    const status = playback ? ({ start: 'started', end: 'completed', error: 'failed', fallback: 'failed', interrupted: 'cancelled', selected: 'selected' } as const)[phase as 'start'] ?? 'observed' : 'observed';
    onActivity({ source: 'native', stage: playback ? 'playback' : record.kind === 'status' ? 'connection' : 'input', status,
      runId: typeof data.requestId === 'string' ? data.requestId : undefined,
      title: playback ? `Originalet · ${data.event ?? 'uppspelning'} · ${phase}` : record.kind === 'chat' ? `Originalets chatt · ${data.role ?? 'meddelande'}` : record.kind === 'status' ? 'Originalets observation ansluten' : `Originalets serversvar · ${data.op ?? 'state'}`,
      owner: playback ? 'Originalspelarens faktiska återkoppling' : 'Originalfliken',
      reason: playback ? 'Klippval och faktisk uppspelning är separata steg. Klippval bevisar inte att bilden visats.' : 'Observerat i den öppnade fliken. Samma serversvar används av originalet; inga extra spelkommandon skickas.', data });
  }

  function newObservation() {
    setPreviewRequested(false);
    keepNativeLog.reset();
    setTrace(current => restartPartnerTrace(current, { observedVersions: observedVersions.current }));
    setFollowFromRecord(1);
    setObservationRevision(current => current + 1);

    onActivity({ source: 'config', stage: 'connection', status: 'observed', title: 'Ny observation startad', owner: 'Du',
      reason: 'Tidigare minnesprotokoll ersattes efter ditt val. Befintligt spel och anslutningar fortsätter; bara framtida instruktioner följs.',
      data: { discardedRecords: trace.records.length, previousLimited: trace.limited, gap: true } });
  }

  const visible = entries.filter(entry => filter === 'all' || entry.stage === filter).slice(full ? -150 : -5).reverse();
  const rounds = trace.records.filter(record => record.kind === 'round').length;
  // Astrid launches the shared Web runtime. Do not start a second renderer while
  // the attachment is pending, or when the bounded observation log is reset.
  const webOwnsPresentation = streamView?.dealerId === 'astrid' || nativePresentationOwner === 'web-local';
  const liveStatus = !connected && !nativeConnected ? `${connection}${rounds ? ` · ${rounds} sparade meddelanden` : ''}` : rounds ? `Speldata mottagna · ${rounds} meddelanden${nativeConnected ? ' · native-observation' : ''}` : nativeConnected ? 'Original anslutet · väntar på en spelrunda' : connection;
  const playbackTrace = buildPlaybackTrace(trace.records, { inventory: streamView?.videos, clipInventory, dealerId: streamView?.dealerId, savedRevision: savedRevision ?? streamView?.project?.revision });
  const previewTrace = trace.records.some(record => record.source === 'native')
    ? { ...trace, records: trace.records.filter(record => record.source !== 'partner') } : trace;
  return <section className={styles.panel} aria-label="Händelselogg i realtid">
    <header className={styles.header}><div><span className="eyebrow">EVENT → KLIPPVAL → SPELARKVITTO</span><h2>Uppspelning <small>{focused ? `${entries.length} senaste` : `${entries.length}/150`}</small></h2><p>Följ spelflikens faktiska presentation. Sparade val, visad bild och avslut har separata kvitton.</p></div><div className={styles.tools}>{!full ? <><button className="text-button" onClick={() => setExpanded(value => !value)}>{expanded ? 'Fäll ihop' : 'Visa senaste'}</button><button className="text-button" onClick={onOpen}>Öppna uppspelning →</button></> : <button className="text-button" disabled={!entries.length} onClick={() => { keepNativeLog.reset(); onClear(); }}>Töm detaljloggen</button>}</div></header>
    {full ? <><PlaybackTraceView trace={playbackTrace} nativeConnected={nativeConnected} partnerConnected={connected} />{clipInventoryError ? <p role="status" className={styles.note}>{clipInventoryError}</p> : null}</> : null}
    <div hidden={!full}><PartnerReference focused={focused} trace={trace} connected={connected || nativeConnected} connection={liveStatus} dealerId={streamView?.dealerId} onConnect={connect} onDisconnect={() => disconnect()} onNative={receiveNative} onNewObservation={newObservation} onActivity={onActivity} onImport={records => { setPreviewRequested(false); let imported = createPartnerTrace(); for (const record of records) imported = appendPartnerTrace(imported, record); setTrace(imported); }} diagnostics={<div className={styles.connection}><div><strong>{focused ? liveStatus : connection}</strong><p>{focused ? "Studion följer den öppnade spelflikens aktiva profil, kort, chatt och uppspelningskvitton direkt. Den separata tekniska Partner-spelarens SSE används inte här." : "Partner SSE är kompletterande instruktioner; originalflikens native-observation innehåller uppspelningskvittona. Om inga rundor kommer: spela i fliken som Anslut öppnade och kontrollera serverversionen."}</p><button className="text-button" onClick={() => void readConfiguration()}>Läs om konfiguration</button></div><div>{configuration && !configuration.configured ? <p>{[...configuration.missing, ...configuration.invalid].join(', ')}</p> : <p>Konfiguration finns på Studio-servern.</p>}{statusError ? <p role="alert">{statusError}</p> : null}</div></div>}>{webOwnsPresentation ? <section aria-label="Web äger presentationen"><h3>En spelare · Web</h3><p>Spela och chatta i spelfliken. Web använder Eventstudions sparade familjer och idlepolicy. Loggen visar dess verkliga klippval och uppspelning. Ingen parallell labbfilm körs.</p>{!focused ? <ReferenceCapture onActivity={onActivity} /> : null}</section> : streamView ? <section aria-label="Separat Lab-preview"><h3>Separat Lab-preview · {streamView.dealerId}</h3><p>Manuellt jämförelseprov. Dess uppspelning är ett Lab-kvitto och räknas inte som visad i spelfliken.</p><button className="text-button" onClick={() => { setFollowFromRecord(previewTrace.records.length); setPreviewRequested(current => !current); }}>{previewRequested ? 'Stäng Lab-preview' : 'Öppna separat Lab-preview'}</button>{previewRequested ? <GameStream {...streamView} trace={previewTrace} active={full} autoFollow={false} followFromRecord={followFromRecord} observationRevision={observationRevision} onActivity={onActivity} /> : null}</section> : null}</PartnerReference></div>
    {full || expanded ? <>
      <div className={styles.filters} role="group" aria-label="Filtrera detaljlogg"><button aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>Alla</button>{Object.entries(stageNames).map(([id, label]) => <button key={id} aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}</button>)}</div>
      {!visible.length ? <p className={styles.empty}>Inga registrerade händelser i detta urval. Kör Testa event, spela en variant, använd chatten eller anslut den läsande strömmen. Inga exempelrader visas som verkliga händelser.</p> : <ol className={styles.timeline}>{visible.map(entry => <li key={entry.id} data-status={entry.status}><div className={styles.timestamp}><time dateTime={entry.time}>{new Date(entry.time).toLocaleTimeString('sv-SE')}</time><span>{stageNames[entry.stage]}</span></div><div className={styles.body}><div className={styles.tags}><span>{sourceNames[entry.source]}</span><span>{statusNames[entry.status]}</span></div><h3>{entry.title}</h3><p><strong>Vem:</strong> {entry.owner}. <strong>Varför:</strong> {entry.reason}</p>{entry.runId ? <small className={styles.run}>Förlopp {entry.runId}</small> : null}{entry.data != null ? <details><summary>Visa faktisk data och fält</summary><pre>{JSON.stringify(entry.data, null, 2)}</pre></details> : null}</div></li>)}</ol>}
      <p className={styles.note}>Tillfällig logg i minnet, högst 150 poster. Den töms vid omladdning och är ingen komplett spelhistorik. Stora listor och objekt kortas med en $logTruncation-markör från loggvisningen som visar totalt, visat och utelämnat antal. Ett valt klipp eller avslutad preview innebär inte godkänd läppsynk.</p>
    </> : <p className={styles.latest} aria-live="polite">{entries.length ? `${sourceNames[entries.at(-1)!.source]} · ${entries.at(-1)!.title} — ${statusNames[entries.at(-1)!.status]}` : 'Redo att registrera labbets verkliga anrop och uppspelningshändelser.'}</p>}
  </section>;
}

const modeNames: Record<string, string> = { off: 'Standard', rules: 'Regler', random: 'Slump', active: 'OpenClaw', shadow: 'OpenClaw · skugga' };
const speechStages: Record<string, string> = { text: 'Svarstext', voice: 'TTS', 'video-submit': 'Läppsynk skickad', 'video-queue': 'Video i kö', 'video-render': 'Läppsynk skapas', media: 'Media förbereds', ready: 'Svar redo', start: 'Tal startat', presented: 'Bild visad', end: 'Tal avslutat', interrupted: 'Tal avbrutet', failed: 'Tal misslyckades' };
function PlaybackTraceView({ trace, nativeConnected, partnerConnected }: { trace: ReturnType<typeof buildPlaybackTrace>; nativeConnected: boolean; partnerConnected: boolean }) {
  const mismatched = trace.savedRevision && trace.projectRevision && trace.savedRevision !== trace.projectRevision;
  return <section className={styles.playbackTrace} aria-label="Spårbar uppspelning">
    <dl className={styles.traceStatus}>
      <div><dt>Aktiv anslutning</dt><dd>{nativeConnected ? 'Spelflik · native-kvitton' : 'Spelflik frånkopplad'}{trace.latestChannel ? <small>{trace.latestChannel}</small> : null}</dd></div>
      <div><dt>Klippväljare i spelet</dt><dd>{trace.mode ? modeNames[trace.mode] ?? trace.mode : 'Inte observerad'}</dd></div>
      <div><dt>Sparad Lab-revision</dt><dd>{trace.savedRevision ?? 'Inte läst'}</dd></div>
      <div><dt>Senast kvitterad klipprevision</dt><dd>{trace.projectRevision ?? 'Inget revisionskvitto'}<small>Spelversion {trace.latestVersion ?? 'ej observerad'}</small></dd></div>
    </dl>
    {mismatched ? <p className={styles.traceNotice}>Spelets senaste kvitto använder en annan sparad revision. Nya klippval och redan laddad idle kan ha olika revisioner; följ revisionsfältet på varje rad.</p> : null}
    <h3>Originalspelarens kedja</h3>
    <p className={styles.note}>Ett event och ett klippval är förberedelser. Spelat kräver kvitto på visad bild eller faktisk talstart. Historiska observationer märks separat.</p>
    {!trace.rows.length ? <p className={styles.empty}>Inga native-kvitton här ännu. Anslut till spelet och spela i spelfliken.</p> : <ol className={styles.playbackRows}>{trace.rows.slice(-20).reverse().map(row => <li key={row.id}>
      <div className={styles.traceHeading}><strong>{eventSummary(row.event)}</strong><span>{row.historical ? 'Historisk · ' : ''}{playbackOutcome(row)}</span></div>
      <p><strong>Familj:</strong> {row.familyId ?? 'Ej kvitterad'} · <strong>Variant:</strong> {row.variantId ?? 'Ej kvitterad'} · <strong>Klipp:</strong> {row.fileName ?? row.mediaId ?? 'Ej kvitterat'}</p>
      <p><strong>Orsak:</strong> {row.reason ?? 'Ingen urvalsorsak i kvittot'}{row.mode ? ` · ${modeNames[row.mode] ?? row.mode}` : ''}{row.provider ? ` · ${row.provider}` : ''}</p>
      <small className={styles.run}>Request {row.requestId ?? 'ej kvitterad'}{row.commandRequestId && row.commandRequestId !== row.requestId ? ` · spelcommand ${row.commandRequestId}` : ''} · spelversion {row.version ?? 'ej kvitterad'} · projekt {row.projectRevision ?? 'ej kvitterat'} · {row.channel}</small>
      <div className={styles.receiptSteps} aria-label="Kvitton i mottagningsordning">{row.receipts.length ? row.receipts.map((receipt, index) => <span key={index}>{receipt.state}{receipt.time ? ` · ${new Date(receipt.time).toLocaleTimeString('sv-SE')}` : ''}{receipt.evidence ? <small>{receipt.evidence}</small> : null}{receipt.reason ? <small>{receipt.reason}</small> : null}</span>) : <span>Event mottaget · saknar uppspelningskvitto</span>}</div>
    </li>)}</ol>}
    <h3>Genererat tal · separat förlopp</h3>
    {!trace.speech.length ? <p className={styles.note}>Inget talförlopp observerat. Text, TTS, läppsynk och media kan bli klara utan att talet spelas.</p> : <ol className={styles.playbackRows}>{trace.speech.slice(-8).reverse().map(row => <li key={row.id}><div className={styles.traceHeading}><strong>{row.requestId}</strong><span>{row.historical ? 'Historisk · ' : ''}{playbackOutcome({ ...row, selected: false })}</span></div><div className={styles.receiptSteps}>{row.stages.map((stage, index) => <span key={index}>{speechStages[stage.stage] ?? stage.stage}{typeof stage.elapsedMs === 'number' ? ` · ${(stage.elapsedMs / 1000).toFixed(1)} s` : ''}{stage.reason ? <small>{stage.reason}</small> : null}</span>)}</div></li>)}</ol>}
    <details className={styles.mapping}><summary>Källöversikt · registrerat / preview / runtime / spelat</summary>
      <h4>Labbets befintliga filmregister</h4><dl className={styles.traceStatus}><div><dt>Registrerade filmer</dt><dd>{trace.inventory.registered}</dd></div><div><dt>Tillgänglig preview</dt><dd>{trace.inventory.previewAvailable}</dd></div><div><dt>Registrerad i runtime-familj</dt><dd>{trace.inventory.runtimeFamily}</dd></div><div><dt>Native-kvitterade klipp totalt</dt><dd>{trace.inventory.played}</dd></div></dl>
      <h4>Originalens befintliga medieregister</h4><div className={styles.sourceTable}><table><thead><tr><th>Dealer</th><th>Registrerat</th><th>Preview</th><th>Sparad runtimebindning</th><th>Native-kvitterat</th></tr></thead><tbody>{trace.sources.map(source => <tr key={source.dealerId}><th>{source.dealerId}</th><td>{source.registered}</td><td>{source.previewAvailable}</td><td>{source.runtimeConfigured}</td><td>{source.played}</td></tr>)}</tbody></table></div>
      <p className={styles.note}>Familjregistret är befintliga exakta kandidater; sparad policy avgör om ett alternativ tillåts. Originalens runtimekolumn räknar sparade exakta bindningar. Hämtning, preview och urval räknas inte som spelat i spelet.</p>
    </details>
    <details className={styles.mapping}><summary>Partner-SSE · kompletterande diagnostik</summary><p className={styles.note}>{partnerConnected ? 'Partner-transport ansluten' : 'Ingen aktiv Partner-transport'} · {trace.diagnostics} meddelanden. Instruktionerna är inte originalspelarens uppspelningskvitton och läggs inte till som spelade klipp.</p><p className={styles.note}>{trace.gaps} observationsgränser/luckor · {trace.duplicates} dubbletter uteslutna · {trace.stale} gamla poster uteslutna. Ingen historik återspelas.</p></details>
  </section>;
}
