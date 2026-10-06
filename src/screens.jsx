import React from 'react';
import {
  SPAWN_PICK_FRAGMENTS, SPAWN_PICK_BONUS, MAX_LUCIDITY, CAMPAIGN_DAYS, WORLD_SIZE, handSlots,
} from './core/tuning';
import { gridFor } from './core/board';
import { boardTierFor, loadoutSize, playerSurvival } from './core/run';
import { awakeCount } from './core/world';
import { TYPE_META, FragmentChip, BonusChip, AnchorChip, AffinityBadge, Collection } from './cards';

// --- Spawn -------------------------------------------------------------------
// Props: run, onConfirm(fragmentIndexes, bonusIndexes)
export class SpawnScreen extends React.Component {
  constructor(props) {
    super(props);
    this.state = { fragments: [], bonus: [] };
  }

  toggle(key, index, max) {
    this.setState((s) => {
      const list = s[key];
      if (list.includes(index)) return { [key]: list.filter((i) => i !== index) };
      if (list.length >= max) return max === 1 ? { [key]: [index] } : null;
      return { [key]: [...list, index] };
    });
  }

  render() {
    const { run, onConfirm } = this.props;
    const offer = run.spawnOffer;
    const ready = this.state.fragments.length === SPAWN_PICK_FRAGMENTS
      && this.state.bonus.length === SPAWN_PICK_BONUS;
    return (
      <div className="vat-panel">
        {run.life === 1 ? (
          <p>
            Your mind comes online late, after the other colonists. The only free vat left belonged
            to <strong>{offer.name}</strong>, and their fragments are still in it. You slip inside.
          </p>
        ) : (
          <p>
            Your last body is gone. Your mind drifts through the network to a spare vat that
            once held <strong>{offer.name}</strong>. You take what you can carry.
          </p>
        )}
        <div className="small mb-2">This vat's affinity: <AffinityBadge affinity={offer.affinity} /> (it stays with you for this life)</div>
        <h6>Keep {SPAWN_PICK_FRAGMENTS} fragments (they arrive at tier 1)</h6>
        <div className="vat-chips">
          {offer.fragments.map((f, i) => (
            <FragmentChip key={i} fragment={{ type: f.type, tier: 1 }}
              selected={this.state.fragments.includes(i)}
              onClick={() => this.toggle('fragments', i, SPAWN_PICK_FRAGMENTS)} />
          ))}
        </div>
        <div className="small vat-muted mb-3">Two of the same type can later merge into tier 2.</div>
        <h6>Keep {SPAWN_PICK_BONUS} bonus card</h6>
        <div className="vat-chips">
          {offer.hand.map((id, i) => (
            <BonusChip key={id} id={id} selected={this.state.bonus.includes(i)}
              onClick={() => this.toggle('bonus', i, SPAWN_PICK_BONUS)} />
          ))}
        </div>
        {offer.anchors.length > 0 && (
          <>
            <h6 className="mt-3">Left in the vat (yours, no slot needed)</h6>
            <div className="vat-chips">
              {offer.anchors.map((id, i) => <AnchorChip key={i} id={id} />)}
            </div>
          </>
        )}
        <button className="btn btn-info mt-3" disabled={!ready}
          onClick={() => onConfirm(this.state.fragments, this.state.bonus)}>
          Wake up inside {offer.name}
        </button>
      </div>
    );
  }
}

// --- Shared --------------------------------------------------------------------
export function RulesBox() {
  return (
    <details className="vat-panel vat-rules">
      <summary>How to play</summary>
      <ul className="small mb-0">
        <li>Both sides put their fragments face down on one table. Anyone can claim any pair.</li>
        <li>Same type <em>and</em> same tier match, whoever brought them.</li>
        <li>Each card in a pair scores separately: your own card 2 x tier, their card 1 x tier.</li>
        <li>Match: keep your turn, or press <em>End turn</em> to stop there. Miss: the turn passes. Higher score when the table is clear wins.</li>
        <li>
          Resonance: the type of your last claimed pair. Claiming the next type in the cycle
          {' '}<span role="img" aria-label="water, fire, air, electric, water">{'💧 → 🔥 → 🌀 → ⚡ → 💧'}</span>{' '}
          scores a bonus, the type before it a penalty.
        </li>
        <li>Flipping <em>your own</em> card as the first flip of a turn flashes a clue around its pair. Higher tier = tighter clue. Only you see it, and their cards give you nothing.</li>
        <li>Echo makes your own face-down cards shake for a moment, so you know which one to open first.</li>
        <li>Bonus cards: one per turn, before a flip. Each has its own cooldown and recharges its own way (a type of pair, your own pairs, or turns). Claiming a pair of your affinity types recharges all of them.</li>
        <li>Lock: pick a face-down card; nobody can flip it until your next turn.</li>
        <li>Your duel scores add up to points, which buy bonus cards in the shop on the map. Cards beyond your hand slots wait in storage. Dying loses everything, points included.</li>
        <li>Win: take one of their cards (tier 1). Beat an equal or stronger Sleeper: +1 Lucidity. The board grows every 2 Lucidity (4x3, 4x4, 5x4).</li>
        <li>Own more fragments than the board needs? Choose which ones to bring before the duel.</li>
        <li>Lose: this body dies and you start over at Lucidity 1 with nothing, unless an anchor holds. Anchors are rare, take no slot and each adds 5% or 10% to survive.</li>
        <li>The map: rows are Lucidity, columns are distance. You can duel within 1 Lucidity of yours. Far Sleepers cost more days but show their whole deck.</li>
        <li>The other colonists duel each other every day too. Winners climb, some losers start over, and a few at Lucidity 6 wake and leave for good.</li>
      </ul>
    </details>
  );
}

export function gridLabel(boardTier) {
  const { cols, rows } = gridFor(boardTier);
  return `${cols}x${rows}`;
}

// --- Loadout -----------------------------------------------------------------
// Default picks: the last loadout where the collection still has those cards,
// then the best remaining fragments, up to `size`.
function defaultLoadout(fragments, lastLoadout, size) {
  const picked = [];
  lastLoadout.forEach((f) => {
    const i = fragments.findIndex((g, j) => !picked.includes(j) && g.type === f.type && g.tier === f.tier);
    if (i >= 0 && picked.length < size) picked.push(i);
  });
  const rest = fragments.map((f, i) => i).filter((i) => !picked.includes(i))
    .sort((a, b) => fragments[b].tier - fragments[a].tier || a - b);
  return [...picked, ...rest].slice(0, size);
}

// Props: run, onConfirm(fragmentIndexes)
export class LoadoutScreen extends React.Component {
  constructor(props) {
    super(props);
    const { run } = props;
    this.state = { picked: defaultLoadout(run.fragments, run.lastLoadout, loadoutSize(run)) };
  }

  toggle(index, size) {
    this.setState((s) => {
      if (s.picked.includes(index)) return { picked: s.picked.filter((i) => i !== index) };
      return s.picked.length < size ? { picked: [...s.picked, index] } : null;
    });
  }

  render() {
    const { run, onConfirm } = this.props;
    const size = loadoutSize(run);
    const { picked } = this.state;
    const o = run.opponent;
    return (
      <div className="vat-panel">
        <h5>
          vs {o.name} (L{o.level}, {TYPE_META[o.mainType].symbol} {TYPE_META[o.mainType].label} noise)
          {run.wakeStage ? ' (Wake Attempt)' : ''}
        </h5>
        <p className="mb-2">
          The table is {gridLabel(boardTierFor(run))}. Choose <strong>{size}</strong> fragments to bring.
          Each one puts a pair on the table, and only your own cards give you clues.
          {run.wakeStage ? ' These fragments stay with you for every wake duel.' : ''}
        </p>
        <div className={`vat-loadout-count mb-2 ${picked.length === size ? 'ready' : ''}`}>
          {picked.length} / {size} chosen
        </div>
        <div className="vat-chips">
          {run.fragments.map((f, i) => (
            <FragmentChip key={i} fragment={f} selected={picked.includes(i)}
              onClick={() => this.toggle(i, size)} />
          ))}
        </div>
        <button className="btn btn-info mt-3" disabled={picked.length !== size}
          onClick={() => onConfirm(picked)}>
          Enter the duel
        </button>
      </div>
    );
  }
}

// --- Result ------------------------------------------------------------------
// Props: run, onSteal(kind, index), onContinue(), onMerge(type, tier)
export class ResultScreen extends React.Component {
  render() {
    const { run, onSteal, onContinue, onMerge } = this.props;
    const r = run.result;
    const handFull = run.hand.length >= handSlots(run.lucidity);
    const won = r.outcome === 'player';
    const s = r.stealable;
    const canSteal = won && !r.stolen && (s.fragments.length > 0 || s.bonus.length > 0 || s.anchors.length > 0);
    let title = 'Draw. Nothing gained, the days are spent.';
    if (won) title = r.wakeStage ? `Wake stage ${r.wakeStage} cleared.` : 'You win.';
    if (r.died) title = 'You lose. This body dies.';
    if (r.survived) title = 'You lose, but your anchor holds. This body survives.';
    return (
      <div>
        <div className={`vat-panel vat-result ${won ? 'won' : r.died ? 'died' : ''}`}>
          <h4>{title}</h4>
          <div>You {r.scores.player} - {r.scores.opponent} {r.opponent.name}</div>
          {r.lucidityGained > 0 && <div className="mt-1"><strong>Lucidity +1</strong> (now {run.lucidity})</div>}
          {won && !r.wakeStage && r.lucidityGained === 0 && run.lucidity < MAX_LUCIDITY && (
            <div className="mt-1 vat-muted">A weaker mind teaches you nothing new.</div>
          )}
          {r.died && <div className="mt-1">You keep nothing. Respawning costs another day.</div>}
          {r.survived && r.wakeStage && <div className="mt-1">The Wake Attempt is over. You return to the network.</div>}
          {!r.died && (
            <div className="mt-1">+{r.pointsEarned} points (you now have <strong>{run.points}</strong>)</div>
          )}
        </div>

        {canSteal && (
          <div className="vat-panel">
            <h6>Take one card they brought (it arrives at tier 1)</h6>
            <div className="vat-chips">
              {r.stealable.fragments.map((f, i) => (
                <FragmentChip key={f.type} fragment={f} onClick={() => onSteal('fragment', i)} />
              ))}
              {r.stealable.bonus.map((id, i) => (
                <BonusChip key={id} id={id} onClick={() => onSteal('bonus', i)}
                  extra={<div className="vat-bonus-move">{handFull ? 'goes to storage' : 'goes to your hand'}</div>} />
              ))}
              {r.stealable.anchors.map((id, i) => (
                <AnchorChip key={`a${i}`} id={id} onClick={() => onSteal('anchor', i)} />
              ))}
            </div>
          </div>
        )}
        {won && r.stolen && <div className="vat-panel small">Taken.</div>}

        <button className="btn btn-info mb-3" onClick={onContinue}>
          {r.died ? 'Drift to a new body' : r.wakeStage && !r.survived ? 'Next wake duel' : 'Back to the map'}
        </button>
        {!r.died && !r.wakeStage && (
          <Collection fragments={run.fragments} bonus={run.bonus} hand={run.hand} slots={handSlots(run.lucidity)}
            affinity={run.affinity} anchors={run.anchors} survival={playerSurvival(run)} onMerge={onMerge} />
        )}
      </div>
    );
  }
}

// --- End ---------------------------------------------------------------------
// Props: run, onNewGame()
export function EndScreen({ run, onNewGame }) {
  const wins = run.history.filter((h) => h.outcome === 'player').length;
  return (
    <div className={`vat-panel vat-result ${run.ending === 'awake' ? 'won' : 'died'}`}>
      {run.ending === 'awake' ? (
        <>
          <h3>You wake.</h3>
          <p>
            Fluid drains from the vat. For the first time in years you feel your own weight, and the
            weight of a new world outside. The colony needs every hand.
          </p>
        </>
      ) : (
        <>
          <h3>Day {CAMPAIGN_DAYS} passes.</h3>
          <p>The network closes around you. You never woke.</p>
        </>
      )}
      <p className="small">
        Days used: {Math.min(run.day - 1, CAMPAIGN_DAYS)} | Lives: {run.life} | Duels won: {wins} of {run.history.length}
        {' '}| Other colonists awake: {awakeCount(run.world)} of {WORLD_SIZE}
      </p>
      <button className="btn btn-info" onClick={onNewGame}>New game</button>
    </div>
  );
}
