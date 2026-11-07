import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './global.css';
import { installMockFetch, showDemoBadge } from './demo/mockFetch';

if (import.meta.env.VITE_DEMO === 'true') {
  installMockFetch();
  showDemoBadge();
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
