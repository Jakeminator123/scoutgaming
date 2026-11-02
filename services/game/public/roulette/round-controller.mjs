// Live state is supplied by the game document; this controller never owns game outcomes.
export function createRouletteRoundController({state, $, command, clearPending, renderDraft, renderState, showResult, message, colourNames, errorText, money}) {
  async function submit() {
    if(state.busy||!state.pending) return;
    if($('more').open)$('more').close();
    if($('table-zoom').open)$('table-zoom').close();
    state.busy=true;$('retry').hidden=true;renderDraft();message('Satsningarna är låsta. Rundan avgörs…');
    try {
      const result=await command(state.pending);
      if(result.player.id!==state.pending.playerId||result.requestId!==state.pending.requestId||!result.round) throw Error('invalid_receipt');
      state.state=result;clearPending();state.draft=new Map();state.undo=[];
      message('Hjulet snurrar. Vänta tills kulan har stannat…');
      // The receipt is already committed. A visual failure must never retry a debit.
      try {const scene=await state.roomSceneReady;await scene?.playRound(result.round.event.outcome.number,result.round.id);} catch { /* Show the confirmed result below. */ }
      renderState();showResult(result.round);
      message(`${result.replayed?'Den sparade rundan hämtades. ':''}${result.round.event.outcome.number} · ${colourNames[result.round.event.outcome.color]}. ${result.round.returned?'Tillbaka '+money(result.round.returned,result.round.currency)+'.':'Ingen vinst.'} Lägg nya satsningar när du vill.`);
    } catch(error) {
      if(error.status===400) {
        // Explicit validation failures commit no new round. Refresh before unlocking.
        try {state.state=await command({op:'state'});clearPending();renderState();} catch { /* Keep the exact command available for recovery. */ }
      }
      if(error.status===401) $('login').hidden=false;
      message(errorText[error.message] ?? 'Svaret kunde inte bekräftas. Kontrollera samma runda igen innan du spelar vidare.',true);
      $('retry').hidden=!state.pending;
    } finally {state.busy=false;renderDraft();}
  }
  return {submit};
}
