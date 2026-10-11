'use client';

import type { RefObject } from 'react';
import { labUrl } from '../lib/lab-url.mjs';
import type { ActivityDraft } from './activity-log';
import { EventTestPanel } from './event-test-panel';
import { MediaSituation } from './media-family-editor';
import { SocialChatPanel, type SocialActivity, type SocialDraftCache } from './social-chat-panel';
import socialStyles from './social-chat-panel.module.css';
import { SpeechSource } from './speech-source';
import { Stage, type PlaybackReceipt } from './stage';
import streamStyles from './game-stream.module.css';
import type { StudioAsset, StudioEvent } from '../lib/studio-model.mjs';
import type { OriginalMediaCatalog, OriginalMediaEntry } from '../lib/original-media.mjs';
import type { PresentationStep } from '../lib/presentation-sequence.mjs';
import type { DirectorMode, SimulationResult, TestContext, VideoEntry } from './studio-types';
import styles from './control-events-page.module.css';

const socialTitles: Record<string, string> = {
  'social.requested': 'Meddelande skickat till Astrid',
  'social.responded': 'Astrids svar togs emot',
  'social.suppressed': 'Sociala policyn håller en paus',
  'social.cancelled': 'Socialt prov avbröts',
  'social.failed': 'Socialt prov misslyckades',
  'social.replay.requested': 'Spela sparat tal igen',
  'social.audio.loading': 'Ljudet kontrolleras före start',
  'social.audio.started': 'Astrids tal startade',
  'social.audio.completed': 'Astrids tal spelades klart',
  'social.audio.cancelled': 'Talprovet avbröts',
  'social.audio.failed': 'Talet kunde inte spelas klart',
  'social.audio.rejected': 'Ljudet avvisades',
};
const logReasons: Record<string, string> = {
  ai_disabled: 'Bara standard är valt. Ingen modell anropades.',
  deterministic_rules: 'Reglerna valde den högst prioriterade tillåtna varianten. Ingen modell anropades.',
  local_deal_frequency: 'Klipp valt enligt sparad utdelningsfrekvens.',
  local_random: 'Labbet lottade bland standard och slumpaktiverade alternativ som matchade villkoren.',
  accepted: 'Modellens föreslagna variant var tillåten och godkändes av servern.',
  shadow_only: 'Modellförslaget var giltigt, men skuggläget spelar standardvarianten.',
  no_advice: 'Inget användbart modellråd kom tillbaka. Servern valde standardvarianten.',
  invalid_advice_shape: 'Modellsvaret följde inte det förväntade formatet. Servern valde standardvarianten.',
  request_mismatch: 'Modellsvaret hörde till en annan begäran. Servern valde standardvarianten.',
  catalog_mismatch: 'Modellsvaret gällde en annan projektversion. Servern valde standardvarianten.',
  abstained: 'Modellen avstod från variantval. Servern valde standardvarianten.',
  ineligible_variant: 'Modellens förslag var inte tillåtet i detta prov. Servern valde standardvarianten.',
  'explicit-player-chat': 'Du skickade ett meddelande i det sociala provet.',
  'explicit-manual-replay': 'Du bad att få höra det sparade ljudet igen. Inget nytt tal genererades.',
  'validated-social-trigger': 'Uttrycksförslaget godkändes enligt sociala policyn. Croupiern stannar i vänteläget.',
  'neutral-idle-response': 'Svaret godkändes utan uttrycksbyte. Croupiern stannar i vänteläget.',
  cooldown: 'Pausen mellan sociala reaktioner har inte löpt ut. Inget nytt tal spelas.',
  'audio-metadata-preflight': 'Ljudets längd kontrolleras före uppspelning.',
  'browser-audio-playing': 'Webbläsaren bekräftade att ljudet började spelas.',
  'audio-ended': 'Webbläsaren rapporterade att ljudet spelades till sitt slut.',
  'audio-longer-than-25-seconds': 'Ljudet är längre än 25 sekunder och avvisades. Textsvaret finns kvar.',
  'speech-25-second-watchdog': '25-sekundersgränsen stoppade ljudprovet. Det räknas inte som slutfört tal.',
  'audio-metadata-timeout': 'Ljudets längd kunde inte läsas i tid. Provet avbröts.',
  'audio-play-rejected': 'Webbläsaren nekade ljudstarten. Inget automatiskt omtag görs.',
  'audio-error': 'Webbläsaren rapporterade ett ljudfel. Inget automatiskt omtag görs.',
  'speech-owner-busy': 'Ett annat talprov använder redan ljudspelaren.',
  'user-stop': 'Du stoppade det sociala provet.',
  'explicit-stop': 'Talprovet stoppades uttryckligen.',
  'explicit-stop-or-view-change': 'Provet stoppades eller den aktuella vyn ändrades.',
  'selection-settings-or-view-change': 'Val, inställning eller vy ändrades. Det sociala provet stoppades.',
  'left-astrid-idle': 'Astrids vänteläge lämnades. Det sociala provet stoppades.',
  'social-panel-unmounted': 'Chattpanelen stängdes. Det sociala provet stoppades.',
  'page-hidden': 'Fliken doldes. Det sociala provet stoppades.',
  'page-left': 'Sidan lämnades. Det sociala provet stoppades.',
  'social-request-failed': 'Begäran om ett socialt svar misslyckades.',
};
export const readableLogReason = (reason: string | undefined) => reason ? logReasons[reason] ?? `Rapporterad orsak: ${reason}` : 'Ingen särskild orsak angavs. Se serverns beslutsspår.';

export function describeSocialActivity(entry: SocialActivity): ActivityDraft {
  const audio = entry.type.includes('.audio.');
  const status = entry.type.endsWith('requested') ? 'received' : entry.type.endsWith('started') ? 'started' : entry.type.endsWith('loading') ? 'waiting' : entry.type.endsWith('completed') ? 'completed' : entry.type.endsWith('cancelled') || entry.type.endsWith('suppressed') ? 'cancelled' : entry.type.endsWith('failed') || entry.type.endsWith('rejected') ? 'failed' : 'selected';
  const owner = audio ? 'Labbets ljudspelare' : status === 'received' ? 'Du / spelarchatt'
    : entry.data?.textOwner === 'saved-social-policy' ? 'OpenClaws bedömning · text från din sparade policy'
      : entry.data?.decisionOwner === 'OpenClaw + local-social-policy' ? 'OpenClaw + labbets kontroll'
        : entry.data?.decisionOwner === 'local-social-policy' ? 'Labbets sociala policy' : 'Labbets sociala kontroll';
  return {
    source: 'social',
    stage: audio ? 'playback' : status === 'received' ? 'input' : 'decision',
    status,
    title: socialTitles[entry.type] ?? `Social händelse: ${entry.type}`,
    runId: entry.requestId,
    owner,
    reason: readableLogReason(entry.reason),
    data: { ...entry.data, type: entry.type, rawReason: entry.reason },
  };
}

export function EventsIdleNotice({ refreshing, onRefresh }: { refreshing: boolean; onRefresh: () => void }) {
  return <>
    <div className="event-heading">
      <div>
        <h2>Grundloop</h2>
      </div>
      <button type="button" className="text-button" disabled={refreshing} onClick={onRefresh}>{refreshing ? 'Läser…' : 'Läs in nya filer'}</button>
    </div>
    <p className={styles.idleLink}>
      <a className="text-button" href={labUrl('/control/clips#idle')}>Grundloop och klipp →</a>
    </p>
  </>;
}

export function EventsPreview({
  isIdleEditor, managed, event, observed, originals, dealerId, onSituation, onSpeechLine, onOpenSpeech,
  observedStep, onClearObserved, activityHref, showStage, stage, socialReply, isIdleCopy, frequencyHint,
  onShowChat, mainStage, speechHost, socialChat, social, showTest, test,
}: {
  isIdleEditor: boolean;
  managed: boolean;
  event: StudioEvent;
  observed: boolean;
  originals: OriginalMediaCatalog | null;
  dealerId: string;
  onSituation: (situation: string) => void;
  onSpeechLine: (line: string) => void;
  onOpenSpeech: () => void;
  observedStep: PresentationStep | null;
  onClearObserved: () => void;
  activityHref: string;
  showStage: boolean;
  stage: {
    asset?: StudioAsset;
    dealerLabel: string;
    variantLabel: string;
    playId: number;
    playing: boolean;
    hasResult: boolean;
    previewing: boolean;
    busy: boolean;
    blocked: boolean;
    onPlaybackEvent: (receipt: PlaybackReceipt) => void;
    videoUrl?: string;
    videoName?: string;
    videoId?: string;
    familyId?: string;
    allow2dFallback: boolean;
    fallbackVideo: VideoEntry | null;
    videoMissing: boolean;
    originalMedia: OriginalMediaEntry | null;
    sourceIsObserved: boolean;
    onPlay: () => void;
    onPreview: () => void;
    onPlaybackEnd: () => void;
  };
  socialReply: string;
  isIdleCopy: boolean;
  frequencyHint: string;
  onShowChat: () => void;
  mainStage: RefObject<HTMLDivElement | null>;
  speechHost: RefObject<HTMLDivElement | null>;
  socialChat: RefObject<HTMLDivElement | null>;
  social: {
    draftCache: RefObject<SocialDraftCache | null>;
    dealerId: string;
    eventId: string;
    registerCancel: (cancel: ((reason?: string) => void) | null) => void;
    blocked: boolean;
    onBusyChange: (busy: boolean) => void;
    onActivity: (entry: SocialActivity) => void;
    onBegin: () => void;
    onReaction: (assetId: 'social.ledsen' | 'idle.ready.standard', label: string, exactReply: string) => void;
    onGoToIdle: () => void;
  };
  showTest: boolean;
  test: {
    dealClips: boolean;
    dealFrequency: boolean;
    open: boolean;
    onOpen: (open: boolean) => void;
    mode: DirectorMode;
    onMode: (mode: DirectorMode) => void;
    configured: boolean;
    context: TestContext;
    onContext: (context: TestContext) => void;
    dealer: string;
    eventLabel: string;
    sourceType: string;
    result: SimulationResult | null;
    originalLabel?: string;
    manifestOwned: boolean;
    previewKind: 'selected' | 'social' | null;
    busy: boolean;
    blocked: boolean;
    onRun: () => void;
  };
}) {
  return <div className="preview-column">
    {!isIdleEditor ? <div className="event-heading">
      <div>
        <span className="eyebrow">01 / EVENTSTUDION</span>
        <h2>{event.label}</h2>
        <p>{managed ? 'Spela situationens standardfil eller en variant från samma mapp. Mottagna kortvärden ändrar inte vilken rörelse som används.' : event.description}</p>
      </div>
      <span className="source-tag">{event.sourceType}<span>källtyp · labbindelning</span></span>
    </div> : null}
    {isIdleEditor ? null : managed
      ? <MediaSituation event={event} observed={observed} onSelect={onSituation} />
      : <SpeechSource event={event} originals={originals} dealerId={dealerId} observed={observed} onSelect={onSpeechLine} onOpenSpeech={onOpenSpeech} />}
    <div ref={mainStage} className={socialStyles.stageAnchor}>
      {observedStep ? <div className={streamStyles.context}>
        <strong>Mottaget steg {observedStep.presentationIndex + 1}</strong>
        {observedStep.label}
        <button type="button" className="text-button" onClick={onClearObserved}>Tillbaka till exempel</button>
        <a className="text-button" href={activityHref}>Hela sekvensen →</a>
      </div> : null}
      {showStage ? <div className={socialStyles.speechStage}>
        <Stage
          event={event}
          asset={stage.asset}
          dealer={stage.dealerLabel}
          variantLabel={stage.variantLabel}
          playId={stage.playId}
          playing={stage.playing}
          hasResult={stage.hasResult}
          previewing={stage.previewing}
          busy={stage.busy}
          blocked={stage.blocked}
          onPlaybackEvent={stage.onPlaybackEvent}
          videoUrl={stage.videoUrl}
          videoName={stage.videoName}
          videoId={stage.videoId}
          familyId={stage.familyId}
          allow2dFallback={stage.allow2dFallback}
          fallbackVideo={stage.fallbackVideo}
          videoMissing={stage.videoMissing}
          originalMedia={stage.originalMedia}
          sourceIsObserved={stage.sourceIsObserved}
          onPlay={stage.onPlay}
          onPreview={stage.onPreview}
          onPlaybackEnd={stage.onPlaybackEnd}
        />
        <div ref={speechHost} className={socialStyles.speechHost} />
      </div> : null}
      {dealerId === 'astrid' && <div ref={socialChat} className={socialStyles.chatAnchor}>
        <SocialChatPanel
          compact
          speechHost={speechHost}
          draftCache={social.draftCache}
          dealerId={social.dealerId}
          eventId={social.eventId}
          registerCancel={social.registerCancel}
          blocked={social.blocked}
          onBusyChange={social.onBusyChange}
          onActivity={social.onActivity}
          onBegin={social.onBegin}
          onReaction={social.onReaction}
          onGoToIdle={social.onGoToIdle}
        />
      </div>}
      <div className={socialStyles.sceneReply} aria-live="polite" aria-atomic="true">
        {dealerId === 'astrid' && socialReply ? <>
          <div>
            <span className="eyebrow">ASTRID · SOCIALT LABBSVAR</span>
            <p>{socialReply}</p>
            <small>Separat social presentation, inte ett nytt spel-event eller godkänd läppsynk.</small>
          </div>
          <button className="text-button" type="button" onClick={onShowChat}>Visa chatten ↓</button>
        </> : isIdleCopy
          ? <span>Grundloop redigeras i Innehåll. Sociala svar provas separat.</span>
          : <span><strong>Spela valt klipp</strong> visar ditt material direkt. <strong>Testa event</strong> {frequencyHint}</span>}
      </div>
    </div>
    {showTest ? <EventTestPanel
      dealClips={test.dealClips}
      dealFrequency={test.dealFrequency}
      open={test.open}
      onOpen={test.onOpen}
      mode={test.mode}
      onMode={test.onMode}
      configured={test.configured}
      context={test.context}
      onContext={test.onContext}
      dealer={test.dealer}
      eventLabel={test.eventLabel}
      sourceType={test.sourceType}
      result={test.result}
      originalLabel={test.originalLabel}
      manifestOwned={test.manifestOwned}
      previewKind={test.previewKind}
      busy={test.busy}
      blocked={test.blocked}
      onRun={test.onRun}
    /> : null}
    {!managed ? <div className="workspace-footnote">2D-reserven är ett rörelseprov för labbets eventgrupper. Kompletta spelhänder och läppsynk ingår inte.</div> : null}
    <div className="workspace-footnote">Testmiljö, inte ett spel om pengar. RNG, regler och utbetalningar är alltid utanför studion.</div>
  </div>;
}
