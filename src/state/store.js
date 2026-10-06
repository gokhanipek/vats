import { createStore, combineReducers } from 'redux';
import vatReducer from './vatReducer';

// No persistence: a page reload starts a new run. Components read state.vatReducer.
export const store = createStore(combineReducers({ vatReducer }));
