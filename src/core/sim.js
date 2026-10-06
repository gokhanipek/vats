// Duel simulation: two AIs play a full duel with the real engine. Used to check
// whether the strategy layer matters: with perfect memory, does planning
// (resonance order, hold, Lock) beat greedy play, and how much does going
// first decide the result? Pure and seeded.
import { createDuel, flip, resolve, hold, playBonus, duelOutcome } from './duel';
import { chooseAction, observe, bestPair, knownPairs } from './ai';
import { generateSleeper } from './sleepers';
import { createRng, nextSeed } from './rng';

const MAX_STEPS = 5000;

/**
 * Play one duel between two AIs.
 * @param {object} options
 * @param {number} options.seed
 * @param {number} options.boardTier
 * @param {{player:string, opponent:string}} options.policies - 'planner' | 'greedy'
 * @param {{player:number, opponent:number}} options.memory - capacity (99 = perfect)
 * @param {boolean} [options.bonus=false] - give both sides every bonus card
 * @param {'player'|'opponent'} [options.starting='player']
 * @returns {{outcome, scores, steps, holds, reorders}}
 *   holds / reorders: how often the player side held, or took a different pair than greedy would.
 */
export function simulateDuel(options) {
  const rng = createRng(options.seed);
  const level = 3;
  const deck = () => generateSleeper(level, createRng(nextSeed(rng)), { fragmentCount: 8 });
  const hand = options.bonus ? ['ping', 'echo', 'doubleDown', 'lock', 'defrag'] : [];
  let state = createDuel({ ...deck(), hand }, { ...deck(), hand }, options.boardTier, rng, options.starting || 'player');
  const memory = { player: [], opponent: [] };
  const see = (extra = { player: [], opponent: [] }) => {
    memory.player = observe(memory.player, state, options.memory.player, extra.player);
    memory.opponent = observe(memory.opponent, state, options.memory.opponent, extra.opponent);
  };
  let holds = 0;
  let reorders = 0;

  for (let steps = 0; steps < MAX_STEPS; steps += 1) {
    if (state.phase === 'ended') {
      return { outcome: duelOutcome(state), scores: state.scores, steps, holds, reorders };
    }
    const side = state.active;
    const policy = options.policies[side];
    const action = chooseAction(state, memory[side], rng, { policy, bonus: options.bonus });
    if (!action) break;
    if (action.type === 'hold') {
      if (side === 'player') holds += 1;
      state = hold(state);
    } else if (action.type === 'bonus') {
      state = playBonus(state, side, action.id, rng, action.target);
      if (action.id === 'defrag') {
        memory.player = [];
        memory.opponent = [];
      } else if (action.id === 'ping' && state.lastPeek) {
        see({ ...{ player: [], opponent: [] }, [side]: state.lastPeek.positions });
      }
    } else {
      if (side === 'player' && state.flipped.length === 0) {
        const pairs = knownPairs(memory[side], state);
        const best = bestPair(state, side, memory[side]);
        if (best && pairs[0] && best[0] !== pairs[0][0]) reorders += 1;
      }
      state = flip(state, action.pos, rng);
      see();
      if (state.phase === 'resolving') {
        state = resolve(state);
        see();
      }
    }
  }
  throw new Error(`duel did not finish (seed ${options.seed})`);
}

/**
 * Play `n` duels with alternating starters and summarise them from the player
 * side's point of view.
 * @returns {{wins, losses, draws, starterWins, avgMargin, holdsPerDuel, reordersPerDuel}}
 *   starterWins: share of decided duels won by whoever went first.
 */
export function simulateMany(n, options) {
  const total = { wins: 0, losses: 0, draws: 0, starterWins: 0, decided: 0, margin: 0, holds: 0, reorders: 0 };
  for (let i = 0; i < n; i += 1) {
    const starting = i % 2 === 0 ? 'player' : 'opponent';
    const r = simulateDuel({ ...options, seed: (options.seed || 1) * 100003 + i, starting });
    if (r.outcome === 'player') total.wins += 1;
    else if (r.outcome === 'opponent') total.losses += 1;
    else total.draws += 1;
    if (r.outcome !== 'draw') {
      total.decided += 1;
      if (r.outcome === starting) total.starterWins += 1;
    }
    total.margin += r.scores.player - r.scores.opponent;
    total.holds += r.holds;
    total.reorders += r.reorders;
  }
  return {
    wins: total.wins / n,
    losses: total.losses / n,
    draws: total.draws / n,
    starterWins: total.decided ? total.starterWins / total.decided : 0,
    avgMargin: total.margin / n,
    holdsPerDuel: total.holds / n,
    reordersPerDuel: total.reorders / n,
  };
}
