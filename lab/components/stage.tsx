'use client';

import { useEffect, useEffectEvent, useRef, useState, type CSSProperties } from 'react';
import type { StudioAsset, StudioEvent } from '../lib/studio-model.mjs';
import { getMotionClip, motionAllowedForSource, stageBaseAnimation } from '../lib/motion-library.mjs';
import { playMotion } from '../lib/motion-player.mjs';
import { OriginalMediaPlayer } from './original-media-player';
import type { OriginalMediaEntry } from '../lib/original-media.mjs';
import motionStyles from './stage-motion.module.css';

export interface PlaybackReceipt { phase: 'started' | 'completed' | 'failed' | 'fallback'; medium: 'video' | '2d'; playId?: number; reason?: string; durationMs?: number; currentTimeMs?: number }

function PlayingCard({ rank, suit, back = false, className = '' }: { rank: string; suit: string; back?: boolean; className?: string }) {
  return <div className={`playing-card ${back ? 'card-back' : ''} ${suit === '♥' || suit === '♦' ? 'red-suit' : ''} ${className}`}>
    {back ? <span className="card-monogram">C</span> : <><span className="card-corner">{rank}<small>{suit}</small></span><span className="card-suit">{suit}</span><span className="card-corner card-corner-bottom">{rank}<small>{suit}</small></span></>}
  </div>;
}

export function Stage({ event, asset, dealer, variantLabel, playId, playing, hasResult, onPlay, busy, videoUrl, videoName, videoMissing = false, originalMedia, sourceIsObserved = false, onPreview, previewing = false, previewLabel = 'Spela vald variant', onPlaybackEnd, onPlaybackEvent, blocked = false }: {
  event: StudioEvent;
  asset?: StudioAsset;
  dealer: string;
  variantLabel: string;
  playId: number;
  playing: boolean;
  hasResult: boolean;
  onPlay: () => void;
  busy: boolean;
  videoUrl?: string;
  videoName?: string;
  videoMissing?: boolean;
  originalMedia?: OriginalMediaEntry | null;
  sourceIsObserved?: boolean;
  onPreview?: () => void;
  previewing?: boolean;
  previewLabel?: string;
  onPlaybackEnd?: () => void;
  onPlaybackEvent?: (receipt: PlaybackReceipt) => void;
  blocked?: boolean;
}) {
  const [preview, setPreview] = useState<'animation' | 'video'>('video');
  const [failedVideo, setFailedVideo] = useState('');
  const [failedOriginal, setFailedOriginal] = useState('');
  const sceneRef = useRef<HTMLDivElement>(null);
  const actorRef = useRef<HTMLDivElement>(null);
  const faceRef = useRef<HTMLDivElement>(null);
  const leftArmRef = useRef<HTMLDivElement>(null);
  const rightArmRef = useRef<HTMLDivElement>(null);
  const blushRef = useRef<HTMLSpanElement>(null);
  const sadFaceRef = useRef<HTMLSpanElement>(null);
  const coverHandsRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoTurn = useRef<{ identity: string; phase: 'ready' | 'playing' | 'completed' | 'cancelled' | 'failed' } | null>(null);
  const originalIdentity = `${originalMedia?.id}:${playId}`;
  const showOriginal = preview === 'video' && !videoUrl && !videoMissing && Boolean(originalMedia?.available) && failedOriginal !== originalIdentity;
  const showFileVideo = preview === 'video' && Boolean(videoUrl) && failedVideo !== videoUrl;
  const showVideo = showOriginal || showFileVideo;
  const mediaName = showOriginal ? originalMedia?.label : videoName;
  const videoIdentity = JSON.stringify([event.id, dealer, videoUrl, playId, showVideo, blocked]);
  if (videoTurn.current?.identity !== videoIdentity) videoTurn.current = { identity: videoIdentity, phase: 'ready' };
  const turn = videoTurn.current;
  const isCurrentVideo = (element: HTMLVideoElement) => videoTurn.current === turn && videoRef.current === element && showVideo && !blocked;
  const fallbackReason = preview === 'animation' ? 'Bara 2D valt' : failedOriginal === originalIdentity ? 'Originalklippet kunde inte spelas · visar 2D-reserv' : failedVideo && failedVideo === videoUrl ? 'Videon kunde inte spelas · visar 2D-reserv' : videoMissing ? 'Kopplad fil saknas · visar 2D-reserv' : 'Ingen video för denna situation · visar 2D-reserv';
  const requestedClip = getMotionClip(asset?.id);
  const clip = motionAllowedForSource(requestedClip, event.sourceType) ? requestedClip : undefined;
  const durationMs = asset?.durationMs ?? clip?.durationMs ?? 1700;
  const animation = stageBaseAnimation(event, asset?.animation);
  const shouldAnimate = playing && (hasResult || previewing);
  const reportPlaybackEnd = useEffectEvent((finishedId: number) => { if (finishedId === playId) onPlaybackEnd?.(); });
  const reportPlayback = useEffectEvent((receipt: PlaybackReceipt) => onPlaybackEvent?.(receipt));
  const eventCard = event.exampleEvent.card as { r?: string; s?: string } | null | undefined;
  const rank = eventCard?.r ?? (sourceIsObserved ? '' : 'A');
  const suit = eventCard?.s ?? (sourceIsObserved ? '' : '♠');
  const isConcealed = event.exampleEvent.faceDown === true;
  const hasPublishedCard = isConcealed || Boolean(eventCard?.r && eventCard?.s);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || showVideo || !shouldAnimate || playId === 0) return;
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    let completed = false;
    const finish = () => { if (!completed) { completed = true; reportPlayback({ playId, phase: 'completed', medium: '2d', durationMs: preference.matches ? 0 : durationMs }); reportPlaybackEnd(playId); } };
    reportPlayback({ playId, phase: 'started', medium: '2d', durationMs: preference.matches ? 0 : durationMs, reason: fallbackReason });
    if (!clip) {
      const fallback = window.setTimeout(finish, preference.matches ? 0 : durationMs);
      return () => { completed = true; window.clearTimeout(fallback); };
    }
    const playback = playMotion(clip, {
      actor: actorRef.current, face: faceRef.current, leftArm: leftArmRef.current,
      rightArm: rightArmRef.current, blush: blushRef.current,
      sadFace: sadFaceRef.current, coverHands: coverHandsRef.current,
    }, { durationMs, reducedMotion: preference.matches, onFinish: finish });
    scene.dataset.motionPlayer = playback.status === 'unsupported' ? 'css' : 'json';
    const fallback = playback.status === 'unsupported' ? window.setTimeout(finish, durationMs) : undefined;
    const reduce = () => { if (preference.matches) { playback.cancel(); finish(); } };
    preference.addEventListener('change', reduce);
    return () => { completed = true; window.clearTimeout(fallback); preference.removeEventListener('change', reduce); playback.cancel(); delete scene.dataset.motionPlayer; };
  }, [clip, durationMs, event.id, dealer, shouldAnimate, playId, showVideo]);

  useEffect(() => {
    if (!showFileVideo || !playing || blocked) return;
    const timer = window.setTimeout(() => {
      if (videoTurn.current !== turn || turn.phase !== 'ready' || !videoRef.current) return;
      turn.phase = 'failed'; videoRef.current.pause();
      reportPlayback({ playId, phase: 'fallback', medium: 'video', reason: 'Videon startade inte inom sex sekunder. Visar 2D-reserv.' });
      setFailedVideo(videoUrl ?? '');
    }, 6000);
    return () => window.clearTimeout(timer);
  }, [showVideo, playing, playId, videoUrl, blocked, videoIdentity]);
  useEffect(() => {
    if (blocked || !playing) {
      videoRef.current?.pause();
      if (turn.phase === 'playing') turn.phase = 'cancelled';
    }
  }, [blocked, playing, videoIdentity]);

  return <section className="stage-panel" aria-label="Animerad labbförhandsvisning">
    <div className="stage-overline"><span><i className="live-dot" /> {showVideo ? 'KOPPLAD VIDEO · LABB' : '2D-RESERV · LABB'}</span><div className="stage-preview-tabs" role="group" aria-label="Förhandsvisningstyp"><button aria-pressed={preview === 'video'} disabled={blocked || playing} onClick={() => setPreview('video')}>Video / 2D-reserv</button><button aria-pressed={preview === 'animation'} disabled={blocked || playing} onClick={() => setPreview('animation')}>Bara 2D</button></div></div>
    {showOriginal && originalMedia ? <OriginalMediaPlayer mediaId={originalMedia.id} playId={playId} playing={playing && !blocked} event={event.exampleEvent} onPlaybackEvent={onPlaybackEvent} onPlaybackEnd={onPlaybackEnd} onFailure={() => setFailedOriginal(originalIdentity)} /> : showFileVideo ? <div className="stage-video"><video ref={videoRef} key={`${videoUrl}-${playId}`} src={videoUrl} controls={!blocked} preload="metadata" autoPlay={playing && !blocked} muted playsInline onPlaying={e => {
      const element = e.currentTarget;
      if (!isCurrentVideo(element)) { if (videoRef.current !== element || videoTurn.current === turn && blocked) element.pause(); return; }
      if (element.paused || turn.phase === 'failed') { element.pause(); return; }
      if (turn.phase === 'playing') return;
      turn.phase = 'playing';
      onPlaybackEvent?.({ playId, phase: 'started', medium: 'video', durationMs: Number.isFinite(element.duration) ? Math.round(element.duration * 1000) : undefined });
    }} onEnded={e => {
      if (!isCurrentVideo(e.currentTarget) || turn.phase !== 'playing') return;
      turn.phase = 'completed';
      onPlaybackEvent?.({ playId, phase: 'completed', medium: 'video', currentTimeMs: Math.round(e.currentTarget.currentTime * 1000) }); onPlaybackEnd?.();
    }} onError={e => {
      if (!isCurrentVideo(e.currentTarget) || turn.phase === 'failed') return;
      turn.phase = 'failed'; e.currentTarget.pause();
      onPlaybackEvent?.({ playId, phase: 'fallback', medium: 'video', reason: 'Videon kunde inte spelas. Visar 2D-reserv.' }); setFailedVideo(videoUrl ?? '');
    }} aria-label={`Exakt labbkopplat original: ${videoName ?? 'video'}`} /><span>Originalvideo · eget ljud av från start · inte runtime-godkänd</span></div> : <div ref={sceneRef} className={`stage-scene ${motionStyles.scene} ${shouldAnimate ? 'is-playing' : ''} motion-${animation}`} key={`${event.id}-${playId}`} data-motion-asset={clip?.assetId} style={{ '--motion-duration': `${durationMs}ms`, '--asset-color': asset?.color ?? '#a5d9cb' } as CSSProperties} aria-hidden="true">
      <div className="stage-halo" />
      <div className="stage-lines" />
      <div className="dealer-presence">
        <div className="dealer-nameplate">{dealer}<span>CROUPIER</span></div>
        <div className="dealer-avatar" ref={actorRef}><div className={motionStyles.face} ref={faceRef}><div className="avatar-hair" /><div className="avatar-head"><span ref={blushRef} className={motionStyles.blush} /><span ref={sadFaceRef} className={motionStyles.sadFace}><i /><i /><span className={motionStyles.sadMouth} /></span></div></div><div className="avatar-neck" /><div className="avatar-body"><i /><i /></div><div className="avatar-arm left-arm" ref={leftArmRef} /><div className="avatar-arm right-arm" ref={rightArmRef} /><div className={motionStyles.coverHands} ref={coverHandsRef}><i /><i /></div></div>
        <div className="speech-signal"><i /><i /><i /><i /><i /></div>
      </div>
      <div className="table-surface"><div className="table-inner"><div className="table-brand">CROUPIER<span>BLACKJACK · PRESENTATION LAB</span></div><div className="table-arc" /><div className="table-rule">THE GAME DECIDES. THE DEALER PRESENTS.</div>
        <div className="table-slot slot-left">01</div><div className="table-slot slot-centre">02</div><div className="table-slot slot-right">03</div>
      </div></div>
      <div className="shoe"><PlayingCard rank="" suit="" back /><PlayingCard rank="" suit="" back /></div>
      {!sourceIsObserved || event.sourceType === 'reveal' && hasPublishedCard ? <div className="dealer-cards">{!sourceIsObserved ? <PlayingCard rank="6" suit="♠" /> : null}<div className="flip-card"><div className="flip-inner"><div className="flip-front"><PlayingCard rank="" suit="" back /></div><div className="flip-back"><PlayingCard rank={rank} suit={suit} /></div></div></div></div> : null}
      {!sourceIsObserved ? <div className="player-card resting-card"><PlayingCard rank="8" suit="♣" /></div> : null}
      {!sourceIsObserved || event.sourceType === 'deal' && hasPublishedCard ? <div className="dealt-card"><PlayingCard rank={rank} suit={suit} back={isConcealed} /></div> : null}
      {!sourceIsObserved ? <><div className="chip-stack chips-left"><i /><i /><i /><span>25</span></div><div className="chip-stack chips-centre"><i /><i /><i /><span>50</span></div><div className="chip-stack chips-right"><i /><i /><i /><span>25</span></div></> : null}
      <div className="turn-indicator" />
      <div className="stage-sparkles"><i /><i /><i /><i /><i /><i /></div>
    </div>}
    <div className="stage-bottom"><div className="stage-caption"><span className="eyebrow">{showVideo ? 'EXAKT KOPPLAD VIDEOGENERERING' : playing || previewing ? 'SPELAR LABBANIMATION' : 'REDO FÖR FÖRHANDSVISNING'}</span><strong>{variantLabel}</strong><span className={motionStyles.motionLabel}>{showVideo ? mediaName : <>{fallbackReason}{clip ? <> · {clip.label}</> : null}</>}</span></div><div className={motionStyles.actions}>{onPreview ? <button type="button" className={motionStyles.previewButton} onClick={() => { setFailedVideo(''); onPreview(); }} disabled={busy || blocked}><span aria-hidden="true">▷ </span>{previewLabel}</button> : null}<button type="button" className="play-button" onClick={() => { setFailedVideo(''); onPlay(); }} disabled={busy || blocked}><span aria-hidden="true">{busy ? '◌' : '▶'}</span>{blocked ? 'Socialt svar pågår' : busy ? 'Beräknar…' : 'Testa event'}</button></div></div>
  </section>;
}
