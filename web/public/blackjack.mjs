// Demo-mode blackjack round engine (client-side for this demo only — in the
// real product the server decides everything; this module exists so the
// recreation is playable without an RGS).
// Rules per the build scope: 8 decks reshuffled every round, S17, American
// hole card with peek, blackjack 3:2, insurance 2:1, double any two, no
// surrender, up to 3 boxes.

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

export class Round {
  // boxes: array of stakes, e.g. [25] or [25, 0, 100] (0 = empty box)
  constructor(boxes) {
    this.shoe = freshShoe();
    this.boxes = boxes.map(stake => ({ stake, cards: [], done: false, doubled: false, insured: 0, result: null }));
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
    this.emit('round.dealt');
    const up = this.dealer[0];
    if (up.r === 'A') { this.phase = 'insurance'; this.emit('insurance.offered'); return; }
    this.afterInsurance();
  }

  live() { return this.boxes.filter(b => b.stake > 0); }

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
