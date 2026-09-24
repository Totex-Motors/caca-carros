import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';

import './styles/global.css';
import './styles/dossie.css';
import './styles/dark.css';
import { aplicarTema, temaAtual } from './services/theme';

aplicarTema(temaAtual());

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
