'use client';

import { useState } from 'react';
import type { ConnectionStatus, DirectorMode } from './studio-types';
import { requestJson } from './studio-types';
import { VoicePreviewPanel } from './voice-preview-panel';
import { OpenClawSources } from './openclaw-sources';

import { modeLabels, modeExplanations } from '../lib/director-modes.mjs';
export { modeLabels, modeExplanations };

export function ModeSelector({ mode, onChange, configured, compact = false }: { mode: DirectorMode; onChange: (mode: DirectorMode) => void; configured: boolean; compact?: boolean }) {
  return <div className={`mode-selector ${compact ? 'compact' : ''}`}><div className="mode-options" role="group" aria-label="Beslutsmodell">{(Object.keys(modeLabels) as DirectorMode[]).map(key => <button key={key} type="button" className={key === mode ? 'active' : ''} aria-pressed={key === mode} onClick={() => onChange(key)}><span>{modeLabels[key]}</span>{!compact ? <small>{modeExplanations[key]}</small> : null}</button>)}</div>{compact ? <p className="helper">{modeExplanations[mode]}</p> : null}{!configured && (mode === 'shadow' || mode === 'active') ? <p className="connection-warning">Ingen modellkoppling är konfigurerad. Testet använder säker standard och visar orsaken.</p> : null}</div>;
}

export function GatewayPanel({ status, mode, onModeChange, dealerId, dirty, onPlayerChat, standaloneVoicePreviewAvailable = true }: { status: ConnectionStatus; mode: DirectorMode; onModeChange: (mode: DirectorMode) => void; dealerId: string; dirty: boolean; onPlayerChat: () => void; standaloneVoicePreviewAvailable?: boolean }) {
  const [message, setMessage] = useState('');
  const [conversationId, setConversationId] = useState('');
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; text: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');


  async function send() {
    if (!message.trim() || busy) return;
    const text = message.trim();
    const id = conversationId || `lab-operator-${crypto.randomUUID()}`;
    setConversationId(id);
    setBusy(true);
    setError('');
    setMessages(current => [...current, { role: 'user', text }]);
    setMessage('');
    try {
      const response = await requestJson<{ reply: string }>('/api/chat', { method: 'POST', body: JSON.stringify({ message: text, conversationId: id, dealerId }) });
      if (typeof response.reply !== 'string' || !response.reply.trim()) throw new Error('OpenClaw returnerade inget läsbart svar.');
      setMessages(current => [...current, { role: 'assistant', text: response.reply }]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Chatten kunde inte nå OpenClaw.'); }
    finally { setBusy(false); }
  }

  return <div className="gateway-workspace"><section className="chat-choices" aria-label="Välj chatt"><div><span className="eyebrow">SOM SPELARE</span><h2>Bordets spelarchatt</h2><p>Anslut originalspelet och chatta med dess spelarsession och offentliga kort som underlag. Labbet visar svaret när dealern är i standardposition.</p><button className="text-button" onClick={onPlayerChat}>Öppna bordschatten →</button></div><div><span className="eyebrow">SOM BYGGARE</span><h2>Fråga OpenClaw</h2><p>Diskutera det sparade labbprojektet. Chatten ändrar inte dina regler eller filer.</p><a className="text-button" href="#operator-chat">Till operatörschatten ↓</a></div></section>
    <div className="gateway-layout"><aside className="operator-chat" id="operator-chat" aria-label="Operatörschatt med OpenClaw"><div className="chat-heading"><span className="eyebrow">OPERATÖRSCHATT</span><h2>Äldre OpenClaw-rådgivare</h2><p>Den här chatten skickar frågor via Director på Render och kan inte ändra systemet. För drift och granskade modelländringar: <button type="button" data-scout-assistant="openclaw">Öppna Adminroboten · OpenClaw</button></p><p>För dig som bygger labbet. Inte spelarchatten.</p><p className="chat-project-note">Chatten läser det senast sparade projektet.{dirty ? ' Du har osparade ändringar – spara först för att ta med dem.' : ''}</p></div><div className="chat-messages" aria-live="polite">{messages.length ? messages.map((item, index) => <div className={`chat-message ${item.role}`} key={index}><span>{item.role === 'user' ? 'DU' : 'OPENCLAW'}</span><p>{item.text}</p></div>) : <div className="chat-empty"><span aria-hidden="true">✳</span><h3>Fråga om ditt upplägg.</h3><p>Svaret kommer från den konfigurerade servern. Inga svar simuleras här.</p><button className="suggested-prompt" onClick={() => setMessage('Förklara mycket kort vilken kontroll du har över varianter i Croupier-labbet.')}>Vad får du bestämma över? ↗</button></div>}{busy ? <div className="chat-pending">Väntar på OpenClaw…</div> : null}</div>{error ? <p className="inline-error" role="alert">{error}</p> : null}<form onSubmit={event => { event.preventDefault(); void send(); }}><label className="sr-only" htmlFor="operator-message">Meddelande till OpenClaw</label><textarea id="operator-message" placeholder={status.configured ? 'Skriv till OpenClaw…' : 'Konfigurera serverkopplingen först…'} value={message} onChange={event => setMessage(event.target.value)} rows={3} maxLength={2000} disabled={busy || !status.configured} /><div className="chat-send-row"><span>Ingen nyckel i webbläsaren</span><button className="primary-button" disabled={busy || !status.configured || !message.trim()} type="submit">Skicka ↑</button></div></form></aside><section className="gateway-main"><div className="connection-summary"><div className="claw-symbol" aria-hidden="true">✳</div><div><span className="eyebrow">SERVERKOPPLING</span><h2>{status.configured ? 'OpenClaw är konfigurerat' : 'Lokalt läge · ingen modellkoppling'}</h2><p>{status.message ?? 'Status beskriver konfigurationen. En verklig körning verifierar om Gatewayn svarar.'}</p></div><span className={`status-pill ${status.configured ? 'configured' : ''}`}>{status.reachable === true ? 'Kontakt verifierad' : status.configured ? 'Inte hälsotestad' : 'Ej ansluten'}</span></div>
      <div className="gateway-flow"><div><span className="flow-index">01</span><strong>Labb → server</strong><p>Ditt event och en avgränsad testkontext.</p></div><span aria-hidden="true">→</span><div><span className="flow-index">02</span><strong>OpenClaw</strong><p>Ett förslag bland redan tillåtna varianter.</p></div><span aria-hidden="true">→</span><div><span className="flow-index">03</span><strong>Kontroll → visning</strong><p>Valet valideras. Fel ger säker standard.</p></div></div>
      <details className="gateway-diagnostics"><summary>Urvalsläge · {modeLabels[mode]}</summary><p className="helper">Börja med standardfilen. Aktivera regler, slump eller OpenClaw när familjen har granskade varianter som får väljas.</p><ModeSelector mode={mode} onChange={onModeChange} configured={Boolean(status.configured)} /></details>
      <details className="gateway-diagnostics"><summary>Ansvar, spelarminne och dashboard</summary><div className="authority-grid"><div><span className="eyebrow">KAN PÅVERKA</span><h3>Presentationen</h3><ul><li>Val av en redan tillåten variant</li><li>Ton, hälsning och ett granskat uttryck</li><li>Test av chatt- och preferenssignaler</li></ul></div><div><span className="eyebrow">KAN INTE PÅVERKA</span><h3>Spelets sanning</h3><ul><li>RNG, kort, resultat eller utbetalningar</li><li>Ändra dina policyfiler via denna chatt</li><li>Välja en otillåten eller påhittad video</li></ul></div></div>
      <div className="notice"><strong>Skilj på bordschatt och fristående chattprov.</strong><p>Bordschatten använder originalspelets serverägda underlag; eventuellt spelarminne hanteras i originalspelets inställningar. Eventstudions testsignaler och fristående chattprov är separata och är inte bevis på vad som hänt vid bordet. IDE-agenternas GitLab-inbox hör inte till detta system.</p></div>
      <a className="external-link" href="/admin/ai/models">OpenClaw-modeller och dashboard <span aria-hidden="true">↗</span></a><p className="helper">Dashboarden hanterar agenter och verktyg. Labbets editor hanterar event, regler och videokopplingar.</p>
      </details><VoicePreviewPanel available={standaloneVoicePreviewAvailable} latestReply={messages.findLast(item => item.role === 'assistant')?.text ?? ''} />
      <OpenClawSources />
    </section></div>
  </div>;
}
