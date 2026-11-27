import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // IPv4 loopback so both http://localhost and http://127.0.0.1 work. The two are separate
  // origins, which lets a shopper and an operator stay signed in side by side while testing.
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  build: {
    chunkSizeWarningLimit: 700,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'firebase', test: /node_modules[\\/](@firebase|firebase|idb)[\\/]/ },
            { name: 'vendor', test: /node_modules[\\/](react|react-dom|react-router|scheduler|zod)[\\/]/ },
          ],
        },
      },
    },
  },
});
