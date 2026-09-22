'use client';

import { useEffect, useRef, useState } from 'react';
import type { ActivityDraft } from './activity-log';
import styles from './game-stream.module.css';

/** The browser owns tab selection and permission. No screen data leaves it. */
export function ReferenceCapture({ onActivity }: { onActivity: (entry: ActivityDraft) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const generation = useRef(0);
  const [sharing, setSharing] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState('');
  function stop() {
    generation.current++;
    stream.current?.getTracks().forEach(track => track.stop());
    stream.current = null;
    if (video.current) video.current.srcObject = null;
    setSharing(false); setRequesting(false);
  }
  useEffect(() => () => { generation.current++; stream.current?.getTracks().forEach(track => track.stop()); }, []);
  async function start() {
    if (requesting || stream.current) return;
    if (!navigator.mediaDevices?.getDisplayMedia) { setError('Öppna labbet i Chrome eller Edge för att visa spelfliken här. Referensspelet fungerar fortfarande i sin egen flik.'); return; }
    const request = ++generation.current;
    setError(''); setRequesting(true);
    try {
      const next = await navigator.mediaDevices.getDisplayMedia({ video: { displaySurface: 'browser' }, audio: false });
      if (request !== generation.current) { next.getTracks().forEach(track => track.stop()); return; }
      stream.current = next;
      next.getVideoTracks()[0]?.addEventListener('ended', () => {
        if (stream.current !== next) return;
        stop();
        onActivity({ source: 'player', stage: 'connection', status: 'cancelled', title: 'Visning av spelfliken stoppad', owner: 'Webbläsaren', reason: 'Bildströmmen avslutades. Partner-observationen är separat.' });
      }, { once: true });
      if (video.current) { video.current.srcObject = next; await video.current.play(); }
      if (request !== generation.current || stream.current !== next || !next.active) return;
      setSharing(true);
      onActivity({ source: 'player', stage: 'connection', status: 'observed', title: 'Vald flik visas i labbet', owner: 'Webbläsarens bildström', reason: 'Lokal bildvisning utan inspelning eller uppladdning. Bekräftar inte klipp-ID eller Partner-events.' });
    } catch (cause) {
      if (request !== generation.current) return;
      stop();
      setError(cause instanceof DOMException && cause.name === 'NotAllowedError' ? 'Ingen flik valdes. Du kan försöka igen när referensspelet är öppet.' : 'Spelfliken kunde inte visas. Använd referensspelets egen flik.');
    } finally { if (request === generation.current) setRequesting(false); }
  }
  return <div className={styles.capture}>
    <video ref={video} autoPlay playsInline muted hidden={!sharing} aria-label="Direktbild från vald spelflik" />
    {!sharing ? <div className={styles.empty}><span aria-hidden="true">♠</span><strong>Originalspelets bild</strong><p>Anslut öppnar spelet. Välj sedan dess flik nedan för att visa bilden här. Webbläsaren kräver ditt val; speldata och labbet fungerar även utan bilddelning.</p></div> : null}
    <div className={styles.toolbar}><button className="text-button" disabled={requesting} onClick={() => sharing ? stop() : void start()}>{sharing ? 'Sluta visa spelfliken' : requesting ? 'Välj spelflik i webbläsaren…' : 'Visa spelfliken här'}</button><small>Bilden stannar i din webbläsare. Ljudet hörs från originalfliken.</small></div>
    {error ? <p role="status">{error}</p> : null}
  </div>;
}
