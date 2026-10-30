import test from 'node:test';
import assert from 'node:assert/strict';
import { PistiHand, PistiMatch, captures, cardPoints, newDeck } from '../src/pisti.js';
import { botAction } from '../src/bot.js';

const seeded = (seed) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };

// A hand with the table and both players' cards set by hand.
function rigged({ pile, mine, theirs, deck = [] }) {
  const h = new PistiHand({ rng: seeded(1) });
  h.pile = pile; h.hidden = 0; h.hands = [mine, theirs]; h.deck = deck; h.turn = 0; h.captured = [[], []]; h.pisti = [0, 0]; h.pistiCount = [0, 0];
  return h;
}

test('deck has 52 cards and the scoring cards are worth 11 points in all', () => {
  const d = newDeck();
  assert.equal(new Set(d).size, 52);
  assert.equal(d.reduce((n, c) => n + cardPoints(c), 0), 2 + 3 + 4 + 4);
});

test('matching rank or a jack takes the table, nothing takes an empty one', () => {
  assert.ok(captures('H5', 'S5'));
  assert.ok(captures('H11', 'S5'));
  assert.ok(!captures('H6', 'S5'));
  assert.ok(!captures('H11', null));
});

test('a deal: 4 face-up/down on the table, 4 each, 40 left, face-up card is not a jack', () => {
  for (let i = 1; i < 50; i++) {
    const h = new PistiHand({ dealer: 1, rng: seeded(i) });
    assert.equal(h.pile.length, 4);
    assert.equal(h.hands[0].length + h.hands[1].length, 8);
    assert.equal(h.deck.length, 40);
    assert.notEqual(h.top.slice(1), '11');
    assert.equal(h.turn, 0);
  }
});

test('pişti: a lone card taken by the same rank gives 10, by a jack nothing, jack on jack 20', () => {
  let h = rigged({ pile: ['S5'], mine: ['H5', 'C9'], theirs: ['D3'] });
  assert.equal(h.play(0, 'H5').pisti, 10);
  h = rigged({ pile: ['S5'], mine: ['H11', 'C9'], theirs: ['D3'] });
  const r = h.play(0, 'H11');
  assert.equal(r.pisti, 0);
  assert.equal(r.took.length, 2);
  h = rigged({ pile: ['S11'], mine: ['H11', 'C9'], theirs: ['D3'] });
  assert.equal(h.play(0, 'H11').pisti, 20);
});

test('rejects a card you do not hold and a move out of turn', () => {
  const h = rigged({ pile: ['S5'], mine: ['H5'], theirs: ['D3'] });
  assert.equal(h.play(1, 'D3').ok, false);
  assert.equal(h.play(0, 'H9').ok, false);
});

test('last taker gets the leftovers, most cards gives 3, ties give nothing', () => {
  const h = rigged({ pile: ['S5', 'D6'], mine: ['H9'], theirs: ['C2'] });
  h.play(0, 'H9'); // nothing taken: 9 on 6
  h.lastCapture = 1;
  h.play(1, 'C2');
  assert.equal(h.phase, 'done');
  assert.equal(h.leftover, 4);
  assert.equal(h.captured[1].length, 4);
  assert.deepEqual(h.scores, [0, 2 + 3]); // 2 of clubs = 2, most cards = 3
});

test('a full hand with random moves ends with all 52 cards accounted for', () => {
  const rng = seeded(7);
  for (let g = 0; g < 100; g++) {
    const h = new PistiHand({ dealer: g % 2, rng });
    let guard = 0;
    while (h.phase !== 'done' && guard++ < 100) h.play(h.turn, h.hands[h.turn][Math.floor(rng() * h.hands[h.turn].length)]);
    assert.equal(h.phase, 'done');
    assert.equal(h.captured[0].length + h.captured[1].length + (h.lastCapture == null ? h.leftover : 0), 52);
    assert.ok(h.scores.reduce((a, b) => a + b) >= 11);
  }
});

test('bot: takes a lone card for a pişti, keeps its jack for a poor table', () => {
  let h = rigged({ pile: ['S5'], mine: ['H5', 'C11'], theirs: ['D3', 'D4', 'D8'] });
  h.turn = 1; [h.hands[0], h.hands[1]] = [h.hands[1], h.hands[0]];
  assert.equal(botAction(h, { level: 'zor', rng: seeded(3) }).card, 'H5');
  h = rigged({ pile: ['S5', 'S6'], mine: ['H11', 'C9'], theirs: ['D3', 'D4'], deck: ['H2'] });
  h.turn = 1; [h.hands[0], h.hands[1]] = [h.hands[1], h.hands[0]];
  assert.equal(botAction(h, { level: 'normal', rng: seeded(3) }).card, 'C9');
});

test('bots always play a legal card; the hard level beats the easy one over many hands', () => {
  const rng = seeded(11);
  const wins = { zor: 0, kolay: 0 };
  for (let g = 0; g < 300; g++) {
    const h = new PistiHand({ dealer: g % 2, rng });
    while (h.phase !== 'done') {
      const level = h.turn === 0 ? 'zor' : 'kolay';
      const { card } = botAction(h, { level, seat: h.turn, rng });
      assert.ok(h.play(h.turn, card).ok);
    }
    if (h.scores[0] > h.scores[1]) wins.zor++; else if (h.scores[1] > h.scores[0]) wins.kolay++;
  }
  assert.ok(wins.zor > wins.kolay, JSON.stringify(wins));
});

test('a match ends at the target, saves and restores', () => {
  const m = new PistiMatch({ settings: { targetScore: 51 }, rng: seeded(5) });
  m.startRound();
  const copy = PistiMatch.fromJSON(JSON.parse(JSON.stringify(m.toJSON())), seeded(9));
  assert.deepEqual(copy.hand.hands, m.hand.hands);
  let rounds = 0;
  while (!m.over && rounds++ < 40) {
    const h = m.hand;
    while (h.phase !== 'done') h.play(h.turn, botAction(h, { level: 'normal', seat: h.turn }).card);
    m.finishRound();
    if (!m.over) m.startRound();
  }
  assert.ok(m.over);
  assert.ok(m.scores[m.winner] >= 51);
});

test('four players: 4 cards each, 3 deals in all, the player after the dealer leads, turns go round', () => {
  const rng = seeded(21);
  const h = new PistiHand({ players: 4, rng });
  assert.deepEqual(h.hands.map((x) => x.length), [4, 4, 4, 4]);
  assert.equal(h.deck.length, 32);
  assert.equal(h.turn, 0); // the dealer is seat 3
  let deals = 1;
  let last = h.deck.length;
  while (h.phase !== 'done') {
    const seat = h.turn;
    h.play(seat, h.hands[seat][0]);
    if (h.deck.length < last) { deals++; last = h.deck.length; }
    if (h.phase !== 'done') assert.equal(h.turn, (seat + 1) % 4);
  }
  assert.equal(deals, 3);
  assert.equal(h.captured.reduce((n, c) => n + c.length, 0) + (h.lastCapture == null ? h.leftover : 0), 52);
});

test('teams: points and the card bonus are added per team (seats 0+2 against 1+3)', () => {
  const h = new PistiHand({ players: 4, teams: true, rng: seeded(2) });
  h.captured = [['C2', 'S5'], ['D10', 'H9', 'H8'], ['S14'], []];
  h.pisti = [10, 0, 0, 0];
  h.phase = 'done';
  assert.deepEqual(h.score(), [2 + 1 + 10, 3]); // 3 cards each: a tie gives nobody the card bonus
  h.captured[1].push('H7');
  assert.deepEqual(h.score(), [13, 3 + 3]); // team 1 now has more cards
  assert.equal(h.sideOf(2), 0);
  assert.equal(h.sideOf(3), 1);
});

test('alone, four players: four sides, the most cards gets 3', () => {
  const h = new PistiHand({ players: 4, rng: seeded(3) });
  h.captured = [['H3', 'H4'], ['S3'], ['D3', 'D4', 'D5'], []];
  h.pisti = [0, 0, 0, 0];
  assert.deepEqual(h.score(), [0, 0, 3, 0]);
});

test('view hides other hands and the face-down table cards, and reports the taken table', () => {
  const h = new PistiHand({ players: 4, rng: seeded(4) });
  const v = h.view(2);
  assert.deepEqual(v.hand, h.hands[2]);
  assert.equal(v.pile.filter((c) => c === '?').length, 3);
  assert.equal(v.pile[3], h.pile[3]);
  assert.equal(JSON.stringify(v).includes(h.hands[0][0]), false);
  const r = rigged({ pile: ['S5', 'D6'], mine: ['H6'], theirs: ['D3'] });
  r.hidden = 1;
  r.play(0, 'H6');
  assert.equal(r.view(0).lastTake.cards.length, 3);
  assert.equal(r.view(0).lastTake.hidden, 1);
});

test('a four player match ends by team or alone, saves and restores', () => {
  for (const teams of [false, true]) {
    const m = new PistiMatch({ settings: { players: 4, teams, targetScore: 51 }, rng: seeded(8) });
    m.startRound();
    const copy = PistiMatch.fromJSON(JSON.parse(JSON.stringify(m.toJSON())), seeded(9));
    assert.deepEqual(copy.hand.hands, m.hand.hands);
    let rounds = 0;
    while (!m.over && rounds++ < 80) {
      const h = m.hand;
      while (h.phase !== 'done') h.play(h.turn, botAction(h, { level: 'zor', seat: h.turn }).card);
      m.finishRound();
      if (!m.over) m.startRound();
    }
    assert.ok(m.over);
    assert.equal(m.scores.length, teams ? 2 : 4);
    assert.ok(m.scores[m.winner] >= 51);
  }
});
