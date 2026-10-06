import React from 'react';
import { connect } from 'react-redux';
import {
  vatNewRunAction, vatConfirmSpawnAction, vatChooseSignalAction, vatConfirmLoadoutAction, vatStartWakeAction,
  vatRecordDuelAction, vatStealAction, vatContinueAction, vatMergeAction, vatSetHandAction, vatBuyBonusAction,
} from './state/actions';
import { CAMPAIGN_DAYS, MAX_LUCIDITY } from './core/tuning';
import DuelScreen from './duel-screen';
import { SpawnScreen, LoadoutScreen, ResultScreen, EndScreen } from './screens';
import MapScreen from './map-screen';

import 'bootstrap/dist/css/bootstrap.css';
import './vat.css';

function newSeed() {
  return Math.floor(Math.random() * 4294967296);
}

// The vat game MVP: one container that switches screens on run.screen.
class VatGame extends React.Component {
  componentDidMount() {
    document.body.style.backgroundImage = '';
    document.body.classList.add('vat-body');
    if (!this.props.run) this.props.newRun(newSeed());
  }

  componentWillUnmount() {
    document.body.classList.remove('vat-body');
  }

  renderScreen() {
    const { run } = this.props;
    switch (run.screen) {
      case 'spawn':
        return <SpawnScreen key={`spawn-${run.life}`} run={run} onConfirm={this.props.confirmSpawn} />;
      case 'map':
        return (
          <MapScreen run={run} onChoose={this.props.chooseSignal}
            onMerge={this.props.merge} onWake={this.props.startWake}
            onSetHand={this.props.setHand} onBuy={this.props.buyBonus} />
        );
      case 'loadout':
        return <LoadoutScreen key={run.duelSeed} run={run} onConfirm={this.props.confirmLoadout} />;
      case 'duel':
        return <DuelScreen key={run.duelSeed} run={run} onDone={this.props.recordDuel} />;
      case 'result':
        return (
          <ResultScreen key={`result-${run.history.length}`} run={run} onSteal={this.props.steal}
            onContinue={this.props.continueRun} onMerge={this.props.merge} />
        );
      case 'end':
        return <EndScreen run={run} onNewGame={() => this.props.newRun(newSeed())} />;
      default:
        return null;
    }
  }

  render() {
    const { run } = this.props;
    if (!run) return null;
    const daysLeft = CAMPAIGN_DAYS - run.day + 1;
    return (
      <div className={`vat-root container ${run.screen === 'duel' ? 'wide' : ''}`}>
        <div className="vat-header">
          <span className="vat-title">VATS</span>
          <span>Day <strong>{Math.min(run.day, CAMPAIGN_DAYS)}</strong>/{CAMPAIGN_DAYS}
            {daysLeft <= 5 && daysLeft > 0 && <span className="vat-warn"> ({daysLeft} left)</span>}
          </span>
          <span>Lucidity <strong>{run.lucidity}</strong>/{MAX_LUCIDITY}</span>
          <span>Points <strong>{run.points}</strong></span>
          <span>Life <strong>#{run.life}</strong></span>
        </div>
        {this.renderScreen()}
      </div>
    );
  }
}

const mapStateToProps = (state) => ({
  run: state.vatReducer,
});

const mapDispatchToProps = (dispatch) => ({
  newRun: (seed) => dispatch(vatNewRunAction(seed)),
  confirmSpawn: (fragmentIndexes, bonusIndexes) => dispatch(vatConfirmSpawnAction(fragmentIndexes, bonusIndexes)),
  chooseSignal: (npcId) => dispatch(vatChooseSignalAction(npcId)),
  confirmLoadout: (fragmentIndexes) => dispatch(vatConfirmLoadoutAction(fragmentIndexes)),
  startWake: () => dispatch(vatStartWakeAction()),
  recordDuel: (duel) => dispatch(vatRecordDuelAction(duel)),
  steal: (kind, index) => dispatch(vatStealAction(kind, index)),
  continueRun: () => dispatch(vatContinueAction()),
  merge: (type, tier) => dispatch(vatMergeAction(type, tier)),
  setHand: (ids) => dispatch(vatSetHandAction(ids)),
  buyBonus: (id) => dispatch(vatBuyBonusAction(id)),
});

export default connect(mapStateToProps, mapDispatchToProps)(VatGame);
