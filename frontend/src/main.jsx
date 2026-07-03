import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/erp-forms.css'
import './styles/classic-erp.css'
import './styles/admin-theme.css'
import { initNetworkListeners } from './utils/networkStatus'
import App from './App.jsx'

initNetworkListeners()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('Service worker registration failed:', err);
    });
  });
}
