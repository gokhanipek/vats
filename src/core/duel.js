// Pure duel engine for the vat game. All functions return a NEW state.
//
// State shape:
// {
//   cols, rows,
//   cards: Array<{ownerId, type, tier, faceUp, claimedBy, lockedBy}>, // index = board position
//   supplied: { player: fragment[], opponent: fragment[] },  // what each side brought
//   active: 'player' | 'opponent',
//   phase: 'awaitingFirst' | 'awaitingSecond' | 'resolving' | 'ended',
//   flipped: number[],                    // positions flipped this turn (0-2)
//   matchesThisTurn: number,              // pairs claimed this turn (hold needs at least 1)
//   scores: { player, opponent },
//   resonance: { player, opponent },      // each side's last claimed type, or null
//   affinity: { player: string[], opponent: string[] },
//   hands: { player: string[], opponent: string[] },          // bonus card ids
//   cooldowns: { player: {id: n}, opponent: {id: n} },        // recharge steps left; 0 = ready
//   bonusPlayed: boolean,                 // a bonus card was played this turn
//   doubleDown: boolean,                  // Double Down is active this turn
//   lastHint: null | hint & { side },     // hint from the latest flip, private to `side`
//   lastPeek: null | { side, positions }, // latest Ping, private to `side`
//   lastEcho: null | { side, positions }, // latest Echo: `side`'s own face-down cards, private
//   lastEvent: null | { kind, side, ... } // for the UI log
// }
import { BONUS_CARDS, AFFINITY_RECHARGE, MATCHES_PER_TURN } from './tuning';
import { isMatch, resonanceOf, resonantPairPoints, affinityOf } from './fragments';
import { buildBoard } from './board';
import { hintFor } from './hints';
import { shuffleWith } from './rng';

export const OTHER = { player: 'opponent', opponent: 'player' };

function readyHand(hand) {
  const cooldowns = {};
  hand.forEach((id) => { cooldowns[id] = 0; });
  return cooldowns;
}

/**
 * Create a duel.
 * @param {{level:number, fragments:Array, hand:string[], affinity?:string[]}} player
 * @param {{level:number, fragments:Array, hand:string[], affinity?:string[]}} opponent
 * @param {number} boardTier
 * @param {function(): number} rng
 * @param {'player'|'opponent'} [starting='player']
 */
export function createDuel(player, opponent, boardTier, rng, starting = 'player') {
  const board = buildBoard(
    [
      { id: 'player', level: player.level, fragments: player.fragments },
      { id: 'opponent', level: opponent.level, fragments: opponent.fragments },
    ],
    boardTier,
    rng
  );
  return {
    ...board,
    cards: board.cards.map((c) => ({ ...c, lockedBy: null })),
    active: starting,
    phase: 'awaitingFirst',
    flipped: [],
    matchesThisTurn: 0,
    scores: { player: 0, opponent: 0 },
    resonance: { player: null, opponent: null },
    affinity: {
      player: player.affinity || affinityOf(player.fragments),
      opponent: opponent.affinity || affinityOf(opponent.fragments),
    },
    hands: { player: [...player.hand], opponent: [...opponent.hand] },
    cooldowns: { player: readyHand(player.hand), opponent: readyHand(opponent.hand) },
    bonusPlayed: false,
    doubleDown: false,
    lastHint: null,
    lastPeek: null,
    lastEcho: null,
    lastEvent: null,
  };
}

/** Whether the active side may flip the card at `pos` now. Locked cards can't be flipped. */
export function canFlip(state, pos) {
  if (state.phase !== 'awaitingFirst' && state.phase !== 'awaitingSecond') return false;
  const card = state.cards[pos];
  return Boolean(card) && card.claimedBy === null && !card.faceUp && !card.lockedBy;
}

// Locks never block the game: if fewer than 2 cards could be flipped, all locks open.
function releaseIfStuck(state) {
  if (state.phase === 'ended') return state;
  const flippable = state.cards.filter((c) => c.claimedBy === null && !c.lockedBy).length;
  const locked = state.cards.some((c) => c.lockedBy);
  if (!locked || flippable >= 2) return state;
  return { ...state, cards: state.cards.map((c) => (c.lockedBy ? { ...c, lockedBy: null } : c)) };
}

/**
 * Flip the card at `pos` for the active side. Only the first flip of a turn,
 * of the active side's own card, produces a hint, and it is private to that side.
 * After the second flip the phase becomes 'resolving'.
 */
export function flip(state, pos, rng) {
  if (!canFlip(state, pos)) return state;
  const side = state.active;
  const cards = state.cards.map((c, i) => (i === pos ? { ...c, faceUp: true } : c));
  const flipped = [...state.flipped, pos];
  const next = { ...state, cards, flipped, phase: flipped.length === 2 ? 'resolving' : 'awaitingSecond' };
  const givesHint = flipped.length === 1 && cards[pos].ownerId === side;
  const hint = givesHint ? hintFor(next, pos, rng) : null;
  return { ...next, lastHint: hint && { ...hint, side } };
}

// Start `side`'s turn: its own locks open, and its 'turns' cards recharge one step.
function beginTurn(state, side) {
  const cards = state.cards.map((c) => (c.lockedBy === side ? { ...c, lockedBy: null } : c));
  const cooldowns = { ...state.cooldowns[side] };
  state.hands[side].forEach((id) => {
    if (BONUS_CARDS[id].recharge === 'turns' && cooldowns[id] > 0) cooldowns[id] -= 1;
  });
  return releaseIfStuck({
    ...state,
    cards,
    cooldowns: { ...state.cooldowns, [side]: cooldowns },
    active: side,
    phase: 'awaitingFirst',
    flipped: [],
    matchesThisTurn: 0,
    bonusPlayed: false,
    doubleDown: false,
  });
}

// Recharge `side`'s cards after it claimed a pair of `type` (ownPair: both its own cards).
function rechargeOnClaim(state, side, type, ownPair) {
  const cooldowns = { ...state.cooldowns[side] };
  const affinity = state.affinity[side].includes(type) ? AFFINITY_RECHARGE : 0;
  state.hands[side].forEach((id) => {
    const def = BONUS_CARDS[id];
    let steps = affinity;
    if (def.recharge === 'type' && def.type === type) steps += 1;
    if (def.recharge === 'own' && ownPair) steps += 1;
    cooldowns[id] = Math.max(0, (cooldowns[id] || 0) - steps);
  });
  return { ...state.cooldowns, [side]: cooldowns };
}

/**
 * Resolve the two flipped cards. A match claims and scores the pair (with
 * resonance), sets the side's resonance and keeps the turn; a miss flips both
 * back and passes the turn.
 */
export function resolve(state) {
  if (state.phase !== 'resolving') return state;
  const side = state.active;
  const [p1, p2] = state.flipped;
  const a = state.cards[p1];
  const b = state.cards[p2];

  if (isMatch(a, b, p1, p2)) {
    const base = resonantPairPoints(a, b, side, state.resonance[side]);
    const points = state.doubleDown ? base * 2 : base;
    const ownPair = a.ownerId === side && b.ownerId === side;
    const cards = state.cards.map((c, i) =>
      (i === p1 || i === p2 ? { ...c, faceUp: false, claimedBy: side } : c));
    const ended = cards.every((c) => c.claimedBy !== null);
    const claimed = releaseIfStuck({
      ...state,
      cards,
      flipped: [],
      matchesThisTurn: state.matchesThisTurn + 1,
      phase: ended ? 'ended' : 'awaitingFirst',
      scores: { ...state.scores, [side]: state.scores[side] + points },
      resonance: { ...state.resonance, [side]: a.type },
      cooldowns: rechargeOnClaim(state, side, a.type, ownPair),
      lastEvent: {
        kind: 'match', side, points, positions: [p1, p2], doubled: state.doubleDown,
        resonance: resonanceOf(state.resonance[side], a.type),
      },
    });
    // With a per-turn limit, the turn passes once it is reached.
    const capped = MATCHES_PER_TURN > 0 && claimed.matchesThisTurn >= MATCHES_PER_TURN;
    return capped && !ended ? beginTurn(claimed, OTHER[side]) : claimed;
  }

  const penalty = state.doubleDown ? BONUS_CARDS.doubleDown.missPenalty : 0;
  const cards = state.cards.map((c, i) => (i === p1 || i === p2 ? { ...c, faceUp: false } : c));
  return beginTurn(
    {
      ...state,
      cards,
      scores: { ...state.scores, [side]: Math.max(0, state.scores[side] - penalty) },
      lastEvent: { kind: 'miss', side, penalty },
    },
    OTHER[side]
  );
}

/** Whether the active side may end its turn now: only right after a match. */
export function canHold(state) {
  return state.phase === 'awaitingFirst' && state.matchesThisTurn > 0;
}

/** End the turn after a match without flipping again. */
export function hold(state) {
  if (!canHold(state)) return state;
  const side = state.active;
  return beginTurn({ ...state, lastEvent: { kind: 'hold', side } }, OTHER[side]);
}

/** Whether `side` may play bonus card `id` right now. */
export function canPlayBonus(state, side, id) {
  const def = BONUS_CARDS[id];
  return Boolean(def)
    && state.active === side
    && state.phase === 'awaitingFirst'
    && !state.bonusPlayed
    && state.hands[side].includes(id)
    && !state.cooldowns[side][id];
}

/** Positions a Lock may target: face-down, unclaimed, not already locked. */
export function lockTargets(state) {
  const targets = [];
  state.cards.forEach((c, i) => { if (c.claimedBy === null && !c.faceUp && !c.lockedBy) targets.push(i); });
  return targets;
}

/**
 * Play a bonus card from `side`'s hand. Invalid plays return the unchanged state.
 * - ping: lastPeek holds 2 random face-down positions, visible only to `side`
 * - defrag: reshuffles the contents of every unclaimed position (locks move with their card)
 * - doubleDown: matches this turn score double, a miss costs points
 * - echo: lastEcho holds `side`'s own face-down positions, visible only to `side`
 * - lock: the card at `target` can't be flipped until `side`'s next turn begins
 * @param {object} state
 * @param {'player'|'opponent'} side
 * @param {string} id
 * @param {function(): number} rng
 * @param {number} [target] - position, for lock
 */
export function playBonus(state, side, id, rng, target) {
  if (!canPlayBonus(state, side, id)) return state;
  if (id === 'lock' && !lockTargets(state).includes(target)) return state;
  const def = BONUS_CARDS[id];
  let next = {
    ...state,
    bonusPlayed: true,
    cooldowns: { ...state.cooldowns, [side]: { ...state.cooldowns[side], [id]: def.cooldown } },
    lastEvent: { kind: 'bonus', side, id },
  };
  if (id === 'ping') {
    const faceDown = [];
    state.cards.forEach((c, i) => { if (c.claimedBy === null && !c.faceUp) faceDown.push(i); });
    next = { ...next, lastPeek: { side, positions: shuffleWith(rng, faceDown).slice(0, def.cards) } };
  } else if (id === 'defrag') {
    const open = [];
    state.cards.forEach((c, i) => { if (c.claimedBy === null) open.push(i); });
    const contents = shuffleWith(rng, open.map((i) => state.cards[i]));
    const cards = [...state.cards];
    open.forEach((pos, k) => { cards[pos] = { ...contents[k], faceUp: false }; });
    next = { ...next, cards, lastHint: null, lastPeek: null, lastEcho: null };
  } else if (id === 'doubleDown') {
    next = { ...next, doubleDown: true };
  } else if (id === 'echo') {
    const own = [];
    state.cards.forEach((c, i) => { if (c.claimedBy === null && !c.faceUp && c.ownerId === side) own.push(i); });
    next = { ...next, lastEcho: { side, positions: own } };
  } else if (id === 'lock') {
    const cards = state.cards.map((c, i) => (i === target ? { ...c, lockedBy: side } : c));
    next = releaseIfStuck({ ...next, cards, lastEvent: { kind: 'bonus', side, id, target } });
  }
  return next;
}

/** 'player' | 'opponent' | 'draw' once ended, otherwise null. */
export function duelOutcome(state) {
  if (state.phase !== 'ended') return null;
  if (state.scores.player > state.scores.opponent) return 'player';
  if (state.scores.opponent > state.scores.player) return 'opponent';
  return 'draw';
}
