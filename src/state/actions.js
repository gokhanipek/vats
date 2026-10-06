// Action types and creators for the vat run. The reducer imports them as Actions.*.
export const VAT_NEW_RUN = 'VAT_NEW_RUN'
export const VAT_CONFIRM_SPAWN = 'VAT_CONFIRM_SPAWN'
export const VAT_CHOOSE_SIGNAL = 'VAT_CHOOSE_SIGNAL'
export const VAT_CONFIRM_LOADOUT = 'VAT_CONFIRM_LOADOUT'
export const VAT_START_WAKE = 'VAT_START_WAKE'
export const VAT_RECORD_DUEL = 'VAT_RECORD_DUEL'
export const VAT_STEAL = 'VAT_STEAL'
export const VAT_CONTINUE = 'VAT_CONTINUE'
export const VAT_MERGE = 'VAT_MERGE'
export const VAT_SET_HAND = 'VAT_SET_HAND'
export const VAT_BUY_BONUS = 'VAT_BUY_BONUS'

// Start a new vat game from a seed (all run randomness derives from it).
export function vatNewRunAction(seed){
  return { type: VAT_NEW_RUN, seed }
}

// Take over the offered Sleeper: indexes of the picked fragments and bonus cards.
export function vatConfirmSpawnAction(fragmentIndexes, bonusIndexes){
  return { type: VAT_CONFIRM_SPAWN, fragmentIndexes, bonusIndexes }
}

// Travel to a Sleeper on the map and duel it, by its npc id.
export function vatChooseSignalAction(npcId){
  return { type: VAT_CHOOSE_SIGNAL, npcId }
}

// Bring these fragments to the duel: indexes into the run's fragments.
export function vatConfirmLoadoutAction(fragmentIndexes){
  return { type: VAT_CONFIRM_LOADOUT, fragmentIndexes }
}

// Begin the Wake Attempt (Lucidity 6 only).
export function vatStartWakeAction(){
  return { type: VAT_START_WAKE }
}

// Record a finished duel: { outcome, scores, supplied }.
export function vatRecordDuelAction(duel){
  return { type: VAT_RECORD_DUEL, duel }
}

// Steal after a win. kind is 'fragment' | 'bonus' | 'anchor'; a bonus card goes to storage when the hand is full.
export function vatStealAction(kind, index){
  return { type: VAT_STEAL, kind, index }
}

// Leave the result screen (respawn after a death, next wake stage, or back to the map).
export function vatContinueAction(){
  return { type: VAT_CONTINUE }
}

// Merge 2 equal fragments of { type, tier } into the next tier.
export function vatMergeAction(type, tier){
  return { type: VAT_MERGE, fragmentType: type, tier }
}

// Choose the hand: the bonus card ids to take into duels (the rest stay in storage).
export function vatSetHandAction(ids){
  return { type: VAT_SET_HAND, ids }
}

// Buy a bonus card from the shop with points, by id.
export function vatBuyBonusAction(id){
  return { type: VAT_BUY_BONUS, id }
}
