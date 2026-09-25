'use client';

import { useEffect, useRef, useState } from 'react';
import { eventSummary, type ActivityEntry } from '../lib/activity-log.mjs';
import styles from './activity-log.module.css';
import { ReferenceCapture } from './reference-capture';
import { PartnerReference } from './partner-reference';
import { createPartnerTrace, appendPartnerTrace, restartPartnerTrace } from '../lib/partner-trace.mjs';
import { GameStream, type GameStreamProps } from './game-stream';

export type ActivityDraft = Omit<ActivityEntry, 'id' | 'time'>;
interface PartnerStatus { configured: boolean; missing: string[]; invalid: string[]; endpoint: string | null }
const sourceNames = { lab: 'Labb', manual: 'Manuellt val', social: 'Socialt prov', partner: 'Partner-indata', native: 'Originalspelaren', player: 'Labbspelare', config: 'Konfiguration' };
const stageNames = { input: 'Indata', decision: 'Beslut', playback: 'Uppspelning', connection: 'Anslutning', configuration: 'Konfiguration' };
const statusNames = { received: 'Mottaget', waiting: 'Väntar', selected: 'Valt', started: 'Startat', completed: 'Avslutat', failed: 'Fel / reserv', cancelled: 'Avbrutet', observed: 'Observerat' };

export function ActivityLog({ entries, onActivity, onClear, full = false, onOpen, streamView, focused = false }: { focused?: boolean; entries: ActivityEntry[]; onActivity: (entry: ActivityDraft) => void; onClear: () => void; full?: boolean; onOpen: () => void; streamView?: Omit<GameStreamProps, 'trace' | 'active' | 'onActivity'> }) {
  const [expanded, setExpanded] = useState(false);
  const [filter, setFilter] = useState('all');
  const [configuration, setConfiguration] = useState<PartnerStatus | null>(null);
  const [connection, setConnection] = useState('Frånkopplad');
  const [statusError, setStatusError] = useState('');
  const stream = useRef<EventSource | null>(null);
  const [connected, setConnected] = useState(false);
  const [nativeConnected, setNativeConnected] = useState(false);
  const [nativePresentationOwner, setNativePresentationOwner] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [followFromRecord, setFollowFromRecord] = useState(0);
  const [observationRevision, setObservationRevision] = useState(0);
  const connectionWait = useRef<{ promise: Promise<void>; resolve: () => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> } | null>(null);
  const [trace, setTrace] = useState(createPartnerTrace);
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
      const response = await fetch('/api/inputs', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error('Anslutningsstatus kunde inte läsas.');
      setConfiguration(data);
    } catch { setStatusError('Anslutningsstatus kunde inte läsas. Labbets egen logg fungerar ändå.'); }
  }
  useEffect(() => { void readConfiguration(); return () => { stream.current?.close(); if (connectionWait.current) { clearTimeout(connectionWait.current.timer); connectionWait.current.reject(new Error('Ytan stängdes.')); connectionWait.current = null; } }; }, []);

  function finishConnection(error?: Error) {
    const pending = connectionWait.current; connectionWait.current = null;
    if (!pending) return;
    clearTimeout(pending.timer);
    if (error) pending.reject(error); else pending.resolve();
  }

  function disconnect(user = true) {
    stream.current?.close(); stream.current = null; setConnected(false); setConnection('Frånkopplad');
    setReady(false);
    finishConnection(new Error('Partner-anslutningen avbröts.'));
    if (user) setNativeConnected(false);
    setTrace(current => appendPartnerTrace(current, { time: new Date().toISOString(), source: 'lab-observer', kind: 'status', data: { state: 'disconnected', reason: user ? 'user' : 'transport-error', gap: true } }));
    if (user) onActivity({ source: 'partner', stage: 'connection', status: 'cancelled', title: 'Observation stoppad', owner: 'Du', reason: 'Ingen historik hämtas i efterhand. Nästa anslutning kan ha en lucka.', data: { replay: false } });
  }
  function connect(): Promise<void> {
    if (connectionWait.current) return connectionWait.current.promise;
    if (stream.current) return Promise.resolve();
    if (!configuration?.configured) return Promise.reject(new Error('Partner-observation saknar giltig serverkonfiguration.'));
    setFollowFromRecord(trace.records.length);
    let resolve!: () => void, reject!: (error: Error) => void;
    const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
    const timer = setTimeout(() => { stream.current?.close(); stream.current = null; setConnected(false); setConnection('Transporten svarade inte'); finishConnection(new Error('Partner-anslutningen svarade inte inom 12 sekunder.')); }, 12000);
    connectionWait.current = { promise, resolve, reject, timer };
    const next = new EventSource('/api/inputs/events'); stream.current = next;
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
        if (state === 'connected') { setReady(true); finishConnection(); }
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
    setNativeConnected(true); setReady(true);
    recordObservation(record);
    const data = record.data as Record<string, unknown> ?? {};
    if (record.kind === 'status' && ['chat-progress', 'chat-failed'].includes(String(data.state))) {
      onActivity({ source: 'native', stage: 'decision', status: data.state === 'chat-failed' ? 'failed' : 'observed',
        runId: String(data.requestId), title: data.state === 'chat-failed' ? 'Chattsvaret avbröts' : `Chattsvar · ${data.stage} · ${(Number(data.elapsedMs) / 1000).toFixed(1)} s`,
        owner: 'Astrids chatt och tal', reason: data.state === 'chat-failed' ? String(data.reason) : 'Tid sedan frågan skickades. Uppspelningen har ett separat kvitto.', data });
      return;
    }
    if (record.kind === 'status' && data.state === 'attached') setNativePresentationOwner(String(data.presentationOwner ?? 'legacy'));
    const playback = record.kind === 'playback';
    const phase = String(data.state ?? 'observed');
    const status = playback ? ({ start: 'started', end: 'completed', error: 'failed', interrupted: 'cancelled', selected: 'selected' } as const)[phase as 'start'] ?? 'observed' : 'observed';
    onActivity({ source: 'native', stage: playback ? 'playback' : record.kind === 'status' ? 'connection' : 'input', status,
      runId: typeof data.requestId === 'string' ? data.requestId : undefined,
      title: playback ? `Originalet · ${data.event ?? 'uppspelning'} · ${phase}` : record.kind === 'chat' ? `Originalets chatt · ${data.role ?? 'meddelande'}` : record.kind === 'status' ? 'Originalets observation ansluten' : `Originalets serversvar · ${data.op ?? 'state'}`,
      owner: playback ? 'Originalspelarens faktiska återkoppling' : 'Originalfliken',
      reason: playback ? 'Klippval och faktisk uppspelning är separata steg. Klippval bevisar inte att bilden visats.' : 'Observerat i den öppnade fliken. Samma serversvar används av originalet; inga extra spelkommandon skickas.', data });
  }

  function newObservation() {
    setTrace(current => restartPartnerTrace(current, { observedVersions: observedVersions.current }));
    setFollowFromRecord(1);
    setObservationRevision(current => current + 1);
    setReady(connected || nativeConnected);
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
  return <section className={styles.panel} aria-label="Händelselogg i realtid">
    <header className={styles.header}><div><span className="eyebrow">INDATA → BESLUT → UPPSPELNING</span><h2>Händelselogg <small>{entries.length}/150</small></h2><p>Det som faktiskt händer i den här fliken. Källan och beslutsfattaren följer varje steg.</p></div><div className={styles.tools}>{!full ? <><button className="text-button" onClick={() => setExpanded(value => !value)}>{expanded ? 'Fäll ihop' : 'Visa senaste'}</button><button className="text-button" onClick={onOpen}>Öppna loggen →</button></> : <button className="text-button" disabled={!entries.length} onClick={onClear}>Töm visningen</button>}</div></header>
    <div hidden={!full}><PartnerReference focused={focused} trace={trace} connected={connected || nativeConnected} connection={liveStatus} dealerId={streamView?.dealerId} onConnect={connect} onDisconnect={() => disconnect()} onNative={receiveNative} onNewObservation={newObservation} onActivity={onActivity} onImport={records => { setReady(false); let imported = createPartnerTrace(); for (const record of records) imported = appendPartnerTrace(imported, record); setTrace(imported); }} diagnostics={<div className={styles.connection}><div><strong>{connection}</strong><p>Partner SSE och originalflikens observation kompletterar varandra. Om inga rundor kommer: spela i fliken som Anslut öppnade och kontrollera serverversionen. Äldre drift kan sakna native-observation.</p><button className="text-button" onClick={() => void readConfiguration()}>Läs om konfiguration</button></div><div>{configuration && !configuration.configured ? <p>{[...configuration.missing, ...configuration.invalid].join(', ')}</p> : <p>Konfiguration finns på den lokala servern.</p>}{statusError ? <p role="alert">{statusError}</p> : null}</div></div>}>{webOwnsPresentation ? <section aria-label="Web äger presentationen"><h3>En spelare · Web</h3><p>Spela och chatta i spelfliken. Web använder Eventstudions sparade familjer och idlepolicy. Loggen visar dess verkliga klippval och uppspelning. Ingen parallell labbfilm körs.</p>{!focused ? <ReferenceCapture onActivity={onActivity} /> : null}</section> : streamView ? <GameStream {...streamView} trace={trace} active={full} autoFollow={ready} followFromRecord={followFromRecord} observationRevision={observationRevision} onActivity={onActivity} /> : null}</PartnerReference></div>
    {full || expanded ? <>
      <div className={styles.filters} role="group" aria-label="Filtrera logg"><button aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>Alla</button>{Object.entries(stageNames).map(([id, label]) => <button key={id} aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}</button>)}</div>
      {!visible.length ? <p className={styles.empty}>Inga registrerade händelser i detta urval. Kör Testa event, spela en variant, använd chatten eller anslut den läsande strömmen. Inga exempelrader visas som verkliga händelser.</p> : <ol className={styles.timeline}>{visible.map(entry => <li key={entry.id} data-status={entry.status}><div className={styles.timestamp}><time dateTime={entry.time}>{new Date(entry.time).toLocaleTimeString('sv-SE')}</time><span>{stageNames[entry.stage]}</span></div><div className={styles.body}><div className={styles.tags}><span>{sourceNames[entry.source]}</span><span>{statusNames[entry.status]}</span></div><h3>{entry.title}</h3><p><strong>Vem:</strong> {entry.owner}. <strong>Varför:</strong> {entry.reason}</p>{entry.runId ? <small className={styles.run}>Förlopp {entry.runId}</small> : null}{entry.data != null ? <details><summary>Visa faktisk data och fält</summary><pre>{JSON.stringify(entry.data, null, 2)}</pre></details> : null}</div></li>)}</ol>}
      <p className={styles.note}>Tillfällig logg i minnet, högst 150 poster. Den töms vid omladdning och är ingen komplett spelhistorik. Stora listor och objekt kortas med en $logTruncation-markör från loggvisningen som visar totalt, visat och utelämnat antal. Ett valt klipp eller avslutad preview innebär inte godkänd läppsynk.</p>
    </> : <p className={styles.latest} aria-live="polite">{entries.length ? `${sourceNames[entries.at(-1)!.source]} · ${entries.at(-1)!.title} — ${statusNames[entries.at(-1)!.status]}` : 'Redo att registrera labbets verkliga anrop och uppspelningshändelser.'}</p>}
  </section>;
}
