import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
// BrowserRouter o'rniga HashRouter chaqiramiz
import { HashRouter } from 'react-router-dom';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    {/* BrowserRouter o'rniga HashRouter ishlatamiz */}
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>
);