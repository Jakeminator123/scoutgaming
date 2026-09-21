'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { exportPartnerTrace, type PartnerTrace } from '../lib/partner-trace.mjs';
import type { ActivityDraft } from './activity-log';
import styles from './activity-log.module.css';

interface Configuration { configured: boolean; mappingConfigured: boolean; mappingError?: string | null; playerId: string | null; origin: string | null }
interface Access { verifiedAt: string; playerId: string; scopes: string[] }
interface Mapping { fetchedAt: string; source: string; actualPlayback: false; mapping: { revision?: string | null; dealers: Record<string, Record<string, unknown>>; backofficePicks?: unknown; notes?: string[] } }

export function PartnerReference({ trace, connected, onActivity, onImport, children }: { trace: PartnerTrace; connected: boolean; onActivity: (entry: ActivityDraft) => void; onImport?: (records: Record<string, unknown>[]) => void; children?: ReactNode }) {
  const [configuration, setConfiguration] = useState<Configuration | null>(null);
  const [access, setAccess] = useState<Access | null>(null);
  const [mapping, setMapping] = useState<Mapping | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [exportText, setExportText] = useState('');
  const gameWindow = useRef<Window | null>(null);
  const importInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    let current = true;
    fetch('/api/inputs/reference', { cache: 'no-store' }).then(async response => {
      if (!response.ok) throw new Error();
      const data = await response.json(); if (current) setConfiguration(data);
    }).catch(() => { if (current) setError('Referensspelets konfiguration kunde inte läsas.'); });
    return () => { current = false; };
  }, []);
  async function request(action: string) {
    const response = await fetch('/api/inputs/reference', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? 'API-anropet misslyckades.');
    return data;
  }
  async function run(action: 'verify' | 'launch' | 'launch-staged-base' | 'mapping') {
    if (busy) return;
    const openingGame = action === 'launch' || action === 'launch-staged-base';
    // Reuse the current player tab; a second launch must not interrupt a hand.
    if (openingGame && gameWindow.current && !gameWindow.current.closed) { gameWindow.current.focus(); setError('Spelet är redan öppet. Avsluta rundan och stäng spelfliken före byte av videoläge.'); return; }
    // Open synchronously with the user's click so popup protection does not drop the result.
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
    <span className="eyebrow">BEFINTLIGT BLACKJACK → OBSERVATION → 2D-MOCKUP</span>
    <h3>Följ spelet och videoflödet</h3>
    <p>Öppna spelet via Partner och följ det här. Växla mellan originalflikens bild och labbets presentation av samma mottagna instruktioner.</p>
    <p><strong>Spelare:</strong> {configuration?.playerId ?? 'Läses från serverkonfigurationen'}{access ? <> · Behörigheter: <strong>{access.scopes.join(', ')}</strong></> : null}</p>
    <div className={styles.tools}>
      <button className="text-button" disabled={Boolean(busy) || !configuration?.configured} onClick={() => void run('verify')}>{busy === 'verify' ? 'Verifierar…' : 'Verifiera Partner-åtkomst'}</button>
      <button className="primary-button" disabled={Boolean(busy) || !canLaunch} onClick={() => void run('launch')}>{busy === 'launch' ? 'Öppnar…' : 'Öppna referensspelet ↗'}</button>
      <button className="text-button" disabled={Boolean(busy) || !configuration?.mappingConfigured} onClick={() => void run('mapping')}>{busy === 'mapping' ? 'Hämtar…' : 'Hämta videokarta'}</button>
    </div>
    {children}
    <details className={styles.mapping}>
      <summary>Testa Astrids grundfilmer</summary>
      <p>Öppnar staged-grundläget utan smooth60 eller rhythm. Grundfilmerna är märkta för granskning. Använd detta för att jämföra videolägen efter en avslutad runda.</p>
      <button className="primary-button" disabled={Boolean(busy) || !canLaunch} onClick={() => void run('launch-staged-base')}>{busy === 'launch-staged-base' ? 'Öppnar…' : 'Öppna staged-grundläge ↗'}</button>
      <p className={styles.note}>Samma Partner-spelare används. Saknade talfiler och rundmeddelanden i Partner-strömmen kan fortfarande behöva åtgärdas separat.</p>
    </details>
    {!access ? <p className={styles.note}>Verifiera åtkomsten före spelöppning. Inga externa anrop görs när sidan öppnas.</p> : !canLaunch ? <p className={styles.note}>Nyckeln saknar launch. Den kan inte öppna referensspelet.</p> : null}
    {access && !access.scopes.includes('play') ? <p className={styles.note}>Nyckeln kan öppna spelet men saknar play för en egen klient med Partner-table. Labbet skickar inga insatser eller spelhandlingar.</p> : null}
    {!configuration?.mappingConfigured && configuration ? <p className={styles.note}>{configuration.mappingError ?? 'Videokartan behöver generations-API:ts separata lästoken, BETTALOTTO_API.'}</p> : null}
    <p className={styles.note}>En accepterad SSE-anslutning bevisar inte att rundor från referensspelet publiceras. Bekräfta att en verklig runda dyker upp här. Ingen trafik ersätts med exempeldata.</p>
    {mapping ? <details className={styles.mapping}><summary>Videokarta · {Object.keys(mapping.mapping.dealers).length} dealers · {new Date(mapping.fetchedAt).toLocaleTimeString('sv-SE')}</summary>
      <p>Serverrevision: {mapping.mapping.revision ?? 'inte angiven av servern'}. Detta är material och bindningar, inte uppspelningskvitton.</p>
      {Object.entries(mapping.mapping.dealers).map(([dealer, data]) => <details key={dealer}><summary>{dealer} · {Array.isArray(data.engine) ? data.engine.length : 0} motorklipp · {Array.isArray(data.stagedTakes) ? data.stagedTakes.length : 0} staged-takes · {Array.isArray(data.greenTakes) ? data.greenTakes.length : 0} green-takes</summary><pre>{JSON.stringify(data, null, 2)}</pre></details>)}
      <details><summary>Backoffice-val per bordsdel</summary><pre>{JSON.stringify(mapping.mapping.backofficePicks ?? {}, null, 2)}</pre></details>
      <ul>{mapping.mapping.notes?.map(note => <li key={note}>{note}</li>)}</ul>
    </details> : null}
    <div className={styles.protocol}><div><strong>Observationsprotokoll · {rounds} mottagna kommandomeddelanden</strong><p className={styles.note}>Hela mottagna presentationslistor sparas separat från den kortade loggvisningen. Protokollet finns kvar mellan labbets vyer tills sidan laddas om. {connected ? 'Observation pågår.' : 'Ingen aktiv anslutning.'}</p></div><button className="text-button" disabled={!trace.records.length && !mapping && !access} onClick={download}>Exportera observationsprotokoll</button>{onImport ? <><input ref={importInput} type="file" accept="application/json,.json" hidden onChange={event => void importObservation(event.target.files?.[0])} /><button className="text-button" disabled={connected} onClick={() => importInput.current?.click()}>Läs in observation</button></> : null}</div>
    {trace.limited ? <p role="alert">Protokollet har nått sin gräns och fångar inga fler meddelanden. Exportera det; fortsatt trafik syns endast i loggvisningen.</p> : null}
    {exportText ? <details className={styles.mapping} open><summary>JSON-export redo</summary><p className={styles.note}>Samma underlag som i JSON-filen. Du kan också markera och kopiera det här. Exportera igen för att ta med senare meddelanden.</p><textarea className={styles.exportText} aria-label="Observationsprotokoll som JSON" readOnly value={exportText} rows={8} /></details> : null}
    <p className={styles.note}>Protokollet innehåller inte originalspelarens faktiska klippstart, klippslut eller kortlandning. Dessa behöver observeras i spelaren innan sekvensen kan återges korrekt i 2D. En launch-länk och inloggningsuppgifter följer inte med exporten.</p>
    {error ? <p role="alert">{error}</p> : null}
  </section>;
}
