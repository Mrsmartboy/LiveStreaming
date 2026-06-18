import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',       // Listen on all interfaces
    port: 5173,
    strictPort: true,
    allowedHosts: true,    // Allow ANY host: LAN IPs, ngrok tunnels, etc.
    proxy: {
      '/api': {
        target: 'http://backend:5000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://backend:5000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
