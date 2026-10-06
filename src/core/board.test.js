import { gridFor, splitPairs, buildBoard, boardTierForLucidity } from './board';
import { hintFor, partnerPositions } from './hints';
import { createRng } from './rng';

const frags = (n, tier = 1, type = 'water') => Array.from({ length: n }, () => ({ type, tier }));

describe('board', () => {
  it('sizes the grid by tier', () => {
    expect(gridFor(1)).toEqual({ cols: 4, rows: 3, pairs: 6 });
    expect(gridFor(2)).toEqual({ cols: 4, rows: 4, pairs: 8 });
    expect(gridFor(3)).toEqual({ cols: 5, rows: 4, pairs: 10 });
    expect(gridFor(4)).toEqual({ cols: 6, rows: 4, pairs: 12 });
    expect(gridFor(9).pairs).toBe(12);
  });

  it('maps Lucidity to board tiers in steps of two', () => {
    expect([1, 2, 3, 4, 5, 6].map(boardTierForLucidity)).toEqual([1, 1, 2, 2, 3, 3]);
    expect(boardTierForLucidity(0)).toBe(1);
    expect(boardTierForLucidity(9)).toBe(3);
  });

  it('splits evenly when both sides have enough', () => {
    const s = splitPairs(6, { id: 'p', level: 1, count: 5 }, { id: 'o', level: 1, count: 5 }, createRng(1));
    expect(s).toEqual({ p: 3, o: 3 });
  });

  it('gives the odd pair to the side with more cards, then higher level', () => {
    expect(splitPairs(15, { id: 'p', level: 5, count: 9 }, { id: 'o', level: 5, count: 8 }, createRng(1)))
      .toEqual({ p: 8, o: 7 });
    expect(splitPairs(15, { id: 'p', level: 4, count: 9 }, { id: 'o', level: 5, count: 9 }, createRng(1)))
      .toEqual({ o: 8, p: 7 });
  });

  it('moves a shortfall to the other side', () => {
    const s = splitPairs(8, { id: 'p', level: 2, count: 3 }, { id: 'o', level: 2, count: 6 }, createRng(1));
    expect(s).toEqual({ p: 3, o: 5 });
  });

  it('builds a shuffled board with owners and best-first supply', () => {
    const board = buildBoard([
      { id: 'player', level: 1, fragments: [...frags(3), { type: 'fire', tier: 2 }] },
      { id: 'opponent', level: 1, fragments: frags(3, 1, 'air') },
    ], 1, createRng(7));
    expect(board.cards).toHaveLength(12);
    expect(board.supplied.player[0]).toEqual({ type: 'fire', tier: 2 });
    expect(board.cards.filter((c) => c.ownerId === 'player')).toHaveLength(6);
    expect(board.cards.every((c) => !c.faceUp && c.claimedBy === null)).toBe(true);
  });

  it('shrinks rows when both sides are short', () => {
    const board = buildBoard([
      { id: 'player', level: 2, fragments: frags(3) },
      { id: 'opponent', level: 2, fragments: frags(3, 1, 'air') },
    ], 2, createRng(7));
    expect(board.cards).toHaveLength(12);
    expect(board.rows).toBe(3);
  });
});

describe('hints', () => {
  const board = {
    cols: 4,
    rows: 3,
    cards: [
      { type: 'water', tier: 1 }, { type: 'fire', tier: 2 }, { type: 'air', tier: 3 }, { type: 'x', tier: 1 },
      { type: 'y', tier: 1 }, { type: 'y', tier: 1 }, { type: 'z', tier: 1 }, { type: 'z', tier: 1 },
      { type: 'x', tier: 1 }, { type: 'water', tier: 1 }, { type: 'fire', tier: 2 }, { type: 'air', tier: 3 },
    ].map((c) => ({ ...c, ownerId: 'player', faceUp: false, claimedBy: null })),
  };

  it('finds partners', () => {
    expect(partnerPositions(board.cards, 0)).toEqual([9]);
  });

  it('tier 1 area is 3x3 and contains the pair', () => {
    for (let seed = 1; seed < 30; seed += 1) {
      const h = hintFor(board, 0, createRng(seed));
      expect(h.positions).toHaveLength(9);
      expect(h.positions).toContain(9);
    }
  });

  it('tier 2 area is 2x2 and contains the pair', () => {
    for (let seed = 1; seed < 30; seed += 1) {
      const h = hintFor(board, 1, createRng(seed));
      expect(h.positions).toHaveLength(4);
      expect(h.positions).toContain(10);
    }
  });

  it('tier 3 marks the pair and one neighbour', () => {
    const h = hintFor(board, 2, createRng(3));
    expect(h.positions).toHaveLength(2);
    expect(h.positions[0]).toBe(11);
    expect([7, 10]).toContain(h.positions[1]);
  });

  it('places the area randomly, not always centred', () => {
    const areas = new Set();
    for (let seed = 1; seed < 40; seed += 1) {
      areas.add(hintFor(board, 0, createRng(seed)).positions.join(','));
    }
    expect(areas.size).toBeGreaterThan(1);
  });

  it('returns null when the pair is claimed', () => {
    const cards = board.cards.map((c, i) => (i === 9 ? { ...c, claimedBy: 'player' } : c));
    expect(hintFor({ ...board, cards }, 0, createRng(1))).toBeNull();
  });
});
