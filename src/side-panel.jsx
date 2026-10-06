import React from 'react';
import { BONUS_CARDS } from './core/tuning';
import { lifeSummaries } from './core/run';
import { TYPE_META, pips } from './cards';

// Left-hand panel during a duel: the move log ("Game") and previous lives ("History").
// Props: log (newest first, see DuelScreen.addLog), run
export default class SidePanel extends React.Component {
  constructor(props) {
    super(props);
    this.state = { tab: 'game' };
  }

  renderTab(id, label) {
    return (
      <button className={`vat-tab ${this.state.tab === id ? 'active' : ''}`}
        onClick={() => this.setState({ tab: id })}>{label}</button>
    );
  }

  render() {
    return (
      <div className="vat-sidepanel">
        <div className="vat-tabs">
          {this.renderTab('game', 'Game')}
          {this.renderTab('history', 'History')}
        </div>
        <div className="vat-tab-body">
          {this.state.tab === 'game' ? <MoveLog log={this.props.log} /> : <LivesHistory run={this.props.run} />}
        </div>
      </div>
    );
  }
}

function MiniCard({ card }) {
  return (
    <span className={`vat-mini type-${card.type} tier-${card.tier}`} title={`${TYPE_META[card.type].label} tier ${card.tier}`}>
      {TYPE_META[card.type].symbol}<small>{pips(card.tier)}</small>
    </span>
  );
}

function MoveLog({ log }) {
  if (log.length === 0) return <div className="vat-muted small">No moves yet. You go first.</div>;
  return (
    <div className="vat-moves">
      {log.map((e) => {
        const who = <span className={`vat-who who-${e.side}`}>{e.side === 'player' ? 'You' : 'Them'}</span>;
        if (e.kind === 'bonus' && e.bonus === 'defrag') {
          return (
            <div key={e.id} className="vat-move defrag">
              {who} played <strong>Defrag</strong>
              <div className="small">Every unclaimed card moved. Forget what you remembered.</div>
            </div>
          );
        }
        if (e.kind === 'bonus') {
          return (
            <div key={e.id} className="vat-move bonus">
              {who} played <strong>{BONUS_CARDS[e.bonus].label}</strong>
              {e.bonus === 'ping' && e.side === 'opponent' && <span className="small vat-muted"> (peeked at 2 cards)</span>}
              {e.bonus === 'echo' && e.side === 'opponent' && <span className="small vat-muted"> (sensed their cards)</span>}
              {e.bonus === 'lock' && <span className="small vat-muted"> (a card is locked until their next turn)</span>}
            </div>
          );
        }
        if (e.kind === 'hold') {
          return (
            <div key={e.id} className="vat-move hold">
              {who} ended the turn
            </div>
          );
        }
        if (e.kind === 'clue') {
          return (
            <div key={e.id} className="vat-move clue">
              {who} got a clue from <MiniCard card={e.card} />
              {e.side === 'opponent' && <span className="small vat-muted"> (only they see it)</span>}
            </div>
          );
        }
        if (e.kind === 'match') {
          return (
            <div key={e.id} className="vat-move match">
              {who} <MiniCard card={e.cards[0]} /><MiniCard card={e.cards[1]} />
              <span className="vat-points">+{e.points}{e.doubled ? ' x2' : ''}</span>
              {e.resonance === 'bonus' && <span className="vat-res up"> {'▲'} resonant</span>}
              {e.resonance === 'penalty' && <span className="vat-res down"> {'▼'} dissonant</span>}
            </div>
          );
        }
        return (
          <div key={e.id} className="vat-move miss">
            {who} <MiniCard card={e.cards[0]} /><MiniCard card={e.cards[1]} />
            <span className="vat-muted"> miss</span>
            {e.penalty > 0 && <span className="vat-penalty"> -{e.penalty}</span>}
          </div>
        );
      })}
    </div>
  );
}

const OUTCOME_BADGE = { player: 'W', opponent: 'L', draw: 'D' };

function LivesHistory({ run }) {
  const lives = lifeSummaries(run.history);
  if (lives.length === 0) return <div className="vat-muted small">This is your first life. No history yet.</div>;
  return (
    <div className="vat-lives">
      {lives.map((l) => {
        const current = l.life === run.life && l.fate === 'alive';
        let fate = current ? 'current life' : 'alive';
        if (l.fate === 'died') fate = `died on day ${l.endDay}`;
        if (l.fate === 'woke') fate = `woke on day ${l.endDay}`;
        return (
          <div key={l.life} className={`vat-life fate-${l.fate}`}>
            <div className="vat-life-head">
              <strong>Life #{l.life}</strong>
              <span className="small">{fate}</span>
            </div>
            <div className="small">Peak Lucidity {l.peakLucidity} | {l.wins}/{l.duels.length} won</div>
            <div className="vat-badges">
              {l.duels.map((d, i) => (
                <span key={i} className={`vat-badge out-${d.outcome}`}
                  title={`Day ${d.day} vs ${d.opponentName || ''} L${d.opponentLevel}${d.wake ? ` (wake ${d.wake})` : ''}`
                    + (d.scores ? `: ${d.scores.player}-${d.scores.opponent}` : '')
                    + (d.survived ? ' (an anchor held)' : '')}>
                  {OUTCOME_BADGE[d.outcome]}
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
