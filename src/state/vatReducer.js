import * as Actions from './actions'
import {
  newRun, confirmSpawn, chooseSignal, confirmLoadout, setHand, buyBonus, startWake, recordDuel, steal, continueRun, mergeInRun,
} from '../core/run'

// The vat game run (see vat/core/run.js), or null before the first run starts.
// Every rule lives in run.js; an invalid action returns the unchanged state.
export default function vatReducer(state = null, action) {
  if (action.type === Actions.VAT_NEW_RUN) {
    return newRun(action.seed)
  }
  if (state === null) {
    return state
  }
  switch (action.type) {
    case Actions.VAT_CONFIRM_SPAWN:
      return confirmSpawn(state, action.fragmentIndexes, action.bonusIndexes)
    case Actions.VAT_CHOOSE_SIGNAL:
      return chooseSignal(state, action.npcId)
    case Actions.VAT_CONFIRM_LOADOUT:
      return confirmLoadout(state, action.fragmentIndexes)
    case Actions.VAT_START_WAKE:
      return startWake(state)
    case Actions.VAT_RECORD_DUEL:
      return recordDuel(state, action.duel)
    case Actions.VAT_STEAL:
      return steal(state, action.kind, action.index)
    case Actions.VAT_CONTINUE:
      return continueRun(state)
    case Actions.VAT_SET_HAND:
      return setHand(state, action.ids)
    case Actions.VAT_BUY_BONUS:
      return buyBonus(state, action.id)
    case Actions.VAT_MERGE:
      return mergeInRun(state, action.fragmentType, action.tier)
    default:
      return state
  }
}
