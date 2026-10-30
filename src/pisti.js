// Pişti rules without any DOM. 2 or 4 players (4 either on their own or as two teams), 52 cards;
// a card is 'S14' = suit + rank (J 11, Q 12, K 13, A 14). Seats are 0..n-1 in the order of play (clockwise):
// with 4 players seat 0 is bottom, 1 right, 2 top, 3 left; with teams seats 0+2 play against 1+3.

export const SUITS = ['S', 'H', 'D', 'C'];
export const suitOf = (c) => c[0];
export const rankOf = (c) => Number(c.slice(1));
export const isJack = (c) => rankOf(c) === 11;

export const newDeck = () => SUITS.flatMap((s) => Array.from({ length: 13 }, (_, i) => `${s}${i + 2}`));

export function shuffle(arr, rng = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Points a single captured card is worth: 2 of clubs 2, 10 of diamonds 3, every ace and jack 1.
export function cardPoints(c) {
  if (c === 'C2') return 2;
  if (c === 'D10') return 3;
  const r = rankOf(c);
  return r === 14 || r === 11 ? 1 : 0;
}
export const pilePoints = (cards) => cards.reduce((n, c) => n + cardPoints(c), 0);

export const PISTI = 10;
export const DOUBLE_PISTI = 20;
export const MOST_CARDS = 3;
export const HIDDEN = '?'; // what a player sees of a face-down card

// Does `card` take a pile whose top card is `top`? A jack takes anything; an empty pile takes nothing.
export function captures(card, top) {
  return top != null && (isJack(card) || rankOf(card) === rankOf(top));
}

export class PistiHand {
  // `dealer` deals; the player after them leads. `state` restores a saved hand.
  constructor({ players = 2, teams = false, dealer, rng = Math.random, state } = {}) {
    if (state) {
      Object.assign(this, structuredClone(state));
      return;
    }
    this.n = players;
    this.teams = players === 4 && teams;
    this.dealer = dealer ?? players - 1;
    let deck;
    do deck = shuffle(newDeck(), rng); while (isJack(deck[3])); // the face-up card is never a jack
    this.pile = deck.splice(0, 4); // bottom three face-down, the top one face-up
    this.hidden = 3; // how many cards from the bottom are still face-down
    this.hands = Array.from({ length: players }, () => []);
    this.deck = deck;
    this.captured = Array.from({ length: players }, () => []);
    this.pisti = new Array(players).fill(0); // pişti bonus points per seat
    this.pistiKinds = Array.from({ length: players }, () => [0, 0]); // [single, double] pişti per seat
    this.lastCapture = null;
    this.turn = (this.dealer + 1) % players;
    this.phase = 'play';
    this.seq = 0; // cards played so far
    this.takeSeq = 0; // tables taken so far
    this.lastAction = null; // { seq, seat, card, took, pisti }
    this.lastTake = null; // { seq, seat, cards, hidden, pisti, end } of the latest taken table
    this.deal();
  }

  get sides() { return this.teams ? 2 : this.n; }
  sideOf(seat) { return this.teams ? seat % 2 : seat; }
  get top() { return this.pile.length ? this.pile[this.pile.length - 1] : null; }
  get visiblePile() { return this.pile.slice(this.hidden); }
  legalCards(seat) { return this.turn === seat && this.phase === 'play' ? this.hands[seat].slice() : []; }

  deal() {
    for (let i = 0; i < 4; i++) for (let k = 1; k <= this.n; k++) this.hands[(this.dealer + k) % this.n].push(this.deck.shift());
  }

  // Plays a card. Returns { ok, took, pisti } where took is the list of cards taken from the table (empty when none).
  play(seat, card) {
    if (this.phase !== 'play') return { ok: false, error: 'done' };
    if (seat !== this.turn) return { ok: false, error: 'notYourTurn' };
    const i = this.hands[seat].indexOf(card);
    if (i < 0) return { ok: false, error: 'noCard' };
    this.hands[seat].splice(i, 1);
    const top = this.top;
    const single = this.pile.length === 1;
    const takes = captures(card, top);
    const hiddenBefore = this.hidden;
    this.pile.push(card);
    let took = [];
    let pisti = 0;
    if (takes) {
      took = this.pile;
      this.pile = [];
      this.hidden = 0;
      this.captured[seat].push(...took);
      this.lastCapture = seat;
      // pişti: took a lone card; with a jack it only counts when the lone card was a jack too
      if (single) pisti = isJack(card) ? (isJack(top) ? DOUBLE_PISTI : 0) : PISTI;
      if (pisti) { this.pisti[seat] += pisti; this.pistiKinds[seat][pisti === DOUBLE_PISTI ? 1 : 0]++; }
      this.lastTake = { seq: ++this.takeSeq, seat, cards: took.slice(), hidden: hiddenBefore, pisti, end: false };
    }
    this.lastAction = { seq: ++this.seq, seat, card, took: took.length, pisti };
    this.advance();
    return { ok: true, took, pisti };
  }

  advance() {
    this.turn = (this.turn + 1) % this.n;
    if (this.hands.some((h) => h.length)) return;
    if (this.deck.length) { this.deal(); return; }
    // last card played: whoever took last also gets what is left on the table
    this.leftover = this.pile.length;
    if (this.pile.length && this.lastCapture != null) {
      this.captured[this.lastCapture].push(...this.pile);
      this.lastTake = { seq: ++this.takeSeq, seat: this.lastCapture, cards: this.pile.slice(), hidden: this.hidden, pisti: 0, end: true };
    }
    this.pile = [];
    this.hidden = 0;
    this.phase = 'done';
    this.scores = this.score();
  }

  // Cards, scoring-card points and pişti points of one seat.
  breakdown(seat) {
    return { cards: this.captured[seat].length, points: pilePoints(this.captured[seat]), pisti: this.pisti[seat] };
  }

  // Points of each side (a player, or a team) for this hand.
  score() {
    const count = new Array(this.sides).fill(0);
    const pts = new Array(this.sides).fill(0);
    for (let s = 0; s < this.n; s++) {
      const side = this.sideOf(s);
      count[side] += this.captured[s].length;
      pts[side] += pilePoints(this.captured[s]) + this.pisti[s];
    }
    const top = Math.max(...count);
    const leaders = count.filter((c) => c === top).length; // a tie gives nobody the 3 points
    return pts.map((p, side) => p + (leaders === 1 && count[side] === top ? MOST_CARDS : 0));
  }

  // What `seat` may see: its own cards, the face-up table, sizes of everything else.
  view(seat) {
    const done = this.phase === 'done';
    return {
      n: this.n,
      teams: this.teams,
      phase: this.phase,
      turn: this.turn,
      dealer: this.dealer,
      seq: this.seq,
      hand: this.hands[seat].slice(),
      handSizes: this.hands.map((h) => h.length),
      pile: this.pile.map((c, i) => (i < this.hidden ? HIDDEN : c)),
      hidden: this.hidden,
      deckCount: this.deck.length,
      captured: this.captured.map((c) => c.length),
      stats: this.captured.map((_, s) => this.breakdown(s)),
      pistiKinds: this.pistiKinds.map((k) => k.slice()),
      lastCapture: this.lastCapture,
      lastAction: this.lastAction && { ...this.lastAction },
      lastTake: this.lastTake && { ...this.lastTake, cards: this.lastTake.cards.slice() },
      scores: done ? this.scores.slice() : null,
      leftover: done ? this.leftover : 0,
    };
  }

  toJSON() { return structuredClone({ ...this }); }
  static fromJSON(state) { return new PistiHand({ state }); }
}

export class PistiMatch {
  // settings: { players: 2|4, teams, targetScore }
  constructor({ settings = {}, rng = Math.random, state } = {}) {
    this.rng = rng;
    if (state) {
      Object.assign(this, structuredClone(state), { rng });
      this.hand = state.hand ? PistiHand.fromJSON(state.hand) : null;
      return;
    }
    const players = settings.players === 4 ? 4 : 2;
    this.settings = { players, teams: players === 4 && !!settings.teams, targetScore: settings.targetScore ?? 101 };
    this.sides = this.settings.teams ? 2 : players;
    this.scores = new Array(this.sides).fill(0);
    this.rounds = []; // { scores, pisti, cards } per finished hand
    this.dealer = players - 1; // so seat 0, the human who made the room, leads the first hand
    this.hand = null;
  }

  get n() { return this.settings.players; }
  sideOf(seat) { return this.settings.teams ? seat % 2 : seat; }

  startRound() {
    this.hand = new PistiHand({ players: this.n, teams: this.settings.teams, dealer: this.dealer, rng: this.rng });
    return this.hand;
  }

  // Adds the finished hand to the totals.
  finishRound() {
    const h = this.hand;
    if (!h || h.phase !== 'done') return false;
    this.rounds.push({ scores: h.scores.slice(), pisti: h.pisti.slice(), cards: h.captured.map((c) => c.length) });
    this.scores = this.scores.map((x, i) => x + h.scores[i]);
    this.dealer = (this.dealer + 1) % this.n;
    this.hand = null;
    return true;
  }

  get over() {
    const t = this.settings.targetScore;
    const top = Math.max(...this.scores);
    return top >= t && this.scores.filter((s) => s === top).length === 1;
  }
  // The winning side (a player, or a team).
  get winner() { return this.over ? this.scores.indexOf(Math.max(...this.scores)) : null; }
  // Standings, best first: [{ side, score, place }]
  get standings() {
    return this.scores.map((score, side) => ({ side, score })).sort((a, b) => b.score - a.score || a.side - b.side).map((x, i, all) => ({ ...x, place: i && all[i - 1].score === x.score ? all[i - 1].place : i + 1 }));
  }

  view(seat) {
    return {
      settings: { ...this.settings },
      scores: this.scores.slice(),
      rounds: this.rounds.map((r) => ({ scores: r.scores.slice(), pisti: r.pisti.slice(), cards: r.cards.slice() })),
      over: this.over,
      winner: this.winner,
      standings: this.standings,
      hand: this.hand ? this.hand.view(seat) : null,
    };
  }

  toJSON() {
    const { rng, hand, ...rest } = this;
    return structuredClone({ ...rest, hand: hand ? hand.toJSON() : null });
  }
  static fromJSON(state, rng) { return new PistiMatch({ state, rng }); }
}
