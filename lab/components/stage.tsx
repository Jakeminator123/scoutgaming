'use client';

import { useEffect, useEffectEvent, useRef, useState, type CSSProperties } from 'react';
import type { StudioAsset, StudioEvent } from '../lib/studio-model.mjs';
import { getMotionClip, motionAllowedForSource, stageBaseAnimation } from '../lib/motion-library.mjs';
import { playMotion } from '../lib/motion-player.mjs';
import { OriginalMediaPlayer } from './original-media-player';
import { FileVideo } from './file-video';
import type { OriginalMediaEntry } from '../lib/original-media.mjs';
import type { VideoEntry } from './studio-types';
import motionStyles from './stage-motion.module.css';

export interface PlaybackReceipt { phase: 'started' | 'completed' | 'failed' | 'fallback'; medium: 'video' | '2d'; playId?: number; reason?: string; durationMs?: number; currentTimeMs?: number; mediaId?: string; fileName?: string; familyId?: string }

function PlayingCard({ rank, suit, back = false, className = '' }: { rank: string; suit: string; back?: boolean; className?: string }) {
  return <div className={`playing-card ${back ? 'card-back' : ''} ${suit === '♥' || suit === '♦' ? 'red-suit' : ''} ${className}`}>
    {back ? <span className="card-monogram">C</span> : <><span className="card-corner">{rank}<small>{suit}</small></span><span className="card-suit">{suit}</span><span className="card-corner card-corner-bottom">{rank}<small>{suit}</small></span></>}
  </div>;
}

export function Stage({ event, asset, dealer, variantLabel, playId, playing, hasResult, onPlay, busy, videoUrl: requestedUrl, videoName: requestedName, videoId: requestedId, familyId, fallbackVideo, videoMissing = false, originalMedia, sourceIsObserved = false, onPreview, previewing = false, previewLabel = 'Spela valt klipp', onPlaybackEnd, onPlaybackEvent, blocked = false, allow2dFallback = true }: {
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
  videoId?: string;
  familyId?: string;
  fallbackVideo?: VideoEntry | null;
  videoMissing?: boolean;
  originalMedia?: OriginalMediaEntry | null;
  sourceIsObserved?: boolean;
  onPreview?: () => void;
  previewing?: boolean;
  previewLabel?: string;
  onPlaybackEnd?: () => void;
  onPlaybackEvent?: (receipt: PlaybackReceipt) => void;
  blocked?: boolean;
  allow2dFallback?: boolean;
}) {
  const [preview, setPreview] = useState<'animation' | 'video'>('video');
  const [failedVideos, setFailedVideos] = useState<string[]>([]);
  const useStandard = Boolean((requestedUrl && failedVideos.includes(`${playId}:${requestedUrl}`) || videoMissing && requestedId) && fallbackVideo?.available
    && familyId && fallbackVideo.familyId === familyId && fallbackVideo.id !== requestedId);
  const videoUrl = useStandard ? fallbackVideo!.previewUrl : requestedUrl;
  const videoName = useStandard ? fallbackVideo!.fileName : requestedName;
  const videoId = useStandard ? fallbackVideo!.id : requestedId;
  const failedVideo = failedVideos.includes(`${playId}:${videoUrl}`);
  const canTryStandard = Boolean(!useStandard && fallbackVideo?.available && familyId && fallbackVideo.familyId === familyId && fallbackVideo.id !== requestedId);
  const failureMessage = canTryStandard ? 'Provar standardvideon i samma mapp.' : allow2dFallback ? 'Visar 2D-reserv.' : 'Ingen spelbar video i mappen.';
  const failVideo = () => setFailedVideos(current => [...current.slice(-3), `${playId}:${videoUrl}`]);
  const [failedOriginal, setFailedOriginal] = useState('');
  const sceneRef = useRef<HTMLDivElement>(null);
  const actorRef = useRef<HTMLDivElement>(null);
  const faceRef = useRef<HTMLDivElement>(null);
  const leftArmRef = useRef<HTMLDivElement>(null);
  const rightArmRef = useRef<HTMLDivElement>(null);
  const blushRef = useRef<HTMLSpanElement>(null);
  const sadFaceRef = useRef<HTMLSpanElement>(null);
  const coverHandsRef = useRef<HTMLDivElement>(null);
  const originalIdentity = `${originalMedia?.id}:${playId}`;
  const showOriginal = (preview === 'video' || !allow2dFallback) && !videoUrl && !videoMissing && Boolean(originalMedia?.available) && failedOriginal !== originalIdentity;
  const showFileVideo = (preview === 'video' || !allow2dFallback) && Boolean(videoUrl) && !failedVideo;
  const showVideo = showOriginal || showFileVideo;
  const noMedia = !showVideo && !allow2dFallback;
  const mediaName = showOriginal ? originalMedia?.label : videoName;
  const fallbackReason = preview === 'animation' ? 'Bara 2D valt' : failedOriginal === originalIdentity ? 'Originalklippet kunde inte spelas · visar 2D-reserv' : failedVideo ? 'Videon kunde inte spelas · visar 2D-reserv' : videoMissing ? 'Kopplad fil saknas · visar 2D-reserv' : 'Ingen video för denna situation · visar 2D-reserv';
  const requestedClip = getMotionClip(asset?.id);
  const clip = motionAllowedForSource(requestedClip, event.sourceType) ? requestedClip : undefined;
  const durationMs = asset?.durationMs ?? clip?.durationMs ?? 1700;
  const animation = stageBaseAnimation(event, asset?.animation);
  const shouldAnimate = playing && (hasResult || previewing);
  const reportPlaybackEnd = useEffectEvent((finishedId: number) => { if (finishedId === playId) onPlaybackEnd?.(); });
  const emitPlayback = (receipt: PlaybackReceipt) => onPlaybackEvent?.({ ...receipt, ...(receipt.medium === 'video' && videoId ? { mediaId: videoId, fileName: videoName, familyId } : {}) });
  const reportPlayback = useEffectEvent(emitPlayback);
  const eventCard = event.exampleEvent.card as { r?: string; s?: string } | null | undefined;
  const rank = eventCard?.r ?? (sourceIsObserved ? '' : 'A');
  const suit = eventCard?.s ?? (sourceIsObserved ? '' : '♠');
  const isConcealed = event.exampleEvent.faceDown === true;
  const hasPublishedCard = isConcealed || Boolean(eventCard?.r && eventCard?.s);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || showVideo || !shouldAnimate || playId === 0 || !allow2dFallback) return;
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
  }, [clip, durationMs, event.id, dealer, shouldAnimate, playId, showVideo, allow2dFallback]);

  useEffect(() => {
    if (!noMedia || !shouldAnimate || playId === 0) return;
    reportPlayback({ playId, phase: 'failed', medium: 'video', reason: 'Ingen spelbar video för den exakta situationen.' });
    reportPlaybackEnd(playId);
  }, [noMedia, shouldAnimate, playId]);

  return <section className="stage-panel" aria-label="Animerad labbförhandsvisning">
    <div className="stage-overline"><span><i className="live-dot" /> {showVideo ? 'KOPPLAD VIDEO · LABB' : noMedia ? 'VIDEO SAKNAS · LABB' : '2D-RESERV · LABB'}</span>{allow2dFallback ? <div className="stage-preview-tabs" role="group" aria-label="Förhandsvisningstyp"><button aria-pressed={preview === 'video'} disabled={blocked || playing} onClick={() => setPreview('video')}>Video / 2D-reserv</button><button aria-pressed={preview === 'animation'} disabled={blocked || playing} onClick={() => setPreview('animation')}>Bara 2D</button></div> : null}</div>
    {noMedia ? <div className="stage-video" role="status">Ingen spelbar video för den här situationen. Kontrollera filen och manifestet.</div> : showOriginal && originalMedia ? <OriginalMediaPlayer mediaId={originalMedia.id} playId={playId} playing={playing && !blocked} event={event.exampleEvent} onPlaybackEvent={onPlaybackEvent} onPlaybackEnd={onPlaybackEnd} onFailure={() => setFailedOriginal(originalIdentity)} /> : showFileVideo ? <div className="stage-video"><FileVideo key={`${event.id}-${dealer}-${videoUrl}-${playId}`} url={videoUrl!} name={videoName} playId={playId} playing={playing} blocked={blocked}
      onReceipt={value => emitPlayback({ ...value, ...(value.phase === 'fallback' ? { reason: `${value.reason} ${failureMessage}` } : {}) })}
      onFailure={failVideo} onEnd={() => onPlaybackEnd?.()} /><span>Labbklipp · ljud av från start · inte visuellt godkänt</span></div> : <div ref={sceneRef} className={`stage-scene ${motionStyles.scene} ${shouldAnimate ? 'is-playing' : ''} motion-${animation}`} key={`${event.id}-${playId}`} data-motion-asset={clip?.assetId} style={{ '--motion-duration': `${durationMs}ms`, '--asset-color': asset?.color ?? '#a5d9cb' } as CSSProperties} aria-hidden="true">
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
    <div className="stage-bottom"><div className="stage-caption"><span className="eyebrow">{showVideo ? 'EXAKT KOPPLAD VIDEO' : noMedia ? 'INGEN VIDEO' : playing || previewing ? 'SPELAR LABBANIMATION' : 'REDO FÖR FÖRHANDSVISNING'}</span><strong>{variantLabel}</strong><span className={motionStyles.motionLabel}>{showVideo ? mediaName : noMedia ? 'Ingen film spelades.' : <>{fallbackReason}{clip ? <> · {clip.label}</> : null}</>}</span></div><div className={motionStyles.actions}>{onPreview ? <button type="button" className={motionStyles.previewButton} onClick={() => { setFailedVideos([]); onPreview(); }} disabled={busy || blocked}><span aria-hidden="true">▷ </span>{previewLabel}</button> : null}<button type="button" className="play-button" onClick={() => { setFailedVideos([]); onPlay(); }} disabled={busy || blocked}><span aria-hidden="true">{busy ? '◌' : '▶'}</span>{blocked ? 'Socialt svar pågår' : busy ? 'Beräknar…' : 'Testa event'}</button></div></div>
  </section>;
}
