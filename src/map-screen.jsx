import React from 'react';
import {
  MAX_LUCIDITY, CAMPAIGN_DAYS, WAKE_BOARD_TIER, WAKE_DUELS, MAP_COLS, TRAVEL_DAYS, WORLD_SIZE,
  BONUS_CARDS, handSlots,
} from './core/tuning';
import { mapGrid, inReach, travelDays, revealsDeck, awakeCount } from './core/world';
import { playerSurvival, shopStock } from './core/run';
import { TYPE_META, FragmentChip, BonusChip, AnchorChip, AffinityBadge, Collection } from './cards';
import { RulesBox, gridLabel } from './screens';

const ROW_STYLE = { gridTemplateColumns: `44px repeat(${MAP_COLS}, minmax(34px, 1fr))` };

function signalLabel(level, lucidity) {
  if (level < lucidity) return { text: 'Weaker: no Lucidity on a win', className: 'weak' };
  if (level > lucidity) return { text: 'Stronger: Lucidity on a win', className: 'strong' };
  return { text: 'Equal: Lucidity on a win', className: 'equal' };
}

// The map of Sleepers: rows are Lucidity (6 at the top), columns are distance.
// Props: run, onChoose(npcId), onMerge(type, tier), onWake(), onSetHand(ids), onBuy(id)
export default class MapScreen extends React.Component {
  constructor(props) {
    super(props);
    this.state = { selected: null }; // npc id
  }

  renderCell(cell, col) {
    const { run } = this.props;
    if (cell.length === 0) return <div key={col} className="vat-cell empty" />;
    return (
      <div key={col} className="vat-cell">
        {cell.map((n) => {
          const reachable = inReach(n, run.lucidity);
          const className = `vat-dot type-${n.mainType} tier-1`
            + (reachable ? ' reachable' : '') + (this.state.selected === n.id ? ' selected' : '');
          return (
            <button key={n.id} className={className} title={`${n.name}, L${n.level}`}
              onClick={() => this.setState({ selected: n.id })}>
              {TYPE_META[n.mainType].symbol}
            </button>
          );
        })}
      </div>
    );
  }

  renderGrid() {
    const { run } = this.props;
    const grid = mapGrid(run.world);
    const rows = [];
    for (let level = MAX_LUCIDITY; level >= 1; level -= 1) {
      const reach = Math.abs(level - run.lucidity) <= 1;
      rows.push(
        <div key={level} className={`vat-map-row ${reach ? 'in-reach' : ''}`} style={ROW_STYLE}>
          <div className="vat-map-level">
            L{level}{level === run.lucidity && <span className="vat-map-you">you</span>}
          </div>
          {grid[level - 1].map((cell, col) => this.renderCell(cell, col))}
        </div>
      );
    }
    return (
      <div className="vat-map">
        {rows}
        <div className="vat-map-row vat-map-foot" style={ROW_STYLE}>
          <div className="vat-map-level" />
          {Array.from({ length: MAP_COLS }, (_, col) => (
            <div key={col} className="vat-map-days">{TRAVEL_DAYS[col]}d</div>
          ))}
        </div>
      </div>
    );
  }

  renderSelected() {
    const { run, onChoose } = this.props;
    const n = run.world.npcs.find((x) => x.id === this.state.selected && !x.awake);
    if (!n) return <div className="vat-panel small vat-muted">Pick a Sleeper on the map to see their signal.</div>;
    const reachable = inReach(n, run.lucidity);
    const days = travelDays(n);
    const label = signalLabel(n.level, run.lucidity);
    return (
      <div className={`vat-panel vat-signal-detail type-${n.mainType} tier-1`}>
        <div className="d-flex justify-content-between flex-wrap">
          <h5 className="mb-1">{n.name} <span className="vat-signal-strength">L{n.level}</span></h5>
          <span>{days} day{days === 1 ? '' : 's'} away</span>
        </div>
        <div>
          {TYPE_META[n.mainType].symbol} {TYPE_META[n.mainType].label} noise
          <span className="small vat-muted"> | affinity </span><AffinityBadge affinity={n.affinity} />
        </div>
        {reachable && <div className={`vat-signal-note ${label.className}`}>{label.text}</div>}
        {revealsDeck(n) ? (
          <div className="mt-2">
            <div className="small vat-muted">Far signals are clear: you can see their whole deck.</div>
            <div className="vat-chips">
              {n.fragments.map((f, i) => <FragmentChip key={i} fragment={f} />)}
            </div>
            <div className="vat-chips mt-1">
              {n.hand.map((id) => <BonusChip key={id} id={id} />)}
              {n.anchors.map((id, i) => <AnchorChip key={`a${i}`} id={id} />)}
            </div>
          </div>
        ) : (
          <div className="small vat-muted mt-1">Too close to read clearly. Signals 2 or more days away show their deck.</div>
        )}
        {reachable ? (
          <button className="btn btn-sm btn-dark mt-2" onClick={() => onChoose(n.id)}>
            Travel and duel ({days} day{days === 1 ? '' : 's'})
          </button>
        ) : (
          <div className="small mt-2">Out of reach: you can duel Sleepers within 1 Lucidity of yours.</div>
        )}
      </div>
    );
  }

  renderShop() {
    const { run, onBuy } = this.props;
    const stock = shopStock(run);
    return (
      <div className="vat-panel">
        <h6>Shop: you have <strong>{run.points}</strong> points</h6>
        <div className="small vat-muted mb-2">Your duel scores add up to points. Dying loses them all.</div>
        <div className="vat-chips">
          {stock.length === 0 && <span className="vat-muted small">You own every bonus card.</span>}
          {stock.map((id) => (
            <BonusChip key={id} id={id} price={BONUS_CARDS[id].price}
              disabled={run.points < BONUS_CARDS[id].price} onClick={() => onBuy(id)} />
          ))}
        </div>
      </div>
    );
  }

  render() {
    const { run, onMerge, onWake, onSetHand } = this.props;
    const woke = run.world.news.filter((e) => e.kind === 'wake');
    return (
      <div>
        {run.day === 1 && run.life === 1 && (
          <div className="vat-panel vat-intro">
            The colonists sleep in vats, their minds joined in the network. They train their memory by
            duelling with fragments of its code. Remember enough and you wake, and can help build the
            colony outside. Reach <strong>Lucidity {MAX_LUCIDITY}</strong> and pass the Wake Attempt before
            day {CAMPAIGN_DAYS}. <strong>Your hold on a vat is weak: lose a duel and this body dies.</strong>
          </div>
        )}
        {woke.length > 0 && (
          <div className="vat-panel vat-news">
            {woke.map((e) => <div key={e.id}><strong>{e.name}</strong> woke and left the network.</div>)}
          </div>
        )}
        {run.lucidity >= MAX_LUCIDITY && (
          <div className="vat-panel vat-wake">
            <p className="mb-2">
              You are lucid enough to try to wake: {WAKE_DUELS} duels in a row on {gridLabel(WAKE_BOARD_TIER)} against
              the network's Wardens. You choose your fragments once. No steals, no merges in between. Lose one and you die.
            </p>
            <button className="btn btn-warning" onClick={onWake}>Attempt to wake</button>
          </div>
        )}
        <div className="d-flex justify-content-between flex-wrap align-items-baseline">
          <h6 className="vat-heading">The network</h6>
          <span className="small vat-muted">
            Colonists awake: {awakeCount(run.world)} / {WORLD_SIZE}. Bright rows are within reach.
          </span>
        </div>
        {this.renderGrid()}
        {this.renderSelected()}
        <Collection fragments={run.fragments} bonus={run.bonus} hand={run.hand} slots={handSlots(run.lucidity)}
          affinity={run.affinity} anchors={run.anchors} survival={playerSurvival(run)}
          onMerge={onMerge} onSetHand={onSetHand} />
        {this.renderShop()}
        <RulesBox />
      </div>
    );
  }
}
