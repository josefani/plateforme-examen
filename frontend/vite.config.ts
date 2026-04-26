import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: [
      'plateforme-examen.duckdns.org',
      '.duckdns.org', // Autorise tous les sous-domaines duckdns.org
      'localhost'
    ],
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
  },
});
