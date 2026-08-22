// Demo-mode blackjack round engine (client-side for this demo only — in the
// real product the server decides everything; this module exists so the
// recreation is playable without an RGS).
// Rules per the build scope: 8 decks reshuffled every round, S17, American
// hole card with peek, blackjack 3:2, insurance 2:1, double any two, no
// surrender, up to 7 boxes. Side bets, settled at deal time: Perfect Pairs
// (perfect 25:1 / colored 12:1 / mixed 6:1) and 21+3 (suited trips 100:1 /
// straight flush 40:1 / trips 30:1 / straight 10:1 / flush 5:1).

const RANKS = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const SUITS = ['♠','♥','♦','♣'];

// Unbiased shuffle: Fisher–Yates drawing via rejection sampling, never modulo.
function randInt(n) {
  const max = Math.floor(0xFFFFFFFF / n) * n;
  const buf = new Uint32Array(1);
  do { crypto.getRandomValues(buf); } while (buf[0] >= max);
  return buf[0] % n;
}
export function freshShoe(decks = 8) {
  const shoe = [];
  for (let d = 0; d < decks; d++)
    for (const s of SUITS) for (const r of RANKS) shoe.push({ r, s });
  for (let i = shoe.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    [shoe[i], shoe[j]] = [shoe[j], shoe[i]];
  }
  return shoe;
}

export function handValue(cards) {
  let total = 0, aces = 0;
  for (const c of cards) {
    if (c.r === 'A') { aces++; total += 11; }
    else total += ['J','Q','K','10'].includes(c.r) ? 10 : Number(c.r);
  }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  const soft = aces > 0;
  return { total, soft };
}
const isBJ = cards => cards.length === 2 && handValue(cards).total === 21;
const tenVal = c => ['10','J','Q','K'].includes(c.r);
const isRed = c => c.s === '♥' || c.s === '♦';
const rankOrd = c => RANKS.indexOf(c.r) + 1; // A=1, 2..10, J=11, Q=12, K=13

// Perfect Pairs: player's first two cards. Returns {name, pays} or null.
function perfectPairsHit(c1, c2) {
  if (c1.r !== c2.r) return null;
  if (c1.s === c2.s) return { name: 'Perfect Pair', pays: 25 };
  if (isRed(c1) === isRed(c2)) return { name: 'Colored Pair', pays: 12 };
  return { name: 'Mixed Pair', pays: 6 };
}

// 21+3: player's first two cards + dealer upcard. Returns {name, pays} or null.
// Straights: ace high or low (A-2-3 and Q-K-A valid, no K-A-2 wraparound).
function isStraight3(cards) {
  const v = cards.map(rankOrd).sort((a, b) => a - b);
  if (v[0] === v[1] || v[1] === v[2]) return false; // needs 3 distinct ranks
  if (v[0] + 1 === v[1] && v[1] + 1 === v[2]) return true; // ace low / no ace
  return v[0] === 1 && v[1] === 12 && v[2] === 13;          // ace high: Q-K-A
}
function twentyOnePlusThreeHit(cards) {
  const suited = cards.every(c => c.s === cards[0].s);
  if (cards.every(c => c.r === cards[0].r))
    return suited ? { name: 'Suited Three of a Kind', pays: 100 } : { name: 'Three of a Kind', pays: 30 };
  const straight = isStraight3(cards);
  if (straight && suited) return { name: 'Straight Flush', pays: 40 };
  if (straight) return { name: 'Straight', pays: 10 };
  if (suited) return { name: 'Flush', pays: 5 };
  return null;
}

export class Round {
  // boxes: array of stakes, e.g. [25] or [25, 0, 100] (0 = empty box), or of
  // objects {main, pp, tp} (numbers, 0 = not placed). A box is live when
  // main > 0; pp/tp without main are ignored.
  constructor(boxes) {
    this.shoe = freshShoe();
    this.boxes = boxes.map(box => {
      const o = typeof box === 'object' && box !== null ? box : { main: box };
      return {
        stake: o.main || 0, pp: o.pp || 0, tp: o.tp || 0,
        cards: [], done: false, doubled: false, insured: 0, result: null,
        sideReturn: 0, sideLabels: [],
      };
    });
    this.dealer = [];
    this.phase = 'dealing';
    this.active = -1;
    this.events = [];
  }
  emit(e, data) { this.events.push({ e, ...data }); }
  draw() { return this.shoe.pop(); }

  deal() {
    for (const b of this.live()) b.cards.push(this.draw());
    this.dealer.push(this.draw());             // upcard
    for (const b of this.live()) b.cards.push(this.draw());
    this.holeCard = this.draw();               // face down, dealt but hidden
    this.settleSideBets();
    this.emit('round.dealt');
    const up = this.dealer[0];
    if (up.r === 'A') { this.phase = 'insurance'; this.emit('insurance.offered'); return; }
    this.afterInsurance();
  }

  live() { return this.boxes.filter(b => b.stake > 0); }

  // Side bets settle off the first two player cards + dealer upcard, right at
  // the deal. "pays N:1" => total return = stake * (N + 1); loss = 0.
  settleSideBets() {
    const up = this.dealer[0];
    for (const b of this.live()) {
      if (b.pp > 0) {
        const hit = perfectPairsHit(b.cards[0], b.cards[1]);
        if (hit) {
          b.sideReturn += b.pp * (hit.pays + 1);
          b.sideLabels.push(`${hit.name} ${hit.pays}:1`);
        }
      }
      if (b.tp > 0) {
        const hit = twentyOnePlusThreeHit([b.cards[0], b.cards[1], up]);
        if (hit) {
          b.sideReturn += b.tp * (hit.pays + 1);
          b.sideLabels.push(`${hit.name} ${hit.pays}:1`);
        }
      }
    }
  }

  // insuranceTaken: array of booleans matching live() order
  resolveInsurance(insuranceTaken = []) {
    this.live().forEach((b, i) => {
      if (insuranceTaken[i]) b.insured = b.stake / 2;
    });
    this.afterInsurance();
  }

  afterInsurance() {
    const up = this.dealer[0];
    if (up.r === 'A' || tenVal(up)) {
      this.emit('dealer.peek');
      if (isBJ([up, this.holeCard])) {
        this.dealer.push(this.holeCard);
        this.emit('dealer.blackjack');
        this.settle();
        return;
      }
    }
    this.phase = 'decisions';
    this.advance();
  }

  advance() {
    const boxes = this.live();
    this.active = boxes.findIndex(b => !b.done);
    if (this.active === -1) { this.dealerPlay(); return; }
    const b = boxes[this.active];
    if (isBJ(b.cards) || handValue(b.cards).total >= 21) { b.done = true; this.advance(); return; }
    this.emit('hand.thinking', { box: this.active });
  }

  legal() {
    const b = this.live()[this.active];
    if (!b) return [];
    const acts = ['hit', 'stand'];
    if (b.cards.length === 2 && !b.doubled) acts.push('double');
    return acts;
  }

  act(action) {
    const b = this.live()[this.active];
    if (!b || !this.legal().includes(action)) throw new Error(`illegal action ${action}`);
    if (action === 'hit') {
      b.cards.push(this.draw());
      this.emit('card.dealt', { box: this.active, card: b.cards.at(-1) });
      if (handValue(b.cards).total >= 21) b.done = true;
    } else if (action === 'double') {
      b.doubled = true; b.stake *= 2;
      b.cards.push(this.draw());
      this.emit('card.dealt', { box: this.active, card: b.cards.at(-1) });
      b.done = true;
    } else b.done = true;
    if (b.done) this.advance();
  }

  dealerPlay() {
    this.phase = 'dealer';
    this.dealer.push(this.holeCard);
    this.emit('dealer.reveal');
    const anyLive = this.live().some(b => handValue(b.cards).total <= 21 && !isBJ(b.cards));
    if (anyLive) {
      // S17: stand on ALL 17s including soft
      while (handValue(this.dealer).total < 17) {
        this.dealer.push(this.draw());
        this.emit('dealer.draw', { card: this.dealer.at(-1) });
      }
    }
    this.settle();
  }

  settle() {
    this.phase = 'settled';
    const d = handValue(this.dealer).total;
    const dealerBJ = isBJ(this.dealer);
    for (const b of this.live()) {
      const p = handValue(b.cards).total;
      let payout = 0; // total returned to player (stake included when won/pushed)
      if (b.insured) payout += dealerBJ ? b.insured * 3 : 0;
      if (isBJ(b.cards)) payout += dealerBJ ? b.stake : b.stake * 2.5;
      else if (dealerBJ || p > 21) payout += 0;
      else if (d > 21 || p > d) payout += b.stake * 2;
      else if (p === d) payout += b.stake;
      b.result = payout;
    }
    this.emit('round.settled');
  }
}
