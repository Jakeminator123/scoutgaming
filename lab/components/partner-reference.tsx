'use client';
import { labBasePath, labUrl } from "../lib/lab-url.mjs";

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { exportPartnerTrace, type PartnerTrace } from '../lib/partner-trace.mjs';
import { acceptNativeObservation } from '../lib/native-observation.mjs';
import { scopeNativeSession } from '../lib/native-session-channel.mjs';
import { NativeSpeechContext, type NativeSpeechBinding } from './native-speech-context';
import type { ActivityDraft } from './activity-log';
import styles from './activity-log.module.css';

interface Configuration { configured: boolean; mappingConfigured: boolean; mappingError?: string | null; playerId: string | null; origin: string | null }
interface Access { verifiedAt: string; playerId: string; scopes: string[] }
interface Mapping { fetchedAt: string; source: string; actualPlayback: false; mapping: { revision?: string | null; dealers: Record<string, Record<string, unknown>>; backofficePicks?: unknown; notes?: string[] } }

export function PartnerReference({ trace, connected, connection, dealerId = 'astrid', onConnect, onDisconnect, onNative, onActivity, onImport, onNewObservation, children, diagnostics, focused = false }: { focused?: boolean; trace: PartnerTrace; connected: boolean; connection: string; dealerId?: string; onConnect: () => Promise<void>; onDisconnect: () => void; onNative: (record: Record<string, unknown>) => void; onActivity: (entry: ActivityDraft) => void; onImport?: (records: Record<string, unknown>[]) => void; onNewObservation?: () => void; children?: ReactNode; diagnostics?: ReactNode }) {
  // The cloud build mounts Studio on the game origin. Its ordinary player
  // entry is usable even when the optional Partner observer is unconfigured.
  const directGameUrl = focused && labBasePath() === '/studio' ? '/blackjack' : null;
  const [configuration, setConfiguration] = useState<Configuration | null>(null);
  const [access, setAccess] = useState<Access | null>(null);
  const [mapping, setMapping] = useState<Mapping | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [exportText, setExportText] = useState('');
  const [speechBinding, setSpeechBinding] = useState<NativeSpeechBinding | null>(null);
  const gameWindow = useRef<Window | null>(null);
  const observer = useRef<{ source: Window; origin: string; channel: string; lastSequence: number } | null>(null);
  const nativeSessionEpoch = useRef(0);
  const observing = useRef(false);
  const nativeCallback = useRef(onNative); nativeCallback.current = onNative;
  const importInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const receive = (message: MessageEvent) => {
      const expected = observer.current;
      if (!expected || !observing.current) return;
      const record = acceptNativeObservation(message, expected);
      if (!record) return;
      const scoped = focused ? scopeNativeSession(record, nativeSessionEpoch.current) : { epoch: nativeSessionEpoch.current, record };
      nativeSessionEpoch.current = scoped.epoch;
      const observed = scoped.record;
      if (record.kind === 'status' && record.data?.state === 'attached') setSpeechBinding(previous => ({
        source: expected.source, origin: expected.origin, channel: expected.channel, revision: (previous?.revision ?? 0) + 1,
      }));
      if (record.kind === 'status' && record.data?.state === 'attached' && expected.lastSequence > 0) nativeCallback.current({ source: 'native', channel: observed.channel, kind: 'status', time: record.time, data: { state: 'reconnected', gap: true, reason: 'original-page-reloaded' } });
      else if (expected.lastSequence > 0 && Number(record.nativeSequence) > expected.lastSequence + 1) nativeCallback.current({ source: 'native', channel: observed.channel, kind: 'status', time: record.time, data: { state: 'gap', gap: true, reason: 'native-sequence-gap' } });
      expected.lastSequence = record.nativeSequence;
      nativeCallback.current(observed);
    };
    window.addEventListener('message', receive);
    return () => { window.removeEventListener('message', receive); observer.current = null; };
  }, []);
  useEffect(() => {
    let current = true;
    fetch(labUrl('/api/inputs/reference'), { cache: 'no-store' }).then(async response => {
      if (!response.ok) throw new Error();
      const data = await response.json(); if (current) setConfiguration(data);
    }).catch(() => { if (current) setError('Referensspelets konfiguration kunde inte läsas.'); });
    return () => { current = false; };
  }, []);
  async function request(action: string) {
    const response = await fetch(labUrl('/api/inputs/reference'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? 'API-anropet misslyckades.');
    return data;
  }
  async function connectGame() {
    if (busy) return;
    if (gameWindow.current && !gameWindow.current.closed) {
      gameWindow.current.focus();
      if (!observer.current) {
        setError('Spelet är öppet utan studiokoppling. Spela klart och stäng spelfliken före Anslut & följ spelet. Dina sparade klippval gäller även utan observation.');
        return;
      }
      observing.current = true;
      try { await onConnect(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Strömmen kunde inte anslutas.'); }
      return;
    }
    const game = window.open('about:blank', '_blank');
    if (!game) { setError('Tillåt en ny flik för att ansluta referensspelet.'); return; }
    gameWindow.current = game;
    setBusy('connect'); setError('');
    try {
      const verified = await request('verify'); setAccess(verified);
      if (!verified.scopes.includes('launch')) throw new Error('Partner-nyckeln saknar launch och kan inte öppna referensspelet.');
      // Open the event channel before navigation so the first accepted round is
      // not lost. Native observation remains usable if upstream SSE is absent.
      try { await onConnect(); } catch (cause) {
        onActivity({ source: 'partner', stage: 'connection', status: 'failed', title: 'Partner-strömmen kunde inte startas', owner: 'Läsande anslutning', reason: 'Originalfliken öppnas med native-observation. Kontrollera att speldata börjar komma.', data: { error: cause instanceof Error ? cause.message : 'Anslutningen misslyckades' } });
      }
      const data = await request('launch');
      const url = new URL(data.url);
      if (!configuration?.origin || url.origin !== configuration.origin) throw new Error('Referensspelet gav en oväntad adress.');
      const channel = crypto.randomUUID();
      observer.current = { source: game, origin: url.origin, channel, lastSequence: 0 };
      observing.current = true;
      url.searchParams.set('labObserverOrigin', window.location.origin);
      url.searchParams.set('labObserverChannel', channel);
      url.searchParams.set('dealer', dealerId);
      if (dealerId === 'astrid') url.searchParams.set('presentation', 'local');
      game.location.replace(url.href);
      onActivity({ source: 'config', stage: 'connection', status: 'observed', title: 'Originalspel och labbföljning startade', owner: 'Partner-launch + native-observation', reason: 'Spela i originalfliken. Bilddelningen väljs i webbläsaren; data följs automatiskt.', data: { dealerId, presentationMode: data.presentationMode } });
    } catch (cause) { game.close(); gameWindow.current = null; observer.current = null; onDisconnect(); setError(cause instanceof Error ? cause.message : 'Spelet kunde inte anslutas.'); }
    finally { setBusy(''); }
  }
  function openGame() {
    if (!directGameUrl || busy) return;
    if (gameWindow.current && !gameWindow.current.closed) { gameWindow.current.focus(); return; }
    const game = window.open(directGameUrl, '_blank');
    if (!game) { setError('Tillåt en ny flik för att öppna spelet.'); return; }
    game.opener = null;
    gameWindow.current = game;
    observer.current = null;
    observing.current = false;
    setSpeechBinding(null);
    onDisconnect();
    setError('');
  }
  function disconnect() { observing.current = false; onDisconnect(); }
  async function run(action: 'verify' | 'launch' | 'launch-staged-base' | 'mapping') {
    if (busy) return;
    const openingGame = action === 'launch' || action === 'launch-staged-base';
    // Reuse the current player tab; a second launch must not interrupt a hand.
    if (openingGame && gameWindow.current && !gameWindow.current.closed) { gameWindow.current.focus(); setError('Spelet är redan öppet. Avsluta rundan och stäng spelfliken före byte av videoläge.'); return; }
    // Diagnostic launch without observation. The main Anslut flow binds the
    // trusted popup and its per-launch observation channel instead.
    const game = openingGame ? window.open('about:blank', '_blank') : null;
    if (openingGame && !game) { setError('Tillåt en ny flik för att öppna referensspelet.'); return; }
    if (game) { game.opener = null; gameWindow.current = game; }
    setBusy(action); setError('');
    try {
      const data = await request(action);
      if (action === 'verify') {
        setAccess(data);
        onActivity({ source: 'config', stage: 'connection', status: 'observed', title: 'Partner-behörigheter verifierade', owner: 'Bettalotto / ping', reason: 'Verifierar åtkomst; inga spelkommandon skickades.', data: { scopes: data.scopes, verifiedAt: data.verifiedAt } });
      } else if (action === 'mapping') {
        setMapping(data);
        onActivity({ source: 'partner', stage: 'configuration', status: 'observed', title: 'Aktuell videokarta hämtad', owner: 'Generations-API / mapping', reason: 'Visar registrerat material och BO-val. Bevisar inte vilket klipp som faktiskt spelades.', data: { source: data.source, fetchedAt: data.fetchedAt, revision: data.mapping.revision ?? null, actualPlayback: false, dealers: Object.keys(data.mapping.dealers) } });
      } else if (game) {
        game.location.replace(data.url);
        onActivity({ source: 'config', stage: 'connection', status: 'observed', title: action === 'launch-staged-base' ? 'Astrids staged-grundläge öppnat i egen flik' : 'Referensspelet öppnat i egen flik', owner: 'Partner-launch', reason: 'Samma konfigurerade spelare som eventströmmen. Öppningen är ingen registrerad spelrunda.', data: { expiresIn: data.expiresIn, presentationMode: data.presentationMode } });
      }
    } catch (cause) {
      game?.close();
      setError(cause instanceof Error ? cause.message : 'Referensspelet kunde inte nås.');
    } finally { setBusy(''); }
  }
  function download() {
    const content = exportPartnerTrace(trace, { access, videoMapping: mapping });
    const json = JSON.stringify(content, null, 2);
    setExportText(json);
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = `croupier-observation-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    document.body.append(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function importObservation(file?: File) {
    if (!file || !onImport) return;
    setError('');
    try {
      if (file.size > 4 * 1024 * 1024) throw new Error('Observationen får vara högst 4 MiB.');
      const value = JSON.parse(await file.text());
      if (value?.kind !== 'croupier-partner-observation' || value.schemaVersion !== 1 || !Array.isArray(value.records) || value.records.length > 300 || !value.records.every((record: unknown) => record && typeof record === 'object' && !Array.isArray(record))) throw new Error('Välj en exporterad Croupier-observation med högst 300 poster.');
      onImport(value.records.map((record: Record<string, unknown>) => ({ ...record, origin: 'import' })));
      onActivity({ source: 'partner', stage: 'input', status: 'observed', title: 'Sparad observation inläst', owner: 'Importerad observation', reason: 'Historiska instruktioner, ingen ny live-runda.', data: { records: value.records.length } });
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Observationen kunde inte läsas.'); }
    finally { if (importInput.current) importInput.current.value = ''; }
  }
  const rounds = trace.records.filter(record => record.kind === 'round').length;
  const canLaunch = access?.scopes.includes('launch');
  return <section className={styles.reference} aria-label="Referensspel och observationsprotokoll">
    <span className="eyebrow">{dealerId === 'astrid' ? 'ETT SPEL · EN PRESENTATION' : 'ETT SPEL · TVÅ PRESENTATIONER'}</span>
    <h3>{dealerId === 'astrid' ? 'Spela i spelfliken. Konfigurera och följ i Studio.' : 'Originalet och labbet, sida vid sida'}</h3>
    <p>{dealerId === 'astrid' ? 'Astrid använder studions gemensamma klippfamiljer. Spela och chatta i spelfliken. Anslut & följ spelet öppnar dessutom observation så att klippval och uppspelningskvitton visas här.' : 'Anslut öppnar rätt spelarsession och följer dess speldata. Spela i originalfliken; här ser du samma instruktioner, labbets variantval och faktisk uppspelning.'}</p>
    <div className={styles.tools}>{directGameUrl ? <a className="primary-button" href={directGameUrl} target="_blank" rel="noopener" onClick={event => { event.preventDefault(); openGame(); }}>Öppna spelet ↗</a> : null}<button className={directGameUrl ? 'text-button' : 'primary-button'} disabled={Boolean(busy) || !configuration?.configured} onClick={() => connected ? disconnect() : void connectGame()}>{busy === 'connect' ? 'Ansluter…' : connected ? 'Koppla från' : focused ? 'Anslut & följ spelet' : 'Anslut'}</button><strong role="status">{connection}</strong></div>
    {!configuration?.configured ? <p className={styles.note}>{configuration ? directGameUrl ? 'Studions observation är inte konfigurerad. Öppna spelet fungerar ändå med vanlig spelarinloggning och sparade klippval.' : 'Partner-konfiguration saknas eller är ogiltig. Se Diagnostik.' : 'Läser anslutningsinställningar…'}</p> : null}
    {error ? <p role="alert">{error}</p> : null}
    <NativeSpeechContext.Provider value={{ binding: speechBinding, connected }}>{children}</NativeSpeechContext.Provider>
    <details className={styles.mapping}><summary>{focused ? 'Diagnostik · anslutning och observationsfiler' : 'Diagnostik · videokarta, anslutning och observationsfiler'}</summary>
    <p><strong>{focused ? "Teknisk launch-identitet:" : "Spelare:"}</strong> {configuration?.playerId ?? 'Läses från serverkonfigurationen'}{access ? <> · Behörigheter: <strong>{access.scopes.join(', ')}</strong></> : null}</p>
    <div className={styles.tools}>
      <button className="text-button" disabled={Boolean(busy) || !configuration?.configured} onClick={() => void run('verify')}>{busy === 'verify' ? 'Verifierar…' : 'Verifiera Partner-åtkomst'}</button>
      {!focused ? <><button className="primary-button" disabled={Boolean(busy) || !canLaunch} onClick={() => void run('launch')}>{busy === 'launch' ? 'Öppnar…' : 'Öppna referensspelet ↗'}</button>
      <button className="text-button" disabled={Boolean(busy) || !configuration?.mappingConfigured} onClick={() => void run('mapping')}>{busy === 'mapping' ? 'Hämtar…' : 'Hämta videokarta'}</button></> : null}
    </div>
    {diagnostics}
    {!focused ? <details className={styles.mapping}>
      <summary>Testa Astrids grundfilmer</summary>
      <p>Öppnar staged-grundläget utan smooth60 eller rhythm. Grundfilmerna är märkta för granskning. Använd detta för att jämföra videolägen efter en avslutad runda.</p>
      <button className="primary-button" disabled={Boolean(busy) || !canLaunch} onClick={() => void run('launch-staged-base')}>{busy === 'launch-staged-base' ? 'Öppnar…' : 'Öppna staged-grundläge ↗'}</button>
      <p className={styles.note}>Samma Partner-spelare används. Saknade talfiler och rundmeddelanden i Partner-strömmen kan fortfarande behöva åtgärdas separat.</p>
    </details> : null}
    {!access ? <p className={styles.note}>Verifiera åtkomsten före spelöppning. Inga externa anrop görs när sidan öppnas.</p> : !canLaunch ? <p className={styles.note}>Nyckeln saknar launch. Den kan inte öppna referensspelet.</p> : null}
    {!focused && access && !access.scopes.includes('play') ? <p className={styles.note}>Nyckeln kan öppna spelet men saknar play för en egen klient med Partner-table. Labbet skickar inga insatser eller spelhandlingar.</p> : null}
    {!focused && !configuration?.mappingConfigured && configuration ? <p className={styles.note}>{configuration.mappingError ?? 'Videokartan behöver generations-API:ts separata lästoken, BETTALOTTO_API.'}</p> : null}
    {focused ? <p className={styles.note}>Launch-identiteten används för att öppna spelet. Profilen du väljer i Astrids flik äger ditt spel och minne; den flikens faktiska händelser visas här.</p> : <p className={styles.note}>En accepterad SSE-anslutning bevisar inte att rundor från referensspelet publiceras. Bekräfta att en verklig runda dyker upp här. Ingen trafik ersätts med exempeldata.</p>}
    {mapping ? <details className={styles.mapping}><summary>Videokarta · {Object.keys(mapping.mapping.dealers).length} dealers · {new Date(mapping.fetchedAt).toLocaleTimeString('sv-SE')}</summary>
      <p>Serverrevision: {mapping.mapping.revision ?? 'inte angiven av servern'}. Detta är material och bindningar, inte uppspelningskvitton.</p>
      {Object.entries(mapping.mapping.dealers).map(([dealer, data]) => <details key={dealer}><summary>{dealer} · {Array.isArray(data.engine) ? data.engine.length : 0} motorklipp · {Array.isArray(data.stagedTakes) ? data.stagedTakes.length : 0} staged-takes · {Array.isArray(data.greenTakes) ? data.greenTakes.length : 0} green-takes</summary><pre>{JSON.stringify(data, null, 2)}</pre></details>)}
      <details><summary>Backoffice-val per bordsdel</summary><pre>{JSON.stringify(mapping.mapping.backofficePicks ?? {}, null, 2)}</pre></details>
      <ul>{mapping.mapping.notes?.map(note => <li key={note}>{note}</li>)}</ul>
    </details> : null}
    <div className={styles.protocol}><div><strong>Observationsprotokoll · {trace.rolling ? `${trace.records.length} senaste poster · ${rounds} spelkommandon` : `${rounds} mottagna kommandomeddelanden`}</strong><p className={styles.note}>{trace.rolling ? "Live-observationen fortsätter löpande. De senaste 300 posterna sparas med hela presentationslistor; äldre poster lämnar fönstret med en tydlig luckmarkering i exporten." : "Hela mottagna presentationslistor sparas separat från den kortade loggvisningen. Protokollet finns kvar mellan labbets vyer tills sidan laddas om."} {connected ? 'Observation pågår.' : 'Ingen aktiv anslutning.'}</p></div><button className="text-button" disabled={!trace.records.length && !mapping && !access} onClick={download}>Exportera observationsprotokoll</button>{onImport ? <><input ref={importInput} type="file" accept="application/json,.json" hidden onChange={event => void importObservation(event.target.files?.[0])} /><button className="text-button" disabled={connected} onClick={() => importInput.current?.click()}>Läs in observation</button></> : null}</div>
    {onNewObservation ? <div className={styles.protocol}><div><strong>Börja en ny historik här</strong><p className={styles.note}>Exportera först om du vill behålla protokollet. Ny observation ersätter dess {trace.records.length} poster{focused ? "." : " och avbryter labbets gamla uppspelningskö."} Spelet, anslutningen och bilddelningen behålls; bara framtida instruktioner följs.</p></div><button className="text-button" disabled={Boolean(busy)} onClick={() => { setExportText(''); onNewObservation(); }}>Ny observation</button></div> : null}
    {trace.rolling && (trace.droppedRecords ?? 0) > 0 ? <p role="status">Observation pågår. {trace.droppedRecords} äldre poster har lämnat det rullande fönstret och ingår inte i nästa export.</p> : null}
    {trace.limited ? <p role="alert">Protokollet har nått sin gräns och fångar inga fler meddelanden. Exportera det och välj Ny observation för att fortsätta följa kommande händer.</p> : null}
    {exportText ? <details className={styles.mapping} open><summary>JSON-export redo</summary><p className={styles.note}>Samma underlag som i JSON-filen. Du kan också markera och kopiera det här. Exportera igen för att ta med senare meddelanden.</p><textarea className={styles.exportText} aria-label="Observationsprotokoll som JSON" readOnly value={exportText} rows={8} /></details> : null}
    <p className={styles.note}>{focused ? "Protokollet följer Astrids verkliga spelflik. Det innehåller offentliga serversvar, chatt och uppspelningskvitton." : "Native-observation kan komplettera Partner-instruktionerna med originalets offentliga serversvar, chatt och uppspelningskvitton. Äldre serverversioner kan sakna detta."} Launch-länk och inloggningsuppgifter följer inte med exporten.</p>
    </details>
  </section>;
}
