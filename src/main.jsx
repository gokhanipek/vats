import React from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { store } from './state/store';
import VatGame from './vat-game';

createRoot(document.getElementById('root')).render(
  <Provider store={store}>
    <VatGame />
  </Provider>
);
