'use client';

import { useEffect, useRef, useState } from 'react';
import { studioHistory } from '../lib/studio-history.mjs';
import type { ConnectionStatus, DirectorMode } from './studio-types';
import { requestJson } from './studio-types';
import { VoicePreviewPanel } from './voice-preview-panel';
import styles from './gateway-panel.module.css';

import { modeLabels, modeExplanations } from '../lib/director-modes.mjs';
export { modeLabels, modeExplanations };

export function ModeSelector({ mode, onChange, configured, compact = false }: { mode: DirectorMode; onChange: (mode: DirectorMode) => void; configured: boolean; compact?: boolean }) {
  return <div className={`${styles.modeSelector} ${compact ? styles.compact : ''}`}><div className="mode-options" role="group" aria-label="Beslutsmodell">{(Object.keys(modeLabels) as DirectorMode[]).map(key => <button key={key} type="button" className={key === mode ? 'active' : ''} aria-pressed={key === mode} onClick={() => onChange(key)}><span>{modeLabels[key]}</span>{!compact ? <small>{modeExplanations[key]}</small> : null}</button>)}</div>{compact ? <p className="helper">{modeExplanations[mode]}</p> : null}{!configured && (mode === 'shadow' || mode === 'active') ? <p className="connection-warning">Ingen modellkoppling är konfigurerad. Testet använder säker standard och visar orsaken.</p> : null}</div>;
}

export function GatewayPanel({ status, mode, onModeChange, dealerId, dirty, onPlayerChat, modelsHref = '/admin/ai/models', standaloneVoicePreviewAvailable = true }: { status: ConnectionStatus; mode: DirectorMode; onModeChange: (mode: DirectorMode) => void; dealerId: string; dirty: boolean; onPlayerChat: () => void; modelsHref?:string; standaloneVoicePreviewAvailable?: boolean }) {
  const [message, setMessage] = useState('');
  const [conversationId, setConversationId] = useState('');
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; text: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const request=useRef<AbortController|null>(null);
  const unsent=useRef(false);unsent.current=dirty||Boolean(message.trim());
  useEffect(()=>{
    const owner=studioHistory(window),canLeave=()=>!unsent.current&&!request.current;
    const release=owner.guardTraversal(canLeave);
    const guard=(event:Event)=>{if(!canLeave())event.preventDefault();};
    const warn=(event:BeforeUnloadEvent)=>{if(!canLeave()){event.preventDefault();event.returnValue='';}};
    window.addEventListener('studio:before-navigate',guard);
    window.addEventListener('beforeunload',warn);
    return()=>{release();window.removeEventListener('studio:before-navigate',guard);window.removeEventListener('beforeunload',warn);request.current?.abort();request.current=null;};
  },[]);

  async function send() {
    if (!message.trim() || request.current || !status.configured) return;
    const active=new AbortController();request.current=active;
    const text = message.trim();
    const id = conversationId || `lab-operator-${crypto.randomUUID()}`;
    setConversationId(id);
    setBusy(true);
    setError('');
    setMessages(current => [...current, { role: 'user', text }]);
    setMessage('');
    try {
      const response = await requestJson<{ reply: string }>('/api/chat', { method: 'POST', signal:active.signal, body: JSON.stringify({ message: text, conversationId: id, dealerId }) });
      if(active.signal.aborted)return;
      if (typeof response.reply !== 'string' || !response.reply.trim()) throw new Error('OpenClaw returnerade inget läsbart svar.');
      setMessages(current => [...current, { role: 'assistant', text: response.reply }]);
    } catch (cause) { if(!active.signal.aborted)setError(cause instanceof Error ? cause.message : 'Chatten kunde inte nå OpenClaw.'); }
    finally { if(request.current===active){request.current=null;setBusy(false);} }
  }

  return <div className={styles.workspace}>
    <section className={styles.chat} aria-label="Dialogtest för vald dealer">
      <header><h2>Testa dialog</h2><p>Ställ en fråga med den valda dealerns sparade inställningar.</p></header>
      {dirty && <p role="note">Spara dina ändringar innan du testar dem här.</p>}
      <div className={styles.messages} aria-live="polite">
        {messages.length ? messages.map((item,index)=><div className={item.role==='user'?styles.userMessage:styles.reply} key={index}><strong>{item.role==='user'?'Du':'Dealerns agent'}</strong><p>{item.text}</p></div>) : <p className={styles.empty}>Skriv ett meddelande för att börja. Testet ändrar inga klipp eller spelregler.</p>}
        {busy && <p role="status">Väntar på svar…</p>}
      </div>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <form onSubmit={event=>{event.preventDefault();void send();}}>
        <label htmlFor="operator-message">Meddelande</label>
        <textarea id="operator-message" placeholder="Skriv till dealerns agent…" value={message} onChange={event=>setMessage(event.target.value)} rows={3} maxLength={2000} disabled={busy||!status.configured}/>
        <div className={styles.actions}><span>{status.configured?'Använder sparade inställningar':'Anslutning saknas'}</span><button disabled={busy||!status.configured||!message.trim()} type="submit">Skicka</button></div>
      </form>
    </section>
    <aside className={styles.context}>
      <h2>Anslutning</h2><p>{status.reachable===true?'Kontakt verifierad':status.configured?'Konfigurerad, kontakt ännu inte verifierad':'Ingen modell ansluten'}</p>
      {status.message && <details><summary>Anslutningsdetaljer</summary><p>{status.message}</p></details>}
      <p>Dialogtestet använder serverns svar. Spelarens chatt och spel sker i det publicerade spelrummet.</p>
      <button type="button" onClick={onPlayerChat}>Öppna spelrum</button>
      {standaloneVoicePreviewAvailable && <VoicePreviewPanel available latestReply={messages.findLast(item=>item.role==='assistant')?.text??''}/>}
    </aside>
  </div>;
}
