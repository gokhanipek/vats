// The world: a fixed population of colonists (NPC Sleepers) on the map.
// Each day some of them duel each other off-screen, settled by the rng. Winners
// climb, defeated minds sometimes die and start over at Lucidity 1 in another
// vat, and Lucidity-6 winners may wake and leave the network for good.
// Nobody new ever arrives. Pure: every function returns a new world.
//
// World shape:
// {
//   npcs: Array<{ id, name, level, column, mainType, fragments, hand, anchors, memory, awake }>,
//   news: Array<{ kind: 'wake', id, name }>,  // what happened during the latest advance
// }
import {
  WORLD_SIZE, WORLD_WARMUP_DAYS, NPC_FIGHT_CHANCE, NPC_DEATH_CHANCE, NPC_WAKE_CHANCE,
  LEVEL_UP_BONUS_CHANCE, LEVEL_UP_MERGE_CHANCE, LEVEL_UP_ANCHOR_CHANCE, MAX_LUCIDITY,
  MAP_COLS, TRAVEL_DAYS, REVEAL_DECK_DAYS, REACH, ANCHORS, BONUS_IDS, AI_MEMORY, handSlots,
} from './tuning';
import { mergeOptions, mergeFragments } from './fragments';
import { generateSleeper, randomName, rollFragment, rollAnchor, supplyFor } from './sleepers';
import { pick, randInt, shuffleWith } from './rng';

/** Total survival chance an anchor list gives (uncapped). */
export function anchorSurvival(anchors) {
  return anchors.reduce((sum, id) => sum + ANCHORS[id].survival, 0);
}

/** The chance a defeated NPC dies: the base chance, lowered by its anchors. */
export function npcDeathChance(npc) {
  return Math.max(0, NPC_DEATH_CHANCE - anchorSurvival(npc.anchors));
}

/** Days it takes to reach an NPC. */
export function travelDays(npc) {
  return TRAVEL_DAYS[npc.column];
}

/** Whether an NPC is far enough away that its whole deck is visible. */
export function revealsDeck(npc) {
  return travelDays(npc) >= REVEAL_DECK_DAYS;
}

/** Whether a player at `lucidity` can duel this NPC. */
export function inReach(npc, lucidity) {
  return !npc.awake && Math.abs(npc.level - lucidity) <= REACH;
}

/**
 * The map as rows of cells: grid[level - 1][column] is the list of NPCs there
 * (possibly empty). Woken NPCs are not on the map.
 */
export function mapGrid(world) {
  const grid = Array.from({ length: MAX_LUCIDITY }, () => Array.from({ length: MAP_COLS }, () => []));
  world.npcs.forEach((n) => { if (!n.awake) grid[n.level - 1][n.column].push(n); });
  return grid;
}

/** How many colonists have woken so far. */
export function awakeCount(world) {
  return world.npcs.filter((n) => n.awake).length;
}

/**
 * Level an NPC up: +1 Lucidity, and it gains a fragment or (sometimes) a bonus
 * card. With a spare fragment it may merge two equal ones. Rarely, an anchor.
 */
export function levelUp(npc, rng) {
  if (npc.level >= MAX_LUCIDITY) return npc;
  const level = npc.level + 1;
  let { fragments, hand, anchors } = npc;
  const freeBonus = BONUS_IDS.filter((id) => !hand.includes(id));
  if (rng() < LEVEL_UP_BONUS_CHANCE && hand.length < handSlots(level) && freeBonus.length > 0) {
    hand = [...hand, pick(rng, freeBonus)];
  } else {
    fragments = [...fragments, rollFragment(level, npc.mainType, rng)];
  }
  const merges = mergeOptions(fragments);
  if (merges.length > 0 && fragments.length - 1 >= supplyFor(level) && rng() < LEVEL_UP_MERGE_CHANCE) {
    const m = pick(rng, merges);
    fragments = mergeFragments(fragments, m.type, m.tier);
  }
  if (rng() < LEVEL_UP_ANCHOR_CHANCE) anchors = [...anchors, rollAnchor(rng)];
  return { ...npc, level, fragments, hand, anchors, memory: AI_MEMORY[level] };
}

/** A mind that died: same person, a new vat elsewhere, back to Lucidity 1 with a fresh deck. */
export function resetMind(npc, rng) {
  const fresh = generateSleeper(1, rng, { name: npc.name });
  return { ...fresh, id: npc.id, column: randInt(rng, MAP_COLS), awake: false };
}

/**
 * An NPC lost a duel: it dies (resets) with npcDeathChance. A surviving
 * Lucidity-6 loser drops to 5, so the top of the map keeps moving.
 */
export function loseDuel(npc, rng) {
  if (rng() < npcDeathChance(npc)) return resetMind(npc, rng);
  if (npc.level === MAX_LUCIDITY) return { ...npc, level: MAX_LUCIDITY - 1, memory: AI_MEMORY[MAX_LUCIDITY - 1] };
  return npc;
}

/** An NPC won a duel against someone at `loserLevel`. Climbs only vs equal or stronger. */
function winDuel(npc, loserLevel, rng, wakes, news) {
  if (loserLevel < npc.level) return npc;
  if (npc.level === MAX_LUCIDITY) {
    if (wakes && rng() < NPC_WAKE_CHANCE) {
      news.push({ kind: 'wake', id: npc.id, name: npc.name });
      return { ...npc, awake: true };
    }
    return npc;
  }
  return levelUp(npc, rng);
}

/**
 * One day of off-screen duels. Some NPCs fight one opponent at their own level;
 * a coin flip decides it.
 * @param {object} world
 * @param {function(): number} rng
 * @param {{wakes?:boolean}} [options] - wakes: false during the warm-up
 */
export function advanceDay(world, rng, options = {}) {
  const wakes = options.wakes !== false;
  const byId = {};
  world.npcs.forEach((n) => { byId[n.id] = n; });
  const fighters = shuffleWith(rng, world.npcs.filter((n) => !n.awake && rng() < NPC_FIGHT_CHANCE).map((n) => n.id));
  const busy = new Set();
  const news = [...world.news];
  fighters.forEach((aId) => {
    if (busy.has(aId)) return;
    const bId = fighters.find((id) => id !== aId && !busy.has(id) && byId[id].level === byId[aId].level);
    if (bId === undefined) return;
    busy.add(aId);
    busy.add(bId);
    const [winId, loseId] = rng() < 0.5 ? [aId, bId] : [bId, aId];
    const level = byId[winId].level;
    byId[winId] = winDuel(byId[winId], level, rng, wakes, news);
    byId[loseId] = loseDuel(byId[loseId], rng);
  });
  return { ...world, npcs: world.npcs.map((n) => byId[n.id]), news };
}

/** Advance `days` days. Events are added to `news` (clear it first to start fresh). */
export function advanceDays(world, days, rng) {
  let next = world;
  for (let d = 0; d < days; d += 1) next = advanceDay(next, rng);
  return next;
}

/**
 * Create the colony: WORLD_SIZE colonists at Lucidity 1 in random columns,
 * then run WORLD_WARMUP_DAYS without wakes so day 1 has Sleepers at every level.
 */
export function createWorld(rng) {
  const used = new Set();
  const npcs = [];
  for (let id = 0; id < WORLD_SIZE; id += 1) {
    let name = randomName(rng);
    while (used.has(name)) name = randomName(rng);
    used.add(name);
    npcs.push({ ...generateSleeper(1, rng, { name }), id, column: randInt(rng, MAP_COLS), awake: false });
  }
  let world = { npcs, news: [] };
  for (let d = 0; d < WORLD_WARMUP_DAYS; d += 1) world = advanceDay(world, rng, { wakes: false });
  return { ...world, news: [] };
}

/**
 * Apply the player's duel to the NPC they fought. If the NPC lost, it may die;
 * if it won, it climbs when the player was at least its level.
 * @param {object} world
 * @param {number} npcId
 * @param {'player'|'opponent'|'draw'} outcome - who won, from the player's side
 * @param {number} playerLevel
 * @param {function(): number} rng
 */
export function applyPlayerDuel(world, npcId, outcome, playerLevel, rng) {
  const news = [...world.news];
  const npcs = world.npcs.map((n) => {
    if (n.id !== npcId) return n;
    if (outcome === 'player') return loseDuel(n, rng);
    if (outcome === 'opponent') return winDuel(n, playerLevel, rng, true, news);
    return n;
  });
  return { ...world, npcs, news };
}

/** Remove one anchor from an NPC (it was stolen). */
export function takeAnchor(world, npcId, anchorId) {
  const npcs = world.npcs.map((n) => {
    if (n.id !== npcId) return n;
    const i = n.anchors.indexOf(anchorId);
    return i < 0 ? n : { ...n, anchors: n.anchors.filter((_, j) => j !== i) };
  });
  return { ...world, npcs };
}
