import {
  isMatch, cardPoints, pairPoints, mergeOptions, mergeFragments, bestFirst,
  resonanceOf, resonantPairPoints, affinityOf,
} from './fragments';
import { createRng, shuffleWith } from './rng';

describe('fragments', () => {
  it('matches same type and tier regardless of owner', () => {
    const a = { ownerId: 'player', type: 'water', tier: 2 };
    const b = { ownerId: 'opponent', type: 'water', tier: 2 };
    expect(isMatch(a, b, 0, 1)).toBe(true);
    expect(isMatch(a, a, 0, 0)).toBe(false);
    expect(isMatch(a, { ...b, tier: 1 }, 0, 1)).toBe(false);
    expect(isMatch(a, { ...b, type: 'fire' }, 0, 1)).toBe(false);
  });

  it('scores own cards double (doubled scale: 2x tier own, 1x tier theirs)', () => {
    const own = { ownerId: 'player', type: 'fire', tier: 3 };
    const theirs = { ownerId: 'opponent', type: 'fire', tier: 3 };
    expect(cardPoints(own, 'player')).toBe(6);
    expect(cardPoints(theirs, 'player')).toBe(3);
    expect(pairPoints(own, own, 'player')).toBe(12);
    expect(pairPoints(own, theirs, 'player')).toBe(9);
    expect(pairPoints(theirs, theirs, 'player')).toBe(6);
  });

  it('merges two equal fragments into the next tier', () => {
    const before = [{ type: 'water', tier: 1 }, { type: 'air', tier: 1 }, { type: 'water', tier: 1 }];
    const after = mergeFragments(before, 'water', 1);
    expect(after).toEqual([{ type: 'air', tier: 1 }, { type: 'water', tier: 2 }]);
    expect(before).toHaveLength(3);
  });

  it('refuses invalid merges', () => {
    const single = [{ type: 'water', tier: 1 }];
    expect(mergeFragments(single, 'water', 1)).toBe(single);
    const top = [{ type: 'fire', tier: 3 }, { type: 'fire', tier: 3 }];
    expect(mergeFragments(top, 'fire', 3)).toBe(top);
  });

  it('lists merge options once per type/tier', () => {
    const f = [{ type: 'water', tier: 1 }, { type: 'water', tier: 1 }, { type: 'water', tier: 1 },
      { type: 'fire', tier: 3 }, { type: 'fire', tier: 3 }, { type: 'air', tier: 1 }];
    expect(mergeOptions(f)).toEqual([{ type: 'water', tier: 1 }]);
  });

  it('sorts best-first', () => {
    const f = [{ type: 'a', tier: 1 }, { type: 'b', tier: 3 }, { type: 'c', tier: 2 }];
    expect(bestFirst(f).map((x) => x.type)).toEqual(['b', 'c', 'a']);
  });
});

describe('rng', () => {
  it('is deterministic per seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('shuffles without mutating', () => {
    const input = [1, 2, 3, 4, 5];
    const out = shuffleWith(createRng(1), input);
    expect(input).toEqual([1, 2, 3, 4, 5]);
    expect([...out].sort()).toEqual(input);
  });
});

describe('resonance and affinity', () => {
  const card = (type, ownerId, tier = 1) => ({ type, ownerId, tier });

  it('follows the cycle water -> fire -> air -> electric -> water', () => {
    expect(resonanceOf('water', 'fire')).toBe('bonus');
    expect(resonanceOf('electric', 'water')).toBe('bonus');
    expect(resonanceOf('fire', 'water')).toBe('penalty');
    expect(resonanceOf('water', 'electric')).toBe('penalty');
    expect(resonanceOf('water', 'air')).toBeNull(); // opposite
    expect(resonanceOf('water', 'water')).toBeNull();
    expect(resonanceOf(null, 'water')).toBeNull();
  });

  it('adds or removes points per tier, never below 0', () => {
    const own = [card('fire', 'p', 2), card('fire', 'p', 2)]; // 4 + 4 = 8
    expect(resonantPairPoints(...own, 'p', null)).toBe(8);
    expect(resonantPairPoints(...own, 'p', 'water')).toBe(12);
    expect(resonantPairPoints(...own, 'p', 'air')).toBe(4);
    const theirs = [card('fire', 'o'), card('fire', 'o')]; // 1 + 1 = 2
    expect(resonantPairPoints(...theirs, 'p', 'air')).toBe(0);
  });

  it('affinity is the two most common types', () => {
    const f = (types) => types.map((type) => ({ type, tier: 1 }));
    expect(affinityOf(f(['air', 'air', 'fire', 'electric', 'electric', 'air']))).toEqual(['air', 'electric']);
    expect(affinityOf(f(['fire']))).toEqual(['fire', 'water']);
  });
});
