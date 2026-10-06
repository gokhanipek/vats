import React from 'react';
import { BONUS_CARDS, ANCHORS, RESONANCE_CYCLE } from './core/tuning';
import { mergeOptions } from './core/fragments';
import { collectionSummary } from './core/run';

// Symbol + label per type. Colour comes from CSS (.type-<type>.tier-<n>);
// the symbol and pips make cards readable without colour.
export const TYPE_META = {
  water: { label: 'Water', symbol: '\u{1F4A7}' },
  fire: { label: 'Fire', symbol: '\u{1F525}' },
  air: { label: 'Air', symbol: '\u{1F300}' },
  electric: { label: 'Electric', symbol: '⚡' },
};

export function pips(tier) {
  return '●'.repeat(tier);
}

export function fragmentName(f) {
  return `${TYPE_META[f.type].label} ${pips(f.tier)}`;
}

// A small face-up fragment chip, used in lists and pickers.
export function FragmentChip({ fragment, count, selected, onClick, note }) {
  const className = `vat-chip type-${fragment.type} tier-${fragment.tier}`
    + (selected ? ' selected' : '') + (onClick ? ' clickable' : '');
  return (
    <div className={className} onClick={onClick} title={fragmentName(fragment)}>
      <span className="vat-chip-symbol">{TYPE_META[fragment.type].symbol}</span>
      <span className="vat-chip-pips">{pips(fragment.tier)}</span>
      {count > 1 && <span className="vat-chip-count">x{count}</span>}
      {note && <span className="vat-chip-note">{note}</span>}
    </div>
  );
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** How a bonus card recharges, in words. */
export function rechargeText(id) {
  const def = BONUS_CARDS[id];
  if (def.recharge === 'type') return `Recharge: claim ${plural(def.cooldown, `${TYPE_META[def.type].label} pair`)}`;
  if (def.recharge === 'own') return `Recharge: claim ${plural(def.cooldown, 'pair')} of your own cards`;
  return `Recharge: ${plural(def.cooldown, 'turn')}`;
}

/** A bonus card's cooldown state in a duel: 'ready' or what it still needs. */
export function cooldownText(id, left) {
  if (!left) return 'ready';
  const def = BONUS_CARDS[id];
  if (def.recharge === 'type') return `needs ${plural(left, `${TYPE_META[def.type].label} pair`)}`;
  if (def.recharge === 'own') return `needs ${plural(left, 'own pair')}`;
  return `${plural(left, 'turn')} left`;
}

// A bonus card as a chip. `status` (in a duel) shows its cooldown; `price` (in the shop) its cost.
export function BonusChip({ id, selected, onClick, disabled, status, price, extra }) {
  const def = BONUS_CARDS[id];
  const className = 'vat-bonus' + (selected ? ' selected' : '') + (onClick && !disabled ? ' clickable' : '')
    + (disabled ? ' disabled' : '');
  return (
    <div className={className} onClick={disabled ? undefined : onClick} title={def.text}>
      <div className="vat-bonus-head">
        <strong>{def.type ? `${TYPE_META[def.type].symbol} ` : ''}{def.label}</strong>
        {status && <span className={`vat-bonus-cost ${status === 'ready' ? 'ready' : ''}`}>{status}</span>}
        {price !== undefined && <span className="vat-bonus-cost">{price} pts</span>}
      </div>
      <div className="vat-bonus-text">{def.text}</div>
      <div className="vat-bonus-recharge">{rechargeText(id)}</div>
      {extra}
    </div>
  );
}

// A side's resonance: its last claimed type, which type comes next (bonus) and before (penalty).
export function ResonanceBadge({ lastType }) {
  if (!lastType) return <div className="vat-resonance small vat-muted">no resonance yet</div>;
  const i = RESONANCE_CYCLE.indexOf(lastType);
  const n = RESONANCE_CYCLE.length;
  const next = RESONANCE_CYCLE[(i + 1) % n];
  const prev = RESONANCE_CYCLE[(i + n - 1) % n];
  return (
    <div className="vat-resonance small" title="Your last claimed type. The next type in the cycle scores a bonus, the one before a penalty.">
      {TYPE_META[lastType].symbol} <span className="up">{'▲'}{TYPE_META[next].symbol}</span>
      {' '}<span className="down">{'▼'}{TYPE_META[prev].symbol}</span>
    </div>
  );
}

// Two affinity types: claiming a pair of either recharges every bonus card.
export function AffinityBadge({ affinity }) {
  if (!affinity || affinity.length === 0) return null;
  return (
    <div className="vat-affinity small" title="Affinity: claiming a pair of these types recharges every bonus card">
      {affinity.map((t) => TYPE_META[t].symbol).join(' ')}
    </div>
  );
}

// A rare anchor card: no slot, raises the chance to survive a lost duel.
export function AnchorChip({ id, selected, onClick }) {
  const def = ANCHORS[id];
  const className = 'vat-bonus vat-anchor' + (selected ? ' selected' : '') + (onClick ? ' clickable' : '');
  return (
    <div className={className} onClick={onClick} title={def.text}>
      <div className="vat-bonus-head">
        <strong>{'⚓'} {def.label}</strong>
        <span className="vat-bonus-cost">rare</span>
      </div>
      <div className="vat-bonus-text">{def.text}</div>
    </div>
  );
}

// The player's fragments, grouped, with merge buttons when `onMerge` is given.
// `survival` is the player's chance to survive a lost duel (from anchors).
// `bonus` is every owned bonus card; those not in `hand` are in storage. With `onSetHand`,
// clicking a card moves it between hand and storage (up to `slots` in the hand).
export function Collection({
  fragments, bonus = [], hand, slots = 0, affinity, anchors = [], survival = 0, onMerge, onSetHand,
}) {
  const summary = collectionSummary(fragments);
  const storage = hand ? bonus.filter((id) => !hand.includes(id)) : [];
  const merges = onMerge ? mergeOptions(fragments) : [];
  return (
    <div className="vat-panel">
      <h6>Your fragments ({fragments.length}): each one puts a pair on the table</h6>
      <div className="vat-chips">
        {summary.map((s) => (
          <FragmentChip key={`${s.type}${s.tier}`} fragment={s} count={s.count} />
        ))}
      </div>
      {merges.length > 0 && (
        <div className="mt-2">
          {merges.map((m) => (
            <button key={`${m.type}${m.tier}`} className="btn btn-sm btn-outline-info mr-2 mb-1"
              onClick={() => onMerge(m.type, m.tier)}>
              Merge 2x {fragmentName(m)} {'→'} {pips(m.tier + 1)}
            </button>
          ))}
          <div className="small vat-muted">Merging makes a stronger card (better points and hints) but you supply fewer pairs.</div>
        </div>
      )}
      {affinity && affinity.length > 0 && (
        <div className="small mt-2">
          Affinity: <AffinityBadge affinity={affinity} /> (claiming these types recharges all your bonus cards)
        </div>
      )}
      {hand && (
        <>
          <h6 className="mt-3">Hand ({hand.length}/{slots}): the bonus cards you take into duels</h6>
          <div className="vat-chips">
            {hand.length === 0 && <span className="vat-muted small">empty</span>}
            {hand.map((id) => (
              <BonusChip key={id} id={id}
                onClick={onSetHand ? () => onSetHand(hand.filter((h) => h !== id)) : undefined}
                extra={onSetHand ? <div className="vat-bonus-move">to storage {'↓'}</div> : null} />
            ))}
          </div>
          <h6 className="mt-3">Storage ({storage.length})</h6>
          <div className="vat-chips">
            {storage.length === 0 && <span className="vat-muted small">empty</span>}
            {storage.map((id) => {
              const room = hand.length < slots;
              return (
                <BonusChip key={id} id={id} disabled={!onSetHand || !room}
                  onClick={onSetHand && room ? () => onSetHand([...hand, id]) : undefined}
                  extra={onSetHand ? <div className="vat-bonus-move">{room ? `to hand ${'↑'}` : 'hand is full'}</div> : null} />
              );
            })}
          </div>
        </>
      )}
      {anchors.length > 0 && (
        <>
          <h6 className="mt-3">Anchors: {Math.round(survival * 100)}% chance to survive a lost duel</h6>
          <div className="vat-chips">
            {anchors.map((id, i) => <AnchorChip key={i} id={id} />)}
          </div>
        </>
      )}
    </div>
  );
}
