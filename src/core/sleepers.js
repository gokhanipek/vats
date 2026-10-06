// Generated Sleepers: the colonists' decks, spawn offers and Wake Attempt Wardens.
import {
  TYPES, TIER_ODDS, MAIN_TYPE_SHARE, BONUS_IDS, MAX_LUCIDITY,
  SPAWN_OFFER_FRAGMENTS, SPAWN_OFFER_BONUS, AI_MEMORY, WAKE_AI_MEMORY, WAKE_BOARD_TIER,
  ANCHOR_CHANCE, DEEP_ANCHOR_SHARE,
} from './tuning';
import { gridFor, boardTierForLucidity } from './board';
import { affinityOf } from './fragments';
import { pick, randInt, shuffleWith } from './rng';

const NAMES = [
  'Ada', 'Bram', 'Cyra', 'Dov', 'Esme', 'Fenn', 'Gale', 'Hux', 'Iris', 'Jory',
  'Kael', 'Lio', 'Mara', 'Nyx', 'Odo', 'Pell', 'Quin', 'Rhea', 'Sol', 'Tamsin',
];

/** A random Sleeper name such as "Nyx-412". */
export function randomName(rng) {
  return `${pick(rng, NAMES)}-${100 + randInt(rng, 900)}`;
}

function rollTier(level, rng) {
  const odds = TIER_ODDS[level] || TIER_ODDS[1];
  let roll = rng();
  for (let t = 0; t < odds.length; t += 1) {
    if (roll < odds[t]) return t + 1;
    roll -= odds[t];
  }
  return 1;
}

/**
 * One fragment for a Sleeper: usually its main type, tier rolled by level.
 * @param {number} level
 * @param {string} mainType
 * @param {function(): number} rng
 */
export function rollFragment(level, mainType, rng) {
  const type = rng() < MAIN_TYPE_SHARE ? mainType : pick(rng, TYPES);
  return { type, tier: rollTier(level, rng) };
}

/** A random anchor id (Deep Anchors are the rarer kind). */
export function rollAnchor(rng) {
  return rng() < DEEP_ANCHOR_SHARE ? 'deepAnchor' : 'anchor';
}

/** The number of fragments a Sleeper needs to supply its half of a board at its level. */
export function supplyFor(level) {
  return Math.ceil(gridFor(boardTierForLucidity(level)).pairs / 2);
}

/**
 * Generate a Sleeper.
 * @param {number} level - Lucidity 1-6
 * @param {function(): number} rng
 * @param {{fragmentCount?:number, bonusCount?:number, memory?:number, name?:string}} [options]
 * @returns {{name, level, mainType, affinity, fragments, hand, anchors, memory}}
 */
export function generateSleeper(level, rng, options = {}) {
  const mainType = pick(rng, TYPES);
  // Enough fragments to supply its half of a board at its own level, plus one.
  const fragmentCount = options.fragmentCount || supplyFor(level) + 1;
  const fragments = [];
  for (let i = 0; i < fragmentCount; i += 1) {
    fragments.push(rollFragment(level, mainType, rng));
  }
  const bonusCount = options.bonusCount || 1 + randInt(rng, 2);
  return {
    name: options.name || randomName(rng),
    level,
    mainType,
    affinity: affinityOf(fragments),
    fragments,
    hand: shuffleWith(rng, BONUS_IDS).slice(0, bonusCount),
    anchors: rng() < ANCHOR_CHANCE ? [rollAnchor(rng)] : [],
    memory: options.memory !== undefined ? options.memory : AI_MEMORY[level],
  };
}

/** The vat offered at (re)spawn: what its last occupant left, a wide pick of cards. */
export function generateSpawnOffer(rng) {
  return generateSleeper(1 + randInt(rng, 3), rng, {
    fragmentCount: SPAWN_OFFER_FRAGMENTS,
    bonusCount: SPAWN_OFFER_BONUS,
  });
}

/**
 * A Wake Attempt opponent: a Warden of the network, not a colonist.
 * Top level, maximum memory, full supply for the wake board.
 */
export function generateWakeOpponent(rng) {
  return generateSleeper(MAX_LUCIDITY, rng, {
    fragmentCount: Math.ceil(gridFor(WAKE_BOARD_TIER).pairs / 2) + 1,
    memory: WAKE_AI_MEMORY,
    name: `Warden-${100 + randInt(rng, 900)}`,
  });
}
