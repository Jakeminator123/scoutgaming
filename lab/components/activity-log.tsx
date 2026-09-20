'use client';

import { useEffect, useRef, useState } from 'react';
import { eventSummary, type ActivityEntry } from '../lib/activity-log.mjs';
import styles from './activity-log.module.css';

export type ActivityDraft = Omit<ActivityEntry, 'id' | 'time'>;
interface PartnerStatus { configured: boolean; missing: string[]; invalid: string[]; endpoint: string | null }
const sourceNames = { lab: 'Labbexempel', manual: 'Manuellt val', social: 'Socialt prov', partner: 'Partner live', player: 'Labbspelare', config: 'Konfiguration' };
const stageNames = { input: 'Indata', decision: 'Beslut', playback: 'Uppspelning', connection: 'Anslutning', configuration: 'Konfiguration' };
const statusNames = { received: 'Mottaget', waiting: 'Väntar', selected: 'Valt', started: 'Startat', completed: 'Avslutat', failed: 'Fel / reserv', cancelled: 'Avbrutet', observed: 'Observerat' };

export function ActivityLog({ entries, onActivity, onClear, full = false, onOpen }: { entries: ActivityEntry[]; onActivity: (entry: ActivityDraft) => void; onClear: () => void; full?: boolean; onOpen: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [filter, setFilter] = useState('all');
  const [configuration, setConfiguration] = useState<PartnerStatus | null>(null);
  const [connection, setConnection] = useState('Frånkopplad');
  const [statusError, setStatusError] = useState('');
  const stream = useRef<EventSource | null>(null);
  const [connected, setConnected] = useState(false);

  async function readConfiguration() {
    setStatusError('');
    try {
      const response = await fetch('/api/inputs', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error('Anslutningsstatus kunde inte läsas.');
      setConfiguration(data);
    } catch { setStatusError('Anslutningsstatus kunde inte läsas. Labbets egen logg fungerar ändå.'); }
  }
  useEffect(() => { void readConfiguration(); return () => { stream.current?.close(); }; }, []);

  function disconnect(user = true) {
    stream.current?.close(); stream.current = null; setConnected(false); setConnection('Frånkopplad');
    if (user) onActivity({ source: 'partner', stage: 'connection', status: 'cancelled', title: 'Observation stoppad', owner: 'Du', reason: 'Ingen historik hämtas i efterhand. Nästa anslutning kan ha en lucka.', data: { replay: false } });
  }
  function connect() {
    if (stream.current || !configuration?.configured) return;
    const next = new EventSource('/api/inputs/events'); stream.current = next;
    setConnected(true); setConnection('Ansluter…');
    next.addEventListener('status', message => {
      if (stream.current !== next) return;
      try {
        const envelope = JSON.parse((message as MessageEvent).data);
        const data = envelope.data ?? {};
        const state = data.state;
        setConnection(state === 'connected' ? 'Ansluten · endast observation' : state === 'connecting' ? 'Ansluter…' : 'Frånkopplad / lucka');
        onActivity({ source: 'partner', stage: 'connection', status: state === 'error' ? 'failed' : 'observed', title: state === 'connected' ? 'Partner-ström ansluten' : 'Partner-anslutning', owner: 'Läsande anslutning', reason: String(data.reason ?? 'Strömmen saknar replay. Inget spel eller urval körs från loggen.'), data });
        if (state === 'error' || state === 'disconnected') { next.close(); stream.current = null; setConnected(false); }
      } catch { setStatusError('Ett anslutningsmeddelande kunde inte läsas.'); }
    });
    next.addEventListener('input', message => {
      if (stream.current !== next) return;
      try {
        const envelope = JSON.parse((message as MessageEvent).data);
        const data = envelope.data ?? {};
        onActivity({ source: 'partner', stage: 'input', status: 'observed', runId: typeof data.requestId === 'string' ? data.requestId : envelope.id, title: `Publicerad runda · ${data.op ?? envelope.kind}`, owner: 'Partner API / spelserver', reason: 'Verkligt mottagen data. Presentationslistan är instruktioner; inget har spelats upp av labbet.', data: { receivedAt: envelope.time, upstreamId: envelope.upstreamId, ...data } });
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
  }

  const visible = entries.filter(entry => filter === 'all' || entry.stage === filter).slice(full ? -150 : -5).reverse();
  return <section className={styles.panel} aria-label="Händelselogg i realtid">
    <header className={styles.header}><div><span className="eyebrow">INDATA → BESLUT → UPPSPELNING</span><h2>Händelselogg <small>{entries.length}/150</small></h2><p>Det som faktiskt händer i den här fliken. Källan och beslutsfattaren följer varje steg.</p></div><div className={styles.tools}>{!full ? <><button className="text-button" onClick={() => setExpanded(value => !value)}>{expanded ? 'Fäll ihop' : 'Visa senaste'}</button><button className="text-button" onClick={onOpen}>Öppna loggen →</button></> : <button className="text-button" disabled={!entries.length} onClick={onClear}>Töm visningen</button>}</div></header>
    {full || expanded ? <>
      {full ? <div className={styles.connection}><div><h3>Verklig Partner-ström</h3><p>Separat från labbproven. Läser endast events för den konfigurerade API-nyckeln och partnerns playerId. Vanliga spelklientens anrop ingår inte.</p><strong>{connection}</strong><p className={styles.note}>Anslutningen spelar inga rundor och driver inte scenen. Avbrott markeras som luckor; servern har ingen replay.</p></div><div><button className="primary-button" disabled={!configuration?.configured && !connected} onClick={() => connected ? disconnect() : connect()}>{connected ? 'Koppla från' : 'Anslut läsande'}</button><button className="text-button" onClick={() => void readConfiguration()}>Läs om konfiguration</button>{!configuration?.configured ? <p className={styles.note}>Ej ansluten. {!configuration ? 'Läser konfiguration…' : [configuration.missing.length ? `Saknas: ${configuration.missing.join(', ')}.` : '', configuration.invalid.length ? `Kontrollera format: ${configuration.invalid.join(', ')}.` : ''].filter(Boolean).join(' ')} Uppgifterna stannar på den lokala servern.</p> : <p className={styles.note}>Uppgifterna har godkänt format. Behörighet verifieras först vid anslutning.</p>}{statusError ? <p role="alert">{statusError}</p> : null}</div></div> : null}
      <div className={styles.filters} role="group" aria-label="Filtrera logg"><button aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>Alla</button>{Object.entries(stageNames).map(([id, label]) => <button key={id} aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}</button>)}</div>
      {!visible.length ? <p className={styles.empty}>Inga registrerade händelser i detta urval. Kör Testa event, spela en variant, använd chatten eller anslut den läsande strömmen. Inga exempelrader visas som verkliga händelser.</p> : <ol className={styles.timeline}>{visible.map(entry => <li key={entry.id} data-status={entry.status}><div className={styles.timestamp}><time dateTime={entry.time}>{new Date(entry.time).toLocaleTimeString('sv-SE')}</time><span>{stageNames[entry.stage]}</span></div><div className={styles.body}><div className={styles.tags}><span>{sourceNames[entry.source]}</span><span>{statusNames[entry.status]}</span></div><h3>{entry.title}</h3><p><strong>Vem:</strong> {entry.owner}. <strong>Varför:</strong> {entry.reason}</p>{entry.runId ? <small className={styles.run}>Förlopp {entry.runId}</small> : null}{entry.data != null ? <details><summary>Visa faktisk data och fält</summary><pre>{JSON.stringify(entry.data, null, 2)}</pre></details> : null}</div></li>)}</ol>}
      <p className={styles.note}>Tillfällig logg i minnet, högst 150 poster. Den töms vid omladdning och är ingen komplett spelhistorik. Stora listor och objekt kortas med en $logTruncation-markör från loggvisningen som visar totalt, visat och utelämnat antal. Ett valt klipp eller avslutad preview innebär inte godkänd läppsynk.</p>
    </> : <p className={styles.latest} aria-live="polite">{entries.length ? `${sourceNames[entries.at(-1)!.source]} · ${entries.at(-1)!.title} — ${statusNames[entries.at(-1)!.status]}` : 'Redo att registrera labbets verkliga anrop och uppspelningshändelser.'}</p>}
  </section>;
}
