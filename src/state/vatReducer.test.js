import vatReducer from './vatReducer';
import {
  vatNewRunAction, vatConfirmSpawnAction, vatChooseSignalAction, vatRecordDuelAction,
  vatStealAction, vatContinueAction, vatMergeAction, vatConfirmLoadoutAction,
} from './actions';

// The id of a Lucidity-1 Sleeper on the map: always in reach of a new life.
const levelOne = (s) => s.world.npcs.find((n) => !n.awake && n.level === 1).id;

describe('vatReducer', () => {
  it('starts empty and ignores run actions before a run exists', () => {
    expect(vatReducer(undefined, { type: '@@INIT' })).toBeNull();
    expect(vatReducer(null, vatContinueAction())).toBeNull();
  });

  it('plays a spawn, a won duel, a steal and a merge', () => {
    let s = vatReducer(null, vatNewRunAction(9));
    expect(s.screen).toBe('spawn');
    s = vatReducer(s, vatConfirmSpawnAction([0, 1, 2], [0]));
    expect(s.screen).toBe('map');
    s = vatReducer(s, vatChooseSignalAction(levelOne(s)));
    s = vatReducer(s, vatRecordDuelAction({
      outcome: 'player',
      scores: { player: 9, opponent: 3 },
      supplied: { player: [], opponent: [{ type: 'water', tier: 2 }] },
    }));
    expect(s.screen).toBe('result');
    s = vatReducer(s, vatStealAction('fragment', 0));
    expect(s.fragments).toHaveLength(4);
    s = vatReducer(s, vatContinueAction());
    expect(s.screen).toBe('map');
    const withPair = { ...s, fragments: [{ type: 'air', tier: 1 }, { type: 'air', tier: 1 }] };
    expect(vatReducer(withPair, vatMergeAction('air', 1)).fragments).toEqual([{ type: 'air', tier: 2 }]);
  });

  it('confirms a loadout when the player owns more than they bring', () => {
    let s = vatReducer(null, vatNewRunAction(9));
    s = vatReducer(s, vatConfirmSpawnAction([0, 1, 2], [0]));
    s = { ...s, fragments: [...s.fragments, { type: 'air', tier: 1 }] };
    s = vatReducer(s, vatChooseSignalAction(levelOne(s)));
    expect(s.screen).toBe('loadout');
    s = vatReducer(s, vatConfirmLoadoutAction([1, 2, 3]));
    expect(s.screen).toBe('duel');
    expect(s.duelFragments).toHaveLength(3);
  });

  it('returns the same state for invalid actions', () => {
    const s = vatReducer(null, vatNewRunAction(9));
    expect(vatReducer(s, vatChooseSignalAction(0))).toBe(s);
  });
});
