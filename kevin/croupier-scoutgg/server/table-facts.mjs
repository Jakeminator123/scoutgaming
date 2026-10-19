// The dealer can SEE the table: questions about the visitor's own game are answered from the
// shared table's state (cards, dealer's up card, last result, whose turn, shoe, balance).
// Replies are built here from reviewed templates filled with facts only: no model text, no
// predictions, no betting advice. sv, en, pt and ko have their own; es/fr/zh use the English templates.
import { total } from '../public/game-events.js';

const RENDERED = new Set();   // only strings built here may be spoken as a fact reply
export const approvedFact = text => RENDERED.has(text);
// dealer-chat.mjs registers replies that passed its guard, so the voice pipeline may speak them.
export function markApproved(text) { RENDERED.add(text); if (RENDERED.size > 500) RENDERED.delete(RENDERED.values().next().value); }

const T = {
  sv: {
    noRound: 'Ingen runda pågår just nu.',
    notSeated: 'Du sitter inte vid bordet än. Välj en box för att vara med.',
    hand: (box, cards, value, bust) => `Box ${box}: ${cards}, ${bust ? `${value}, tjock` : value}.`,
    dealerShows: (cards, value) => `Dealern har ${cards}${value ? ` (${value})` : ''}.`,
    decide: 'Det beslutet är ditt, jag ger inga råd.',
    predict: 'Ingen kan veta nästa kort. Blandningen är låst innan rundan börjar.',
    turnMine: (box, secs) => `Det är din tur på box ${box}. Du har ${secs} sekunder på dig.`,
    turnOther: name => `Det är ${name}s tur just nu.`,
    turnNone: 'Det är ingens tur just nu.',
    lastNone: 'Du har inte spelat någon runda än.',
    last: (net, staked, lines) => `Förra rundan satsade du ${staked} och ${net > 0 ? `vann ${money(net)}` : net < 0 ? `förlorade ${money(-net)}` : 'gick jämnt'}. ${lines}`,
    lastBoxes: (lines, net, staked) => `Förra rundan: ${lines} Totalt satsade du ${staked} och ${net > 0 ? `vann ${money(net)}` : net < 0 ? `förlorade ${money(-net)}` : 'gick jämnt'}.`,
    lastHand: (box, value, res) => `Box ${box}: ${value}, ${res}.`,
    won: 'vinst', lost: 'förlust', push: 'lika', bust: 'tjock', bj: 'blackjack',
    table: (players, left, decks) => `${players} vid bordet och ${left} kort kvar i skon av ${decks} kortlekar.`,
    one: 'En spelare', many: n => `${n} spelare`,
    balance: b => `Ditt demosaldo är ${b}.`,
  },
  en: {
    noRound: 'No round is in play right now.',
    notSeated: 'You are not seated yet. Choose a box to join.',
    hand: (box, cards, value, bust) => `Box ${box}: ${cards}, ${bust ? `${value}, bust` : value}.`,
    dealerShows: (cards, value) => `The dealer has ${cards}${value ? ` (${value})` : ''}.`,
    decide: 'That decision is yours, I do not give advice.',
    predict: 'Nobody can know the next card. The shuffle is locked before the round starts.',
    turnMine: (box, secs) => `It is your turn on box ${box}. You have ${secs} seconds.`,
    turnOther: name => `It is ${name}'s turn right now.`,
    turnNone: 'It is nobody\'s turn right now.',
    lastNone: 'You have not played a round yet.',
    last: (net, staked, lines) => `Last round you staked ${staked} and ${net > 0 ? `won ${money(net)}` : net < 0 ? `lost ${money(-net)}` : 'broke even'}. ${lines}`,
    lastBoxes: (lines, net, staked) => `Last round: ${lines} In total you staked ${staked} and ${net > 0 ? `won ${money(net)}` : net < 0 ? `lost ${money(-net)}` : 'broke even'}.`,
    lastHand: (box, value, res) => `Box ${box}: ${value}, ${res}.`,
    won: 'win', lost: 'loss', push: 'push', bust: 'bust', bj: 'blackjack',
    table: (players, left, decks) => `${players} at the table and ${left} cards left in the ${decks}-deck shoe.`,
    one: 'One player', many: n => `${n} players`,
    balance: b => `Your demo balance is ${b}.`,
  },
  // Emil 15 Oct: the dealers speak Brazilian Portuguese too; the round result is said in it, not in English
  pt: {
    noRound: 'Nenhuma rodada em andamento agora.',
    notSeated: 'Você ainda não está na mesa. Escolha um box para entrar.',
    hand: (box, cards, value, bust) => `Box ${box}: ${cards}, ${bust ? `${value}, estourou` : value}.`,
    dealerShows: (cards, value) => `A banca tem ${cards}${value ? ` (${value})` : ''}.`,
    decide: 'Essa decisão é sua, eu não dou conselhos.',
    predict: 'Ninguém sabe qual é a próxima carta. O embaralhamento é fechado antes da rodada começar.',
    turnMine: (box, secs) => `É a sua vez no box ${box}. Você tem ${secs} segundos.`,
    turnOther: name => `Agora é a vez de ${name}.`,
    turnNone: 'Não é a vez de ninguém agora.',
    lastNone: 'Você ainda não jogou nenhuma rodada.',
    last: (net, staked, lines) => `Na última rodada você apostou ${staked} e ${net > 0 ? `ganhou ${money(net)}` : net < 0 ? `perdeu ${money(-net)}` : 'empatou'}. ${lines}`,
    lastBoxes: (lines, net, staked) => `Última rodada: ${lines} No total você apostou ${staked} e ${net > 0 ? `ganhou ${money(net)}` : net < 0 ? `perdeu ${money(-net)}` : 'empatou'}.`,
    lastHand: (box, value, res) => `Box ${box}: ${value}, ${res}.`,
    won: 'vitória', lost: 'derrota', push: 'empate', bust: 'estourou', bj: 'blackjack',
    table: (players, left, decks) => `${players} na mesa e ${left} cartas restantes no sapato de ${decks} baralhos.`,
    one: 'Um jogador', many: n => `${n} jogadores`,
    balance: b => `Seu saldo de demonstração é ${b}.`,
  },
  // Emil 19 Oct: Dragan, Paow and Astrid 2.0 speak Korean; the round result is said in it too (입니다 after a value, whatever its last sound)
  ko: {
    noRound: '지금은 진행 중인 라운드가 없어요.',
    notSeated: '아직 테이블에 앉지 않으셨어요. 박스를 골라 참여하세요.',
    hand: (box, cards, value, bust) => `박스 ${box}: ${cards}, ${bust ? `${value}, 버스트` : value}.`,
    dealerShows: (cards, value) => `딜러 카드는 ${cards}${value ? ` (${value})` : ''}입니다.`,
    decide: '그 결정은 손님 몫이에요. 저는 조언을 드리지 않아요.',
    predict: '다음 카드는 아무도 알 수 없어요. 셔플은 라운드가 시작되기 전에 고정돼요.',
    turnMine: (box, secs) => `박스 ${box} 차례입니다. ${secs}초 남았어요.`,
    turnOther: name => `지금은 ${name}님 차례입니다.`,
    turnNone: '지금은 아무의 차례도 아니에요.',
    lastNone: '아직 플레이한 라운드가 없어요.',
    last: (net, staked, lines) => `지난 라운드에 ${staked}를 베팅해서 ${net > 0 ? `${money(net)}를 따셨어요` : net < 0 ? `${money(-net)}를 잃으셨어요` : '본전이었어요'}. ${lines}`,
    lastBoxes: (lines, net, staked) => `지난 라운드: ${lines} 모두 합쳐 ${staked}를 베팅해서 ${net > 0 ? `${money(net)}를 따셨어요` : net < 0 ? `${money(-net)}를 잃으셨어요` : '본전이었어요'}.`,
    lastHand: (box, value, res) => `박스 ${box}: ${value}, ${res}.`,
    won: '승리', lost: '패배', push: '푸시', bust: '버스트', bj: '블랙잭',
    table: (players, left, decks) => `테이블에 ${players}, ${decks}덱 슈에 카드가 ${left}장 남아 있어요.`,
    one: '플레이어 한 명', many: n => `플레이어 ${n}명`,
    balance: b => `데모 잔액은 ${b}입니다.`,
  },
};
const t = lang => T[lang] ?? T.en;
const money = v => `$${Number(v ?? 0).toFixed(2)}`;
const cardsText = cards => cards.filter(c => c.r).map(c => `${c.r}${c.s}`).join(' ');

/** Which fact a visitor message asks for, or null. Advice and predictions get facts plus a firm "no". */
export function factId(text) {
  const s = String(text ?? '').normalize('NFKC').toLowerCase();
  if (/ska jag|borde jag|should i|what should|vad ska jag|hit or stand|ta kort eller|tips|advice|råd/u.test(s)) return 'decide';
  if (/vinner jag|kommer jag|nästa kort|will i win|next card|predict|förutsp/u.test(s)) return 'predict';
  if (/förra|senaste rundan|vad hände|vann jag|förlorade jag|last round|what happened|did i (win|lose)|how did i do/u.test(s)) return 'last';
  if (/saldo|balance|pengar kvar|how much money|hur mycket pengar/u.test(s)) return 'balance';
  if (/vems tur|min tur|whose turn|my turn|is it my/u.test(s)) return 'turn';
  if (/kort kvar|cards left|skon|the shoe|hur många spelare|how many players|vilka spelar|who is playing/u.test(s)) return 'table';
  if (/min hand|mina kort|vad har jag|vad har dealern|dealerns kort|my hand|my cards|what do i have|dealer (has|have|show)|dealer's card|upcard|vad visar/u.test(s)) return 'hand';
  return null;
}

function handLines(v, L) {
  const round = v.round, me = v.me;
  if (!round || v.phase !== 'round') return L.noRound;
  const mine = round.hands.filter(h => v.owners[h.box] === me?.id);
  const lines = mine.map(h => L.hand(7 - h.box, cardsText(h.cards), total(h.cards.filter(c => c.r)), Boolean(h.busted) || total(h.cards.filter(c => c.r)) > 21));
  const up = round.dealer.filter(c => c.r);
  return [...(me?.seats?.length ? lines : [L.notSeated]), L.dealerShows(cardsText(up), up.length > 1 ? total(up) : null)].join(' ');
}

const resultOf = (h, L) => h.busted ? L.bust : h.result > h.stake * 2 ? L.bj : h.result > h.stake ? L.won : h.result === h.stake ? L.push : L.lost;

/** Serhiy: a visitor on two or more boxes whose results differ. Only then does the dealer follow
 *  the table's outcome clip with that visitor's own box-by-box result (roundResult below). */
export function mixedResult(receipt) {
  const hands = receipt?.hands ?? [];
  return hands.length > 1 && new Set(hands.map(h => resultOf(h, T.en))).size > 1;
}

/** The dealer's spoken line after a mixed round, from the visitor's own settlement receipt
 *  (server state, never client text): every box, then the net. Null when nothing is mixed or the
 *  receipt is not this round's. Registered like every other fact, so only it may be voiced. */
export function roundResult(v, roundId, lang = 'en') {
  const r = v.me?.lastSettlement;
  if (!r || r.roundId !== roundId || !mixedResult(r)) return null;
  return tableFact('last', v, lang);
}

/** The reply for a fact id, built from the visitor's own view of the table. */
export function tableFact(id, v, lang = 'en') {
  const L = t(lang);
  let out;
  if (id === 'hand') out = handLines(v, L);
  else if (id === 'decide') out = `${L.decide} ${handLines(v, L)}`;
  else if (id === 'predict') out = `${L.predict} ${handLines(v, L)}`;
  else if (id === 'balance') out = v.me ? L.balance(money(v.me.balance)) : L.notSeated;
  else if (id === 'table') out = L.table(v.players.length === 1 ? L.one : L.many(v.players.length), v.shoe.remaining, v.shoe.decks);
  else if (id === 'turn') {
    const h = v.phase === 'round' && v.round?.phase === 'decisions' ? v.round.hands[v.round.active] : null;
    const owner = h && v.players.find(p => p.id === v.owners[h.box]);
    out = !h ? L.turnNone : owner?.id === v.me?.id ? L.turnMine(7 - h.box, Math.round((v.actionMs ?? 15000) / 1000)) : L.turnOther(owner?.name ?? '?');
  } else if (id === 'last') {
    const r = v.me?.lastSettlement;
    if (!r) out = L.lastNone;
    else {
      const results = r.hands.map(h => {
        const value = total(h.cards.filter(c => c.r));
        const res = h.busted ? L.bust : h.result > h.stake * 2 ? L.bj : h.result > h.stake ? L.won : h.result === h.stake ? L.push : L.lost;
        return { res, line: L.lastHand(7 - h.box, value, res) };   // box 1 = first base (public/box-label.js)
      });
      const lines = results.map(x => x.line).join(' ');
      // Two or more boxes with different results (Serhiy): every box first, the net last, so
      // one lost box never sounds like the whole round was lost.
      const mixed = new Set(results.map(x => x.res)).size > 1;
      out = mixed ? L.lastBoxes(lines, Number(r.net), money(r.staked)) : L.last(Number(r.net), money(r.staked), lines);
    }
  } else return null;
  out = out.replace(/\s+/g, ' ').trim();
  RENDERED.add(out); if (RENDERED.size > 500) RENDERED.delete(RENDERED.values().next().value);
  return out;
}
