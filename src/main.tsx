import React from 'react';
import { createRoot } from 'react-dom/client';
import MasterGate from './MasterGate';
import './styles.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found');
}

createRoot(rootElement).render(
  <React.StrictMode>
    <MasterGate />
  </React.StrictMode>,
);
