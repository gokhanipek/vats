import {
  createDuel, canFlip, flip, resolve, playBonus, canPlayBonus, duelOutcome, hold, canHold, lockTargets,
} from './duel';
import {
  chooseFlip, chooseBonus, chooseAction, observe, remember, shouldHold, knownPairs, bestPair,
} from './ai';
import { createRng } from './rng';
import { BONUS_CARDS, AFFINITY_RECHARGE } from './tuning';

const side = (types, hand = []) => ({ level: 1, fragments: types.map((type) => ({ type, tier: 1 })), hand });
const HAND = ['ping', 'defrag', 'doubleDown', 'echo', 'lock'];

// A fixed 3x2 board: 0/1 a mixed water pair, 2/3 the opponent's fire pair,
// 4/5 the player's air pair. No affinity, so recharge comes only from card rules.
function fixed(hands = { player: HAND, opponent: ['doubleDown'] }) {
  const duel = createDuel(side(['water', 'fire', 'air'], hands.player),
    side(['electric', 'air', 'fire'], hands.opponent), 1, createRng(1));
  const cards = [
    { ownerId: 'player', type: 'water', tier: 1 }, { ownerId: 'opponent', type: 'water', tier: 1 },
    { ownerId: 'opponent', type: 'fire', tier: 1 }, { ownerId: 'opponent', type: 'fire', tier: 1 },
    { ownerId: 'player', type: 'air', tier: 1 }, { ownerId: 'player', type: 'air', tier: 1 },
  ].map((c) => ({ ...c, faceUp: false, claimedBy: null, lockedBy: null }));
  return { ...duel, cols: 3, rows: 2, cards, affinity: { player: [], opponent: [] } };
}
const claim = (d, a, b, rng = createRng(1)) => resolve(flip(flip(d, a, rng), b, rng));

describe('duel', () => {
  it('creates a full board with every bonus card ready', () => {
    const duel = createDuel(side(['water', 'fire', 'air'], ['ping']), side(['electric', 'air', 'fire']), 1, createRng(5));
    expect(duel.cards).toHaveLength(12);
    expect(duel.cooldowns.player).toEqual({ ping: 0 });
    expect(duel.resonance).toEqual({ player: null, opponent: null });
    expect(duel.affinity.player).toEqual(['water', 'fire']);
    expect(duel.phase).toBe('awaitingFirst');
  });

  it('only the first flip of your own card gives a hint, private to you', () => {
    const rng = createRng(1);
    const own = flip(fixed(), 0, rng);
    expect(own.lastHint.side).toBe('player');
    expect(own.lastHint.positions).toContain(1);
    expect(flip(fixed(), 2, rng).lastHint).toBeNull(); // the opponent's card
    expect(flip(flip(fixed(), 2, rng), 4, rng).lastHint).toBeNull(); // own card, second flip
  });

  it('a match claims, scores by ownership, sets resonance and keeps the turn', () => {
    const d = claim(fixed(), 0, 1);
    expect(d.cards[0].claimedBy).toBe('player');
    expect(d.scores.player).toBe(3); // 2 (own) + 1 (theirs), no resonance yet
    expect(d.resonance.player).toBe('water');
    expect(d.active).toBe('player');
    expect(d.matchesThisTurn).toBe(1);
    expect(d.lastEvent).toMatchObject({ kind: 'match', resonance: null });
  });

  it('resonance: the next type in the cycle scores a bonus, the one before a penalty', () => {
    // water -> fire is resonant: their fire pair 1 + 1 = 2, +2 per tier
    const resonant = claim(claim(fixed(), 0, 1), 2, 3);
    expect(resonant.scores.player).toBe(3 + 4);
    expect(resonant.lastEvent.resonance).toBe('bonus');
    // air -> fire is dissonant: their fire pair 2, -2 per tier
    const dissonant = claim(claim(fixed(), 4, 5), 2, 3);
    expect(dissonant.scores.player).toBe(4 + 0);
    expect(dissonant.lastEvent.resonance).toBe('penalty');
  });

  it('resonance carries over between turns', () => {
    let d = claim(fixed(), 4, 5); // player resonance: air
    d = hold(d);
    d = resolve(flip(flip(d, 0, createRng(1)), 2, createRng(1))); // opponent misses
    expect(d.active).toBe('player');
    expect(d.resonance.player).toBe('air');
  });

  it('hold ends the turn after a match, and only after a match', () => {
    expect(canHold(fixed())).toBe(false);
    expect(hold(fixed())).toEqual(fixed());
    const d = hold(claim(fixed(), 4, 5));
    expect(d.active).toBe('opponent');
    expect(d.phase).toBe('awaitingFirst');
    expect(d.matchesThisTurn).toBe(0);
  });

  it('a miss flips back and passes the turn', () => {
    const d = claim(fixed(), 0, 2);
    expect(d.active).toBe('opponent');
    expect(d.cards[0].faceUp).toBe(false);
    expect(d.phase).toBe('awaitingFirst');
  });

  it('cannot flip claimed or face-up cards', () => {
    const rng = createRng(1);
    const d = flip(fixed(), 0, rng);
    expect(canFlip(d, 0)).toBe(false);
    expect(flip(d, 0, rng)).toBe(d);
  });

  it('ends when the board is cleared and picks the winner', () => {
    let d = fixed();
    [[0, 1], [2, 3], [4, 5]].forEach(([a, b]) => { d = claim(d, a, b); });
    expect(d.phase).toBe('ended');
    expect(d.scores.player).toBe(3 + 4 + 6); // water, fire (resonant), air (resonant)
    expect(duelOutcome(d)).toBe('player');
  });

  it('double down doubles a match and puts the card on cooldown', () => {
    let d = playBonus(fixed(), 'player', 'doubleDown', createRng(1));
    expect(d.cooldowns.player.doubleDown).toBe(BONUS_CARDS.doubleDown.cooldown);
    d = claim(d, 4, 5);
    expect(d.scores.player).toBe(8);
  });

  it('double down miss costs points, floored at 0', () => {
    let d = { ...fixed(), scores: { player: 10, opponent: 0 } };
    d = claim(playBonus(d, 'player', 'doubleDown', createRng(1)), 0, 2);
    expect(d.scores.player).toBe(10 - BONUS_CARDS.doubleDown.missPenalty);
    d = { ...fixed(), scores: { player: 1, opponent: 0 } };
    d = claim(playBonus(d, 'player', 'doubleDown', createRng(1)), 0, 2);
    expect(d.scores.player).toBe(0);
  });

  it('only one bonus per turn, only at a turn boundary, only when ready, only if held', () => {
    const rng = createRng(1);
    const d = playBonus(fixed(), 'player', 'ping', rng);
    expect(canPlayBonus(d, 'player', 'defrag')).toBe(false);
    expect(canPlayBonus(flip(fixed(), 0, rng), 'player', 'ping')).toBe(false);
    const cooling = { ...fixed(), cooldowns: { player: { ping: 1 }, opponent: {} } };
    expect(playBonus(cooling, 'player', 'ping', rng)).toBe(cooling);
    expect(canPlayBonus(fixed(), 'opponent', 'doubleDown')).toBe(false); // not their turn
    expect(canPlayBonus(fixed(), 'player', 'nope')).toBe(false);
  });

  it('cards recharge by their own rule: type, own pair, or turns', () => {
    let d = { ...fixed(), cooldowns: { player: { ping: 1, doubleDown: 1, lock: 1, echo: 2, defrag: 4 }, opponent: {} } };
    d = claim(d, 4, 5); // an own air pair: Lock ('own') recharges; Fire/Electric cards don't
    expect(d.cooldowns.player).toMatchObject({ lock: 0, doubleDown: 1, ping: 1, echo: 2 });
    d = claim(d, 2, 3); // a fire pair: Double Down ('type' fire) recharges
    expect(d.cooldowns.player.doubleDown).toBe(0);
    d = { ...fixed(), active: 'opponent', cooldowns: { player: { echo: 2, defrag: 4 }, opponent: {} } };
    d = claim(d, 0, 2); // opponent misses: the player's turn begins, 'turns' cards recharge
    expect(d.cooldowns.player).toMatchObject({ echo: 1, defrag: 3 });
  });

  it('claiming an affinity type recharges every card', () => {
    let d = { ...fixed(), affinity: { player: ['air'], opponent: [] } };
    d = { ...d, hands: { ...d.hands, player: ['ping', 'echo', 'defrag'] } };
    d = { ...d, cooldowns: { player: { ping: 1, echo: 2, defrag: 4 }, opponent: {} } };
    d = claim(d, 4, 5);
    expect(d.cooldowns.player).toEqual({ ping: 1 - AFFINITY_RECHARGE, echo: 2 - AFFINITY_RECHARGE, defrag: 4 - AFFINITY_RECHARGE });
  });

  it('ping peeks at 2 face-down cards for the player only', () => {
    const d = playBonus(fixed(), 'player', 'ping', createRng(2));
    expect(d.lastPeek.side).toBe('player');
    expect(d.lastPeek.positions).toHaveLength(2);
    expect(d.cards.every((c) => !c.faceUp)).toBe(true);
  });

  it('echo marks only your own face-down cards, privately, without revealing them', () => {
    let d = claim(fixed(), 4, 5); // own air pair claimed
    d = playBonus(d, 'player', 'echo', createRng(1));
    expect(d.lastEcho).toEqual({ side: 'player', positions: [0] });
    expect(d.cards.every((c) => !c.faceUp)).toBe(true);
  });

  it('lock: nobody can flip the card until the locker\'s next turn', () => {
    let d = playBonus(fixed(), 'player', 'lock', createRng(1), 2);
    expect(d.cards[2].lockedBy).toBe('player');
    expect(canFlip(d, 2)).toBe(false);
    expect(lockTargets(d)).not.toContain(2);
    d = claim(d, 0, 4); // player misses
    expect(d.active).toBe('opponent');
    expect(canFlip(d, 2)).toBe(false); // still locked on their turn
    d = claim(d, 0, 4); // opponent misses: the player's turn, the lock opens
    expect(d.cards[2].lockedBy).toBeNull();
  });

  it('lock needs a valid target', () => {
    const rng = createRng(1);
    expect(playBonus(fixed(), 'player', 'lock', rng)).toEqual(fixed());
    const claimed = claim(fixed(), 4, 5);
    expect(playBonus(claimed, 'player', 'lock', rng, 4)).toBe(claimed);
  });

  it('locks open when they would leave fewer than 2 cards to flip', () => {
    let d = claim(claim(fixed(), 0, 1), 4, 5); // fire pair left: 2 and 3
    d = playBonus(d, 'player', 'lock', createRng(1), 2);
    expect(d.cards[2].lockedBy).toBeNull();
    expect(canFlip(d, 2)).toBe(true);
  });

  it('defrag reshuffles unclaimed cards and keeps claimed ones', () => {
    let d = claim(fixed(), 4, 5, createRng(3));
    d = playBonus(d, 'player', 'defrag', createRng(3));
    expect(d.cards[4].claimedBy).toBe('player');
    expect(d.cards[5].claimedBy).toBe('player');
    const open = d.cards.filter((c) => c.claimedBy === null).map((c) => c.type).sort();
    expect(open).toEqual(['fire', 'fire', 'water', 'water']);
  });
});

describe('ai', () => {
  const knowing = (d, positions) => positions.map((pos) => ({ pos, type: d.cards[pos].type, tier: d.cards[pos].tier }));

  it('remembers with bounded capacity, oldest forgotten', () => {
    let m = [];
    m = remember(m, 0, { type: 'a', tier: 1 }, 2);
    m = remember(m, 1, { type: 'b', tier: 1 }, 2);
    m = remember(m, 2, { type: 'c', tier: 1 }, 2);
    expect(m.map((x) => x.pos)).toEqual([1, 2]);
    expect(remember(m, 3, { type: 'd', tier: 1 }, 0)).toEqual([]);
  });

  it('opens and completes a known pair', () => {
    const d = { ...fixed(), active: 'opponent' };
    const memory = knowing(d, [2, 3]);
    const rng = createRng(1);
    const first = chooseFlip(d, memory, rng);
    expect(first).toBe(2);
    expect(chooseFlip(flip(d, first, rng), memory, rng)).toBe(3);
  });

  it('planner takes the best-value pair; greedy takes the first it knows', () => {
    // Resonance electric: water is resonant (3 + 2), fire neutral (2), air dissonant (4 - 2).
    const d = { ...fixed(), resonance: { player: 'electric', opponent: null } };
    const memory = knowing(d, [2, 3, 4, 5, 0, 1]);
    expect(knownPairs(memory, d)).toHaveLength(3);
    expect(bestPair(d, 'player', memory)).toEqual([0, 1]);
    expect(chooseFlip(d, memory, createRng(1), 'planner')).toBe(0);
    expect(chooseFlip(d, memory, createRng(1), 'greedy')).toBe(2);
  });

  it('skips locked cards', () => {
    let d = playBonus({ ...fixed(), active: 'opponent' }, 'opponent', 'doubleDown', createRng(1));
    d = { ...d, cards: d.cards.map((c, i) => (i === 2 ? { ...c, lockedBy: 'player' } : c)) };
    expect(knownPairs(knowing(d, [2, 3]), d)).toEqual([]);
  });

  it('second flip searches its own hint area when it knows no match', () => {
    const rng = createRng(4);
    const d = flip({ ...fixed(), active: 'opponent' }, 2, rng); // the opponent's own card
    expect(d.lastHint.side).toBe('opponent');
    for (let i = 0; i < 10; i += 1) {
      expect(d.lastHint.positions).toContain(chooseFlip(d, [], rng));
    }
  });

  it('observe forgets claimed cards and learns face-up ones', () => {
    const rng = createRng(1);
    let d = flip(fixed(), 0, rng);
    let m = observe([], d, 4);
    expect(m.map((x) => x.pos)).toEqual([0]);
    d = resolve(flip(d, 1, rng));
    m = observe(m, d, 4);
    expect(m).toEqual([]);
  });

  it('planner holds instead of flipping blind; greedy never holds', () => {
    const d = claim(fixed(), 4, 5);
    expect(shouldHold(d, [], 'planner')).toBe(true);
    expect(shouldHold(d, [], 'greedy')).toBe(false);
    expect(shouldHold(d, knowing(d, [0, 1]), 'planner')).toBe(false); // knows a good pair
    expect(chooseAction(d, [], createRng(1), { bonus: false })).toEqual({ type: 'hold' });
  });

  it('planner saves a dissonant pair of its own, but takes one that would feed the other side', () => {
    // Player resonance fire: water is dissonant.
    const base = { ...claim(fixed(), 4, 5), resonance: { player: 'fire', opponent: null } };
    const ownWater = {
      ...base,
      cards: base.cards.map((c, i) => (i === 1 ? { ...c, ownerId: 'player' } : c)),
    };
    expect(shouldHold(ownWater, knowing(ownWater, [0, 1]))).toBe(true);
    expect(shouldHold(base, knowing(base, [0, 1]))).toBe(false); // card 1 is theirs: take it
    // Holding with Lock ready: lock a card of the saved pair first.
    expect(chooseBonus(ownWater, 'player', knowing(ownWater, [0, 1]), true)).toEqual({ id: 'lock', target: 0 });
  });

  it('plays double down when it knows a good pair, ping when blind', () => {
    const d = { ...fixed(), active: 'opponent', hands: { player: [], opponent: ['doubleDown', 'ping'] } };
    d.cooldowns = { player: {}, opponent: { doubleDown: 0, ping: 0 } };
    expect(chooseBonus(d, 'opponent', knowing(d, [2, 3]))).toEqual({ id: 'doubleDown' });
    expect(chooseBonus(d, 'opponent', [])).toEqual({ id: 'ping' });
  });
});
