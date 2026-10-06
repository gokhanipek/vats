// Opponent AI: bounded memory of revealed cards, flip choice, hold and bonus policy.
// Memory is an array of { pos, type, tier }, oldest first.
//
// Two policies:
//   'planner' (the game's AI) - takes the best-value known pair (resonance
//             included), holds rather than flipping blind, and saves a
//             dissonant pair of its own for later (with Lock if it can).
//   'greedy'  - takes any known pair, never holds. Used by the simulation as a
//             baseline: if planning doesn't beat greed, the strategy layer is weak.
import { isMatch, resonanceOf, resonantPairPoints } from './fragments';
import { canPlayBonus, canHold, OTHER } from './duel';
import { pick } from './rng';
import { AI_HOLD_BELOW } from './tuning';

/**
 * Remember a revealed card, forgetting the oldest beyond `capacity`.
 * @param {Array} memory
 * @param {number} pos
 * @param {{type:string,tier:number}} card
 * @param {number} capacity
 */
export function remember(memory, pos, card, capacity) {
  if (capacity <= 0) return [];
  const next = memory.filter((m) => m.pos !== pos);
  next.push({ pos, type: card.type, tier: card.tier });
  return next.slice(-capacity);
}

/**
 * Bring memory in line with the board: remember face-up cards (and `extra`
 * positions such as the AI's own Ping), forget claimed positions.
 * @param {Array} memory
 * @param {object} state - duel state
 * @param {number} capacity
 * @param {number[]} [extra=[]]
 */
export function observe(memory, state, capacity, extra = []) {
  let next = memory.filter((m) => state.cards[m.pos].claimedBy === null);
  state.cards.forEach((c, i) => {
    if (c.faceUp && c.claimedBy === null && !next.some((m) => m.pos === i)) {
      next = remember(next, i, c, capacity);
    }
  });
  extra.forEach((i) => { next = remember(next, i, state.cards[i], capacity); });
  return next;
}

// Whether a remembered position can be flipped now.
function open(state, pos) {
  const c = state.cards[pos];
  return c.claimedBy === null && !c.faceUp && !c.lockedBy;
}

/**
 * Every remembered pair that can be claimed now: [posA, posB] pairs.
 * @returns {Array<number[]>}
 */
export function knownPairs(memory, state) {
  const usable = memory.filter((m) => open(state, m.pos));
  const pairs = [];
  for (let i = 0; i < usable.length; i += 1) {
    for (let j = i + 1; j < usable.length; j += 1) {
      if (isMatch(usable[i], usable[j], usable[i].pos, usable[j].pos)) {
        pairs.push([usable[i].pos, usable[j].pos]);
      }
    }
  }
  return pairs;
}

/** Whether the AI currently knows a pair it could claim. */
export function knowsPair(memory, state) {
  return knownPairs(memory, state).length > 0;
}

/** Points `side` would score for the pair at [posA, posB] now, resonance included. */
export function pairValue(state, side, [posA, posB]) {
  return resonantPairPoints(state.cards[posA], state.cards[posB], side, state.resonance[side]);
}

/**
 * How much taking a pair now swings the score: what `side` gains, plus what the
 * other side would gain if it were left on the board (their own cards score them double).
 */
export function pairSwing(state, side, pair) {
  return pairValue(state, side, pair) + pairValue(state, OTHER[side], pair);
}

/** The best known pair for `side` by swing (first on ties), or null. */
export function bestPair(state, side, memory) {
  let best = null;
  knownPairs(memory, state).forEach((p) => {
    if (!best || pairSwing(state, side, p) > pairSwing(state, side, best)) best = p;
  });
  return best;
}

// A known pair `side` would rather keep for later: dissonant now, and made only
// of its own cards (leaving the other side's cards on the board hands them 2x points).
function savedPair(state, side, memory) {
  return knownPairs(memory, state).find((p) => {
    const card = state.cards[p[0]];
    return resonanceOf(state.resonance[side], card.type) === 'penalty'
      && p.every((pos) => state.cards[pos].ownerId === side);
  }) || null;
}

/**
 * The chance that flipping an unknown card finds a partner already in memory:
 * remembered single cards / (other unknown cards + remembered single cards).
 * With a good memory a "blind" flip is often a free match.
 */
export function blindMatchChance(state, memory) {
  const known = memory.filter((m) => open(state, m.pos));
  const unknown = state.cards.filter((_, i) => open(state, i) && !known.some((m) => m.pos === i)).length;
  if (unknown === 0) return 0;
  return known.length / (unknown - 1 + known.length || 1);
}

/**
 * Whether the active side should end its turn now (only possible after a match).
 * greedy: never. planner: with no known pair, hold when a blind flip is unlikely
 * to find a remembered partner (it would mostly teach the other side); with
 * known pairs, hold only to save a dissonant pair of its own for later.
 */
export function shouldHold(state, memory, policy = 'planner') {
  if (policy === 'greedy' || !canHold(state)) return false;
  const side = state.active;
  const best = bestPair(state, side, memory);
  if (!best) return blindMatchChance(state, memory) < AI_HOLD_BELOW;
  const effect = resonanceOf(state.resonance[side], state.cards[best[0]].type);
  // Even the best pair is dissonant: save it if it is all ours, take it if it would feed them.
  return effect === 'penalty' && best.every((pos) => state.cards[pos].ownerId === side);
}

/**
 * Choose the next position to flip.
 * First flip: open the best known pair (planner) or any known pair (greedy),
 * otherwise an unknown card. Second flip: a remembered match, otherwise inside
 * its own hint area, otherwise an unknown card.
 * @returns {number|null}
 */
export function chooseFlip(state, memory, rng, policy = 'planner') {
  const available = [];
  state.cards.forEach((_, i) => { if (open(state, i)) available.push(i); });
  if (available.length === 0) return null;
  const known = new Set(memory.map((m) => m.pos));
  const unknown = available.filter((i) => !known.has(i));

  if (state.flipped.length === 0) {
    const pair = policy === 'greedy' ? knownPairs(memory, state)[0] : bestPair(state, state.active, memory);
    if (pair) return pair[0];
  } else {
    const firstPos = state.flipped[0];
    const first = state.cards[firstPos];
    const match = memory.find((m) => available.includes(m.pos) && isMatch(first, m, firstPos, m.pos));
    if (match) return match.pos;
    const hint = state.lastHint;
    if (hint && hint.side === state.active && hint.source === firstPos) {
      const inArea = hint.positions.filter((i) => available.includes(i) && !known.has(i));
      if (inArea.length > 0) return pick(rng, inArea);
    }
  }
  return pick(rng, unknown.length > 0 ? unknown : available);
}

/**
 * Pick a bonus card for `side`, or null. `{ id, target? }`.
 * Holding: Lock a card of the pair it is saving. Otherwise: Double Down when its
 * best known pair isn't dissonant; Defrag when trailing badly; Ping when blind.
 * The AI never plays Echo yet.
 */
export function chooseBonus(state, side, memory, holding = false) {
  const can = (id) => canPlayBonus(state, side, id);
  if (holding) {
    const saved = savedPair(state, side, memory);
    return saved && can('lock') ? { id: 'lock', target: saved[0] } : null;
  }
  const best = bestPair(state, side, memory);
  if (best) {
    const dissonant = resonanceOf(state.resonance[side], state.cards[best[0]].type) === 'penalty';
    return !dissonant && can('doubleDown') ? { id: 'doubleDown' } : null;
  }
  const behind = state.scores[OTHER[side]] - state.scores[side];
  if (behind >= 8 && can('defrag')) return { id: 'defrag' };
  if (can('ping')) return { id: 'ping' };
  return null;
}

/**
 * The active side's next action:
 * { type: 'bonus', id, target? } | { type: 'hold' } | { type: 'flip', pos } | null.
 * @param {object} state
 * @param {Array} memory
 * @param {function(): number} rng
 * @param {{policy?:'planner'|'greedy', bonus?:boolean}} [options]
 */
export function chooseAction(state, memory, rng, options = {}) {
  const policy = options.policy || 'planner';
  const side = state.active;
  if (state.phase === 'awaitingFirst') {
    const holding = shouldHold(state, memory, policy);
    if (options.bonus !== false && !state.bonusPlayed) {
      const bonus = chooseBonus(state, side, memory, holding);
      if (bonus) return { type: 'bonus', ...bonus };
    }
    if (holding) return { type: 'hold' };
  }
  const pos = chooseFlip(state, memory, rng, policy);
  return pos === null ? null : { type: 'flip', pos };
}
