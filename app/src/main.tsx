import React from 'react';
import ReactDOM from 'react-dom/client';
import { Buffer } from 'buffer';
import App from './App';
import './index.css';

// Polyfill Buffer for Solana Web3.js
// @ts-expect-error - Adding Buffer to global scope for Solana Web3.js compatibility
window.Buffer = Buffer;
// @ts-expect-error - Adding Buffer to globalThis for Solana Web3.js compatibility
globalThis.Buffer = Buffer;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
