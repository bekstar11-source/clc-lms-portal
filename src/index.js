import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
// 🔥 BrowserRouter o'rniga HashRouter ishlatamiz
import { HashRouter } from 'react-router-dom';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,   // 5 daqiqa - qayta fetch bo'lmaydi
      gcTime: 30 * 60 * 1000,     // 30 daqiqa - cache xotirada saqlanadi
      refetchOnWindowFocus: false,
    },
  },
});

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <App />
      </HashRouter>
    </QueryClientProvider>
  </React.StrictMode>
);