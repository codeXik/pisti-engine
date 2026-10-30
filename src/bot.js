// The computer player. It sees what a real player sees: its own cards, the face-up part of the table,
// and (for the stronger levels) everything that was played and taken so far.
import { captures, rankOf, isJack, cardPoints, pilePoints, newDeck, PISTI, DOUBLE_PISTI } from './pisti.js';

export const LEVELS = { kolay: 'Kolay', normal: 'Normal', zor: 'Zor' };

// Chance that a hand of `h` unknown cards drawn from `pool` holds at least one card that satisfies `test`.
function chanceHas(pool, h, test) {
  const k = pool.filter(test).length;
  if (!k || !h) return 0;
  let none = 1;
  for (let i = 0; i < h; i++) none *= Math.max(0, pool.length - k - i) / (pool.length - i);
  return 1 - none;
}

// Cards the player cannot place: own hand, face-up table cards and (hard level) every card already taken.
function unseenPool(hand, seat, level) {
  const known = new Set(hand.hands[seat]);
  for (const c of hand.visiblePile) known.add(c);
  if (level === 'zor') for (const cards of hand.captured) for (const c of cards) known.add(c);
  else if (level === 'normal') for (const c of hand.captured[seat]) known.add(c); // remembers only its own takings
  return newDeck().filter((c) => !known.has(c));
}

// Value of taking `cards` from the table, in points (the table cards plus the card played).
function takeValue(hand, seat, played, level) {
  const pile = hand.pile;
  const top = hand.top;
  let v = pilePoints(pile) + cardPoints(played) + pile.length * 0.45; // every card counts towards the 3 points for most cards
  if (pile.length === 1) v += isJack(played) ? (isJack(top) ? DOUBLE_PISTI : 0) : PISTI;
  if (level === 'zor') {
    const mine = hand.captured.reduce((n, c, s) => n + (hand.sideOf(s) === hand.sideOf(seat) ? c.length : 0), 0);
    const rival = Math.max(...Array.from({ length: hand.sides }, (_, side) => hand.captured.reduce((n, c, s) => n + (hand.sideOf(s) === side && side !== hand.sideOf(seat) ? c.length : 0), 0)));
    if (Math.abs(mine - rival) < 10) v += 0.6; // the card race is close
  }
  return v;
}

export function botAction(hand, { level = 'normal', seat = 1, rng = Math.random } = {}) {
  const mine = hand.hands[seat];
  // cards held by the players who can take the table back from us (a partner never does)
  const opp = hand.hands.reduce((n, h, s) => n + (hand.sideOf(s) !== hand.sideOf(seat) ? h.length : 0), 0);
  const pool = level === 'kolay' ? [] : unseenPool(hand, seat, level);
  const top = hand.top;

  if (level === 'kolay') {
    const takers = mine.filter((c) => captures(c, top));
    if (takers.length && rng() < 0.7) return { card: takers.filter((c) => !isJack(c))[0] || takers[0] };
    return { card: mine[Math.floor(rng() * mine.length)] };
  }

  let best = null;
  let bestScore = -Infinity;
  for (const c of mine) {
    let s;
    if (captures(c, top)) {
      const v = takeValue(hand, seat, c, level);
      s = v + 1; // taking is better than giving the table away
      if (isJack(c)) {
        // a jack is the only card that takes anything, so keep it for a table worth having
        const worth = pilePoints(hand.pile) + hand.pile.length * 0.45 + (hand.pile.length === 1 && isJack(top) ? DOUBLE_PISTI : 0);
        const lastCards = mine.length === 1 && !hand.deck.length;
        s = worth >= 2.5 || lastCards ? v + 1 : v - 3.5;
      }
    } else {
      // dumping: what the opponent can take back, and the risk of a pişti when the table is (nearly) empty
      const onTable = hand.pile.length + 1;
      const tableValue = pilePoints(hand.pile) + cardPoints(c) + onTable * 0.45;
      const rank = rankOf(c);
      const matchChance = chanceHas(pool, opp, (x) => rankOf(x) === rank);
      const jackChance = chanceHas(pool, opp, isJack);
      const loss = matchChance * (tableValue + (hand.pile.length === 0 ? PISTI : 0)) + jackChance * tableValue * (1 - matchChance);
      s = -loss - (isJack(c) ? 1.5 : 0) - cardPoints(c) * 0.3;
    }
    s += (level === 'zor' ? 0.0001 : 0.001) * rng(); // break ties without a pattern
    if (s > bestScore) { bestScore = s; best = c; }
  }
  return { card: best };
}
