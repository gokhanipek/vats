// The run: lives, Lucidity, the map of Sleepers, the 30-day clock and the Wake Attempt.
// Pure: randomness comes from `run.seed`, and each transition stores a new seed.
//
// Run shape:
// {
//   seed, day, life, lucidity,
//   points,                            // the points total: duel scores add up, spent in the shop
//   affinity: string[],                // two types, from the vat you spawned in
//   fragments: Array<{type,tier}>,     // every fragment you own (the loadout picks from these)
//   bonus: string[],                   // every bonus card you own (hand + storage)
//   hand: string[],                    // the bonus cards you take into duels (at most handSlots)
//   anchors: string[],
//   screen: 'spawn' | 'map' | 'loadout' | 'duel' | 'result' | 'end',
//   spawnOffer: Sleeper | null,        // the vat you wake in on (re)spawn
//   world: World,                      // the colonists on the map (see world.js)
//   opponent: Sleeper | null,          // current duel opponent (an NPC with an id, or a Warden)
//   travelDays: number,                // days the current duel costs
//   duelSeed: number | null,
//   duelFragments: Array<{type,tier}> | null, // what the player brings to the current duel
//   lastLoadout: Array<{type,tier}>,   // the previous loadout, offered as the default
//   wakeStage: number | null,          // 1..WAKE_DUELS during the Wake Attempt
//   result: null | { outcome, scores, opponent, lucidityGained, pointsEarned, stealable, stolen, died, survived },
//   ending: null | 'awake' | 'timeout',
//   history: Array<{day, life, outcome, died, survived, opponentName, opponentLevel, wake, lucidity}>,
// }
import {
  CAMPAIGN_DAYS, WAKE_DUEL_DAYS, RESPAWN_DAYS, MAX_LUCIDITY, WAKE_DUELS,
  SPAWN_PICK_FRAGMENTS, SPAWN_PICK_BONUS, WAKE_BOARD_TIER, PLAYER_SURVIVAL_CAP, START_POINTS,
  BONUS_CARDS, handSlots,
} from './tuning';
import { gridFor, splitPairs, boardTierForLucidity } from './board';
import { fragmentKey, mergeFragments } from './fragments';
import { generateSpawnOffer, generateWakeOpponent } from './sleepers';
import {
  createWorld, advanceDays, applyPlayerDuel, inReach, travelDays, anchorSurvival, takeAnchor,
} from './world';
import { createRng, nextSeed } from './rng';

// Run `fn(run, rng)` with an rng from the run's seed, storing the next seed.
function withRng(run, fn) {
  const rng = createRng(run.seed);
  const next = fn(run, rng);
  return { ...next, seed: nextSeed(rng) };
}

function timedOut(day) {
  return day > CAMPAIGN_DAYS;
}

/**
 * Start a new game on day 1: create the colony and offer a vat to wake in.
 * @param {number} seed
 */
export function newRun(seed) {
  return withRng({ seed }, (run, rng) => ({
    day: 1,
    life: 1,
    lucidity: 1,
    points: START_POINTS,
    affinity: [],
    fragments: [],
    bonus: [],
    hand: [],
    anchors: [],
    screen: 'spawn',
    spawnOffer: generateSpawnOffer(rng),
    world: createWorld(rng),
    opponent: null,
    travelDays: 0,
    duelSeed: null,
    duelFragments: null,
    lastLoadout: [],
    wakeStage: null,
    result: null,
    ending: null,
    history: [],
  }));
}

/**
 * Take over the offered vat, keeping the picked fragments and bonus card at tier 1.
 * Any anchor the vat holds is kept too: it takes no slot. The vat sets your affinity.
 * @param {object} run
 * @param {number[]} fragmentIndexes - indexes into spawnOffer.fragments
 * @param {number[]} bonusIndexes - indexes into spawnOffer.hand
 */
export function confirmSpawn(run, fragmentIndexes, bonusIndexes) {
  if (run.screen !== 'spawn') return run;
  const offer = run.spawnOffer;
  const uniqueF = Array.from(new Set(fragmentIndexes)).filter((i) => offer.fragments[i]);
  const uniqueB = Array.from(new Set(bonusIndexes)).filter((i) => offer.hand[i]);
  if (uniqueF.length !== SPAWN_PICK_FRAGMENTS || uniqueB.length !== SPAWN_PICK_BONUS) return run;
  return {
    ...run,
    lucidity: 1,
    fragments: uniqueF.map((i) => ({ type: offer.fragments[i].type, tier: 1 })),
    bonus: uniqueB.map((i) => offer.hand[i]),
    hand: uniqueB.map((i) => offer.hand[i]),
    anchors: [...offer.anchors],
    affinity: [...offer.affinity],
    spawnOffer: null,
    screen: 'map',
  };
}

/** The player's chance to survive a lost duel, from their anchors. */
export function playerSurvival(run) {
  return Math.min(PLAYER_SURVIVAL_CAP, anchorSurvival(run.anchors));
}

/** The board tier for the current duel. */
export function boardTierFor(run) {
  return run.wakeStage ? WAKE_BOARD_TIER : boardTierForLucidity(run.lucidity);
}

/**
 * How many fragments the player brings to the duel against `run.opponent`.
 * Every board has an even pair count, so a tie between the sides gives equal
 * shares whichever side the tie-break picks; a fixed rng is enough here.
 */
export function loadoutSize(run) {
  const shares = splitPairs(
    gridFor(boardTierFor(run)).pairs,
    { id: 'player', level: run.lucidity, count: run.fragments.length },
    { id: 'opponent', level: run.opponent.level, count: run.opponent.fragments.length },
    () => 0
  );
  return shares.player;
}

// With an opponent set: ask for a loadout when the player owns more fragments
// than they bring, otherwise go straight to the duel with all of them.
function enterDuel(run) {
  if (run.fragments.length > loadoutSize(run)) {
    return { ...run, screen: 'loadout', duelFragments: null };
  }
  return { ...run, screen: 'duel', duelFragments: run.fragments };
}

/**
 * Travel to a Sleeper on the map and duel it. It must be awake-free and within reach.
 * @param {object} run
 * @param {number} npcId
 */
export function chooseSignal(run, npcId) {
  if (run.screen !== 'map') return run;
  const npc = run.world.npcs.find((n) => n.id === npcId);
  if (!npc || !inReach(npc, run.lucidity)) return run;
  return withRng(run, (r, rng) => enterDuel({
    ...r,
    opponent: npc,
    travelDays: travelDays(npc),
    duelSeed: nextSeed(rng),
    result: null,
  }));
}

/**
 * Choose the fragments to bring: exactly loadoutSize(run) distinct indexes into run.fragments.
 * @param {object} run
 * @param {number[]} fragmentIndexes
 */
export function confirmLoadout(run, fragmentIndexes) {
  if (run.screen !== 'loadout') return run;
  const unique = Array.from(new Set(fragmentIndexes)).filter((i) => run.fragments[i]);
  if (unique.length !== fragmentIndexes.length || unique.length !== loadoutSize(run)) return run;
  const duelFragments = unique.map((i) => run.fragments[i]);
  return { ...run, screen: 'duel', duelFragments, lastLoadout: duelFragments };
}

/** Whether the Wake Attempt is open. */
export function canAttemptWake(run) {
  return run.screen === 'map' && run.lucidity >= MAX_LUCIDITY;
}

/** Begin the Wake Attempt: WAKE_DUELS back-to-back duels against Wardens, one loadout for all. */
export function startWake(run) {
  if (!canAttemptWake(run)) return run;
  return withRng(run, (r, rng) => enterDuel({
    ...r,
    wakeStage: 1,
    opponent: generateWakeOpponent(rng),
    travelDays: WAKE_DUEL_DAYS,
    duelSeed: nextSeed(rng),
    result: null,
  }));
}

// Distinct fragments (stolen at tier 1, so by type), bonus cards not yet owned, and anchors.
function stealOptions(run, suppliedByOpponent, opponent) {
  const seen = {};
  const fragments = [];
  suppliedByOpponent.forEach((f) => {
    if (!seen[f.type]) {
      seen[f.type] = true;
      fragments.push({ type: f.type, tier: 1 });
    }
  });
  const bonus = opponent.hand.filter((id) => !run.bonus.includes(id));
  return { fragments, bonus, anchors: [...(opponent.anchors || [])] };
}

/**
 * Record a finished duel. It costs the travel days, and the world moves on that
 * many days. A loss is death unless the player's anchors hold. Unless the player
 * died, their duel score is added to the points total.
 * @param {object} run
 * @param {{outcome:'player'|'opponent'|'draw', scores:object, supplied:object}} duel
 */
export function recordDuel(run, duel) {
  if (run.screen !== 'duel') return run;
  return withRng(run, (r, rng) => {
    const day = r.day + r.travelDays;
    const won = duel.outcome === 'player';
    const lost = duel.outcome === 'opponent';
    const survived = lost && rng() < playerSurvival(r);
    const died = lost && !survived;
    const pointsEarned = died ? 0 : duel.scores.player;
    const lucidityGained = !r.wakeStage && won && r.opponent.level >= r.lucidity
      && r.lucidity < MAX_LUCIDITY ? 1 : 0;
    const history = [...r.history, {
      day: r.day, life: r.life, outcome: duel.outcome, scores: duel.scores, died, survived,
      opponentName: r.opponent.name, opponentLevel: r.opponent.level, wake: r.wakeStage,
      lucidity: r.lucidity + lucidityGained, // Lucidity after this duel
    }];

    let world = { ...r.world, news: [] };
    if (!r.wakeStage) world = applyPlayerDuel(world, r.opponent.id, duel.outcome, r.lucidity, rng);
    world = advanceDays(world, r.travelDays, rng);

    if (r.wakeStage && won && r.wakeStage >= WAKE_DUELS) {
      return { ...r, day, history, world, points: r.points + pointsEarned, screen: 'end', ending: 'awake', result: null };
    }

    const stealable = won && !r.wakeStage
      ? stealOptions(r, duel.supplied.opponent, r.opponent)
      : { fragments: [], bonus: [], anchors: [] };
    const next = {
      ...r,
      day,
      history,
      world,
      points: r.points + pointsEarned,
      lucidity: r.lucidity + lucidityGained,
      screen: 'result',
      result: {
        outcome: duel.outcome,
        scores: duel.scores,
        opponent: r.opponent,
        lucidityGained,
        pointsEarned,
        stealable,
        stolen: false,
        died,
        survived,
        wakeStage: r.wakeStage,
      },
    };
    if (!died && timedOut(day)) {
      return { ...next, screen: 'end', ending: 'timeout' };
    }
    return next;
  });
}

/**
 * After a win, take one card the opponent brought (fragments arrive at tier 1).
 * A bonus card goes into your hand if it has room, otherwise into storage.
 * Anchors take no slot and are taken from the opponent.
 * @param {object} run
 * @param {'fragment'|'bonus'|'anchor'} kind
 * @param {number} index - into result.stealable.fragments / .bonus / .anchors
 */
export function steal(run, kind, index) {
  const result = run.result;
  if (run.screen !== 'result' || !result || result.outcome !== 'player' || result.stolen) return run;
  const taken = { ...result, stolen: true };
  if (kind === 'fragment') {
    const f = result.stealable.fragments[index];
    if (!f) return run;
    return { ...run, fragments: [...run.fragments, { type: f.type, tier: 1 }], result: taken };
  }
  if (kind === 'anchor') {
    const id = result.stealable.anchors[index];
    if (!id) return run;
    return {
      ...run,
      anchors: [...run.anchors, id],
      world: takeAnchor(run.world, result.opponent.id, id),
      result: taken,
    };
  }
  const id = result.stealable.bonus[index];
  if (!id || run.bonus.includes(id)) return run;
  return { ...addBonus(run, id), result: taken };
}

// Own a new bonus card: into the hand when it has room, otherwise storage.
function addBonus(run, id) {
  const hand = run.hand.length < handSlots(run.lucidity) ? [...run.hand, id] : run.hand;
  return { ...run, bonus: [...run.bonus, id], hand };
}

/**
 * Choose the hand: distinct bonus cards you own, at most handSlots. The rest
 * stay in storage. Only on the map.
 * @param {object} run
 * @param {string[]} ids
 */
export function setHand(run, ids) {
  if (run.screen !== 'map') return run;
  const unique = Array.from(new Set(ids));
  if (unique.length !== ids.length || ids.length > handSlots(run.lucidity)) return run;
  if (!ids.every((id) => run.bonus.includes(id))) return run;
  return { ...run, hand: ids };
}

/** Bonus cards the shop sells you: every card you don't own yet. */
export function shopStock(run) {
  return Object.keys(BONUS_CARDS).filter((id) => !run.bonus.includes(id));
}

/**
 * Buy a bonus card with points. Only on the map, only one you don't own.
 * @param {object} run
 * @param {string} id
 */
export function buyBonus(run, id) {
  if (run.screen !== 'map' || !shopStock(run).includes(id)) return run;
  const price = BONUS_CARDS[id].price;
  if (run.points < price) return run;
  return addBonus({ ...run, points: run.points - price }, id);
}

/**
 * Leave the result screen. After a death, respawn (costs RESPAWN_DAYS, and the
 * world moves on). In the Wake Attempt, go straight to the next duel, unless an
 * anchor saved you from a lost stage: then the attempt ends and you go back to
 * the map. Otherwise back to the map.
 */
export function continueRun(run) {
  if (run.screen !== 'result') return run;
  return withRng(run, (r, rng) => {
    if (r.result.died) {
      const day = r.day + RESPAWN_DAYS;
      const world = advanceDays({ ...r.world, news: [] }, RESPAWN_DAYS, rng);
      if (timedOut(day)) return { ...r, day, world, screen: 'end', ending: 'timeout' };
      return {
        ...r,
        day,
        world,
        life: r.life + 1,
        lucidity: 1,
        points: START_POINTS,
        affinity: [],
        fragments: [],
        bonus: [],
        hand: [],
        anchors: [],
        duelFragments: null,
        lastLoadout: [],
        wakeStage: null,
        opponent: null,
        screen: 'spawn',
        spawnOffer: generateSpawnOffer(rng),
        result: null,
      };
    }
    if (r.wakeStage && !r.result.survived) {
      // A won stage advances; a drawn stage is replayed against a new Warden.
      // The loadout chosen at the start of the Wake Attempt is kept.
      const wakeStage = r.result.outcome === 'player' ? r.wakeStage + 1 : r.wakeStage;
      return {
        ...r,
        wakeStage,
        opponent: generateWakeOpponent(rng),
        travelDays: WAKE_DUEL_DAYS,
        duelSeed: nextSeed(rng),
        screen: 'duel',
        result: null,
      };
    }
    return {
      ...r, screen: 'map', wakeStage: null, opponent: null, duelFragments: null, result: null,
    };
  });
}

/** Merge 2 equal fragments into the next tier (only between duels). */
export function mergeInRun(run, type, tier) {
  if (run.screen !== 'map' && run.screen !== 'result') return run;
  if (run.wakeStage) return run;
  return { ...run, fragments: mergeFragments(run.fragments, type, tier) };
}

/**
 * One summary per life, newest first: its duels, peak Lucidity and how it ended.
 * @param {Array} history - run.history
 * @returns {Array<{life, duels, wins, peakLucidity, fate:'alive'|'died'|'woke', endDay}>}
 */
export function lifeSummaries(history) {
  const lives = {};
  history.forEach((h) => {
    if (!lives[h.life]) {
      lives[h.life] = { life: h.life, duels: [], wins: 0, peakLucidity: 1, fate: 'alive', endDay: null };
    }
    const l = lives[h.life];
    l.duels.push(h);
    if (h.outcome === 'player') l.wins += 1;
    l.peakLucidity = Math.max(l.peakLucidity, h.lucidity || 1);
    if (h.died) {
      l.fate = 'died';
      l.endDay = h.day;
    } else if (h.outcome === 'player' && h.wake === WAKE_DUELS) {
      l.fate = 'woke';
      l.endDay = h.day;
    }
  });
  return Object.values(lives).sort((a, b) => b.life - a.life);
}

/** Collection summary: [{type, tier, count}] sorted by type then tier. */
export function collectionSummary(fragments) {
  const counts = {};
  fragments.forEach((f) => {
    const key = fragmentKey(f);
    counts[key] = counts[key] || { type: f.type, tier: f.tier, count: 0 };
    counts[key].count += 1;
  });
  return Object.values(counts).sort((a, b) => a.type.localeCompare(b.type) || a.tier - b.tier);
}
