import {
  newRun, confirmSpawn, chooseSignal, confirmLoadout, loadoutSize, recordDuel, steal, continueRun,
  mergeInRun, startWake, canAttemptWake, boardTierFor, collectionSummary, lifeSummaries, playerSurvival,
  setHand, shopStock, buyBonus,
} from './run';
import { generateSleeper } from './sleepers';
import { createRng } from './rng';
import {
  CAMPAIGN_DAYS, WAKE_DUELS, WAKE_BOARD_TIER, WORLD_SIZE, PLAYER_SURVIVAL_CAP, BONUS_CARDS, handSlots,
} from './tuning';

// An NPC with a fixed deck: 3 fragments, so a 4x3 board needs no loadout choice.
const npc = (id, level, extra = {}) => ({
  ...generateSleeper(level, createRng(id + 1), { fragmentCount: 3, bonusCount: 1 }),
  id, name: `N-${id}`, column: 0, awake: false, anchors: [], ...extra,
});
// A run on the map with a controlled world.
const onMap = (npcs = [npc(0, 1), npc(1, 2), npc(2, 3)], extra = {}) => ({
  ...confirmSpawn(newRun(1), [0, 1, 2], [0]), anchors: [], world: { npcs, news: [] }, ...extra,
});
const duelResult = (outcome, supplied = [{ type: 'fire', tier: 2 }]) => ({
  outcome, scores: { player: 5, opponent: 3 }, supplied: { player: [], opponent: supplied },
});

describe('run', () => {
  it('starts on day 1 with a colony and a vat to wake in', () => {
    const run = newRun(1);
    expect(run.day).toBe(1);
    expect(run.screen).toBe('spawn');
    expect(run.world.npcs).toHaveLength(WORLD_SIZE);
    expect(run.spawnOffer.fragments.length).toBeGreaterThanOrEqual(3);
  });

  it('spawn keeps exactly the picks at tier 1, plus any anchor in the vat, and opens the map', () => {
    let run = newRun(1);
    run = { ...run, spawnOffer: { ...run.spawnOffer, anchors: ['anchor'] } };
    run = confirmSpawn(run, [0, 1, 2], [0]);
    expect(run.fragments).toHaveLength(3);
    expect(run.fragments.every((f) => f.tier === 1)).toBe(true);
    expect(run.hand).toHaveLength(1);
    expect(run.anchors).toEqual(['anchor']);
    expect(run.screen).toBe('map');
  });

  it('rejects the wrong number of picks', () => {
    const run = newRun(1);
    expect(confirmSpawn(run, [0, 1], [0])).toBe(run);
    expect(confirmSpawn(run, [0, 0, 1], [0])).toBe(run);
    expect(confirmSpawn(run, [0, 1, 2], [])).toBe(run);
  });

  it('only Sleepers within reach can be chosen', () => {
    const run = onMap();
    expect(chooseSignal(run, 2)).toBe(run); // L3 is out of reach at Lucidity 1
    expect(chooseSignal(run, 99)).toBe(run);
    expect(chooseSignal(run, 1).screen).toBe('duel');
  });

  it('a duel costs the travel days and the world moves on that many days', () => {
    const far = npc(0, 1, { column: 7 });
    let run = chooseSignal(onMap([far, npc(1, 1)]), 0);
    expect(run.travelDays).toBe(3);
    run = recordDuel(run, duelResult('draw'));
    expect(run.day).toBe(4);
  });

  it('a win against an equal or higher level raises Lucidity and offers a steal', () => {
    let run = chooseSignal(onMap(), 0); // the level-1 Sleeper
    run = recordDuel(run, duelResult('player'));
    expect(run.day).toBe(2);
    expect(run.lucidity).toBe(2);
    expect(run.result.stealable.fragments).toEqual([{ type: 'fire', tier: 1 }]);
    run = steal(run, 'fragment', 0);
    expect(run.fragments).toHaveLength(4);
    expect(steal(run, 'fragment', 0)).toBe(run); // only once
    run = continueRun(run);
    expect(run.screen).toBe('map');
  });

  it('a win against a weaker Sleeper gives no Lucidity', () => {
    let run = onMap(undefined, { lucidity: 2 });
    run = recordDuel(chooseSignal(run, 0), duelResult('player'));
    expect(run.lucidity).toBe(2);
    expect(run.result.stealable.fragments.length).toBe(1);
  });

  it('a stolen bonus card goes to the hand, or to storage when the hand is full', () => {
    let run = chooseSignal(onMap([npc(0, 1, { hand: ['doubleDown'] })]), 0);
    run = { ...run, bonus: ['ping', 'defrag'], hand: ['ping', 'defrag'], lucidity: 2 };
    run = recordDuel(run, duelResult('player'));
    expect(handSlots(run.lucidity)).toBe(2);
    run = steal(run, 'bonus', 0);
    expect(run.bonus).toEqual(['ping', 'defrag', 'doubleDown']);
    expect(run.hand).toEqual(['ping', 'defrag']); // full: it waits in storage
  });

  it('offers only bonus cards you do not own yet', () => {
    let run = chooseSignal(onMap([npc(0, 1, { hand: ['ping', 'lock'] })]), 0);
    run = recordDuel({ ...run, bonus: ['ping'], hand: [] }, duelResult('player'));
    expect(run.result.stealable.bonus).toEqual(['lock']);
  });

  it('adds the duel score to the points total, unless you die', () => {
    let run = onMap(undefined, { points: 15 });
    run = recordDuel(chooseSignal(run, 0), duelResult('player'));
    expect(run.result.pointsEarned).toBe(5);
    expect(run.points).toBe(20);
    run = recordDuel(chooseSignal(continueRun(run), 0), duelResult('draw'));
    expect(run.points).toBe(25);
    run = recordDuel(chooseSignal(continueRun(run), 0), duelResult('opponent'));
    expect(run.result.pointsEarned).toBe(0);
    expect(continueRun(run).points).toBe(0); // a new life starts with nothing
  });

  it('the hand is chosen from owned cards, up to the slots; the rest is storage', () => {
    const run = onMap(undefined, { bonus: ['ping', 'echo', 'lock'], hand: ['ping'] });
    expect(setHand(run, ['echo', 'lock']).hand).toEqual(['echo', 'lock']);
    expect(setHand(run, ['ping', 'echo', 'lock'])).toBe(run); // 2 slots at Lucidity 1
    expect(setHand(run, ['defrag'])).toBe(run); // not owned
    expect(setHand(run, ['ping', 'ping'])).toBe(run);
    expect(setHand(run, []).hand).toEqual([]);
  });

  it('the shop sells cards you do not own, for points', () => {
    const run = onMap(undefined, { points: 30, bonus: ['ping'], hand: ['ping'] });
    expect(shopStock(run)).not.toContain('ping');
    const bought = buyBonus(run, 'echo');
    expect(bought.points).toBe(30 - BONUS_CARDS.echo.price);
    expect(bought.bonus).toEqual(['ping', 'echo']);
    expect(bought.hand).toEqual(['ping', 'echo']);
    expect(buyBonus(run, 'ping')).toBe(run); // already owned
    expect(buyBonus(run, 'defrag')).toBe(run); // too expensive
  });

  it('the vat you spawn in sets your affinity', () => {
    let run = newRun(3);
    run = confirmSpawn(run, [0, 1, 2], [0]);
    expect(run.affinity).toHaveLength(2);
    expect(run.affinity).toEqual(newRun(3).spawnOffer.affinity);
    expect(run.bonus).toEqual(run.hand);
  });

  it('stealing an anchor takes no slot and takes it from the Sleeper', () => {
    let run = chooseSignal(onMap([npc(0, 1, { anchors: ['deepAnchor'] })]), 0);
    run = recordDuel(run, duelResult('player'));
    expect(run.result.stealable.anchors).toEqual(['deepAnchor']);
    run = steal(run, 'anchor', 0);
    expect(run.anchors).toEqual(['deepAnchor']);
    expect(run.world.npcs.find((n) => n.id === 0).anchors).toEqual([]);
    expect(playerSurvival(run)).toBeCloseTo(0.1);
  });

  it('player survival from anchors is capped', () => {
    expect(playerSurvival({ anchors: [] })).toBe(0);
    expect(playerSurvival({ anchors: ['deepAnchor', 'deepAnchor', 'deepAnchor', 'deepAnchor'] }))
      .toBe(PLAYER_SURVIVAL_CAP);
  });

  it('a loss without anchors is death: respawn costs a day and resets the life', () => {
    let run = { ...chooseSignal(onMap(), 1), lucidity: 2 };
    run = recordDuel(run, duelResult('opponent'));
    expect(run.result.died).toBe(true);
    expect(steal(run, 'fragment', 0)).toBe(run);
    run = continueRun(run);
    expect(run.screen).toBe('spawn');
    expect(run.day).toBe(3);
    expect(run.life).toBe(2);
    expect(run.lucidity).toBe(1);
    expect(run.fragments).toEqual([]);
  });

  it('anchors can save you from a lost duel', () => {
    const outcomes = new Set();
    for (let seed = 1; seed < 60; seed += 1) {
      const run = { ...chooseSignal(onMap(), 1), anchors: ['deepAnchor', 'deepAnchor', 'deepAnchor'], seed };
      const after = recordDuel(run, duelResult('opponent'));
      outcomes.add(after.result.survived ? 'survived' : 'died');
      if (after.result.survived) {
        expect(after.result.died).toBe(false);
        expect(continueRun(after).screen).toBe('map');
        expect(continueRun(after).lucidity).toBe(1);
      }
    }
    expect([...outcomes].sort()).toEqual(['died', 'survived']);
  });

  it('losing to a Sleeper of your level lets it climb', () => {
    let run = chooseSignal(onMap([npc(0, 1), npc(1, 1)]), 0);
    run = recordDuel({ ...run, travelDays: 0 }, duelResult('opponent'));
    expect(run.world.npcs.find((n) => n.id === 0).level).toBe(2);
  });

  it('a draw gives nothing and is not death', () => {
    const run = recordDuel(chooseSignal(onMap(), 1), duelResult('draw'));
    expect(run.result.died).toBe(false);
    expect(run.lucidity).toBe(1);
    expect(continueRun(run).screen).toBe('map');
  });

  it('merges between duels', () => {
    let run = onMap(undefined, { fragments: [{ type: 'air', tier: 1 }, { type: 'air', tier: 1 }] });
    run = mergeInRun(run, 'air', 1);
    expect(run.fragments).toEqual([{ type: 'air', tier: 2 }]);
    expect(collectionSummary(run.fragments)).toEqual([{ type: 'air', tier: 2, count: 1 }]);
  });

  it('times out after the last day', () => {
    const run = { ...chooseSignal(onMap(), 1), day: CAMPAIGN_DAYS };
    const ended = recordDuel(run, duelResult('player'));
    expect(ended.screen).toBe('end');
    expect(ended.ending).toBe('timeout');
  });

  it('board tier follows Lucidity in steps of two', () => {
    expect([1, 2, 3, 4, 5, 6].map((lucidity) => boardTierFor({ lucidity, wakeStage: null })))
      .toEqual([1, 1, 2, 2, 3, 3]);
  });

  it('goes straight to the duel with all fragments when there is no choice to make', () => {
    const run = chooseSignal(onMap(), 1);
    expect(loadoutSize(run)).toBe(3);
    expect(run.screen).toBe('duel');
    expect(run.duelFragments).toEqual(run.fragments);
  });

  it('asks for a loadout when the player owns more than they bring', () => {
    const five = [
      { type: 'air', tier: 1 }, { type: 'fire', tier: 2 }, { type: 'water', tier: 1 },
      { type: 'electric', tier: 1 }, { type: 'fire', tier: 1 },
    ];
    let run = chooseSignal(onMap(undefined, { fragments: five }), 1);
    expect(run.screen).toBe('loadout');
    expect(loadoutSize(run)).toBe(3);
    expect(confirmLoadout(run, [0, 1])).toBe(run); // too few
    expect(confirmLoadout(run, [0, 0, 1])).toBe(run); // duplicates
    run = confirmLoadout(run, [0, 2, 4]);
    expect(run.screen).toBe('duel');
    expect(run.duelFragments).toEqual([five[0], five[2], five[4]]);
    expect(run.lastLoadout).toEqual(run.duelFragments);
    expect(run.fragments).toHaveLength(5); // the collection is untouched
  });

  it('wake: open at Lucidity 6, against Wardens on the wake board, all stages won wakes you', () => {
    let run = onMap();
    expect(canAttemptWake(run)).toBe(false);
    run = startWake({ ...run, lucidity: 6 });
    expect(run.wakeStage).toBe(1);
    expect(run.opponent.name).toMatch(/^Warden-/);
    expect(boardTierFor(run)).toBe(WAKE_BOARD_TIER);
    for (let stage = 1; stage < WAKE_DUELS; stage += 1) {
      run = recordDuel(run, duelResult('player'));
      expect(run.result.stealable.fragments).toEqual([]);
      run = continueRun(run);
      expect(run.screen).toBe('duel');
      expect(run.wakeStage).toBe(stage + 1);
    }
    run = recordDuel(run, duelResult('player'));
    expect(run.screen).toBe('end');
    expect(run.ending).toBe('awake');
  });

  it('wake: the loadout is chosen once and kept between stages', () => {
    const seven = Array.from({ length: 7 }, (_, i) => ({ type: 'air', tier: 1 + (i % 2) }));
    let run = startWake(onMap(undefined, { lucidity: 6, fragments: seven }));
    expect(run.screen).toBe('loadout');
    expect(loadoutSize(run)).toBe(6);
    run = confirmLoadout(run, [0, 1, 2, 3, 4, 5]);
    const brought = run.duelFragments;
    run = continueRun(recordDuel(run, duelResult('player')));
    expect(run.screen).toBe('duel');
    expect(run.duelFragments).toBe(brought);
  });

  it('wake: losing a stage is death', () => {
    let run = startWake(onMap(undefined, { lucidity: 6 }));
    run = continueRun(recordDuel(run, duelResult('opponent')));
    expect(run.screen).toBe('spawn');
    expect(run.wakeStage).toBeNull();
  });

  it('summarises each life: peak Lucidity, wins and how it ended', () => {
    let run = recordDuel(chooseSignal(onMap([npc(0, 1), npc(1, 1), npc(2, 2)]), 0), duelResult('player'));
    run = continueRun(run); // L2 now
    run = continueRun(recordDuel(chooseSignal(run, 2), duelResult('opponent'))); // dies
    run = confirmSpawn(run, [0, 1, 2], [0]);
    const target = run.world.npcs.find((n) => n.level <= 2 && !n.awake);
    run = recordDuel(chooseSignal(run, target.id), duelResult('draw'));
    const lives = lifeSummaries(run.history);
    expect(lives.map((l) => l.life)).toEqual([2, 1]);
    expect(lives[1]).toMatchObject({ wins: 1, peakLucidity: 2, fate: 'died', endDay: 2 });
    expect(lives[1].duels).toHaveLength(2);
    expect(lives[0]).toMatchObject({ wins: 0, peakLucidity: 1, fate: 'alive', endDay: null });
  });
});
