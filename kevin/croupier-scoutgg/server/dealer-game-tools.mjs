import { approvedFact } from './table-facts.mjs';
import {dealerLanguage} from '../public/dealer-language.js';

const issuedFacts=new WeakSet();

/** Return only explicit, factual game-state questions. Strategy questions stay on the reviewed safety path. */
export function gameStateIntent(text) {
  const s=String(text??'').normalize('NFKC').toLowerCase();
  if(/\b(should|recommend|advise|hit|stand|bet|double|split|insurance|strategy|odds|best move|ignore|instruction|prompt|system|developer|pretend|roleplay|debería|debo|conseil|devrais|建议|应该|下注|要不要)/iu.test(s))return null;
  if(s.includes('我的牌')||s.includes('我有什么牌')||s.includes('我的点数'))return 'own-hand';
  if(s.includes('庄家')&&(s.includes('明牌')||s.includes('亮牌')||s.includes('显示')))return 'dealer-upcard';
  if(s.includes('轮到谁')||s.includes('谁的回合'))return 'turn';
  if(s.includes('现在什么阶段')||s.includes('游戏状态'))return 'phase';
  if(/\b(my hand|my cards|my total|what do i have|how many points|mi mano|mis cartas|mi total|combien de points|ma main|mes cartes|mon total)/iu.test(s))return 'own-hand';
  if(/\b(dealer.*(showing|up.?card|face.?up)|what.*dealer.*card|crupier.*(muestra|carta visible)|croupière.*(montre|carte visible)|庄家.*(明牌|亮牌)|庄家显示)/iu.test(s))return 'dealer-upcard';
  if(/\b(whose turn|who.*turn|which box.*turn|turn is it|de quién es el turno|a quién le toca|à qui le tour|qui joue|轮到谁|谁的回合)/iu.test(s))return 'turn';
  if(/\b(what phase|what is happening|what's happening|game status|estado de la partida|qué está pasando|quelle phase|où en est la partie|现在什么阶段|游戏状态)/iu.test(s))return 'phase';
  return null;
}

const PHASES={
  en:{betting:'bets are open',dealing:'cards are being dealt',insurance:'insurance is available',decisions:'a player is deciding',settled:'the round is complete',idle:'the table is waiting'},
  es:{betting:'las apuestas están abiertas',dealing:'se están repartiendo las cartas',insurance:'el seguro está disponible',decisions:'un jugador está decidiendo',settled:'la ronda ha terminado',idle:'la mesa está esperando'},
  fr:{betting:'les mises sont ouvertes',dealing:'les cartes sont distribuées',insurance:'l’assurance est disponible',decisions:'un joueur prend sa décision',settled:'la manche est terminée',idle:'la table attend'},
  zh:{betting:'现在可以下注',dealing:'正在发牌',insurance:'现在可以购买保险',decisions:'一位玩家正在决定',settled:'本轮已经结束',idle:'牌桌正在等待'},
};

function sentence(intent,state,language) {
  const lang=dealerLanguage(language),hands=state?.hands??[],dealer=state?.dealerCards??[];
  if(intent==='own-hand') {
    if(!state?.playerName||!state.boxes?.length) {
      return ({en:'Join the table and choose a box first, then I can check your hand.',es:'Primero únete a la mesa y elige una caja; después puedo consultar tu mano.',fr:'Rejoignez la table et choisissez une case pour que je puisse vérifier votre main.',zh:'请先加入牌桌并选择一个位置，然后我就能查看你的手牌。'})[lang];
    }
    if(state.phase==='dealing')return ({en:'The cards are still being dealt. I can check your hand in a moment.',es:'Todavía se están repartiendo las cartas. En un momento puedo consultar tu mano.',fr:'Les cartes sont encore distribuées. Je pourrai vérifier votre main dans un instant.',zh:'还在发牌，稍后我就能查看你的手牌。'})[lang];
    if(!hands.length)return ({en:'You do not have any cards in play right now.',es:'No tienes cartas en juego ahora mismo.',fr:'Vous n’avez pas de cartes en jeu pour le moment.',zh:'你现在没有正在进行的手牌。'})[lang];
    const entries=hands.map(hand=>`Box ${hand.box}: ${hand.cards.join(', ')} (${hand.total})`);
    return ({
      en:`${entries.join('. ')}.`,
      es:`${entries.map((v)=>v.replace('Box ','Caja ')).join('. ')}.`,
      fr:`${entries.map((v)=>v.replace('Box ','Case ')).join('. ')}.`,
      zh:`${hands.map(hand=>`${hand.box}号位置：${hand.cards.join('、')}，${hand.total}点`).join('。')}。`,
    })[lang];
  }
  if(intent==='dealer-upcard') {
    if(!dealer.length)return ({en:'The dealer has not shown a card yet.',es:'La crupier todavía no ha mostrado una carta.',fr:'La croupière n’a pas encore montré de carte.',zh:'庄家还没有亮出牌。'})[lang];
    const rank=dealer[0];
    return ({en:`The dealer is showing ${rank}.`,es:`La crupier muestra ${rank}.`,fr:`La croupière montre un ${rank}.`,zh:`庄家明牌是${rank}。`})[lang];
  }
  if(intent==='turn') {
    if(!state?.activeBox)return ({en:'No player is taking a turn right now.',es:'Ningún jugador tiene el turno ahora mismo.',fr:'Aucun joueur ne joue en ce moment.',zh:'现在没有玩家正在行动。'})[lang];
    return ({en:`Box ${state.activeBox} is up.`,es:`Le toca a la caja ${state.activeBox}.`,fr:`C’est au tour de la case ${state.activeBox}.`,zh:`现在轮到${state.activeBox}号位置。`})[lang];
  }
  const phase=PHASES[lang][state?.phase]??PHASES[lang].idle;
  return ({en:`The table status: ${phase}.`,es:`Estado de la mesa: ${phase}.`,fr:`État de la table : ${phase}.`,zh:`牌桌状态：${phase}。`})[lang];
}

export function createDealerGameTools(shared) {
  return Object.freeze({
    read_public_game_state({session,guestToken,playerName}) {
      return shared.readGameState(session,guestToken,playerName);
    },
    makeReply(intent,state,language) {
      if(!['own-hand','dealer-upcard','turn','phase'].includes(intent))throw new Error('Unsupported game-state question');
      const result=Object.freeze({text:sentence(intent,state,dealerLanguage(language)),lang:dealerLanguage(language)});
      issuedFacts.add(result);
      return result;
    },
  });
}

/** Astrid's lip-synced voice for a line table-facts.mjs built from server state (the per-box
 *  round result). Anything else is refused, so no visitor text can reach her TTS this way. */
export function tableFactForVoice(text, language) {
  if (!approvedFact(text)) throw new Error('Only a server-built table fact may be voiced');
  const result = Object.freeze({ text, lang: dealerLanguage(language) });
  issuedFacts.add(result);
  return result;
}

export function isApprovedGameFact(value) {
  return Boolean(value&&issuedFacts.has(value));
}
