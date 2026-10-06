import {
  createWorld, advanceDay, advanceDays, applyPlayerDuel, levelUp, loseDuel, resetMind, mapGrid,
  inReach, travelDays, revealsDeck, awakeCount, npcDeathChance, takeAnchor,
} from './world';
import { createRng } from './rng';
import { WORLD_SIZE, MAP_COLS, MAX_LUCIDITY, NPC_DEATH_CHANCE, AI_MEMORY } from './tuning';
import { supplyFor } from './sleepers';

const npc = (id, level, extra = {}) => ({
  id, name: `N-${id}`, level, column: 0, mainType: 'water', awake: false, memory: AI_MEMORY[level],
  fragments: [{ type: 'water', tier: 1 }, { type: 'fire', tier: 1 }, { type: 'air', tier: 1 }, { type: 'air', tier: 1 }],
  hand: ['ping'], anchors: [], ...extra,
});
const count = (world) => {
  const c = [0, 0, 0, 0, 0, 0];
  world.npcs.forEach((n) => { if (!n.awake) c[n.level - 1] += 1; });
  return c;
};

describe('world', () => {
  it('creates a fixed colony with unique names, warmed up to every level', () => {
    const world = createWorld(createRng(1));
    expect(world.npcs).toHaveLength(WORLD_SIZE);
    expect(new Set(world.npcs.map((n) => n.name)).size).toBe(WORLD_SIZE);
    expect(awakeCount(world)).toBe(0); // no wakes during the warm-up
    expect(world.npcs.every((n) => n.column >= 0 && n.column < MAP_COLS)).toBe(true);
    expect(count(world).filter((c) => c > 0).length).toBeGreaterThanOrEqual(5);
  });

  it('never gains or loses colonists, only wakes them', () => {
    let world = createWorld(createRng(2));
    const rng = createRng(3);
    for (let d = 0; d < 30; d += 1) world = advanceDay(world, rng);
    expect(world.npcs).toHaveLength(WORLD_SIZE);
    expect(world.npcs.map((n) => n.id).sort((a, b) => a - b)).toEqual(Array.from({ length: WORLD_SIZE }, (_, i) => i));
  });

  it('keeps at least 3 Sleepers in reach of every Lucidity over 30 days', () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      const rng = createRng(seed);
      let world = createWorld(rng);
      for (let d = 0; d < 30; d += 1) {
        world = advanceDay(world, rng);
        for (let lucidity = 1; lucidity <= MAX_LUCIDITY; lucidity += 1) {
          const reach = world.npcs.filter((n) => inReach(n, lucidity)).length;
          expect(reach).toBeGreaterThanOrEqual(3);
        }
      }
    }
  });

  it('reports wakes as news', () => {
    const rng = createRng(4);
    let world = { ...createWorld(rng), news: [] };
    world = advanceDays(world, 30, rng);
    expect(world.news.filter((e) => e.kind === 'wake')).toHaveLength(awakeCount(world));
  });

  it('level up adds one card, keeps the deck able to supply, and raises memory', () => {
    for (let seed = 1; seed < 30; seed += 1) {
      const before = npc(1, 2);
      const after = levelUp(before, createRng(seed));
      expect(after.level).toBe(3);
      expect(after.memory).toBe(AI_MEMORY[3]);
      // +1 fragment or bonus card, and -1 when it also merged two fragments
      const gained = (after.fragments.length + after.hand.length) - (before.fragments.length + before.hand.length);
      expect([0, 1]).toContain(gained);
      expect(after.fragments.length).toBeGreaterThanOrEqual(supplyFor(3));
    }
    expect(levelUp(npc(1, MAX_LUCIDITY), createRng(1)).level).toBe(MAX_LUCIDITY);
  });

  it('a mind that dies keeps its name but starts over at Lucidity 1', () => {
    const reset = resetMind(npc(7, 5, { anchors: ['anchor'] }), createRng(1));
    expect(reset).toMatchObject({ id: 7, name: 'N-7', level: 1, awake: false });
  });

  it('a defeated Sleeper dies about NPC_DEATH_CHANCE of the time; a surviving L6 drops to 5', () => {
    const rng = createRng(5);
    let deaths = 0;
    for (let i = 0; i < 2000; i += 1) if (loseDuel(npc(1, 3), rng).level === 1) deaths += 1;
    expect(deaths / 2000).toBeGreaterThan(NPC_DEATH_CHANCE - 0.04);
    expect(deaths / 2000).toBeLessThan(NPC_DEATH_CHANCE + 0.04);
    const levels = new Set();
    for (let i = 0; i < 50; i += 1) levels.add(loseDuel(npc(1, 6), rng).level);
    expect([...levels].sort()).toEqual([1, 5]);
  });

  it('anchors lower an NPC death chance', () => {
    expect(npcDeathChance(npc(1, 1, { anchors: ['deepAnchor'] }))).toBeCloseTo(NPC_DEATH_CHANCE - 0.1);
    expect(npcDeathChance(npc(1, 1, { anchors: ['deepAnchor', 'deepAnchor', 'deepAnchor'] }))).toBe(0);
  });

  it('applies the player duel: a winner climbs only vs an equal or stronger player', () => {
    const world = { npcs: [npc(0, 3), npc(1, 3)], news: [] };
    const rng = createRng(1);
    expect(applyPlayerDuel(world, 0, 'opponent', 3, rng).npcs[0].level).toBe(4);
    expect(applyPlayerDuel(world, 0, 'opponent', 2, rng).npcs[0].level).toBe(3);
    expect(applyPlayerDuel(world, 0, 'draw', 3, rng)).toEqual(world);
    expect(applyPlayerDuel(world, 0, 'player', 3, rng).npcs[1]).toBe(world.npcs[1]);
  });

  it('places Sleepers on a grid of levels and distances, with empty cells', () => {
    const world = { npcs: [npc(0, 1), npc(1, 1), npc(2, 4, { column: 7 }), npc(3, 6, { awake: true })], news: [] };
    const grid = mapGrid(world);
    expect(grid).toHaveLength(MAX_LUCIDITY);
    expect(grid[0][0].map((n) => n.id)).toEqual([0, 1]);
    expect(grid[3][7].map((n) => n.id)).toEqual([2]);
    expect(grid[5].every((cell) => cell.length === 0)).toBe(true); // the woken one is gone
  });

  it('distance costs days and far Sleepers show their deck', () => {
    expect(travelDays(npc(0, 1, { column: 0 }))).toBe(1);
    expect(travelDays(npc(0, 1, { column: 4 }))).toBe(2);
    expect(travelDays(npc(0, 1, { column: 7 }))).toBe(3);
    expect(revealsDeck(npc(0, 1, { column: 2 }))).toBe(false);
    expect(revealsDeck(npc(0, 1, { column: 3 }))).toBe(true);
  });

  it('reach is the player Lucidity plus or minus one', () => {
    expect(inReach(npc(0, 3), 2)).toBe(true);
    expect(inReach(npc(0, 4), 2)).toBe(false);
    expect(inReach(npc(0, 2, { awake: true }), 2)).toBe(false);
  });

  it('takes a stolen anchor from its owner', () => {
    const world = { npcs: [npc(0, 1, { anchors: ['anchor', 'deepAnchor'] })], news: [] };
    expect(takeAnchor(world, 0, 'anchor').npcs[0].anchors).toEqual(['deepAnchor']);
  });
});
