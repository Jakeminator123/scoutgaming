// Product chat effects are supplied by the mounted client. Live renderer and
// ownership values stay behind the runtime adapter and are re-read at each gate.
export async function displayChatDecision(runtime, decision, job) {
  const pending = runtime.pendingChatReplies.get(job.jobId);
  if (!pending || decision.kind === 'silence') return;
  await pending.beforeDisplay?.();
  if (pending.controller.signal.aborted) return;
  const text = decision.exactText;
  if (pending.previewRow?.isConnected && pending.previewText === text) pending.previewRow.classList.remove('pending');
  else runtime.chatLog('vera', text);
  runtime.nativeObservation.emit('chat', { role: 'assistant', text, line: decision.lineId ?? null,
    source: pending.probe ? 'probe' : 'openclaw-chat', synthetic: Boolean(pending.synthetic), speechKind: decision.kind }, pending.correlation);
  if (!pending.synthetic && !pending.probe) runtime.chatHistory.push({ role: 'assistant', text });
}

export function cancelChatDecision(runtime, job, reason) {
  runtime.chatPlaybackDiagnostic.finish(job.jobId, 'cancelled');
  const pending = runtime.pendingChatReplies.get(job.jobId);
  if (pending?.previewRow?.classList.contains('pending')) pending.previewRow.remove();
  pending?.controller?.abort(reason);
  runtime.nativeObservation.emit('chat', { role: 'assistant', state: 'cancelled', reason,
    requestId: job.jobId, source: 'openclaw-chat' });
}

export async function playChatDecision(runtime, decision, signal, jobId) {
  if (runtime.studioPreview) throw Error('Genererat tal är avstängt i provspel.');
  if (decision.kind === 'silence') return;
  const dealSpeech = runtime.pendingChatReplies.get(jobId)?.dealSpeech;
  runtime.localPresentation?.state({ speech: true, ready: false });
  runtime.updatePoseState({ dealerPose: dealSpeech ? 'deal-speech' : decision.kind === 'generatedText' && !decision.speechPackage && !decision.speechStream ? 'standard-idle' : 'speech',
    speechOwner: 'chat-' + jobId, idlePresented: null }, 'chat-speech-started');
  try {
    if (decision.kind === 'generatedText') {
      runtime.speaking = true;
      try {
        if (decision.visualMode === 'generated-lipsync-stream-preview' || decision.speechStream) {
          if (decision.visualMode !== 'generated-lipsync-stream-preview' || !decision.speechStream || decision.speechPackage
            || decision.requestId !== jobId) throw new Error('invalid_speech_stream_decision');
          const checkStreamPose = () => {
            const state = runtime.poseGate.state, job = runtime.poseGate.get(jobId), identity = runtime.poseIdentity();
            if (signal?.aborted || !job || job.status !== 'speaking' || job.dealerId !== identity.dealerId
              || job.sessionRevision !== identity.sessionRevision || job.roundRevision !== identity.roundRevision
              || state.speechOwner !== 'chat-' + jobId || state.actionOwner !== (dealSpeech ? 'deal-chat-' + jobId : 'none') || state.dealerPose !== (dealSpeech ? 'deal-speech' : 'speech')
              || (dealSpeech && (runtime.activeDealSpeech !== dealSpeech || decision.speechStream.presentationVersion !== runtime.tableVersion))
              || !state.visible || state.muted) throw new Error('stale_speech_stream_pose');
          };
          const beforeStreamStart = async () => {
            checkStreamPose(); await runtime.pendingChatReplies.get(jobId)?.beforeStart?.(); checkStreamPose();
          };
          runtime.setChatStatus('Förbereder röst och läppsynk…');
          await runtime.playGeneratedSpeech(decision.speechStream, { exactText: decision.exactText, dealerId: runtime.dealer.key,
            requestId: jobId, mount: runtime.scene, signal, beforeStart: beforeStreamStart, assertCurrent: checkStreamPose,
            prepareRendering: (compositing, framing) => runtime.layerComposition?.prepareClip(compositing ?? undefined, framing),
            renderFrame: (video, presented) => runtime.layerComposition?.renderFrame(video, presented) ?? false,
            setMovingSpeechLayer: layer => runtime.layerComposition?.setMovingSpeechLayer(layer),
            ...(dealSpeech ? {
              onSequenceReady: sequence => { checkStreamPose(); if (sequence.version !== dealSpeech.version) throw Error('moving_deal_version'); dealSpeech.sequence = sequence; runtime.localCards?.sync(runtime.round); },
              onSequenceFrame: (sequence, k) => runtime.movingDealFrame(dealSpeech, sequence, k),
              onSequenceEnd: () => runtime.movingDealEnd(dealSpeech),
            } : {}),
            streamObserver: runtime.pendingChatReplies.get(jobId)?.nativeP6Observer,
            onStart: text => {
              const pending = runtime.pendingChatReplies.get(jobId);
              if (runtime.chatStatus && pending) runtime.chatStatus.dataset.playbackMs = String(Math.round(runtime.now() - pending.requestedAt));
              runtime.setChatStatus(runtime.dealer.name + ' svarar'); runtime.showCaption(text, 27000);
            },
            onFirstFrame: () => {
              const pending = runtime.pendingChatReplies.get(jobId);
              if (runtime.chatStatus && pending) runtime.chatStatus.dataset.firstFrameMs = String(Math.round(runtime.now() - pending.requestedAt));
            },
            onReceipt: receipt => {
              const pending = runtime.pendingChatReplies.get(jobId); if (pending) pending.playbackReceipt = receipt;
              pending?.nativeP6Receipt?.(receipt);
              runtime.chatPlaybackDiagnostic.stream(jobId, receipt);
              runtime.nativeObservation.emit('playback', { event: 'speech', source: 'generated-lipsync-stream',
                synthetic: Boolean(pending?.synthetic), ...receipt, requestId: jobId });
            },
          });
        } else if (decision.visualMode === 'generated-lipsync-preview' && decision.speechPackage) {
          runtime.setChatStatus('Förbereder röst och läppsynk…');
          await runtime.playGeneratedSpeech(decision.speechPackage, { exactText: decision.exactText, dealerId: runtime.dealer.key, mount: runtime.scene, signal,
            beforeStart: runtime.pendingChatReplies.get(jobId)?.beforeStart,
            prepareRendering: compositing => runtime.layerComposition?.prepareClip(compositing ?? undefined),
            renderFrame: video => runtime.layerComposition?.renderFrame(video) ?? false,
            onStart: text => {
              const pending = runtime.pendingChatReplies.get(jobId);
              if (runtime.chatStatus && pending) runtime.chatStatus.dataset.playbackMs = String(Math.round(runtime.now() - pending.requestedAt));
              runtime.setChatStatus(runtime.dealer.name + ' svarar'); runtime.showCaption(text, 27000);
            },
            onReceipt: receipt => {
              const pending = runtime.pendingChatReplies.get(jobId); if (pending) pending.playbackReceipt = receipt;
              runtime.nativeObservation.emit('playback', { event: 'speech', source: pending?.probe ? 'probe' : 'generated-lipsync', synthetic: Boolean(pending?.synthetic), ...receipt, requestId: jobId });
            },
          });
        } else {
          // Registered dealers never silently inherit the browser's voice.
          const pending = runtime.pendingChatReplies.get(jobId);
          if (pending) pending.voiceUnavailable = true;
          runtime.chatPlaybackDiagnostic.finish(jobId, 'text-only');
          runtime.nativeObservation.emit('playback', { event: 'speech', state: 'fallback',
            reason: 'dealer-generated-media-unavailable', renderer: 'text-only', source: 'generated-lipsync', requestId: jobId });
        }
      } finally { runtime.speaking = false; }
      return;
    }
    if (runtime.localPresentationEnabled) {
      runtime.showCaption(decision.exactText, 5000);
      runtime.chatPlaybackDiagnostic.finish(jobId, 'text-only');
      runtime.nativeObservation.emit('playback', { event: 'speech', state: 'fallback', reason: 'recorded-chat-exact-text-unverified', renderer: 'text-only' });
      return;
    }
  } finally {
    runtime.hideCaption();
    runtime.updatePoseState({ dealerPose: 'unknown', speechOwner: 'none', idlePresented: null }, 'chat-speech-completed');
    runtime.localPresentation?.state({ speech: false, ready: false });
  }
}
