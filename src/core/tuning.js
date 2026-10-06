// Every number the MVP playtest might want to change lives here.
// Logic modules read these values; change them here, not in the logic.

// --- Fragments ---------------------------------------------------------------
export const TYPES = ['water', 'fire', 'air', 'electric'];
export const MAX_TIER = 3;

// Scoring (doubled so there are no halves): per card in a claimed pair.
export const OWN_CARD_MULTIPLIER = 2;   // your own card scores 2 x tier
export const THEIR_CARD_MULTIPLIER = 1; // the opponent's card scores 1 x tier

// --- Board -------------------------------------------------------------------
// Every board has an even pair count, so both sides supply the same share.
export const BOARD_TIERS = {
  1: { cols: 4, rows: 3 }, // 3 pairs each
  2: { cols: 4, rows: 4 }, // 4 pairs each
  3: { cols: 5, rows: 4 }, // 5 pairs each
  4: { cols: 6, rows: 4 }, // 6 pairs each
};
// Board tier by Lucidity; the Wake Attempt uses its own tier.
export const LUCIDITY_BOARD_TIER = { 1: 1, 2: 1, 3: 2, 4: 2, 5: 3, 6: 3 };
export const WAKE_BOARD_TIER = 4;

// How long a missed pair stays face up before flipping back.
export const REVEAL_MS = 900;

// --- Hints -------------------------------------------------------------------
// Only the first flip of a turn, of the flipper's own card, gives a hint,
// and only the flipper sees it.
// size: square side of the hint area (tier 3 is the pair + 1 neighbour).
export const HINTS = {
  1: { size: 3, ms: 500 },
  2: { size: 2, ms: 1000 },
  3: { size: null, ms: 1200 },
};

// --- Resonance -----------------------------------------------------------------
// Each side's last claimed type sets its resonance. Claiming the type that comes
// next in the cycle scores a bonus; the type just before it scores a penalty.
// The other two types (the same type, and the opposite one) are neutral.
export const RESONANCE_CYCLE = ['water', 'fire', 'air', 'electric'];
export const RESONANCE_BONUS_PER_TIER = 2;   // added to a resonant pair, per tier
export const DISSONANCE_PENALTY_PER_TIER = 2; // taken from a dissonant pair, per tier (not below 0)

// --- Turn ---------------------------------------------------------------------
// EXPERIMENT (off by default): the most pairs a side may claim in one turn; after
// that many matches the turn passes. 0 = no limit. See the strategy simulation.
export const MATCHES_PER_TURN = 0;

// --- Affinity ------------------------------------------------------------------
// Every Sleeper has two affinity types (the two most common in its deck or vat).
// Claiming a pair of an affinity type recharges every bonus card by this much.
export const AFFINITY_RECHARGE = 1;

// --- Hand ----------------------------------------------------------------------
// Each bonus card has its own cooldown. It starts ready each duel; after use it
// needs `cooldown` recharge steps. The `recharge` rule says what counts as a step:
//   'type'  - you claim a pair of the card's type
//   'turns' - one of your turns begins
//   'own'   - you claim a pair of two of your own cards
// `price` is what the shop charges, in points.
export const BONUS_CARDS = {
  ping: {
    label: 'Ping',
    type: 'electric',
    recharge: 'type',
    cooldown: 1,
    price: 25,
    text: 'Privately peek at 2 random face-down cards.',
    cards: 2,
    ms: 1200,
  },
  echo: {
    label: 'Echo',
    type: 'air',
    recharge: 'turns',
    cooldown: 2,
    price: 25,
    text: 'Your face-down cards shake for a moment. Only you see it.',
    ms: 1500,
  },
  doubleDown: {
    label: 'Double Down',
    type: 'fire',
    recharge: 'type',
    cooldown: 1,
    price: 30,
    text: 'Matches this turn score double. A miss costs 4 points.',
    missPenalty: 4,
  },
  lock: {
    label: 'Lock',
    type: 'water',
    recharge: 'own',
    cooldown: 1,
    price: 35,
    text: 'Lock a face-down card: nobody can flip it until your next turn.',
  },
  defrag: {
    label: 'Defrag',
    type: null,
    recharge: 'turns',
    cooldown: 4,
    price: 40,
    text: 'Reshuffle every unclaimed card. Everyone forgets.',
  },
};
export const BONUS_IDS = Object.keys(BONUS_CARDS);

/** Hand slots for a Lucidity level. Owned bonus cards beyond these wait in storage. */
export function handSlots(lucidity) {
  return lucidity >= 4 ? 3 : 2;
}

// --- Opponents ---------------------------------------------------------------
// AI memory (number of remembered cards) by opponent level.
// Simulated against a player who remembers 5 cards (see the vat-mvp change notes).
export const AI_MEMORY = { 1: 1, 2: 2, 3: 3, 4: 3, 5: 4, 6: 5 };
export const WAKE_AI_MEMORY = 6;
export const AI_FLIP_MS = 650; // delay between AI actions
// After a match with no known pair, the AI holds when a blind flip is less likely
// than this to find a remembered partner (see blindMatchChance in ai.js).
export const AI_HOLD_BELOW = 0.1; // simulated: holding more often only loses to greedy play

// Chance of each tier [t1, t2, t3] in a generated Sleeper's fragments, by level.
export const TIER_ODDS = {
  1: [1, 0, 0],
  2: [0.85, 0.15, 0],
  3: [0.65, 0.35, 0],
  4: [0.5, 0.4, 0.1],
  5: [0.4, 0.4, 0.2],
  6: [0.3, 0.4, 0.3],
};
export const MAIN_TYPE_SHARE = 0.6; // share of a Sleeper's fragments in its main type

// --- Run ---------------------------------------------------------------------
export const MAX_LUCIDITY = 6;
export const CAMPAIGN_DAYS = 30;
export const WAKE_DUEL_DAYS = 1;     // each Wake Attempt duel costs this many days (other duels cost travel days)
export const RESPAWN_DAYS = 1;       // extra days lost on death
export const SPAWN_OFFER_FRAGMENTS = 6;
export const SPAWN_OFFER_BONUS = 3;
export const SPAWN_PICK_FRAGMENTS = 3;
export const SPAWN_PICK_BONUS = 1;
export const WAKE_DUELS = 3;
export const START_POINTS = 0;      // the points total a new life starts with

// --- World ---------------------------------------------------------------------
// A fixed population of colonists. Nobody new ever arrives: a defeated mind that
// dies starts over at Lucidity 1 in another vat, and a mind that wakes leaves the
// network for good. Simulated in the vat-world-map change notes: with these values
// a player at any Lucidity always had at least 3 Sleepers in reach.
export const WORLD_SIZE = 40;
export const WORLD_WARMUP_DAYS = 15;  // days the world runs (without wakes) before day 1
export const NPC_FIGHT_CHANCE = 0.5;  // chance each Sleeper fights on a given day
export const NPC_DEATH_CHANCE = 0.2;  // chance a defeated Sleeper dies (resets to Lucidity 1)
export const NPC_WAKE_CHANCE = 0.15;  // chance a Lucidity-6 winner wakes and leaves
export const LEVEL_UP_BONUS_CHANCE = 0.25; // on level-up: a bonus card instead of a fragment
export const LEVEL_UP_MERGE_CHANCE = 0.5;  // on level-up: merge 2 equal fragments if it can spare one

// --- Map -----------------------------------------------------------------------
// Rows are Lucidity (1 at the bottom), columns are distance from the player.
export const MAP_COLS = 8;
export const TRAVEL_DAYS = [1, 1, 1, 2, 2, 2, 3, 3]; // days to reach a Sleeper, by column
export const REVEAL_DECK_DAYS = 2;   // Sleepers at least this far away show their whole deck
export const REACH = 1;              // you can duel Sleepers within this many Lucidity levels

// --- Anchors -------------------------------------------------------------------
// Rare cards that take no hand slot. Each raises the chance to survive a lost duel.
export const ANCHORS = {
  anchor: { label: 'Anchor', survival: 0.05, text: '+5% chance to survive a lost duel. Takes no slot.' },
  deepAnchor: { label: 'Deep Anchor', survival: 0.1, text: '+10% chance to survive a lost duel. Takes no slot.' },
};
export const ANCHOR_IDS = Object.keys(ANCHORS);
export const PLAYER_SURVIVAL_CAP = 0.3;  // anchors stack up to this
export const ANCHOR_CHANCE = 0.1;        // a generated Sleeper (or spawn offer) holds an anchor
export const LEVEL_UP_ANCHOR_CHANCE = 0.05;
export const DEEP_ANCHOR_SHARE = 0.3;    // share of anchors that are Deep Anchors
