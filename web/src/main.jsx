import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider, SocketProvider, ThemeProvider, ToastProvider } from './lib/context';
import { installMockApi } from './demo/mockApi';
import './styles/tokens.css';
import './styles/app.css';

// Bản demo tĩnh (GitHub Pages) không có backend: chặn toàn bộ `/api/*`
// và trả lời bằng dữ liệu trong bộ nhớ trước khi React khởi động.
const demoMode = import.meta.env.VITE_DEMO_MODE === '1';
if (demoMode) installMockApi();

const Router = demoMode ? HashRouter : BrowserRouter;

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Router>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <SocketProvider>
              <App />
            </SocketProvider>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </Router>
  </React.StrictMode>,
);
