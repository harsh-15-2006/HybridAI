import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Initialises Firebase and App Check before anything else uses them.
import './firebase/app.ts';
import { App } from './app/App.tsx';
import { flags, loadRemoteFlags } from './config/remote.ts';
import { hydrateLocal } from './data/local.ts';
import './design/styles.css';

async function start() {
  await Promise.race([loadRemoteFlags(), new Promise((resolve) => setTimeout(resolve, 2500))]);
  await hydrateLocal(flags.defaultPrivacySetting);
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void start();

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
    // Fetch the lazy pages once so they are cached and open offline.
    await Promise.allSettled([
      import('./features/orders/Orders.tsx'),
      import('./features/orders/Order.tsx'),
      import('./features/product/Ask.tsx'),
      import('./features/checkout/Checkout.tsx'),
    ]);
  });
}
