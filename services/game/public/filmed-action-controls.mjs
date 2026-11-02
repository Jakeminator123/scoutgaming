// Live state is supplied by the game document; this controller never owns game outcomes.
export function createFilmedActionControls({state, localPresentationEnabled, speechQueue, updatePoseState, nativeObservation, cardEl, dealCardTo}) {
  async function beginDealingTake() {
    try {
    const currentOwner = state.speechPoseGate?.state.actionOwner ?? 'none';
    updatePoseState({ dealerPose: 'action', actionOwner: currentOwner === 'none' ? 'dealer-action' : currentOwner,
      idlePresented: null }, 'action-started');
    await speechQueue.idle;
    // A previous player take may have released the controller before the dealer
    // continues. Reclaim it so late chat cleanup cannot interrupt this card run.
    state.localPresentation?.state({ action: true });
    if(state.performancePlayer){if(state.performancePlayer.joins)state.performancePlayer.beginSequence();console.info('[deal] Presented-frame performance sequence');return;}
    } catch (error) { console.warn('[deal] Filmed action unavailable:', error.message); }
  }

  async function deliverCard(container, card, options={}) {
    const correlation=nativeObservation.context();
    let motion;
    const seatBox=container.closest('[data-box]')?.dataset.box;
    if (localPresentationEnabled) {
      const event = { type: 'deal', to: container.id === 'dealer-cards' ? 'dealer' : 'box',
        box: seatBox == null ? null : Number(seatBox), shoeDraw: options.shoeDraw ?? card?.shoeDraw };
      state.localCards?.sync(state.round);
      let token;
      const played = await state.localPresentation?.present(event, {
        onSelected: (video, committedEvent) => { token = state.localCards?.begin(video, committedEvent); },
        onFrame: time => state.localCards?.frame(token, time),
      });
      const calibratedContact = token == null ? false : state.localCards?.finish(token, event.shoeDraw, played);
      if (token == null) state.localCards?.show(event.shoeDraw);
      const element = dealCardTo(container, card, { ...options, motion: { localCompleted: played || !!state.localCards } });
      await element.dealt;
      nativeObservation.emit('playback', { event: 'deal', state: 'landed', ...event, type: undefined,
        renderer: state.localCards ? 'svg-local' : '2d', evidence: calibratedContact ? 'video-frame-track' : 'static-card-presented', calibratedContact: !!calibratedContact }, correlation);
      return;
    }

  }

  async function endDealingTake({ deferIdle = false } = {}) {
    // The filmed return owns the actor until its final pose and the matching
    // idle frame have both been presented. Speech/decisions wait for this.
    try {await state.performancePlayer?.finish({wait:['decisions','insurance'].includes(state.round?.phase)});}catch(error){console.warn('[performance] return',error.message);}
    if (!deferIdle) {
      updatePoseState({ dealerPose: 'unknown', actionOwner: 'none', idlePresented: null }, 'action-completed');
      state.localPresentation?.state({ action: false });
    }
  }
  async function revealHole(container, card) {
    const back = container.querySelector('.card.back');
    if (!back) return;
    if (localPresentationEnabled) {
      state.localPresentation?.state({ action: true });
      state.localCards?.sync(state.round);
      let token;
      const played = await state.localPresentation?.present({ type: 'reveal', to: 'dealer', shoeDraw: card.shoeDraw }, {
        onSelected: (video, event) => { token = state.localCards?.begin(video, event); },
        onFrame: time => state.localCards?.frame(token, time),
      });
      const calibrated = token != null && state.localCards?.finish(token, card.shoeDraw, played);
      if (token == null) state.localCards?.reveal(state.round);
      nativeObservation.emit('playback', { event: 'reveal', state: 'landed', shoeDraw: card.shoeDraw,
        renderer: 'svg-local', evidence: calibrated ? 'video-frame-track' : 'static-card-presented', calibratedContact: !!calibrated });
    }
    const el = cardEl(card);
    el.style.setProperty('--ci', back.style.getPropertyValue('--ci') || 1);
    el.classList.add('flip');
    back.replaceWith(el);
    state.localCards?.reveal(state.round);
    nativeObservation.emit('playback',{event:'reveal',state:'presented',card,evidence:'DOM-replacement'});
  }
  return {beginDealingTake, endDealingTake, deliverCard, revealHole};
}
