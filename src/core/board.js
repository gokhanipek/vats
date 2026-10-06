// Board construction: grid size by tier, who supplies how many pairs, and the
// shuffled shared table. Each supplied fragment puts one pair (2 cards) on it.
import { BOARD_TIERS, LUCIDITY_BOARD_TIER } from './tuning';
import { bestFirst } from './fragments';
import { shuffleWith } from './rng';

/**
 * The board tier for a Lucidity level (clamped to the known levels).
 * @param {number} lucidity
 * @returns {number}
 */
export function boardTierForLucidity(lucidity) {
  const levels = Object.keys(LUCIDITY_BOARD_TIER).map(Number);
  const level = Math.min(Math.max(lucidity, Math.min(...levels)), Math.max(...levels));
  return LUCIDITY_BOARD_TIER[level];
}

/**
 * Grid dimensions and pair count for a board tier (clamped to the known tiers).
 * @param {number} boardTier
 * @returns {{cols:number, rows:number, pairs:number}}
 */
export function gridFor(boardTier) {
  const keys = Object.keys(BOARD_TIERS).map(Number);
  const tier = Math.min(Math.max(boardTier, Math.min(...keys)), Math.max(...keys));
  const { cols, rows } = BOARD_TIERS[tier];
  return { cols, rows, pairs: (cols * rows) / 2 };
}

/**
 * How many pairs each side supplies. Each side owes half; the odd pair and any
 * shortfall go to the side chosen by: more fragments, then higher level, then random.
 * @param {number} totalPairs
 * @param {{id:string, level:number, count:number}} a
 * @param {{id:string, level:number, count:number}} b
 * @param {function(): number} rng
 * @returns {Object<string, number>} pairs per side id
 */
export function splitPairs(totalPairs, a, b, rng) {
  let major = a;
  let minor = b;
  if (b.count > a.count || (b.count === a.count && b.level > a.level)
    || (b.count === a.count && b.level === a.level && rng() < 0.5)) {
    major = b;
    minor = a;
  }
  let majorShare = Math.ceil(totalPairs / 2);
  let minorShare = totalPairs - majorShare;
  if (minor.count < minorShare) {
    majorShare += minorShare - minor.count;
    minorShare = minor.count;
  }
  if (major.count < majorShare) {
    const short = majorShare - major.count;
    majorShare = major.count;
    minorShare = Math.min(minor.count, minorShare + short);
  }
  return { [major.id]: majorShare, [minor.id]: minorShare };
}

/**
 * Build the shared table.
 * @param {Array<{id:string, level:number, fragments:Array}>} sides - exactly two
 * @param {number} boardTier
 * @param {function(): number} rng
 * @returns {{cols:number, rows:number, cards:Array, supplied:Object<string,Array>}}
 *   cards: { ownerId, type, tier, faceUp, claimedBy }, indexed by board position.
 */
export function buildBoard(sides, boardTier, rng) {
  const [a, b] = sides;
  const { cols, pairs } = gridFor(boardTier);
  const shares = splitPairs(
    pairs,
    { id: a.id, level: a.level, count: a.fragments.length },
    { id: b.id, level: b.level, count: b.fragments.length },
    rng
  );
  const supplied = {};
  const cards = [];
  sides.forEach((side) => {
    supplied[side.id] = bestFirst(side.fragments).slice(0, shares[side.id]);
    supplied[side.id].forEach((f) => {
      const card = { ownerId: side.id, type: f.type, tier: f.tier, faceUp: false, claimedBy: null };
      cards.push(card, { ...card });
    });
  });
  // A short board keeps its column count and loses rows.
  const rows = Math.ceil(cards.length / cols);
  return { cols, rows, cards: shuffleWith(rng, cards), supplied };
}
