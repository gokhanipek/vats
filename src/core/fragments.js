// Fragments: { type, tier }. On the board each card also has an ownerId.
import {
  MAX_TIER, OWN_CARD_MULTIPLIER, THEIR_CARD_MULTIPLIER, TYPES,
  RESONANCE_CYCLE, RESONANCE_BONUS_PER_TIER, DISSONANCE_PENALTY_PER_TIER,
} from './tuning';

/**
 * Whether two board cards at different positions match (same type and tier,
 * whoever owns them).
 * @param {{type:string,tier:number}} a
 * @param {{type:string,tier:number}} b
 * @param {number} posA
 * @param {number} posB
 */
export function isMatch(a, b, posA, posB) {
  return posA !== posB && a.type === b.type && a.tier === b.tier;
}

/**
 * Points one card scores for the side that claims it.
 * @param {{ownerId:string,tier:number}} card
 * @param {string} claimerId
 */
export function cardPoints(card, claimerId) {
  const multiplier = card.ownerId === claimerId ? OWN_CARD_MULTIPLIER : THEIR_CARD_MULTIPLIER;
  return card.tier * multiplier;
}

/**
 * Points for a claimed pair: each card scores separately.
 * @param {object} a
 * @param {object} b
 * @param {string} claimerId
 */
export function pairPoints(a, b, claimerId) {
  return cardPoints(a, claimerId) + cardPoints(b, claimerId);
}

/** A stable key for grouping fragments by type and tier. */
export function fragmentKey(fragment) {
  return `${fragment.type}:${fragment.tier}`;
}

/**
 * The type/tier combinations a collection can merge (2 of the same, below max tier).
 * @param {Array<{type:string,tier:number}>} fragments
 * @returns {Array<{type:string,tier:number}>}
 */
export function mergeOptions(fragments) {
  const counts = {};
  fragments.forEach((f) => {
    const key = fragmentKey(f);
    counts[key] = (counts[key] || 0) + 1;
  });
  const seen = {};
  return fragments.filter((f) => {
    const key = fragmentKey(f);
    if (seen[key] || f.tier >= MAX_TIER || counts[key] < 2) return false;
    seen[key] = true;
    return true;
  });
}

/**
 * Merge 2 fragments of a type and tier into 1 of the next tier.
 * Returns the unchanged collection when the merge is not possible.
 * @param {Array<{type:string,tier:number}>} fragments
 * @param {string} type
 * @param {number} tier
 */
export function mergeFragments(fragments, type, tier) {
  if (tier >= MAX_TIER) return fragments;
  const matching = fragments.filter((f) => f.type === type && f.tier === tier);
  if (matching.length < 2) return fragments;
  let removed = 0;
  const kept = fragments.filter((f) => {
    if (removed < 2 && f.type === type && f.tier === tier) {
      removed += 1;
      return false;
    }
    return true;
  });
  return [...kept, { type, tier: tier + 1 }];
}

/**
 * Sort fragments best-first (highest tier first). Stable for equal tiers.
 * @param {Array<{type:string,tier:number}>} fragments
 */
export function bestFirst(fragments) {
  return fragments
    .map((f, i) => ({ f, i }))
    .sort((x, y) => y.f.tier - x.f.tier || x.i - y.i)
    .map((x) => x.f);
}

/**
 * How a claimed type sits against a side's resonance (its last claimed type).
 * 'bonus' for the next type in RESONANCE_CYCLE, 'penalty' for the one before,
 * null otherwise (no resonance yet, the same type, or the opposite type).
 * @param {string|null} lastType
 * @param {string} type
 * @returns {'bonus'|'penalty'|null}
 */
export function resonanceOf(lastType, type) {
  const i = RESONANCE_CYCLE.indexOf(lastType);
  const j = RESONANCE_CYCLE.indexOf(type);
  if (i < 0 || j < 0) return null;
  const n = RESONANCE_CYCLE.length;
  if (j === (i + 1) % n) return 'bonus';
  if (j === (i + n - 1) % n) return 'penalty';
  return null;
}

/**
 * Points for a claimed pair including resonance (never below 0).
 * @param {object} a - board card
 * @param {object} b - board card
 * @param {string} claimerId
 * @param {string|null} lastType - the claimer's resonance before this claim
 */
export function resonantPairPoints(a, b, claimerId, lastType) {
  const base = pairPoints(a, b, claimerId);
  const effect = resonanceOf(lastType, a.type);
  if (effect === 'bonus') return base + RESONANCE_BONUS_PER_TIER * a.tier;
  if (effect === 'penalty') return Math.max(0, base - DISSONANCE_PENALTY_PER_TIER * a.tier);
  return base;
}

/**
 * Affinity: the two most common types among fragments (ties broken by TYPES order).
 * With only one type present, the second is the next type in TYPES order.
 * @param {Array<{type:string}>} fragments
 * @returns {string[]} two types
 */
export function affinityOf(fragments) {
  const counts = {};
  TYPES.forEach((t) => { counts[t] = 0; });
  fragments.forEach((f) => { counts[f.type] += 1; });
  return [...TYPES].sort((x, y) => counts[y] - counts[x] || TYPES.indexOf(x) - TYPES.indexOf(y)).slice(0, 2);
}
