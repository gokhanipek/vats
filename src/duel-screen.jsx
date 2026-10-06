import React from 'react';
import {
  createDuel, flip, resolve, canFlip, playBonus, canPlayBonus, duelOutcome, hold, canHold, lockTargets,
} from './core/duel';
import { chooseAction, observe } from './core/ai';
import { boardTierFor } from './core/run';
import { createRng } from './core/rng';
import { REVEAL_MS, AI_FLIP_MS, BONUS_CARDS } from './core/tuning';
import { TYPE_META, pips, BonusChip, ResonanceBadge, AffinityBadge, cooldownText } from './cards';
import SidePanel from './side-panel';

const END_PAUSE_MS = 1500;     // let the final board sit before the result screen
const SHUFFLE_FLASH_MS = 1200; // how long the Defrag banner and board shake show
const REVEAL_KEY = 'vat.revealAll'; // testing toggle, remembered per browser

function loadRevealAll() {
  try {
    return window.localStorage.getItem(REVEAL_KEY) === '1';
  } catch (e) {
    return false;
  }
}

// Runs one duel. Duel state lives here (timers); the result goes to Redux via onDone.
// Props: run, onDone({ outcome, scores, supplied })
export default class DuelScreen extends React.Component {
  constructor(props) {
    super(props);
    const { run } = props;
    this.rng = createRng(run.duelSeed);
    this.memoryCap = run.opponent.memory;
    const duel = createDuel(
      { level: run.lucidity, fragments: run.duelFragments, hand: run.hand, affinity: run.affinity },
      run.opponent,
      boardTierFor(run),
      this.rng
    );
    this.state = {
      duel, memory: [], hint: null, peek: null, echo: null, log: [], finished: false, shuffling: false,
      targeting: false, // choosing a card to Lock
      revealAll: loadRevealAll(),
    };
    this.toggleRevealAll = this.toggleRevealAll.bind(this);
    this.timers = [];
    this.handleClick = this.handleClick.bind(this);
  }

  toggleRevealAll() {
    const revealAll = !this.state.revealAll;
    try { window.localStorage.setItem(REVEAL_KEY, revealAll ? '1' : '0'); } catch (e) { /* storage blocked */ }
    this.setState({ revealAll });
  }

  componentWillUnmount() {
    this.timers.forEach((t) => clearTimeout(t));
  }

  schedule(fn, ms) {
    this.timers.push(setTimeout(fn, ms));
  }

  // Log entries (newest first):
  // { id, side, kind: 'match'|'miss'|'bonus'|'clue'|'hold', cards?, points?, doubled?, resonance?, penalty?, bonus?, card? }
  addLog(entry) {
    this.logId = (this.logId || 0) + 1;
    const withId = { ...entry, id: this.logId };
    this.setState((s) => ({ log: [withId, ...s.log] }));
  }

  // Show the player's own hint for its duration. Never blocks input.
  // The opponent's hints are private to it: the log only notes that it got one.
  showHint(hint) {
    if (!hint) return;
    this.addLog({ side: hint.side, kind: 'clue', card: { type: hint.type, tier: hint.tier } });
    if (hint.side !== 'player') return;
    const key = Math.random();
    this.setState({ hint: { ...hint, key } });
    this.schedule(() => {
      if (this.state.hint && this.state.hint.key === key) this.setState({ hint: null });
    }, hint.ms);
  }

  // After any change: let the AI act when it is its turn.
  afterChange(duel) {
    if (duel.phase === 'ended') {
      this.setState({ finished: true });
      this.schedule(() => this.props.onDone({
        outcome: duelOutcome(duel), scores: duel.scores, supplied: duel.supplied,
      }), END_PAUSE_MS);
    } else if (duel.active === 'opponent') {
      this.schedule(() => this.aiStep(), AI_FLIP_MS);
    }
  }

  applyFlip(pos) {
    const duel = flip(this.state.duel, pos, this.rng);
    const memory = observe(this.state.memory, duel, this.memoryCap);
    this.setState({ duel, memory });
    this.showHint(duel.lastHint);
    if (duel.phase === 'resolving') {
      this.schedule(() => this.resolveNow(), REVEAL_MS);
    } else if (duel.active === 'opponent') {
      this.schedule(() => this.aiStep(), AI_FLIP_MS);
    }
  }

  resolveNow() {
    const before = this.state.duel;
    const duel = resolve(before);
    const memory = observe(this.state.memory, duel, this.memoryCap);
    this.setState({ duel, memory });
    this.logEvent(before, duel.lastEvent);
    this.afterChange(duel);
  }

  applyHold(side) {
    const duel = hold(this.state.duel);
    if (duel === this.state.duel) return;
    this.setState({ duel });
    this.addLog({ side, kind: 'hold' });
    this.afterChange(duel);
  }

  logEvent(before, event) {
    if (!event) return;
    // The flipped cards are still in `before` (resolve flips them back or claims them).
    const cards = before.flipped.map((pos) => before.cards[pos]);
    if (event.kind === 'match') {
      this.addLog({
        side: event.side, kind: 'match', cards, points: event.points, doubled: event.doubled, resonance: event.resonance,
      });
    } else if (event.kind === 'miss') {
      this.addLog({ side: event.side, kind: 'miss', cards, penalty: event.penalty });
    }
  }

  playBonusFor(side, id, target) {
    const duel = playBonus(this.state.duel, side, id, this.rng, target);
    if (duel === this.state.duel) return;
    let memory = this.state.memory;
    let { hint, peek } = this.state;
    if (id === 'defrag') {
      memory = [];
      hint = null;
      peek = null;
      this.setState({ echo: null });
      // Make the reshuffle impossible to miss on the board itself.
      this.setState({ shuffling: true });
      this.schedule(() => this.setState({ shuffling: false }), SHUFFLE_FLASH_MS);
    }
    if (id === 'ping' && duel.lastPeek) {
      if (side === 'player') {
        peek = { positions: duel.lastPeek.positions };
        this.schedule(() => this.setState({ peek: null }), BONUS_CARDS.ping.ms);
      } else {
        memory = observe(memory, duel, this.memoryCap, duel.lastPeek.positions);
      }
    }
    if (id === 'echo' && side === 'player' && duel.lastEcho) {
      const key = Math.random();
      this.setState({ echo: { positions: duel.lastEcho.positions, key } });
      this.schedule(() => {
        if (this.state.echo && this.state.echo.key === key) this.setState({ echo: null });
      }, BONUS_CARDS.echo.ms);
    }
    this.setState({ duel, memory, hint, peek, targeting: false });
    this.addLog({ side, kind: 'bonus', bonus: id });
    if (side === 'opponent') this.schedule(() => this.aiStep(), AI_FLIP_MS);
  }

  aiStep() {
    const { duel, memory } = this.state;
    if (duel.active !== 'opponent') return;
    if (duel.phase !== 'awaitingFirst' && duel.phase !== 'awaitingSecond') return;
    const action = chooseAction(duel, memory, this.rng);
    if (!action) return;
    if (action.type === 'bonus') this.playBonusFor('opponent', action.id, action.target);
    else if (action.type === 'hold') this.applyHold('opponent');
    else this.applyFlip(action.pos);
  }

  clickBonus(id) {
    if (id === 'lock') {
      if (canPlayBonus(this.state.duel, 'player', 'lock')) this.setState((s) => ({ targeting: !s.targeting }));
      return;
    }
    this.playBonusFor('player', id);
  }

  handleClick(pos) {
    const { duel, finished, targeting } = this.state;
    if (finished || duel.active !== 'player') return;
    if (targeting) {
      if (lockTargets(duel).includes(pos)) this.playBonusFor('player', 'lock', pos);
      return;
    }
    if (canFlip(duel, pos)) this.applyFlip(pos);
  }

  renderCard(card, pos) {
    const { hint, peek, echo, targeting, duel } = this.state;
    const peeked = peek && peek.positions.includes(pos);
    const echoed = echo && echo.positions.includes(pos) && !card.faceUp && card.claimedBy === null;
    const shown = card.faceUp || card.claimedBy !== null || peeked;
    const xray = !shown && this.state.revealAll; // testing aid: player-only, the AI is unaffected
    const inHint = hint && hint.positions.includes(pos);
    let className = 'vat-card';
    if (shown) className += ` shown type-${card.type} tier-${card.tier}`;
    if (xray) className += ` xray type-${card.type} tier-${card.tier}`;
    if (card.claimedBy) className += ` claimed claimed-${card.claimedBy}`;
    if (peeked && !card.faceUp) className += ' peeked';
    if (echoed) className += ' echo';
    if (card.lockedBy) className += ` locked locked-${card.lockedBy}`;
    if (inHint) className += ` hint hint-${hint.type} hint-tier-${hint.tier}`;
    if (targeting && lockTargets(duel).includes(pos)) className += ' targetable';
    if (!shown && duel.active === 'player') className += ' clickable';
    return (
      <div key={pos} className={className} onClick={() => this.handleClick(pos)}>
        {card.lockedBy && <span className="vat-lock" title="Locked">{'\u{1F512}'}</span>}
        {(shown || xray) && (
          <div className="vat-card-face">
            <span className="vat-card-symbol">{TYPE_META[card.type].symbol}</span>
            <span className="vat-card-pips">{pips(card.tier)}</span>
            <span className={`vat-card-owner owner-${card.ownerId}`}>
              {card.ownerId === 'player' ? 'yours' : 'theirs'}
            </span>
          </div>
        )}
      </div>
    );
  }

  renderSide(side, label) {
    const { duel } = this.state;
    const active = duel.active === side && !this.state.finished;
    return (
      <div className={`vat-side ${active ? 'active' : ''} side-${side}`}>
        <div className="vat-side-label">{label}</div>
        <div className="vat-side-score">{duel.scores[side]}</div>
        <ResonanceBadge lastType={duel.resonance[side]} />
        <AffinityBadge affinity={duel.affinity[side]} />
      </div>
    );
  }

  render() {
    const { run } = this.props;
    const { duel, log, finished, targeting } = this.state;
    const outcome = duelOutcome(duel);
    const myTurn = duel.active === 'player' && !finished;
    let status = duel.active === 'player' ? 'Your turn' : 'Opponent is thinking...';
    if (finished) {
      status = outcome === 'player' ? 'You win!' : outcome === 'opponent' ? 'You lose.' : 'Draw.';
    }
    return (
      <div className="vat-duel-layout">
        <SidePanel log={log} run={run} />
        <div className="vat-duel">
          <div className="vat-scorebar">
            {this.renderSide('player', 'You')}
            <div className="vat-status">
              <div className="vat-status-main">{status}</div>
              {duel.doubleDown && <div className="vat-dd">Double Down active</div>}
              {targeting && <div className="vat-dd">Choose a face-down card to lock</div>}
              <div className="small vat-muted">
                vs {run.opponent.name} (L{run.opponent.level}){run.wakeStage ? ` - Wake ${run.wakeStage}` : ''}
              </div>
              {myTurn && canHold(duel) && (
                <button className="btn btn-sm btn-outline-light mt-1" onClick={() => this.applyHold('player')}>
                  End turn (hold)
                </button>
              )}
            </div>
            {this.renderSide('opponent', 'Them')}
          </div>

          {this.state.shuffling && <div className="vat-shuffle-banner">Defrag! The board was reshuffled.</div>}
          <div className={`vat-grid ${this.state.shuffling ? 'shuffling' : ''} ${targeting ? 'targeting' : ''}`}
            style={{ gridTemplateColumns: `repeat(${duel.cols}, 1fr)` }}>
            {duel.cards.map((card, pos) => this.renderCard(card, pos))}
          </div>

          <div className="vat-hand">
            {duel.hands.player.map((id) => (
              <BonusChip key={id} id={id} selected={id === 'lock' && targeting}
                status={cooldownText(id, duel.cooldowns.player[id])}
                disabled={finished || !canPlayBonus(duel, 'player', id)}
                onClick={() => this.clickBonus(id)} />
            ))}
            <div className="vat-muted small align-self-center">
              Opponent holds {duel.hands.opponent.length} bonus card{duel.hands.opponent.length === 1 ? '' : 's'}
            </div>
          </div>

          <div className="small vat-muted mt-2">
            Scoring: your card = 2 x tier, their card = 1 x tier. Resonance: the next type in the cycle
            {' '}<span role="img" aria-label="water, fire, air, electric, water">{'💧→🔥→🌀→⚡→💧'}</span> scores a bonus, the one before a penalty. Only your own card, flipped first, shows a clue.
          </div>
          <label className="vat-test-toggle small">
            <input type="checkbox" checked={this.state.revealAll} onChange={this.toggleRevealAll} />
            {' '}Reveal cards (testing: only you see them, the AI plays normally)
          </label>
        </div>
      </div>
    );
  }
}
